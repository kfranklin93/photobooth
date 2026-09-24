/**
 * GET /api/canva/callback
 *
 * Operator-only. Canva redirects here after the account holder authorises the
 * integration. Exchanges the authorization code for tokens, stores them, and
 * prints the refresh token so it can be pasted into `.env.local` (or the host's
 * environment settings) as `CANVA_REFRESH_TOKEN`.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { exchangeAuthorizationCode } from "@/lib/canva/token";
import { getTokenStore } from "@/lib/canva/token-store";
import {
  STATE_COOKIE,
  VERIFIER_COOKIE,
  checkSetupAccess,
  escapeHtml,
  redirectUri,
  setupPage,
} from "@/lib/canva/oauth-setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function htmlResponse(html: string, status = 200) {
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function errorPage(title: string, detail: string, status: number) {
  return htmlResponse(
    setupPage(
      "Canva setup failed",
      `<h1>${escapeHtml(title)}</h1>
       <p>${escapeHtml(detail)}</p>
       <p class="muted">Start over at <code>/api/canva/auth</code>.</p>`,
    ),
    status,
  );
}

export async function GET(request: Request) {
  const access = checkSetupAccess(request);
  if (!access.ok) {
    return new NextResponse(access.message, { status: access.status });
  }

  const url = new URL(request.url);
  const canvaError = url.searchParams.get("error");
  if (canvaError) {
    return errorPage(
      "Canva declined the request",
      url.searchParams.get("error_description") ?? canvaError,
      400,
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) {
    return errorPage("No authorization code", "Canva did not return a code.", 400);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const codeVerifier = cookieStore.get(VERIFIER_COOKIE)?.value;

  if (!expectedState || !codeVerifier) {
    return errorPage(
      "Setup session expired",
      "The one-time setup cookies are missing or expired.",
      400,
    );
  }
  if (state !== expectedState) {
    return errorPage(
      "State mismatch",
      "The state value did not match, so the request was rejected.",
      400,
    );
  }

  try {
    const token = await exchangeAuthorizationCode({
      code,
      codeVerifier,
      redirectUri: redirectUri(),
    });

    const response = htmlResponse(
      setupPage(
        "Canva connected",
        `<h1>Canva is connected</h1>
         <p>Tokens are stored in the <code>${escapeHtml(
           getTokenStore().name,
         )}</code> token store, so the kiosk works right now.</p>
         <p>Copy this refresh token into your environment as
            <code>CANVA_REFRESH_TOKEN</code> so it survives a restart:</p>
         <pre>${escapeHtml(token.refresh_token)}</pre>
         <p class="muted">Granted scopes: ${escapeHtml(token.scope ?? "(not reported)")}</p>
         <p class="muted">
           Canva rotates this value on every refresh, so the stored copy will
           drift from the one above. That is expected. The env value is only the
           seed used after a cold start with an empty store.
         </p>
         <p><a href="/">Go to the photo booth</a></p>`,
      ),
    );

    response.cookies.delete(VERIFIER_COOKIE);
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (error) {
    console.error("[canva/callback] Token exchange failed:", error);
    return errorPage(
      "Token exchange failed",
      error instanceof Error ? error.message : String(error),
      502,
    );
  }
}
