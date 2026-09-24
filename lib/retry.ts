/**
 * Retry helper for transient network failures.
 *
 * Added in response to an observed failure: uploading a 1.5 MB attachment to
 * Resend succeeded twice and then dropped mid-request (458 KB of 1.54 MB sent)
 * on the same connection. Every guest photo involves several multi-hundred-KB
 * uploads, so a single dropped connection would otherwise lose that guest's
 * photo outright.
 *
 * Only transient conditions are retried: connection errors, timeouts, 429, and
 * 5xx. Anything the server rejected deliberately (400, 401, 403, 404) fails
 * immediately, since resending it would just fail the same way.
 */

export interface RetryOptions {
  attempts?: number;
  /** Delay before the first retry. Doubles each time. */
  baseDelayMs?: number;
  /** Ceiling for the backoff delay. */
  maxDelayMs?: number;
  /** Label used in warning logs. */
  label?: string;
  signal?: AbortSignal;
}

/** Marks an error as worth retrying. Thrown by callers that inspect responses. */
export class TransientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "TransientError";
  }
}

/**
 * Combines a caller's abort signal with a hard deadline.
 *
 * Node's fetch has no default timeout, so a stalled upload hangs until the
 * platform kills the function. Worse, it never throws, so `withRetry` never
 * gets a chance to retry. A deadline converts a hang into a transient failure
 * that can actually be retried.
 */
export function deadlineSignal(ms: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/**
 * Rejects with a `TransientError` if `task` hasn't settled within `ms`.
 *
 * For work that can't accept an AbortSignal (the Resend SDK, for one). The
 * underlying request isn't cancelled, but the caller stops waiting and the
 * retry can proceed.
 */
export function withTimeout<T>(
  task: () => Promise<T>,
  ms: number,
  label = "request",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TransientError(`${label} timed out after ${ms}ms`));
    }, ms);
    task().then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function isTransient(error: unknown): boolean {
  if (error instanceof TransientError) return true;

  // A user/route abort must not be retried.
  if (error instanceof DOMException && error.name === "AbortError") return false;

  if (error instanceof Error) {
    // undici / Node fetch network failures surface as TypeError: fetch failed,
    // usually with a cause carrying the socket-level code.
    const cause = (error as { cause?: { code?: string } }).cause;
    const code = cause?.code ?? "";
    if (
      [
        "ECONNRESET",
        "ECONNREFUSED",
        "EPIPE",
        "ETIMEDOUT",
        "ENOTFOUND",
        "EAI_AGAIN",
        "UND_ERR_SOCKET",
        "UND_ERR_CONNECT_TIMEOUT",
        "UND_ERR_HEADERS_TIMEOUT",
        "UND_ERR_BODY_TIMEOUT",
      ].includes(code)
    ) {
      return true;
    }
    if (/fetch failed|network|socket|terminated/i.test(error.message)) return true;
  }

  return false;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Runs `task`, retrying transient failures with exponential backoff and jitter.
 */
export async function withRetry<T>(
  task: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    attempts = 3,
    baseDelayMs = 700,
    maxDelayMs = 6_000,
    label = "request",
    signal,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;

      if (attempt === attempts || !isTransient(error)) throw error;

      // Jitter avoids several concurrent guests retrying in lockstep.
      const backoff = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const delay = backoff / 2 + Math.random() * (backoff / 2);

      console.warn(
        `[retry] ${label} failed (attempt ${attempt}/${attempts}), retrying in ` +
          `${Math.round(delay)}ms: ${
            error instanceof Error ? error.message : String(error)
          }`,
      );
      await sleep(delay, signal);
    }
  }

  throw lastError;
}
