/**
 * GET /api/canva/auth
 *
 * Operator-only. Starts the Canva Connect OAuth flow so the kiosk can obtain a
 * refresh token. Run this once during setup, signed in as the Canva account
 * that owns the brand template.
 *
 * In production this route requires `?secret=<CANVA_SETUP_SECRET>`.
 */

import { NextResponse } from "next/server";

import {
  OAUTH_COOKIE_MAX_AGE_SECONDS,
  STATE_COOKIE,
  VERIFIER_COOKIE,
  buildAuthorizeUrl,
  checkSetupAccess,
  createPkcePair,
  escapeHtml,
  setupPage,
} from "@/lib/canva/oauth-setup";
import { MissingEnvError } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = checkSetupAccess(request);
  if (!access.ok) {
    return new NextResponse(access.message, { status: access.status });
  }

  let authorizeUrl: string;
  const pkce = createPkcePair();
  try {
    authorizeUrl = buildAuthorizeUrl(pkce);
  } catch (error) {
    if (error instanceof MissingEnvError) {
      return new NextResponse(
        setupPage(
          "Canva setup",
          `<h1>Missing configuration</h1>
           <p>${escapeHtml(error.message)}</p>`,
        ),
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }
    throw error;
  }

  const response = NextResponse.redirect(authorizeUrl);

  // The verifier must never reach the browser's JS, and the state pairs the
  // callback with this request to block CSRF.
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/canva",
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
  };
  response.cookies.set(VERIFIER_COOKIE, pkce.verifier, cookieOptions);
  response.cookies.set(STATE_COOKIE, pkce.state, cookieOptions);

  return response;
}
