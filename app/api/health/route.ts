/**
 * GET /api/health
 *
 * Operator-only readiness check. Reports which token store backend is live,
 * whether it survives a round trip, and which config is present — without
 * exposing any secret values.
 *
 * The token store is the one piece that behaves differently in production than
 * locally: the file store works fine on a laptop and silently loses rotated
 * refresh tokens on serverless. This makes that visible before an event rather
 * than after the first cold start.
 *
 * In production this route requires `?secret=<CANVA_SETUP_SECRET>`.
 */

import { NextResponse } from "next/server";

import { checkSetupAccess } from "@/lib/canva/oauth-setup";
import { getTokenStore } from "@/lib/canva/token-store";
import { findMissingRuntimeEnv } from "@/lib/env";
import { getFrames } from "@/config/frames";
import { MAX_PHOTOS } from "@/config/booth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** True when the filesystem is ephemeral, so a file-based store won't persist. */
function isServerless(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME,
  );
}

export async function GET(request: Request) {
  const access = checkSetupAccess(request);
  if (!access.ok) {
    return new NextResponse(access.message, { status: access.status });
  }

  const store = getTokenStore();
  const serverless = isServerless();

  // Does the store actually hold a refresh token? Read-only: writing here would
  // risk clobbering a live token.
  let storeReadable = false;
  let hasRefreshToken = false;
  let storeError: string | undefined;
  try {
    const tokens = await store.read();
    storeReadable = true;
    hasRefreshToken = Boolean(tokens?.refreshToken);
  } catch (error) {
    storeError = error instanceof Error ? error.message : String(error);
  }

  const frames = getFrames();
  const missingEnv = findMissingRuntimeEnv();

  // A file store on an ephemeral filesystem is the failure mode worth shouting
  // about: everything looks fine until the first cold start.
  const durableStore = store.name === "neon" || store.name === "upstash";
  const warnings: string[] = [];
  if (serverless && !durableStore) {
    warnings.push(
      `Token store is "${store.name}" on a serverless host. Rotated Canva ` +
        `refresh tokens will be lost on cold start. Attach a Postgres database ` +
        `(DATABASE_URL) or configure Upstash.`,
    );
  }
  if (missingEnv.length > 0) {
    warnings.push(`Missing environment variables: ${missingEnv.join(", ")}`);
  }
  if (frames.length === 0) {
    warnings.push("No frames configured in config/frames.ts.");
  }
  if (storeReadable && !hasRefreshToken && missingEnv.length === 0) {
    warnings.push(
      "Token store holds no refresh token yet. Run /api/canva/auth once.",
    );
  }

  const ok = warnings.length === 0;

  return NextResponse.json(
    {
      ok,
      environment: {
        serverless,
        nodeEnv: process.env.NODE_ENV,
      },
      tokenStore: {
        backend: store.name,
        durable: durableStore,
        readable: storeReadable,
        hasRefreshToken,
        error: storeError,
      },
      booth: {
        frameCount: frames.length,
        frameIds: frames.map((frame) => frame.id),
        maxPhotos: MAX_PHOTOS,
      },
      // Presence only — never the values.
      config: {
        canvaClientId: Boolean(process.env.CANVA_CLIENT_ID),
        canvaClientSecret: Boolean(process.env.CANVA_CLIENT_SECRET),
        canvaRefreshTokenSeed: Boolean(process.env.CANVA_REFRESH_TOKEN),
        resendApiKey: Boolean(process.env.RESEND_API_KEY),
        emailFrom: process.env.EMAIL_FROM ?? null,
        appUrl: process.env.APP_URL ?? null,
        setupSecret: Boolean(process.env.CANVA_SETUP_SECRET),
      },
      warnings,
    },
    { status: ok ? 200 : 207 },
  );
}
