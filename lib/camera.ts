/**
 * Shared camera constants and frame-grabbing maths.
 *
 * Kept out of the component files so both the frame picker (preview only) and
 * the capture screen work from exactly the same numbers.
 */

/**
 * `user` is the front camera, which faces a guest at the booth. Switch to
 * `environment` if the tablet is mounted facing away.
 */
export const FACING_MODE: "user" | "environment" = "user";

/** Mirror the preview and the saved photo, so the result matches what the guest saw. */
export const MIRROR = true;

/**
 * Fallback photo shape, as width / height, when no frame has been chosen.
 *
 * The real value comes from the chosen frame: each one declares the shape of its
 * photo opening, because Canva crops to fill and a mismatch silently throws away
 * part of every photo. Frame choice happens before capture precisely so the
 * viewfinder can adopt the right shape.
 */
export const DEFAULT_CAPTURE_ASPECT = 3 / 4;

/**
 * Constraints for a stream close to the target shape.
 *
 * One stream serves every frame in the picker, and those can have different
 * aspects, so this asks for a generous frame and lets the capture crop. Cameras
 * commonly ignore `aspectRatio` anyway, which is why cropping is what actually
 * guarantees the output shape.
 */
export function videoConstraints(): MediaTrackConstraints {
  return {
    facingMode: FACING_MODE,
    width: { ideal: 1920 },
    height: { ideal: 1920 },
  };
}

/**
 * Grabs the current video frame as a JPEG File, centre-cropped to `aspect`.
 *
 * The crop is what keeps the output honest. Previews use CSS `object-cover`,
 * which centre-crops the stream to the viewfinder's shape; writing the full
 * frame instead would hand the guest a wider photo than the one they posed for.
 *
 * @param aspect Target width / height, from the chosen frame.
 */
export async function grabFrameFromVideo(
  video: HTMLVideoElement,
  aspect: number = DEFAULT_CAPTURE_ASPECT,
): Promise<File | null> {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) return null;

  const target = aspect > 0 ? aspect : DEFAULT_CAPTURE_ASPECT;

  // Largest rectangle of `target` that fits inside the source frame.
  const sourceAspect = sourceWidth / sourceHeight;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  if (sourceAspect > target) {
    cropWidth = sourceHeight * target; // trim the sides
  } else {
    cropHeight = sourceWidth / target; // trim top and bottom
  }
  const offsetX = (sourceWidth - cropWidth) / 2;
  const offsetY = (sourceHeight - cropHeight) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cropWidth);
  canvas.height = Math.round(cropHeight);

  const context = canvas.getContext("2d");
  if (!context) return null;

  if (MIRROR) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(
    video,
    offsetX,
    offsetY,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/jpeg", 0.92);
  });
  if (!blob) return null;

  return new File([blob], `booth-${Date.now()}.jpg`, { type: "image/jpeg" });
}
