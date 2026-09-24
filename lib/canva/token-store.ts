/**
 * Persistence for Canva Connect OAuth tokens.
 *
 * Canva rotates the refresh token every time you exchange one: the old value is
 * invalidated and a brand new refresh token comes back in the response. That
 * makes a plain `CANVA_REFRESH_TOKEN` env var a one-shot credential, so the
 * rotated value has to be stored somewhere the server can read back later.
 *
 * Three backends are supported, picked automatically:
 *
 *  1. Upstash Redis (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`)
 *     — the right choice on Vercel/Netlify, where the filesystem is ephemeral
 *     and each request may hit a different instance.
 *  2. A local JSON file (`CANVA_TOKEN_FILE`, default `.canva-token.json`)
 *     — good for `npm run dev` and for a kiosk served from one long-running
 *     Node process.
 *  3. Process memory — the fallback. Works fine until the process restarts,
 *     at which point the seed `CANVA_REFRESH_TOKEN` is used again.
 */

export interface StoredTokens {
  refreshToken: string;
  accessToken?: string;
  /** Epoch milliseconds at which `accessToken` stops being usable. */
  accessTokenExpiresAt?: number;
}

export interface TokenStore {
  readonly name: string;
  read(): Promise<StoredTokens | null>;
  write(tokens: StoredTokens): Promise<void>;
}

const STORE_KEY = "canva:connect:tokens";

/** Survives for the life of the process only. */
class MemoryTokenStore implements TokenStore {
  readonly name = "memory";
  private tokens: StoredTokens | null = null;

  async read(): Promise<StoredTokens | null> {
    return this.tokens;
  }

  async write(tokens: StoredTokens): Promise<void> {
    this.tokens = tokens;
  }
}

/** JSON file on disk. Degrades to in-memory if the path is not writable. */
class FileTokenStore implements TokenStore {
  readonly name = "file";
  private readonly memoryFallback = new MemoryTokenStore();
  private degraded = false;

  constructor(private readonly filePath: string) {}

  async read(): Promise<StoredTokens | null> {
    if (this.degraded) return this.memoryFallback.read();
    try {
      const { readFile } = await import("node:fs/promises");
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as StoredTokens;
      return typeof parsed?.refreshToken === "string" ? parsed : null;
    } catch {
      // Missing or unreadable file simply means "nothing stored yet".
      return this.memoryFallback.read();
    }
  }

  async write(tokens: StoredTokens): Promise<void> {
    await this.memoryFallback.write(tokens);
    if (this.degraded) return;
    try {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(this.filePath, JSON.stringify(tokens, null, 2), {
        encoding: "utf8",
        mode: 0o600,
      });
    } catch (error) {
      this.degraded = true;
      console.warn(
        `[canva] Could not persist rotated refresh token to ${this.filePath}; ` +
          `keeping it in memory for this process only. ` +
          `Configure Upstash Redis for durable storage on serverless hosts. ` +
          `(${(error as Error).message})`,
      );
    }
  }
}

