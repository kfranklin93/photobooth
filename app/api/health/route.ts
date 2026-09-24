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
import { eventFrames, getAllEvents, getLiveEvents } from "@/config/events";
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

  // Which database env vars actually exist, by NAME only — never values.
  // Integrations differ on naming (DATABASE_URL vs POSTGRES_URL vs a prefixed
  // variant), and the token store can only use names it knows to look for.
  const databaseEnvVars = Object.keys(process.env)
    .filter((key) => /DATABASE|POSTGRES|NEON|^PG/.test(key))
    .filter((key) => (process.env[key] ?? "").trim().length > 0)
    .sort();

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

  const allEvents = getAllEvents();
  const liveEvents = getLiveEvents();
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
    if (databaseEnvVars.length > 0) {
      warnings.push(
        `A database appears to be attached (${databaseEnvVars.join(", ")}) but ` +
          `the token store did not pick it up. Set CANVA_TOKEN_DATABASE_URL to ` +
          `the same value, or report these names so the lookup list can include them.`,
      );
    }
  }
  if (missingEnv.length > 0) {
    warnings.push(`Missing environment variables: ${missingEnv.join(", ")}`);
  }
  if (liveEvents.length === 0) {
    warnings.push(
      "No event has a usable frame. Add a designId or brandTemplateId to at " +
        "least one frame in config/events.ts.",
    );
  }
  const pending = allEvents.filter((e) => eventFrames(e).length === 0);
  if (pending.length > 0) {
    warnings.push(
      `Event(s) with no frames yet, hidden from the chooser: ${pending
        .map((e) => e.slug)
        .join(", ")}`,
    );
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
        /** Names only. If the store is "memory" but this list is non-empty, the
         *  connection string exists under a name the store doesn't recognise. */
        databaseEnvVarsPresent: databaseEnvVars,
      },
      booth: {
        maxPhotos: MAX_PHOTOS,
        events: allEvents.map((event) => ({
          slug: event.slug,
          name: event.name,
          palette: event.palette,
          frameCount: eventFrames(event).length,
          frameIds: eventFrames(event).map((frame) => frame.id),
          /** Hidden from the chooser until it has a usable frame. */
          live: eventFrames(event).length > 0,
        })),
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
