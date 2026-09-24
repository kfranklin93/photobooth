/**
 * The three-step Canva Connect workflow that turns a raw camera snapshot into
 * a finished, themed photo:
 *
 *   1. upload the photo to the Canva content library   → asset id
 *   2. autofill the brand template with that asset     → design id
 *   3. export the design as a JPG                      → download URL(s)
 *
 * Each step is an asynchronous Canva job, so each one posts and then polls.
 */

import { canvaFetch, pollCanvaJob, type CanvaJob } from "@/lib/canva/client";
import { CanvaJobError } from "@/lib/canva/errors";
import { env } from "@/lib/env";
import type { FrameOption } from "@/config/frames";

// --- Step 1: asset upload ------------------------------------------------

interface CanvaAsset {
  id: string;
  type: "image" | "video";
  name?: string;
}

interface AssetUploadJob extends CanvaJob {
  asset?: CanvaAsset;
}

/**
 * Uploads binary image data and returns the resulting `asset_id`.
 *
 * The endpoint is unusual: the body is raw bytes (`application/octet-stream`)
 * and the file name travels in the `Asset-Upload-Metadata` header, base64
 * encoded so that non-ASCII names survive the trip.
 */
export async function uploadAsset(
  photo: ArrayBuffer | Uint8Array,
  fileName: string,
  signal?: AbortSignal,
): Promise<string> {
  const metadata = JSON.stringify({
    name_base64: Buffer.from(fileName, "utf8").toString("base64"),
  });

  const created = await canvaFetch<{ job: AssetUploadJob }>("/asset-uploads", {
    method: "POST",
    binaryBody: photo,
    headers: { "Asset-Upload-Metadata": metadata },
    signal,
  });

  const job =
    created.job.status === "success"
      ? created.job
      : await pollCanvaJob<AssetUploadJob>(
          "upload",
          `/asset-uploads/${created.job.id}`,
          { initialDelayMs: 800, intervalMs: 2_000, timeoutMs: 90_000, signal },
        );

  if (!job.asset?.id) {
    throw new CanvaJobError(
      "Canva finished the upload but returned no asset id.",
      "upload",
    );
  }
  return job.asset.id;
}

// --- Step 2: brand template autofill ------------------------------------

interface DesignSummary {
  id: string;
  title?: string;
  url?: string;
  thumbnail?: { url: string; width: number; height: number };
}

interface AutofillJob extends CanvaJob {
  result?: {
    type: "create_design" | "update_design";
    design: DesignSummary;
  };
}

/** Resolves the autofill request body for whichever source a frame declares. */
function autofillSource(frame: FrameOption): Record<string, string> {
  if (frame.designId) {
    return { type: "create_from_design", design_id: frame.designId };
  }
  if (frame.brandTemplateId) {
    return {
      type: "create_from_brand_template",
      brand_template_id: frame.brandTemplateId,
    };
  }
  throw new CanvaJobError(
    `Frame "${frame.id}" has neither a designId nor a brandTemplateId. ` +
      `Fix its entry in config/frames.ts.`,
    "autofill",
  );
}

/** The image data field this frame fills, falling back to the shared default. */
export function frameImageField(frame: FrameOption): string {
  return frame.imageFieldName?.trim() || env.canvaImageFieldName;
}

/**
 * Autofills the chosen frame with the uploaded photo and returns the new
 * `design_id`.
 *
 * Two source modes, per Canva's autofill guide:
 *  - `create_from_brand_template` — from a published brand template
 *  - `create_from_design` — from a plain design carrying tagged data fields.
 *    Handy if publishing a brand template isn't available for your plan or role.
 *
 * Either way the image goes into the frame's named image field. Canva silently
 * ignores data for field names that don't exist, so a wrong name yields an empty
 * frame rather than an error. Check the real names with GET /api/canva/template.
 */
