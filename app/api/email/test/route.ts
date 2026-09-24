/**
 * GET /api/email/test?to=you@example.com
 *
 * Operator-only setup helper. Sends the real guest email — same template,
 * subject, and attachment handling — using a frame image as stand-in artwork.
 *
 * This exists so Resend can be verified independently of Canva. The two halves
 * of the pipeline fail for completely different reasons, and testing them
 * separately turns one confusing failure into two obvious ones.
 *
 * In production this route requires `?secret=<CANVA_SETUP_SECRET>`.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { checkSetupAccess } from "@/lib/canva/oauth-setup";
import { EmailDeliveryError, sendPhotoEmail } from "@/lib/email";
import { MissingEnvError, env } from "@/lib/env";
import { MAX_PHOTOS } from "@/config/booth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function GET(request: Request) {
  const access = checkSetupAccess(request);
  if (!access.ok) {
    return new NextResponse(access.message, { status: access.status });
  }

  const to = new URL(request.url).searchParams.get("to")?.trim() ?? "";
  if (!EMAIL_PATTERN.test(to)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Add a ?to= address, e.g. /api/email/test?to=you@example.com",
      },
      { status: 400 },
    );
  }

  try {
    // Stand-ins for the Canva exports, so the attachment path is exercised with
    // realistically sized files rather than a few dummy bytes. Pass
    // ?count=2 (up to MAX_PHOTOS) to test the multi-attachment email.
    const requested = Number(
      new URL(request.url).searchParams.get("count") ?? "1",
    );
    const count = Math.min(
      Math.max(Number.isFinite(requested) ? requested : 1, 1),
      MAX_PHOTOS,
    );

    const photos = [];
    for (let index = 0; index < count; index++) {
      // Cycle through the available frame artwork so each attachment differs.
      const name = `frame-${(index % 5) + 1}.png`;
      photos.push({
        bytes: await readFile(
          path.join(process.cwd(), "public", "frames", name),
        ),
        fileName: `butterfly-photo-test-${index + 1}.png`,
        contentType: "image/png",
        downloadUrl: `${env.appUrl}/frames/${name}`,
      });
    }

    const messageId = await sendPhotoEmail({ to, photos });

    return NextResponse.json({
      ok: true,
      messageId,
      to,
      from: env.emailFrom,
      attachments: photos.map((p) => ({
        fileName: p.fileName,
        bytes: p.bytes.length,
      })),
      note:
        "Delivered to Resend. If it doesn't arrive, check Resend's dashboard " +
        "logs. On the shared onboarding@resend.dev sender, Resend only " +
        "delivers to the address on your own Resend account.",
    });
  } catch (error) {
    if (error instanceof MissingEnvError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 503 },
      );
    }
    if (error instanceof EmailDeliveryError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: error.code,
          from: env.emailFrom,
          hint:
            "A 403 or 'domain is not verified' means EMAIL_FROM isn't on a " +
            "domain you've verified in Resend. Either verify the domain, or " +
            "use onboarding@resend.dev and send only to your own account email.",
        },
        { status: 502 },
      );
    }
    console.error("[email/test] Failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
