import { allowed, type RateLimiter } from "@/lib/auth/rate-limit";
import type { PrismaClient } from "@/generated/prisma/client";

import { type CheckResult, checkResultSchema, MAX_RESULTS_PER_REQUEST } from "./results";

/**
 * `/api/checks`: a verified user's quick check answers. POST saves a batch (one answer, or a guest's answers merged on
 * sign-in; an `id` already stored is skipped, so retries and merges keep every answer once). GET returns the latest,
 * for a review queue later. If the table isn't there (a deploy whose migration hasn't run) or the database fails, the
 * answer is a 503 and the browser keeps the answers to send later: the feature never breaks the page.
 */
export interface CheckResultStore {
  save(userId: string, results: readonly CheckResult[]): Promise<number>;
  load(userId: string, limit: number): Promise<CheckResult[]>;
}

export type ChecksApiDeps = {
  user: { id: string; canSync: boolean } | null;
  store: CheckResultStore;
  limiter: RateLimiter;
  isProblem: (key: string) => boolean;
  now?: () => number;
  log?: (message: string) => void;
};

export type ChecksApiResult = { status: number; body: unknown };

const UNAVAILABLE: ChecksApiResult = {
  status: 503,
  body: { error: "Quick check results can't be saved right now; they're kept in this browser." },
};

function guard(deps: ChecksApiDeps): ChecksApiResult | { userId: string } {
  if (!deps.user) return { status: 401, body: { error: "Sign in to save quick check results." } };
  if (!deps.user.canSync)
    return { status: 403, body: { error: "Verify your email to save quick check results." } };
  return { userId: deps.user.id };
}

/** A missing table reads as "not migrated yet"; anything else from the database is just "unavailable". */
function describe(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "P2021" ? "the CheckResult table is missing: run `pnpm db:deploy`" : "a database error";
}

export async function postChecks(deps: ChecksApiDeps, body: unknown): Promise<ChecksApiResult> {
  const g = guard(deps);
  if ("status" in g) return g;
  const list = (body as { results?: unknown } | null)?.results;
  const parsed = checkResultSchema.array().max(MAX_RESULTS_PER_REQUEST).safeParse(list);
  if (!parsed.success) return { status: 400, body: { error: "Invalid results." } };
  if (!(await allowed(deps.limiter, [["checksUser", g.userId]])))
    return { status: 429, body: { error: "Too many updates." } };
  const now = (deps.now ?? Date.now)();
  // Unknown problems are dropped, and a clock in the future is clamped to now.
  const results = parsed.data
    .filter((r) => deps.isProblem(r.problemKey))
    .map((r) => ({ ...r, answeredAt: Math.min(r.answeredAt, now) }));
  try {
    const saved = await deps.store.save(g.userId, results);
    return { status: 200, body: { saved } };
  } catch (error) {
    (deps.log ?? console.error)(`[checks] results not saved: ${describe(error)}`);
    return UNAVAILABLE;
  }
}

export async function getChecks(deps: ChecksApiDeps): Promise<ChecksApiResult> {
  const g = guard(deps);
  if ("status" in g) return g;
  try {
    return { status: 200, body: { results: await deps.store.load(g.userId, 500) } };
  } catch (error) {
    (deps.log ?? console.error)(`[checks] results not loaded: ${describe(error)}`);
    return UNAVAILABLE;
  }
}

export function createPrismaCheckResultStore(prisma: PrismaClient): CheckResultStore {
  return {
    async save(userId, results) {
      if (results.length === 0) return 0;
      const { count } = await prisma.checkResult.createMany({
        data: results.map((r) => ({
          userId,
          id: r.id,
          problemKey: r.problemKey,
          questionId: r.questionId,
          sceneId: r.sceneId,
          step: r.step,
          correct: r.correct,
          source: r.source,
          input: r.input ?? null,
          answeredAt: new Date(r.answeredAt),
        })),
        skipDuplicates: true,
      });
      return count;
    },
    async load(userId, limit) {
      const rows = await prisma.checkResult.findMany({
        where: { userId },
        orderBy: { answeredAt: "desc" },
        take: limit,
      });
      return rows.map((row) => ({
        id: row.id,
        problemKey: row.problemKey,
        questionId: row.questionId,
        sceneId: row.sceneId,
        step: row.step,
        correct: row.correct,
        source: row.source === "walkthrough" ? "walkthrough" : "video",
        ...(row.input ? { input: row.input } : {}),
        answeredAt: row.answeredAt.getTime(),
      }));
    },
  };
}