/** Upstash Redis over its REST API — no extra dependency needed. */
class UpstashTokenStore implements TokenStore {
  readonly name = "upstash";

  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  private async command(...args: string[]): Promise<unknown> {
    const response = await fetch(`${this.url.replace(/\/+$/, "")}/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(
        `Upstash request failed with ${response.status} ${response.statusText}`,
      );
    }
    const payload = (await response.json()) as { result?: unknown };
    return payload.result ?? null;
  }

  async read(): Promise<StoredTokens | null> {
    try {
      const result = await this.command("GET", STORE_KEY);
      if (typeof result !== "string") return null;
      const parsed = JSON.parse(result) as StoredTokens;
      return typeof parsed?.refreshToken === "string" ? parsed : null;
    } catch (error) {
      console.warn(
        `[canva] Could not read tokens from Upstash: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async write(tokens: StoredTokens): Promise<void> {
    try {
      await this.command("SET", STORE_KEY, JSON.stringify(tokens));
    } catch (error) {
      console.warn(
        `[canva] Could not persist tokens to Upstash: ${(error as Error).message}`,
      );
    }
  }
}

/**
 * Postgres (Neon) over its HTTP driver.
 *
 * Neon's serverless driver speaks HTTP rather than holding a TCP connection, so
 * it suits short-lived serverless invocations — no pool to exhaust. The table is
 * created on first write, so there's no migration step to remember.
 */
class NeonTokenStore implements TokenStore {
  readonly name = "neon";
  private ensured = false;

  constructor(private readonly connectionString: string) {}

  private async sql() {
    const { neon } = await import("@neondatabase/serverless");
    return neon(this.connectionString);
  }

  private async ensureTable(): Promise<void> {
    if (this.ensured) return;
    const sql = await this.sql();
    await sql`
      CREATE TABLE IF NOT EXISTS canva_tokens (
        id                      text PRIMARY KEY,
        refresh_token           text NOT NULL,
        access_token            text,
        access_token_expires_at bigint,
        updated_at              timestamptz NOT NULL DEFAULT now()
      )
    `;
    this.ensured = true;
  }

  async read(): Promise<StoredTokens | null> {
    try {
      await this.ensureTable();
      const sql = await this.sql();
      const rows = (await sql`
        SELECT refresh_token, access_token, access_token_expires_at
        FROM canva_tokens
        WHERE id = ${STORE_KEY}
      `) as Array<{
        refresh_token: string;
        access_token: string | null;
        access_token_expires_at: string | number | null;
      }>;

      const row = rows[0];
      if (!row?.refresh_token) return null;

      return {
        refreshToken: row.refresh_token,
        accessToken: row.access_token ?? undefined,
        // bigint comes back as a string from Postgres.
        accessTokenExpiresAt:
          row.access_token_expires_at == null
            ? undefined
            : Number(row.access_token_expires_at),
      };
    } catch (error) {
      console.warn(
        `[canva] Could not read tokens from Neon: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async write(tokens: StoredTokens): Promise<void> {
    try {
      await this.ensureTable();
      const sql = await this.sql();
      await sql`
        INSERT INTO canva_tokens
          (id, refresh_token, access_token, access_token_expires_at, updated_at)
        VALUES (
          ${STORE_KEY},
          ${tokens.refreshToken},
          ${tokens.accessToken ?? null},
          ${tokens.accessTokenExpiresAt ?? null},
          now()
        )
        ON CONFLICT (id) DO UPDATE SET
          refresh_token           = EXCLUDED.refresh_token,
          access_token            = EXCLUDED.access_token,
          access_token_expires_at = EXCLUDED.access_token_expires_at,
          updated_at              = now()
      `;
    } catch (error) {
      console.warn(
        `[canva] Could not persist tokens to Neon: ${(error as Error).message}`,
      );
    }
  }
}

/** Connection string env vars, in the order Vercel's Neon integration sets them. */
function neonConnectionString(): string | undefined {
  for (const key of [
    "CANVA_TOKEN_DATABASE_URL", // explicit override
    "DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "DATABASE_URL_UNPOOLED",
    "POSTGRES_URL_NON_POOLING",
  ]) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

let cachedStore: TokenStore | undefined;

export function getTokenStore(): TokenStore {
  if (cachedStore) return cachedStore;

  // Postgres first: if a database is attached, it's the most durable option and
  // needs no extra service.
  const connectionString = neonConnectionString();
  if (connectionString) {
    cachedStore = new NeonTokenStore(connectionString);
    return cachedStore;
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (upstashUrl && upstashToken) {
    cachedStore = new UpstashTokenStore(upstashUrl, upstashToken);
    return cachedStore;
  }

  const explicitFile = process.env.CANVA_TOKEN_FILE?.trim();
  // Serverless filesystems are read-only apart from /tmp, so only reach for a
  // file store when running a normal Node process (or when told to).
  const isServerless = Boolean(
    process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME,
  );
  if (explicitFile || !isServerless) {
    cachedStore = new FileTokenStore(explicitFile ?? ".canva-token.json");
    return cachedStore;
  }

  console.warn(
    "[canva] No durable token store configured. Attach a Postgres database " +
      "(DATABASE_URL) or set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, " +
      "so rotated Canva refresh tokens survive between invocations.",
  );
  cachedStore = new MemoryTokenStore();
  return cachedStore;
}

/** Test/utility hook to reset the memoised store. */
export function resetTokenStore(): void {
  cachedStore = undefined;
}
