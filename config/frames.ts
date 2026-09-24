/**
 * The frames guests can choose between.
 *
 * Each entry points at one Canva source — either a published brand template or
 * a plain design carrying a named image data field. Add an entry per frame
 * design you build in Canva.
 *
 * Canva IDs are not secrets (they appear in design URLs), so they live here in
 * version control rather than in `.env.local`. Only the client ID, secret, and
 * refresh token are secret.
 */

export interface FrameOption {
  /** Stable slug sent by the kiosk and used in logs. Don't rename casually. */
  id: string;
  /** Shown on the picker button. */
  label: string;
  /** One short line under the label. */
  description: string;
  /**
   * Preview image for the picker, served from /public.
   * Drop your frame artwork in public/frames/ and reference it here.
   */
  thumbnail: string;
  /**
   * The Canva source. Provide exactly one:
   *  - brandTemplateId: from https://www.canva.com/brand/brand-templates/<ID>
   *  - designId:        from https://www.canva.com/design/<ID>/edit
   */
  brandTemplateId?: string;
  designId?: string;
  /**
   * Name of the image data field inside this design. Defaults to
   * CANVA_IMAGE_FIELD_NAME when omitted, so frames sharing a field name can
   * leave it unset.
   */
  imageFieldName?: string;
}

/**
 * Edit this list to match the designs you built in Canva.
 *
 * All frames should share the same photo-opening shape, because the camera
 * viewfinder uses a single aspect ratio (CAPTURE_ASPECT in
 * components/CameraCapture.tsx). Mixing portrait and landscape openings means
 * Canva crops some photos more than the guest saw in the preview.
 */
export const FRAMES: FrameOption[] = [
  {
    id: "frame-one",
    // `label` and `description` are placeholder names — rename them freely,
    // they're what guests see. Leave `id` alone: the kiosk posts it to the API.
    label: "Lavender Wings",
    description: "Soft violet butterflies",
    thumbnail: "/frames/frame-1.png",
    designId: "DAHWFL8hvaw", // Canva title: frame2trnsparnt
  },
  {
    id: "frame-two",
    label: "Golden Flutter",
    description: "Gold foil and shimmer",
    thumbnail: "/frames/frame-2.png",
    designId: "DAHWFJWEFAo", // Canva title: frame3trnsprt
  },
  {
    id: "frame-three",
    label: "Royal Bloom",
    description: "Deep violet and blossoms",
    // Canva flattened this export, so the photo area came out solid white. The
    // window was punched back out locally — see public/frames/README.md.
    thumbnail: "/frames/frame-3.png",
    designId: "DAHWFKgV9i8", // Canva title: frame4trnsprt
  },
  {
    id: "frame-four",
    label: "Midnight Garden",
    description: "Dusk violet with gold",
    thumbnail: "/frames/frame-4.png",
    designId: "DAHWFJHy8Y0", // Canva title: frame5trnsprt
  },
  {
    id: "frame-five",
    label: "Butterfly Crown",
    description: "Regal wings and gold",
    // Source artwork was 2:3 (900x1350), stretched to 3:4 to match the others.
    thumbnail: "/frames/frame-5.png",
    designId: "DAHWFMm3erI", // Canva title: frame1-1
  },
];

/** Shape the kiosk needs. Excludes anything Canva-specific. */
export interface PublicFrameOption {
  id: string;
  label: string;
  description: string;
  thumbnail: string;
}

function legacyFallback(): FrameOption[] {
  // Keeps a single-frame setup working straight from .env.local, which is how
  // the booth was configured before frame choice existed.
  const brandTemplateId = process.env.CANVA_TEMPLATE_ID?.trim();
  const designId = process.env.CANVA_SOURCE_DESIGN_ID?.trim();
  if (!brandTemplateId && !designId) return [];

  return [
    {
      id: "default",
      label: "Butterfly Frame",
      description: "Our signature design",
      thumbnail: "/frames/placeholder.svg",
      ...(designId ? { designId } : { brandTemplateId }),
    },
  ];
}

/** Every configured frame, falling back to the single env-configured source. */
export function getFrames(): FrameOption[] {
  const configured = FRAMES.filter((frame) => frame.brandTemplateId || frame.designId);
  return configured.length > 0 ? configured : legacyFallback();
}

/** Looks up a frame by the id the kiosk sent. */
export function findFrame(id: string | null | undefined): FrameOption | undefined {
  if (!id) return undefined;
  return getFrames().find((frame) => frame.id === id);
}

/** Strips Canva IDs before handing the list to the browser. */
export function toPublicFrames(frames: FrameOption[]): PublicFrameOption[] {
  return frames.map(({ id, label, description, thumbnail }) => ({
    id,
    label,
    description,
    thumbnail,
  }));
}
