/**
 * Helpers for the one-time operator OAuth flow that mints the kiosk's Canva
 * refresh token. Uses Authorization Code + PKCE (SHA-256), as required by the
 * Connect API.
 */

import crypto from "node:crypto";

import { CANVA_AUTHORIZE_ENDPOINT, CANVA_SCOPES } from "@/lib/canva/token";
import { env } from "@/lib/env";

export const VERIFIER_COOKIE = "canva_code_verifier";
export const STATE_COOKIE = "canva_oauth_state";
export const OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60;

/** Canva's redirect URL must match one registered in the Developer Portal. */
export function redirectUri(): string {
  return `${env.appUrl}/api/canva/callback`;
}

export interface PkcePair {
  verifier: string;
  challenge: string;
  state: string;
}

export function createPkcePair(): PkcePair {
  // 96 random bytes → 128 base64url characters, the top of Canva's allowed range.
  const verifier = crypto.randomBytes(96).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  const state = crypto.randomBytes(32).toString("base64url");
  return { verifier, challenge, state };
}

export function buildAuthorizeUrl(pkce: PkcePair): string {
  const params = new URLSearchParams({
    code_challenge: pkce.challenge,
    code_challenge_method: "s256",
    scope: CANVA_SCOPES.join(" "),
    response_type: "code",
    client_id: env.canvaClientId,
    state: pkce.state,
    redirect_uri: redirectUri(),
  });
  return `${CANVA_AUTHORIZE_ENDPOINT}?${params.toString()}`;
}

/**
 * Guards the setup routes. They are operator-only: reaching them lets someone
 * start an OAuth flow against this integration, so they stay closed in
 * production unless `CANVA_SETUP_SECRET` is set and supplied.
 */
export function checkSetupAccess(request: Request): { ok: true } | {
  ok: false;
  status: number;
  message: string;
} {
  const secret = process.env.CANVA_SETUP_SECRET?.trim();
  const supplied = new URL(request.url).searchParams.get("secret")?.trim();

  if (secret) {
    const expected = Buffer.from(secret);
    const actual = Buffer.from(supplied ?? "");
    const matches =
      expected.length === actual.length &&
      crypto.timingSafeEqual(expected, actual);
    if (!matches) {
      return { ok: false, status: 401, message: "Invalid or missing setup secret." };
    }
    return { ok: true };
  }

  if (process.env.NODE_ENV === "production") {
    return {
      ok: false,
      status: 403,
      message:
        "Canva setup is disabled in production. Set CANVA_SETUP_SECRET and " +
        "append ?secret=... to use this route.",
    };
  }

  return { ok: true };
}

/** Minimal HTML shell so the setup pages match the kiosk theme. */
export function setupPage(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body {
        margin: 0; min-height: 100vh; display: grid; place-items: center;
        background: #2b0f47; color: #f5ecff; padding: 32px;
        font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, sans-serif;
      }
      main { max-width: 42rem; width: 100%; }
      h1 { font-size: 1.6rem; margin: 0 0 1rem; color: #f0d98c; }
      code, pre {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        background: rgba(0,0,0,0.35); border: 1px solid rgba(240,217,140,0.25);
        border-radius: 8px;
      }
      code { padding: 2px 6px; font-size: 0.9em; }
      pre { padding: 14px 16px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
      a { color: #f0d98c; }
      .muted { color: #cdb8e6; font-size: 0.95rem; }
    </style>
  </head>
  <body><main>${bodyHtml}</main></body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
