/**
 * Frame types shared by every event.
 *
 * The frames themselves live on their event in `config/events.ts` — a frame only
 * means something in the context of the party it belongs to. This module holds
 * the type and the helpers that don't care which event a frame came from.
 *
 * Canva IDs are not secrets (they appear in design URLs), so they live in
 * version control. Only the client ID, secret, and refresh token are secret.
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
  /**
   * Shape of this frame's photo opening, as width / height.
   *
   * Canva crops the photo to fill the frame, so the viewfinder has to match or
   * the guest is framed differently from the result. Because the frame is chosen
   * before the photo is taken, the camera can adopt whichever ratio the chosen
   * frame needs.
   *
   *   0.75  3:4 portrait      1.0   square
   *   1.2   6:5 landscape     1.333 4:3 landscape
   *
   * Falls back to the event's `captureAspect` when omitted. Measure it from the
   * artwork's transparent window rather than the canvas size — a square canvas
   * often holds a landscape opening.
   */
  aspect?: number;
}

/** Shape the kiosk needs. Excludes anything Canva-specific. */
export interface PublicFrameOption {
  id: string;
  label: string;
  description: string;
  thumbnail: string;
  /** Resolved capture aspect for this frame (frame's own, else the event's). */
  aspect: number;
}

/** A frame is only usable once it points at something in Canva. */
export function isFrameReady(frame: FrameOption): boolean {
  return Boolean(frame.brandTemplateId || frame.designId);
}

/**
 * Strips Canva IDs before handing the list to the browser, resolving each
 * frame's capture aspect against the event default.
 */
export function toPublicFrames(
  frames: FrameOption[],
  defaultAspect: number,
): PublicFrameOption[] {
  return frames.map(({ id, label, description, thumbnail, aspect }) => ({
    id,
    label,
    description,
    thumbnail,
    aspect: aspect && aspect > 0 ? aspect : defaultAspect,
  }));
}
