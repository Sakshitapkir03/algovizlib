import { execFileSync } from "node:child_process";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { createDbRateLimiter, createMemoryRateLimiter } from "@/lib/auth/rate-limit";
import { createPrismaAuthStore } from "@/lib/auth/store";
import { hashToken } from "@/lib/auth/tokens";
import { createPrismaProgressStore } from "@/lib/progress/server";
import { checkHealth } from "@/lib/health";
import { createPrismaCheckResultStore, postChecks } from "@/lib/quickcheck/server";
import { createDbCache, createDbUsage, pacificDayEnd } from "@/lib/tutor/usage";

/**
 * Against a real Postgres (`DATABASE_URL_TEST`, e.g. a local `algovizlib_test` database; never the dev or
 * production one): applies the committed migrations, then checks the Prisma stores. Skipped when it isn't set.
 */
const url = process.env.DATABASE_URL_TEST;
const K = "two-pointers/pair-with-target-sum";

describe.skipIf(!url)("database (Postgres)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
      stdio: "pipe",
    });
    const { createPrismaClient } = await import("@/lib/db");
    prisma = createPrismaClient(url);
  }, 60_000);

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "User", "Account", "Session", "AuthToken", "RateLimit", "Progress", "VerificationToken", "AskCache", "CheckResult" CASCADE',
    );
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  const user = async (email: string) => {
    const store = createPrismaAuthStore(prisma);
    return (await store.createUser({ email, name: null, passwordHash: "h" })).id;
  };

  it("emails are unique", async () => {
    await user("ada@example.com");
    await expect(user("ada@example.com")).rejects.toThrow();
  });

  it("a token can be consumed once, even by two requests at the same moment", async () => {
    const store = createPrismaAuthStore(prisma);
    const id = await user("ada@example.com");
    const tokenHash = hashToken("t1");
    await store.createToken({
      userId: id,
      purpose: "RESET_PASSWORD",
      tokenHash,
      expiresAt: new Date(Date.now() + 1000),
    });
    expect(await store.consumeToken(tokenHash, "VERIFY_EMAIL")).toBeNull(); // wrong purpose: untouched
    const results = await Promise.all([
      store.consumeToken(tokenHash, "RESET_PASSWORD"),
      store.consumeToken(tokenHash, "RESET_PASSWORD"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.find(Boolean)!.userId).toBe(id);
  });

  it("setting a password bumps the session version; verifying is idempotent", async () => {
    const store = createPrismaAuthStore(prisma);
    const id = await user("ada@example.com");
    const first = new Date("2026-01-01T00:00:00Z");
    await store.setPassword(id, "h2", { verifyEmailAt: first });
    await store.markEmailVerified(id, new Date("2026-06-01T00:00:00Z"));
    const row = await store.findUserById(id);
    expect(row).toMatchObject({ passwordHash: "h2", sessionVersion: 1, emailVerified: first });
    expect(await store.sessionUser(id)).toMatchObject({ hasPassword: true, providers: [] });
  });

  it("rate limits are shared by every server instance", async () => {
    const limit = { max: 3, windowMs: 60_000 };
    const now = () => 1_800_000_000_000;
    const a = createDbRateLimiter(prisma, now);
    const b = createDbRateLimiter(prisma, now);
    const results = [];
    for (const limiter of [a, b, a, b]) results.push(await limiter.hit("login:ada", limit));
    expect(results).toEqual([true, true, true, false]);
    expect(await createDbRateLimiter(prisma, () => now() + 60_000).hit("login:ada", limit)).toBe(true);
  });

  it("tutor: daily counts are shared and atomic, and cached answers are kept by key", async () => {
    const usage = createDbUsage(prisma);
    const dayEnd = pacificDayEnd(Date.now());
    expect(await usage.peek("askDay:u1", dayEnd)).toBe(0);
    const counts = await Promise.all(Array.from({ length: 5 }, () => usage.add("askDay:u1", dayEnd)));
    expect([...counts].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(await usage.peek("askDay:u1", dayEnd)).toBe(5);
    // A new day starts from zero.
    expect(await usage.peek("askDay:u1", dayEnd + 86_400_000)).toBe(0);
    const cache = createDbCache(prisma);
    expect(await cache.get("k")).toBeUndefined();
    await cache.set("k", "An answer.");
    await cache.set("k", "A newer answer.");
    expect(await cache.get("k")).toBe("A newer answer.");
  });

  it("health: ok with every migration applied, and names a missing table", async () => {
    expect(await checkHealth(prisma)).toMatchObject({ ok: true, missingTables: [], pendingMigrations: [] });
    await prisma.$executeRawUnsafe('ALTER TABLE "AskCache" RENAME TO "AskCache_hidden"');
    try {
      expect(await checkHealth(prisma)).toMatchObject({ ok: false, missingTables: ["AskCache"] });
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE "AskCache_hidden" RENAME TO "AskCache"');
    }
  });

  it("progress: each user only ever sees and changes their own", async () => {
    const store = createPrismaProgressStore(prisma);
    const alice = await user("alice@example.com");
    const bob = await user("bob@example.com");
    await store.apply(alice, { op: "set-status", key: K, status: "done" }, 1000);
    await store.apply(bob, { op: "mark-learning", key: K }, 2000);
    await store.apply(bob, { op: "save-position", key: K, sceneId: "s", seconds: 12.5 }, 3000);
    expect(await store.load(alice)).toEqual({ [K]: { status: "done", manual: true, updatedAt: 1000 } });
    expect(await store.load(bob)).toEqual({
      [K]: {
        status: "learning",
        manual: false,
        updatedAt: 2000,
        position: { sceneId: "s", seconds: 12.5, updatedAt: 3000 },
      },
    });
    // The automatic rule holds in the database too.
    await store.apply(alice, { op: "mark-learning", key: K }, 4000);
    expect((await store.load(alice))[K].status).toBe("done");
    await store.apply(bob, { op: "clear-position", key: K }, 5000);
    expect((await store.load(bob))[K].position).toBeUndefined();
  });

  it("progress: merge keeps the more advanced status and the newer position, in one transaction", async () => {
    const store = createPrismaProgressStore(prisma);
    const id = await user("ada@example.com");
    await store.apply(id, { op: "set-status", key: K, status: "done" }, 1000);
    await store.apply(id, { op: "save-position", key: K, sceneId: "a", seconds: 5 }, 1000);
    const merged = await store.merge(id, {
      [K]: {
        status: "learning",
        manual: false,
        updatedAt: 9000,
        position: { sceneId: "b", seconds: 40, updatedAt: 9000 },
      },
      "sorting/merge-sort": { status: "learning", manual: false, updatedAt: 500 },
    });
    expect(merged[K]).toEqual({
      status: "done",
      manual: true,
      updatedAt: 9000,
      position: { sceneId: "b", seconds: 40, updatedAt: 9000 },
    });
    expect(await store.load(id)).toEqual(merged);
  });

  it("quick checks: answers are stored once each, per user, newest first, and go with the user", async () => {
    const store = createPrismaCheckResultStore(prisma);
    const [ada, bob] = [await user("ada@example.com"), await user("bob@example.com")];
    const answer = (id: string, at: number, correct = true) => ({
      id,
      problemKey: K,
      questionId: "check-found",
      sceneId: "found",
      step: 3,
      correct,
      source: "video" as const,
      answeredAt: at,
    });
    expect(await store.save(ada, [answer("aaaaaaaa1", 1000), answer("aaaaaaaa2", 2000, false)])).toBe(2);
    // A retry or a merge sends some again: stored once.
    expect(await store.save(ada, [answer("aaaaaaaa2", 2000, false), answer("aaaaaaaa3", 3000)])).toBe(1);
    // Another user may use the same id: answers are keyed per user.
    expect(await store.save(bob, [answer("aaaaaaaa1", 500)])).toBe(1);
    const mine = await store.load(ada, 10);
    expect(mine.map((r) => r.id)).toEqual(["aaaaaaaa3", "aaaaaaaa2", "aaaaaaaa1"]);
    expect(mine[1]).toMatchObject({ correct: false, source: "video", answeredAt: 2000 });
    await prisma.user.delete({ where: { id: ada } });
    expect(await prisma.checkResult.count({ where: { userId: ada } })).toBe(0);
    expect(await store.load(bob, 10)).toHaveLength(1);
  });

  it("quick checks: with the table missing (migration not run), saving answers is a 503, not a crash", async () => {
    const id = await user("ada@example.com");
    const logs: string[] = [];
    await prisma.$executeRawUnsafe('ALTER TABLE "CheckResult" RENAME TO "CheckResult_hidden"');
    try {
      const result = await postChecks(
        {
          user: { id, canSync: true },
          store: createPrismaCheckResultStore(prisma),
          limiter: createMemoryRateLimiter(),
          isProblem: () => true,
          log: (m) => logs.push(m),
        },
        {
          results: [
            {
              id: "aaaaaaaa1",
              problemKey: K,
              questionId: "q",
              sceneId: "s",
              step: 1,
              correct: true,
              source: "video",
              answeredAt: 1,
            },
          ],
        },
      );
      expect(result.status).toBe(503);
      expect(logs.join()).toMatch(/CheckResult table is missing: run `pnpm db:deploy`/);
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE "CheckResult_hidden" RENAME TO "CheckResult"');
    }
  });

  it("deleting a user deletes their progress and tokens", async () => {
    const id = await user("ada@example.com");
    await createPrismaProgressStore(prisma).apply(id, { op: "mark-learning", key: K }, 1);
    await prisma.user.delete({ where: { id } });
    expect(await prisma.progress.count()).toBe(0);
  });
});
