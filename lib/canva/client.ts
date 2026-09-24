/**
 * Thin fetch wrapper for the Canva Connect REST API, plus the polling helper
 * that every asynchronous Canva job needs.
 *
 * Canva exposes long-running work (uploads, autofills, exports) as jobs: the
 * POST returns a job id with status `in_progress`, and you re-read the job
 * until it becomes `success` or `failed`.
 */

import {
  CanvaApiError,
  CanvaJobError,
  CanvaJobTimeoutError,
  describeCanvaError,
} from "@/lib/canva/errors";
import { CANVA_API_BASE, getCanvaAccessToken } from "@/lib/canva/token";
import { TransientError, deadlineSignal, withRetry } from "@/lib/retry";

/**
 * Per-request deadline. Generous enough for a multi-hundred-KB asset upload on
 * venue wifi, short enough that a dead connection is retried rather than
 * consuming the whole function budget.
 */
const REQUEST_DEADLINE_MS = 60_000;

/** Every Canva async job response shares this envelope. */
export interface CanvaJob {
  id: string;
  status: "in_progress" | "success" | "failed";
  error?: { code?: string; message?: string };
}

export interface CanvaJobEnvelope<TJob extends CanvaJob> {
  job: TJob;
}

interface CanvaFetchOptions {
  method?: "GET" | "POST";
  /** JSON body. Mutually exclusive with `binaryBody`. */
  json?: unknown;
  /** Raw bytes, sent as application/octet-stream. */
  binaryBody?: ArrayBuffer | Uint8Array;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function toBodyInit(bytes: ArrayBuffer | Uint8Array): BodyInit {
  // A fresh copy keeps TypeScript happy about SharedArrayBuffer-backed views
  // and guarantees fetch receives a plain ArrayBuffer.
  if (bytes instanceof Uint8Array) {
    return bytes.slice().buffer as ArrayBuffer;
  }
  return bytes;
}

/**
 * Calls a Canva Connect endpoint with a valid bearer token and turns error
 * responses into `CanvaApiError`.
 */
export async function canvaFetch<T>(
  path: string,
  options: CanvaFetchOptions = {},
): Promise<T> {
  const accessToken = await getCanvaAccessToken();
  const { method = "GET", json, binaryBody, headers = {}, signal } = options;

  const requestHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...headers,
  };

  let body: BodyInit | undefined;
  if (binaryBody) {
    requestHeaders["Content-Type"] = "application/octet-stream";
    body = toBodyInit(binaryBody);
  } else if (json !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }

  // Retried on transient failures only. The asset upload in particular is a
  // multi-hundred-KB POST, and a dropped connection there loses the guest's
  // photo. Deliberate rejections (400/401/403/404) are not retried.
  try {
    return await withRetry(
      async () => {
        const response = await fetch(`${CANVA_API_BASE}${path}`, {
          method,
          headers: requestHeaders,
          body,
          cache: "no-store",
          // Hard deadline so a stalled socket becomes a retryable failure
          // instead of hanging until the function times out.
          signal: deadlineSignal(REQUEST_DEADLINE_MS, signal),
        });

        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          const { code, message } = describeCanvaError(
            payload,
            `Canva API ${method} ${path} failed with ${response.status} ${response.statusText}`,
          );

          if (response.status === 429 || response.status >= 500) {
            throw new TransientError(message, response.status);
          }
          throw new CanvaApiError(message, response.status, code, path);
        }

        return payload as T;
      },
      { label: `canva ${method} ${path}`, attempts: 3, signal },
    );
  } catch (error) {
    // Retries exhausted: surface it as a CanvaApiError so route handlers can
    // map it to a guest-facing message like any other Canva failure.
    if (error instanceof TransientError) {
      throw new CanvaApiError(error.message, error.status ?? 503, undefined, path);
    }
    throw error;
  }
}

export interface PollOptions {
  /** Delay before the first status check. Keeps fast jobs feeling instant. */
  initialDelayMs?: number;
  /** Delay between subsequent status checks. */
  intervalMs?: number;
  /** Give up after this long and throw `CanvaJobTimeoutError`. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted while waiting for a Canva job."));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Aborted while waiting for a Canva job."));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Re-reads a Canva job until it succeeds, fails, or the timeout elapses.
 *
 * @param jobKind Human-readable label used in error messages ("upload", "autofill", "export").
 * @param statusPath Path to GET, e.g. `/asset-uploads/abc123`.
 */
export async function pollCanvaJob<TJob extends CanvaJob>(
  jobKind: string,
  statusPath: string,
  options: PollOptions = {},
): Promise<TJob> {
  const {
    initialDelayMs = 1_000,
    intervalMs = 3_000,
    timeoutMs = 120_000,
    signal,
  } = options;

  const startedAt = Date.now();
  await sleep(initialDelayMs, signal);

  for (;;) {
    const { job } = await canvaFetch<CanvaJobEnvelope<TJob>>(statusPath, {
      signal,
    });

    if (job.status === "success") return job;

    if (job.status === "failed") {
      throw new CanvaJobError(
        job.error?.message ?? `Canva ${jobKind} job failed.`,
        jobKind,
        job.error?.code,
      );
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed + intervalMs > timeoutMs) {
      throw new CanvaJobTimeoutError(jobKind, elapsed);
    }

    await sleep(intervalMs, signal);
  }
}
