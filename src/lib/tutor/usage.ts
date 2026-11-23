import { createHash } from "node:crypto";

/**
 * Daily question counts and cached answers, in Postgres so every server instance shares them. Days are Pacific days,
 * because that's when the provider's free quota resets: a count is keyed by the Pacific date, and its row's
 * `windowStart` is the moment the day ends (the reset), so the rate-limit table's sweep of rows a day old never cuts a
 * day short.
 */
const PACIFIC = "America/Los_Angeles";

/** The Pacific date at `now`, "2026-11-23". */
export function pacificDate(now: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

/** When the Pacific day containing `now` ends (the next Pacific midnight), as a timestamp. */
export function pacificDayEnd(now: number): number {
  const today = pacificDate(now);
  // The next midnight is 0–25 hours away (a daylight-saving day is 23 or 25 hours long): the first whole hour whose
  // Pacific date is a later day.
  let t = Math.floor(now / 3_600_000) * 3_600_000;
  while (pacificDate(t) === today) t += 3_600_000;
  // Midnight may not fall on a whole UTC hour (it always does in Pacific time, but stay exact): back off by minutes.
  while (pacificDate(t - 60_000) !== today) t -= 60_000;
  return t;
}

export interface UsageCounter {
  /** The count for `key` today, without adding to it. */
  peek(key: string, dayEnd: number): Promise<number>;
  /** Add one to `key`'s count today; returns the new count. */
  add(key: string, dayEnd: number): Promise<number>;
}

export interface AnswerCache {
  get(key: string): Promise<string | undefined>;
  set(key: string, answer: string): Promise<void>;
}

/** The cache key for a suggested question on one step, under one prompt and model. */
export function answerKey(parts: {
  prompt: string;
  model: string;
  problemKey: string;
  sceneId: string;
  question: string;
}) {
  return createHash("sha256")
    .update([parts.prompt, parts.model, parts.problemKey, parts.sceneId, parts.question].join("\u0000"))
    .digest("hex");
}

export function createMemoryUsage(): UsageCounter {
  const counts = new Map<string, number>();
  const id = (key: string, dayEnd: number) => `${key}@${dayEnd}`;
  return {
    async peek(key, dayEnd) {
      return counts.get(id(key, dayEnd)) ?? 0;
    },
    async add(key, dayEnd) {
      const next = (counts.get(id(key, dayEnd)) ?? 0) + 1;
      counts.set(id(key, dayEnd), next);
      return next;
    },
  };
}

export function createMemoryCache(): AnswerCache & { size: () => number } {
  const answers = new Map<string, string>();
  return {
    async get(key) {
      return answers.get(key);
    },
    async set(key, answer) {
      answers.set(key, answer);
    },
    size: () => answers.size,
  };
}

type RawClient = {
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
};

/** Daily counts in the rate-limit table (one upsert per question, atomic across instances). */
export function createDbUsage(client: RawClient): UsageCounter {
  return {
    async peek(key, dayEnd) {
      const rows = await client.$queryRaw<{ count: number }[]>`
        SELECT "count" FROM "RateLimit" WHERE "key" = ${key} AND "windowStart" = ${new Date(dayEnd)}`;
      return Number(rows[0]?.count ?? 0);
    },
    async add(key, dayEnd) {
      const rows = await client.$queryRaw<{ count: number }[]>`
        INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${key}, ${new Date(dayEnd)}, 1)
        ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimit"."count" + 1
        RETURNING "count"`;
      return Number(rows[0]?.count ?? 1);
    },
  };
}

/** Cached answers in the AskCache table; entries older than 30 days are swept now and then. */
export function createDbCache(client: RawClient): AnswerCache {
  return {
    async get(key) {
      const rows = await client.$queryRaw<
        { answer: string }[]
      >`SELECT "answer" FROM "AskCache" WHERE "key" = ${key}`;
      return rows[0]?.answer;
    },
    async set(key, answer) {
      await client.$executeRaw`
        INSERT INTO "AskCache" ("key", "answer") VALUES (${key}, ${answer})
        ON CONFLICT ("key") DO UPDATE SET "answer" = EXCLUDED."answer", "createdAt" = now()`;
      if (Math.random() < 0.01)
        await client.$executeRaw`DELETE FROM "AskCache" WHERE "createdAt" < now() - interval '30 days'`;
    },
  };
}
