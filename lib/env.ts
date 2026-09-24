/**
 * Centralised environment access.
 *
 * Every value is read lazily so that importing this module never throws at
 * build time (Next.js evaluates route modules during `next build`). Missing
 * values only surface when a request actually needs them.
 */

export class MissingEnvError extends Error {
  constructor(public readonly key: string) {
    super(
      `Missing required environment variable "${key}". ` +
        `Add it to .env.local (see .env.local.example) and restart the server.`,
    );
    this.name = "MissingEnvError";
  }
}

function required(key: string): string {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new MissingEnvError(key);
  }
  return value.trim();
}

function optional(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export const env = {
  // --- Canva Connect integration ---------------------------------------
  get canvaClientId() {
    return required("CANVA_CLIENT_ID");
  },
  get canvaClientSecret() {
    return required("CANVA_CLIENT_SECRET");
  },
  /**
   * Long-lived refresh token obtained once via the /api/canva/auth flow.
   * Canva rotates refresh tokens on every use, so the newest value is kept in
   * the token store (see lib/canva/token-store.ts) rather than here.
   */
  get canvaRefreshToken() {
    return required("CANVA_REFRESH_TOKEN");
  },
  get canvaTemplateId() {
    return required("CANVA_TEMPLATE_ID");
  },
  /**
   * Optional alternative to CANVA_TEMPLATE_ID: autofill from a plain design
   * that has tagged data fields, instead of a published brand template. Useful
   * if publishing a brand template isn't available on your Canva plan/role.
   * When set, this takes precedence over CANVA_TEMPLATE_ID.
   */
  get canvaSourceDesignId() {
    const value = process.env.CANVA_SOURCE_DESIGN_ID;
    return value && value.trim().length > 0 ? value.trim() : undefined;
  },
  /** Name of the image data field inside the Canva template. */
  get canvaImageFieldName() {
    return optional("CANVA_IMAGE_FIELD_NAME", "image_frame_name");
  },
  /** JPEG compression quality (1-100) for the exported photo. */
  get canvaExportQuality() {
    const parsed = Number.parseInt(optional("CANVA_EXPORT_QUALITY", "90"), 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 100) return 90;
    return parsed;
  },

  // --- Resend email -----------------------------------------------------
  get resendApiKey() {
    return required("RESEND_API_KEY");
  },
  /** Must be an address on a domain verified in Resend. */
  get emailFrom() {
    return optional("EMAIL_FROM", "Photo Booth <onboarding@resend.dev>");
  },

  // --- Event copy -------------------------------------------------------
  get eventName() {
    return optional("EVENT_NAME", "Princess Butterflies Baby Shower");
  },

  // --- App --------------------------------------------------------------
  /** Public origin of this app, used to build the OAuth redirect URI. */
  get appUrl() {
    return optional("APP_URL", "http://127.0.0.1:3000").replace(/\/+$/, "");
  },
} as const;

function isBlank(key: string): boolean {
  const value = process.env[key];
  return !value || value.trim().length === 0;
}

/**
 * Returns the secrets needed to serve a photo request, if any are missing.
 *
 * Deliberately does not check for an autofill source. Frames are configured in
 * config/frames.ts, and CANVA_TEMPLATE_ID / CANVA_SOURCE_DESIGN_ID exist only as
 * a legacy single-frame fallback. The route validates the frame catalogue
 * separately and reports a far more useful message when it's empty.
 */
export function findMissingRuntimeEnv(): string[] {
  return [
    "CANVA_CLIENT_ID",
    "CANVA_CLIENT_SECRET",
    "CANVA_REFRESH_TOKEN",
    "RESEND_API_KEY",
  ].filter(isBlank);
}
