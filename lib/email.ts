/**
 * Delivery of the finished photos via Resend.
 *
 * A guest may take up to MAX_PHOTOS in one session, and they all arrive in a
 * single email rather than one message per shot. Each exported JPG is attached
 * directly so the guest keeps a copy after Canva's download URLs expire (24
 * hours), and those URLs are also listed in the body as a fallback for clients
 * that strip attachments.
 */

import { Resend } from "resend";
import { env } from "@/lib/env";
import { TransientError, withRetry, withTimeout } from "@/lib/retry";

/**
 * Deadline for one send attempt. The Resend SDK takes no abort signal, so this
 * only stops us waiting — but that's enough to turn a stalled upload into a
 * retryable failure rather than a hang.
 */
const SEND_DEADLINE_MS = 60_000;

export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

let client: Resend | undefined;

function getResend(): Resend {
  if (!client) client = new Resend(env.resendApiKey);
  return client;
}

/** Escapes text before interpolating it into the HTML body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** One finished photo, ready to attach. */
export interface PhotoAttachment {
  bytes: Buffer;
  fileName: string;
  /** Defaults to image/jpeg, matching Canva's export format. */
  contentType?: string;
  /** Canva's temporary download URL, included as a body fallback. */
  downloadUrl?: string;
}

function buildHtml(photos: PhotoAttachment[], eventName: string): string {
  const safeEvent = escapeHtml(eventName);
  const many = photos.length > 1;

  const links = photos
    .map((photo, index) => {
      if (!photo.downloadUrl) return "";
      const safeUrl = escapeHtml(photo.downloadUrl);
      const label = many ? `Download photo ${index + 1}` : "Download your photo";
      return `
                <p style="margin:0 0 12px;text-align:center;">
                  <a href="${safeUrl}"
                     style="display:inline-block;background:linear-gradient(135deg,#7e22ce,#c084fc);color:#ffffff;text-decoration:none;padding:15px 34px;border-radius:999px;font-size:16px;letter-spacing:0.5px;">
                    ${label}
                  </a>
                </p>`;
    })
    .join("");

  const headline = many ? "Your photos have landed" : "Your photo has landed";
  const intro = many
    ? `Thank you for celebrating with us. All ${photos.length} of your keepsake
       photos are attached to this email, sprinkled with a little butterfly magic.`
    : `Thank you for celebrating with us. Your keepsake photo is attached to
       this email, sprinkled with a little butterfly magic.`;

  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4eefb;font-family:Georgia,'Times New Roman',serif;color:#3b1a5c;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4eefb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;border:1px solid #e3d3f5;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#4c1d95,#7e22ce 55%,#a855f7);padding:32px 28px;text-align:center;">
                <div style="font-size:38px;line-height:1;">&#129419;</div>
                <h1 style="margin:14px 0 6px;font-size:26px;font-weight:normal;color:#ffffff;letter-spacing:0.5px;">
                  ${headline}
                </h1>
                <p style="margin:0;font-size:14px;color:#e9d5ff;letter-spacing:1.5px;text-transform:uppercase;">
                  ${safeEvent}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px 8px;">
                <p style="margin:0 0 16px;font-size:17px;line-height:1.6;">
                  ${intro}
                </p>
                <p style="margin:0 0 26px;font-size:17px;line-height:1.6;">
                  Share them, print them, frame them. We are so glad you were there.
                </p>
${links}
                <p style="margin:18px 0 24px;font-size:13px;line-height:1.6;color:#7c6a92;text-align:center;">
                  The download links work for 24 hours. The attached
                  ${many ? "copies are" : "copy is"} yours to keep.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 30px;text-align:center;">
                <div style="border-top:1px solid #ece0f8;padding-top:18px;font-size:22px;color:#c8a951;">
                  &#10022; &#129419; &#10022;
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildText(photos: PhotoAttachment[], eventName: string): string {
  const many = photos.length > 1;
  const lines = [
    `${many ? "Your photos have" : "Your photo has"} landed - ${eventName}`,
    "",
    `Thank you for celebrating with us. ${
      many ? `All ${photos.length} photos are` : "Your photo is"
    } attached to this email.`,
    "",
  ];

  const withUrls = photos.filter((p) => p.downloadUrl);
  if (withUrls.length > 0) {
    lines.push("Download links (valid for 24 hours):");
    withUrls.forEach((photo, index) => {
      lines.push(
        many ? `  ${index + 1}. ${photo.downloadUrl}` : `  ${photo.downloadUrl}`,
      );
    });
  }

  return lines.join("\n");
}

export interface SendPhotoEmailOptions {
  to: string;
  /** One or more finished photos. All are attached to a single email. */
  photos: PhotoAttachment[];
}

/**
 * Emails the finished photos to the guest. Resolves with the Resend message id.
 */
export async function sendPhotoEmail(
  options: SendPhotoEmailOptions,
): Promise<string> {
  const { to, photos } = options;
  if (photos.length === 0) {
    throw new EmailDeliveryError("No photos to send.");
  }

  const eventName = env.eventName;
  const many = photos.length > 1;
  const subject = many
    ? `Your ${eventName} photos are here \u{1F98B}`
    : `Your ${eventName} photo is here \u{1F98B}`;

  // Retried: the attachments are a multi-hundred-KB upload, and a dropped
  // connection mid-send is the one failure that would silently cost a guest
  // their photos. A duplicate is a far better outcome than a loss.
  return withRetry(
    async () => {
      const { data, error } = await withTimeout(
        () =>
          getResend().emails.send({
            from: env.emailFrom,
            to,
            subject,
            html: buildHtml(photos, eventName),
            text: buildText(photos, eventName),
            attachments: photos.map((photo) => ({
              filename: photo.fileName,
              content: photo.bytes,
              contentType: photo.contentType ?? "image/jpeg",
            })),
          }),
        SEND_DEADLINE_MS,
        "resend send",
      );

      if (error) {
        // The SDK flattens network failures into this generic code, so treat it
        // as transient and let the retry decide.
        if (error.name === "application_error") {
          throw new TransientError(error.message ?? "Resend request failed.");
        }
        throw new EmailDeliveryError(
          error.message ?? "Resend rejected the email.",
          error.name,
        );
      }
      if (!data?.id) {
        throw new EmailDeliveryError("Resend did not return a message id.");
      }
      return data.id;
    },
    { label: "resend send", attempts: 3 },
  ).catch((error: unknown) => {
    // Retries exhausted: present it as a delivery failure, not a raw network error.
    if (error instanceof TransientError) {
      throw new EmailDeliveryError(
        `Could not reach Resend after 3 attempts: ${error.message}`,
        "network_error",
      );
    }
    throw error;
  });
}
