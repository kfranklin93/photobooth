/**
 * GET /api/canva/template
 *
 * Operator-only setup helper. Walks every frame in config/frames.ts, lists its
 * autofillable field names, and flags whether the configured image field
 * actually matches one of them.
 *
 * This exists because a wrong field name fails silently: Canva ignores data for
 * fields it doesn't recognise, so the guest gets an empty frame instead of an
 * error. Check this once during setup and that whole class of bug disappears.
 *
 * In production this route requires `?secret=<CANVA_SETUP_SECRET>`.
 */

import { NextResponse } from "next/server";

import { frameImageField, getTemplateDataset } from "@/lib/canva/pipeline";
import { CanvaApiError } from "@/lib/canva/errors";
import { checkSetupAccess } from "@/lib/canva/oauth-setup";
import { MissingEnvError } from "@/lib/env";
import { getFrames } from "@/config/frames";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FrameReport {
  frameId: string;
  label: string;
  ok: boolean;
  source?: "design" | "brand_template";
  canvaId?: string;
  imageField: string;
  imageFieldMatches?: boolean;
  fields?: { name: string; type: string }[];
  hint?: string;
  error?: string;
}

export async function GET(request: Request) {
  const access = checkSetupAccess(request);
  if (!access.ok) {
    return new NextResponse(access.message, { status: access.status });
  }

  const frames = getFrames();
  if (frames.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No frames configured. Add entries to config/frames.ts, or set " +
          "CANVA_TEMPLATE_ID / CANVA_SOURCE_DESIGN_ID for a single-frame setup.",
      },
      { status: 503 },
    );
  }

  const reports: FrameReport[] = [];

  for (const frame of frames) {
    const imageField = frameImageField(frame);
    try {
      const { source, id, dataset } = await getTemplateDataset(
        frame,
        request.signal,
      );

      const fields = Object.entries(dataset).map(([name, field]) => ({
        name,
        type: field.type,
      }));
      const imageFields = fields.filter((field) => field.type === "image");
      const matches = fields.some((field) => field.name === imageField);

      reports.push({
        frameId: frame.id,
        label: frame.label,
        ok: matches,
        source,
        canvaId: id,
        imageField,
        imageFieldMatches: matches,
        fields,
        hint: matches
          ? undefined
          : imageFields.length > 0
            ? `Image field "${imageField}" not found. Use one of: ` +
              imageFields.map((f) => f.name).join(", ")
            : "This design has no image data fields. Select the frame in Canva, " +
              "open Apps > Data autofill, and give it a name.",
      });
    } catch (error) {
      if (error instanceof MissingEnvError) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 503 },
        );
      }

      const isApiError = error instanceof CanvaApiError;
      reports.push({
        frameId: frame.id,
        label: frame.label,
        ok: false,
        imageField,
        error: error instanceof Error ? error.message : String(error),
        hint:
          isApiError && error.status === 404
            ? "Check the ID. A brand template ID comes from " +
              "/brand/brand-templates/<ID>; a design ID comes from /design/<ID>/edit."
            : isApiError && error.status === 403
              ? "Your Canva account cannot access this design, or a brandtemplate " +
                "scope is missing. Enable it and re-run /api/canva/auth."
              : undefined,
      });
      if (!isApiError) {
        console.error(`[canva/template] Frame "${frame.id}" failed:`, error);
      }
    }
  }

  const allOk = reports.every((report) => report.ok);
  return NextResponse.json(
    {
      ok: allOk,
      frameCount: reports.length,
      summary: allOk
        ? "Every frame is wired up correctly."
        : "Some frames need attention. See the hint on each entry below.",
      frames: reports,
    },
    { status: allOk ? 200 : 207 },
  );
}
