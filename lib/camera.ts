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
 * Shape of the captured photo, as width / height. This must match the shape of
 * the photo opening in the Canva template: Canva frames crop to fill, so a
 * mismatch silently throws away part of every photo and can clip faces.
 *
 *   3 / 4  portrait  (current — matches a portrait template opening)
 *   2 / 3  portrait, taller (exact match for a 4x6 print)
 *   4 / 3  landscape
 *   1      square
 *
 * Every viewfinder and preview uses this value, so what the guest sees is what
 * gets sent.
 */
export const CAPTURE_ASPECT = 3 / 4;

/** Constraints for a stream already close to the target shape. */
export function videoConstraints(): MediaTrackConstraints {
  return {
    facingMode: FACING_MODE,
    width: { ideal: Math.round(1920 * CAPTURE_ASPECT) },
    height: { ideal: 1920 },
    aspectRatio: { ideal: CAPTURE_ASPECT },
  };
}

/**
 * Grabs the current video frame as a JPEG File, centre-cropped to
 * CAPTURE_ASPECT.
 *
 * The crop is what keeps the output honest. Previews use CSS `object-cover`,
 * which centre-crops the stream to the viewfinder's shape; writing the full
 * frame instead would hand the guest a wider photo than the one they posed for.
 */
export async function grabFrameFromVideo(
  video: HTMLVideoElement,
): Promise<File | null> {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) return null;

  // Largest rectangle of CAPTURE_ASPECT that fits inside the source frame.
  const sourceAspect = sourceWidth / sourceHeight;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  if (sourceAspect > CAPTURE_ASPECT) {
    cropWidth = sourceHeight * CAPTURE_ASPECT; // trim the sides
  } else {
    cropHeight = sourceWidth / CAPTURE_ASPECT; // trim top and bottom
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
