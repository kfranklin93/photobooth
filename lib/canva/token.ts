/**
 * Canva Connect OAuth 2.0 token handling.
 *
 * The Connect API has no static "API key": every call needs a bearer access
 * token that acts on behalf of a Canva user, and those tokens expire after
 * about 4 hours. The kiosk therefore holds a refresh token (minted once by the
 * operator through /api/canva/auth) and trades it for a fresh access token
 * whenever the cached one is close to expiring.
 *
 * Refresh tokens are single-use: each exchange returns a new one and voids the
 * old one. Two consequences are handled here:
 *  - refreshes are single-flighted, so concurrent requests can't race and
 *    invalidate each other's token;
 *  - the new refresh token is written back to the token store immediately.
 */

import { env } from "@/lib/env";
import { CanvaApiError, describeCanvaError } from "@/lib/canva/errors";
import { getTokenStore, type StoredTokens } from "@/lib/canva/token-store";

export const CANVA_API_BASE = "https://api.canva.com/rest/v1";
export const CANVA_TOKEN_ENDPOINT = `${CANVA_API_BASE}/oauth/token`;
export const CANVA_AUTHORIZE_ENDPOINT = "https://www.canva.com/api/oauth/authorize";

/**
 * Scopes the kiosk needs:
 *  - asset:write               → upload the guest's photo
 *  - asset:read                → poll the upload job for its asset id
 *  - design:content:write      → autofill the template
 *  - design:content:read       → export the finished design, read datasets
 *  - design:meta:read          → read design metadata returned by autofill
 *  - brandtemplate:meta:read   → list brand templates
 *  - brandtemplate:content:read→ read a brand template's dataset (field names)
 *
 * `asset:read` is easy to miss: creating the upload job only needs
 * `asset:write`, but reading the job back to get the asset id needs read, and
 * the pipeline can't continue without it. Canva rejects the upload poll with
 * `Missing scopes: [asset:read]`.
 *
 * Each of these must also be enabled in the Developer Portal under
 * Outside Canva → Configuration → Scopes. Adding one here is not enough:
 * scopes are baked into a token at authorization time, so re-run
 * /api/canva/auth after changing them. Refreshing an existing token preserves
 * its original scopes and will not pick up additions.
 */
export const CANVA_SCOPES = [
  "asset:read",
  "asset:write",
  "design:content:read",
  "design:content:write",
  "design:meta:read",
  "brandtemplate:meta:read",
  "brandtemplate:content:read",
] as const;

/** Refresh once the token is within this window of expiring. */
const EXPIRY_SAFETY_MARGIN_MS = 5 * 60 * 1000;

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

function basicAuthHeader(): string {
  const credentials = `${env.canvaClientId}:${env.canvaClientSecret}`;
  return `Basic ${Buffer.from(credentials, "utf8").toString("base64")}`;
}

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(CANVA_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const { code, message } = describeCanvaError(
      payload,
      `Canva token request failed with ${response.status} ${response.statusText}`,
    );
    const hint =
      code === "invalid_grant"
        ? " The refresh token is expired or was already used. Re-run the setup flow at /api/canva/auth."
        : "";
    throw new CanvaApiError(
      `${message}${hint}`,
      response.status,
      code,
      "/oauth/token",
    );
  }

  const token = payload as Partial<TokenResponse>;
  if (!token?.access_token || !token?.refresh_token) {
    throw new CanvaApiError(
      "Canva token response did not include an access token and refresh token.",
      response.status,
      undefined,
      "/oauth/token",
    );
  }

  return token as TokenResponse;
}

function toStoredTokens(token: TokenResponse): StoredTokens {
  return {
    refreshToken: token.refresh_token,
    accessToken: token.access_token,
    // expires_in is in seconds; Canva currently returns 14400 (4 hours).
    accessTokenExpiresAt: Date.now() + token.expires_in * 1000,
  };
}

function isUsable(tokens: StoredTokens | null): tokens is StoredTokens & {
  accessToken: string;
  accessTokenExpiresAt: number;
} {
  return Boolean(
    tokens?.accessToken &&
      tokens.accessTokenExpiresAt &&
      tokens.accessTokenExpiresAt - EXPIRY_SAFETY_MARGIN_MS > Date.now(),
  );
}

/** Guards against two concurrent refreshes invalidating each other's token. */
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const store = getTokenStore();
  const stored = await store.read();

  // Prefer the rotated token from the store; fall back to the env seed on a
  // cold start (or after the store was cleared).
  const refreshToken = stored?.refreshToken ?? env.canvaRefreshToken;

  // `scope` is deliberately omitted: Canva rejects a refresh that requests any
  // permission the token wasn't already granted, and leaving it out simply
  // preserves the existing scope.
  const token = await postToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );

  await store.write(toStoredTokens(token));
  return token.access_token;
}

/**
 * Returns a valid Canva access token, refreshing it if necessary.
 */
export async function getCanvaAccessToken(): Promise<string> {
  const store = getTokenStore();
  const stored = await store.read();
  if (isUsable(stored)) return stored.accessToken;

  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Exchanges an authorization code for tokens during the one-time operator
 * setup flow, and persists the result.
 */
export async function exchangeAuthorizationCode(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  const token = await postToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      code_verifier: params.codeVerifier,
      redirect_uri: params.redirectUri,
    }),
  );
  await getTokenStore().write(toStoredTokens(token));
  return token;
}
