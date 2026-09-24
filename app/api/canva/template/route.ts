/**
 * GET /api/canva/template
 *
 * Operator-only setup helper. Walks every event in config/events.ts, lists each
 * frame's autofillable field names, and flags whether the configured image field
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
import { eventFrames, getAllEvents } from "@/config/events";

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

interface EventReport {
  slug: string;
  name: string;
  ok: boolean;
  frameCount: number;
  /** Set when the event has no frame pointing at Canva yet. */
  pending?: boolean;
  frames: FrameReport[];
}

export async function GET(request: Request) {
  const access = checkSetupAccess(request);
  if (!access.ok) {
    return new NextResponse(access.message, { status: access.status });
  }

  const events = getAllEvents();
  const reports: EventReport[] = [];

  for (const event of events) {
    const frames = eventFrames(event);

    // An event with no wired frames is expected during setup, not an error.
    if (frames.length === 0) {
      reports.push({
        slug: event.slug,
        name: event.name,
        ok: true,
        pending: true,
        frameCount: 0,
        frames: [],
      });
      continue;
    }

    const frameReports: FrameReport[] = [];

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

        frameReports.push({
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
              : "This design has no image data fields. Select the frame in " +
                "Canva, open Apps > Data autofill, and give it a name.",
        });
      } catch (error) {
        if (error instanceof MissingEnvError) {
          return NextResponse.json(
            { ok: false, error: error.message },
            { status: 503 },
          );
        }

        const isApiError = error instanceof CanvaApiError;
        frameReports.push({
          frameId: frame.id,
          label: frame.label,
          ok: false,
          imageField,
          error: error instanceof Error ? error.message : String(error),
          hint:
            isApiError && error.status === 404
              ? "Check the ID. A brand template ID comes from " +
                "/brand/brand-templates/<ID>; a design ID comes from " +
                "/design/<ID>/edit. Re-creating a design in Canva mints a new ID."
              : isApiError && error.status === 403
                ? "Your Canva account cannot access this design, or a " +
                  "brandtemplate scope is missing. Enable it and re-run " +
                  "/api/canva/auth."
                : undefined,
        });
        if (!isApiError) {
          console.error(
            `[canva/template] ${event.slug}/${frame.id} failed:`,
            error,
          );
        }
      }
    }

    reports.push({
      slug: event.slug,
      name: event.name,
      ok: frameReports.every((report) => report.ok),
      frameCount: frameReports.length,
      frames: frameReports,
    });
  }

  const allOk = reports.every((report) => report.ok);
  const liveCount = reports.filter((r) => !r.pending).length;

  return NextResponse.json(
    {
      ok: allOk,
      eventCount: reports.length,
      liveEventCount: liveCount,
      summary: allOk
        ? liveCount === reports.length
          ? "Every frame on every event is wired up correctly."
          : "Every wired frame is correct. Some events have no frames yet."
        : "Some frames need attention. See the hint on each entry below.",
      events: reports,
    },
    { status: allOk ? 200 : 207 },
  );
}