export async function autofillTemplate(
  frame: FrameOption,
  assetId: string,
  designTitle: string,
  signal?: AbortSignal,
): Promise<string> {
  const created = await canvaFetch<{ job: AutofillJob }>("/autofills", {
    method: "POST",
    json: {
      ...autofillSource(frame),
      title: designTitle.slice(0, 255),
      data: {
        [frameImageField(frame)]: {
          type: "image",
          asset_id: assetId,
        },
      },
    },
    signal,
  });

  const job =
    created.job.status === "success"
      ? created.job
      : await pollCanvaJob<AutofillJob>(
          "autofill",
          `/autofills/${created.job.id}`,
          { initialDelayMs: 1_500, intervalMs: 3_000, timeoutMs: 120_000, signal },
        );

  const designId = job.result?.design.id;
  if (!designId) {
    throw new CanvaJobError(
      "Canva finished the autofill but returned no design id.",
      "autofill",
    );
  }
  return designId;
}

// --- Step 3: export ------------------------------------------------------

interface ExportJob extends CanvaJob {
  urls?: string[];
}

/**
 * Exports a design as JPG and returns the download URLs (one per page).
 * Canva's download URLs expire after 24 hours.
 */
export async function exportDesign(
  designId: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const created = await canvaFetch<{ job: ExportJob }>("/exports", {
    method: "POST",
    json: {
      design_id: designId,
      format: {
        type: "jpg",
        // `quality` is required for jpg exports (1-100).
        quality: env.canvaExportQuality,
      },
    },
    signal,
  });

  const job =
    created.job.status === "success"
      ? created.job
      : await pollCanvaJob<ExportJob>("export", `/exports/${created.job.id}`, {
          initialDelayMs: 1_500,
          intervalMs: 3_000,
          timeoutMs: 120_000,
          signal,
        });

  if (!job.urls?.length) {
    throw new CanvaJobError(
      "Canva finished the export but returned no download URLs.",
      "export",
    );
  }
  return job.urls;
}

// --- Orchestration -------------------------------------------------------

export interface RenderedPhoto {
  assetId: string;
  designId: string;
  downloadUrls: string[];
  /** The finished JPG bytes, ready to attach to an email. */
  imageBytes: Buffer;
}

/** Downloads an exported image from Canva's temporary download URL. */
async function downloadExport(url: string, signal?: AbortSignal): Promise<Buffer> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) {
    throw new Error(
      `Could not download the exported photo (${response.status} ${response.statusText}).`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Runs upload → autofill → export and returns everything needed to email the
 * finished photo.
 */
export async function renderPhotoWithCanva(options: {
  /** The frame the guest chose. Determines which Canva source is filled. */
  frame: FrameOption;
  photo: ArrayBuffer | Uint8Array;
  fileName: string;
  designTitle: string;
  signal?: AbortSignal;
}): Promise<RenderedPhoto> {
  const { frame, photo, fileName, designTitle, signal } = options;

  const assetId = await uploadAsset(photo, fileName, signal);
  const designId = await autofillTemplate(frame, assetId, designTitle, signal);
  const downloadUrls = await exportDesign(designId, signal);
  const imageBytes = await downloadExport(downloadUrls[0], signal);

  return { assetId, designId, downloadUrls, imageBytes };
}

// --- Setup helpers -------------------------------------------------------

export type CanvaDataFieldType = "image" | "text" | "chart" | "sheet";

export interface CanvaDataset {
  [fieldName: string]: { type: CanvaDataFieldType };
}

/**
 * Lists the autofillable field names in one frame's Canva source, so the
 * operator can confirm the image field name matches. Requires the
 * `brandtemplate:content:read` scope for brand templates, or
 * `design:content:read` for a design.
 */
export async function getTemplateDataset(
  frame: FrameOption,
  signal?: AbortSignal,
): Promise<{
  source: "design" | "brand_template";
  id: string;
  dataset: CanvaDataset;
}> {
  if (frame.designId) {
    const { dataset } = await canvaFetch<{ dataset: CanvaDataset }>(
      `/designs/${encodeURIComponent(frame.designId)}/dataset`,
      { signal },
    );
    return { source: "design", id: frame.designId, dataset: dataset ?? {} };
  }

  if (!frame.brandTemplateId) {
    throw new CanvaJobError(
      `Frame "${frame.id}" has neither a designId nor a brandTemplateId.`,
      "autofill",
    );
  }

  const { dataset } = await canvaFetch<{ dataset: CanvaDataset }>(
    `/brand-templates/${encodeURIComponent(frame.brandTemplateId)}/dataset`,
    { signal },
  );
  return {
    source: "brand_template",
    id: frame.brandTemplateId,
    dataset: dataset ?? {},
  };
}
