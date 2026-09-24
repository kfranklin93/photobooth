/** Error raised when the Canva Connect API returns a non-2xx response. */
export class CanvaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Canva's machine-readable error code, when present. */
    public readonly code?: string,
    public readonly endpoint?: string,
  ) {
    super(message);
    this.name = "CanvaApiError";
  }
}

/** Error raised when an asynchronous Canva job finishes with status "failed". */
export class CanvaJobError extends Error {
  constructor(
    message: string,
    public readonly jobKind: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "CanvaJobError";
  }
}

/** Error raised when an asynchronous Canva job never reaches a terminal state. */
export class CanvaJobTimeoutError extends Error {
  constructor(
    public readonly jobKind: string,
    public readonly waitedMs: number,
  ) {
    super(
      `Canva ${jobKind} job did not finish within ${Math.round(waitedMs / 1000)}s.`,
    );
    this.name = "CanvaJobTimeoutError";
  }
}

/** Shape of Canva's JSON error payloads. */
export interface CanvaErrorBody {
  code?: string;
  message?: string;
}

export function describeCanvaError(body: unknown, fallback: string): {
  code?: string;
  message: string;
} {
  if (body && typeof body === "object") {
    const { code, message } = body as CanvaErrorBody;
    if (typeof message === "string" && message.length > 0) {
      return { code: typeof code === "string" ? code : undefined, message };
    }
  }
  return { message: fallback };
}
