/**
 * POST /api/process-photo
 *
 * Accepts a photo + guest email from the kiosk, runs the Canva Connect
 * workflow (upload → autofill → export), then emails the finished image.
 *
 * Expects `multipart/form-data` with:
 *   - photo: the captured image file
 *   - email: the guest's email address
 */

import { NextResponse } from "next/server";

import { renderPhotoWithCanva } from "@/lib/canva/pipeline";
import {
  CanvaApiError,
  CanvaJobError,
  CanvaJobTimeoutError,
} from "@/lib/canva/errors";
import { EmailDeliveryError, sendPhotoEmail } from "@/lib/email";
import { MissingEnvError, findMissingRuntimeEnv } from "@/lib/env";
import { findFrame, getFrames } from "@/config/frames";
import { MAX_PHOTOS } from "@/config/booth";

// Buffer, node:fs and the Canva SDK calls all need the Node.js runtime.
export const runtime = "nodejs";
// The full Canva round trip regularly takes 20-60s. Hosts cap this: Vercel
// Hobby allows 60s, Vercel Pro 300s, Netlify background functions 900s.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_PHOTO_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME_PREFIX = "image/";
/** Practical, permissive check — real validation is Resend's own. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface SuccessBody {
  ok: true;
  messageId: string;
  photoCount: number;
  designIds: string[];
  downloadUrls: string[];
  frameId: string;
}

interface ErrorBody {
  ok: false;
  /** Guest-facing copy, safe to render on the kiosk. */
  message: string;
  /** Operator-facing detail for debugging. */
  detail?: string;
}

function fail(message: string, status: number, detail?: string) {
  return NextResponse.json<ErrorBody>({ ok: false, message, detail }, { status });
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("heic") || mimeType.includes("heif")) return "heic";
  return "jpg";
}

export async function POST(request: Request) {
  // Fail fast with a clear operator message rather than a cryptic API error.
  const missing = findMissingRuntimeEnv();
  if (missing.length > 0) {
    console.error(`[process-photo] Missing env vars: ${missing.join(", ")}`);
    return fail(
      "The photo booth is not finished setting up. Please find the host.",
      503,
      `Missing environment variables: ${missing.join(", ")}`,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("We could not read that photo. Please try again.", 400,
      "Request body was not valid multipart/form-data.");
  }

  const email = String(form.get("email") ?? "").trim();
  // A guest may take up to MAX_PHOTOS, posted as repeated `photo` fields.
  const photos = form.getAll("photo").filter((v): v is File => v instanceof File);
  const requestedFrameId = String(form.get("frameId") ?? "").trim();

  // Resolve the frame first: without a valid one there's nothing to fill.
  const frames = getFrames();
  if (frames.length === 0) {
    console.error("[process-photo] No frames configured.");
    return fail(
      "The photo booth is not finished setting up. Please find the host.",
      503,
      "No frames configured. Add entries to config/frames.ts, or set " +
        "CANVA_TEMPLATE_ID / CANVA_SOURCE_DESIGN_ID for a single-frame setup.",
    );
  }

  // One configured frame means the kiosk skips the picker, so fall back to it.
  const frame =
    findFrame(requestedFrameId) ?? (frames.length === 1 ? frames[0] : undefined);
  if (!frame) {
    return fail("Please choose a frame and try again.", 400,
      `Unknown frameId ${JSON.stringify(requestedFrameId)}. ` +
        `Configured: ${frames.map((f) => f.id).join(", ")}`);
  }

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return fail("That email address does not look right. Please check it.", 400,
      "Email failed validation.");
  }

  const nonEmpty = photos.filter((p) => p.size > 0);
  if (nonEmpty.length === 0) {
    return fail("No photo came through. Please take another one.", 400,
      "No non-empty 'photo' fields in the request.");
  }

  if (nonEmpty.length > MAX_PHOTOS) {
    return fail(`Please send at most ${MAX_PHOTOS} photos.`, 400,
      `Received ${nonEmpty.length} photos; limit is ${MAX_PHOTOS}.`);
  }

  for (const [index, photo] of nonEmpty.entries()) {
    if (photo.size > MAX_PHOTO_BYTES) {
      return fail("That photo is a little too large. Please try again.", 413,
        `Photo ${index + 1} was ${photo.size} bytes; limit is ${MAX_PHOTO_BYTES}.`);
    }
    const mimeType = photo.type || "image/jpeg";
    if (!mimeType.startsWith(ALLOWED_MIME_PREFIX)) {
      return fail("That file is not an image. Please take a photo.", 415,
        `Photo ${index + 1} had unsupported content type: ${mimeType}`);
    }
  }

  const startedAt = Date.now();

  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");

    // Run the photos concurrently: each is an independent Canva round trip of
    // 20-60s, so three in sequence would push past the guest's patience and the
    // platform's function timeout. Canva's per-user limits (30 uploads and 20
    // exports per minute) leave plenty of headroom for MAX_PHOTOS at once.
    const rendered = await Promise.all(
      nonEmpty.map(async (photo, index) => {
        const mimeType = photo.type || "image/jpeg";
        return renderPhotoWithCanva({
          frame,
          photo: await photo.arrayBuffer(),
          fileName: `booth-${stamp}-${index + 1}.${extensionFor(mimeType)}`,
          designTitle: `Photo Booth ${frame.label} ${stamp} (${index + 1})`,
          signal: request.signal,
        });
      }),
    );

    const messageId = await sendPhotoEmail({
      to: email,
      photos: rendered.map((result, index) => ({
        bytes: result.imageBytes,
        fileName:
          rendered.length > 1
            ? `butterfly-photo-${index + 1}.jpg`
            : "butterfly-photo.jpg",
        contentType: "image/jpeg",
        downloadUrl: result.downloadUrls[0],
      })),
    });

    console.log(
      `[process-photo] Delivered ${rendered.length} photo(s) using frame ` +
        `"${frame.id}" in ${Date.now() - startedAt}ms (message ${messageId}): ` +
        rendered.map((r) => r.designId).join(", "),
    );

    return NextResponse.json<SuccessBody>({
      ok: true,
      messageId,
      photoCount: rendered.length,
      designIds: rendered.map((r) => r.designId),
      downloadUrls: rendered.map((r) => r.downloadUrls[0]),
      frameId: frame.id,
    });
  } catch (error) {
    console.error("[process-photo] Failed:", error);

    if (error instanceof MissingEnvError) {
      return fail(
        "The photo booth is not finished setting up. Please find the host.",
        503,
        error.message,
      );
    }

    if (error instanceof CanvaJobTimeoutError) {
      return fail(
        "The magic is taking longer than usual. Please try once more.",
        504,
        error.message,
      );
    }

    if (error instanceof CanvaApiError) {
      const guestMessage =
        error.status === 401 || error.status === 403
          ? "The photo booth lost its connection to Canva. Please find the host."
          : "Something went wrong adding the butterflies. Please try again.";
      return fail(guestMessage, 502, `${error.name}: ${error.message}`);
    }

    if (error instanceof CanvaJobError) {
      return fail(
        "Something went wrong adding the butterflies. Please try again.",
        502,
        `${error.name} (${error.jobKind}): ${error.message}`,
      );
    }

    if (error instanceof EmailDeliveryError) {
      return fail(
        "Your photo is ready but the email would not send. Please check the address.",
        502,
        `${error.name}: ${error.message}`,
      );
    }

    return fail("Something unexpected went wrong. Please try again.", 500,
      error instanceof Error ? error.message : String(error));
  }
}
