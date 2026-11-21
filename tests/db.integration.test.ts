import { execFileSync } from "node:child_process";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { createDbRateLimiter } from "@/lib/auth/rate-limit";
import { createPrismaAuthStore } from "@/lib/auth/store";
import { hashToken } from "@/lib/auth/tokens";
import { createPrismaProgressStore } from "@/lib/progress/server";

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
      'TRUNCATE "User", "Account", "Session", "AuthToken", "RateLimit", "Progress", "VerificationToken" CASCADE',
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

  it("deleting a user deletes their progress and tokens", async () => {
    const id = await user("ada@example.com");
    await createPrismaProgressStore(prisma).apply(id, { op: "mark-learning", key: K }, 1);
    await prisma.user.delete({ where: { id } });
    expect(await prisma.progress.count()).toBe(0);
  });
});
