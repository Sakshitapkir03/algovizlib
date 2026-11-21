/**
 * Fixed-window rate limits, counted in Postgres (`RateLimit` table) so every server instance shares them. Each
 * action is limited per IP and per email (or per user), and a request must pass all of its limits.
 */
export type Limit = { max: number; windowMs: number };

const MINUTE = 60_000;

export const LIMITS = {
  loginIp: { max: 30, windowMs: 15 * MINUTE },
  loginEmail: { max: 10, windowMs: 15 * MINUTE },
  registerIp: { max: 5, windowMs: 60 * MINUTE },
  registerEmail: { max: 3, windowMs: 60 * MINUTE },
  forgotIp: { max: 10, windowMs: 15 * MINUTE },
  forgotEmail: { max: 3, windowMs: 60 * MINUTE },
  resetIp: { max: 10, windowMs: 15 * MINUTE },
  verifyIp: { max: 20, windowMs: 15 * MINUTE },
  resendUser: { max: 3, windowMs: 60 * MINUTE },
  changePasswordUser: { max: 5, windowMs: 15 * MINUTE },
  progressUser: { max: 300, windowMs: MINUTE },
} as const satisfies Record<string, Limit>;

export type LimitName = keyof typeof LIMITS;

export interface RateLimiter {
  /** Count one attempt against `key`; false once the window's limit is exceeded. */
  hit(key: string, limit: Limit): Promise<boolean>;
}

export const windowStart = (now: number, windowMs: number) => Math.floor(now / windowMs) * windowMs;

/** Check every `[name, subject]` pair (all are counted, so a blocked request still uses up its window). */
export async function allowed(
  limiter: RateLimiter,
  checks: readonly (readonly [LimitName, string])[],
): Promise<boolean> {
  const results = await Promise.all(
    checks.map(([name, subject]) => limiter.hit(`${name}:${subject}`, LIMITS[name])),
  );
  return results.every(Boolean);
}

/** In memory, per process: tests, and a fallback that's never used in production. */
export function createMemoryRateLimiter(now: () => number = Date.now): RateLimiter {
  const counts = new Map<string, number>();
  return {
    async hit(key, limit) {
      const id = `${key}@${windowStart(now(), limit.windowMs)}`;
      const count = (counts.get(id) ?? 0) + 1;
      counts.set(id, count);
      return count <= limit.max;
    },
  };
}

type RawClient = {
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
};

/** Postgres: one upsert per hit (atomic across instances); old windows are swept now and then. */
export function createDbRateLimiter(client: RawClient, now: () => number = Date.now): RateLimiter {
  return {
    async hit(key, limit) {
      const start = new Date(windowStart(now(), limit.windowMs));
      const rows = await client.$queryRaw<{ count: number }[]>`
        INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${key}, ${start}, 1)
        ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimit"."count" + 1
        RETURNING "count"`;
      if (Math.random() < 0.01) {
        const cutoff = new Date(now() - 24 * 60 * MINUTE);
        await client.$executeRaw`DELETE FROM "RateLimit" WHERE "windowStart" < ${cutoff}`;
      }
      return Number(rows[0]?.count ?? 1) <= limit.max;
    },
  };
}
