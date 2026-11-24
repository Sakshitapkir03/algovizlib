import type { PrismaClient } from "@/generated/prisma/client";
import { allowed, type RateLimiter } from "@/lib/auth/rate-limit";

import {
  applyReviewChange,
  DAY_MS,
  mergeReviewStates,
  reviewChangeSchema,
  reviewStatesSchema,
  SNOOZE_DAYS,
  type ReviewChange,
  type ReviewState,
  type ReviewStates,
} from "./rules";

/**
 * `/api/review`: a verified user's review schedule (the interval, last review, and snooze per problem). The user id
 * comes from the session only. If the table isn't there (a deploy whose migration hasn't run) or the database fails,
 * the answer is a 503 and a log line: the queue still shows (computed from progress and quick checks with the first
 * interval), and only "Reviewed" and "Snooze" can't be saved.
 */
export interface ReviewStore {
  load(userId: string): Promise<ReviewStates>;
  /** Apply one change to one problem's row (read, apply, write in one transaction). */
  apply(userId: string, change: ReviewChange, now: number): Promise<void>;
  /** Merge a guest's browser copy into the account; returns the merged states. */
  merge(userId: string, guest: ReviewStates): Promise<ReviewStates>;
}

type Row = {
  problemKey: string;
  stage: number;
  reviewedAt: Date | null;
  snoozedUntil: Date | null;
  updatedAt: Date;
};

function rowToState(row: Row): ReviewState {
  const state: ReviewState = { stage: row.stage, updatedAt: row.updatedAt.getTime() };
  if (row.reviewedAt) state.reviewedAt = row.reviewedAt.getTime();
  if (row.snoozedUntil) state.snoozedUntil = row.snoozedUntil.getTime();
  return state;
}

function stateToRow(state: ReviewState) {
  return {
    stage: state.stage,
    reviewedAt: state.reviewedAt !== undefined ? new Date(state.reviewedAt) : null,
    snoozedUntil: state.snoozedUntil !== undefined ? new Date(state.snoozedUntil) : null,
    updatedAt: new Date(state.updatedAt),
  };
}

export function createPrismaReviewStore(prisma: PrismaClient): ReviewStore {
  type Tx = Pick<PrismaClient, "reviewState">;

  async function load(tx: Tx, userId: string): Promise<ReviewStates> {
    const rows = await tx.reviewState.findMany({ where: { userId } });
    const out: Record<string, ReviewState> = {};
    for (const row of rows) out[row.problemKey] = rowToState(row);
    return out;
  }

  async function write(tx: Tx, userId: string, key: string, state: ReviewState) {
    const data = stateToRow(state);
    await tx.reviewState.upsert({
      where: { userId_problemKey: { userId, problemKey: key } },
      create: { userId, problemKey: key, ...data },
      update: data,
    });
  }

  return {
    load: (userId) => load(prisma, userId),
    apply: (userId, change, now) =>
      prisma.$transaction(async (tx) => {
        const row = await tx.reviewState.findUnique({
          where: { userId_problemKey: { userId, problemKey: change.key } },
        });
        const before: ReviewStates = row ? { [change.key]: rowToState(row) } : {};
        await write(tx, userId, change.key, applyReviewChange(before, change, now)[change.key]);
      }),
    merge: (userId, guest) =>
      prisma.$transaction(async (tx) => {
        const account = await load(tx, userId);
        const merged = mergeReviewStates(account, guest);
        for (const key of Object.keys(merged))
          if (JSON.stringify(merged[key]) !== JSON.stringify(account[key]))
            await write(tx, userId, key, merged[key]);
        return merged;
      }),
  };
}

// --- The API (route handlers are thin wrappers) ---------------------------------------------------------------

export type ReviewApiDeps = {
  user: { id: string; canSync: boolean } | null;
  store: ReviewStore;
  limiter: RateLimiter;
  isProblem: (key: string) => boolean;
  now?: () => number;
  log?: (message: string) => void;
};

export type ReviewApiResult = { status: number; body: unknown };

const MAX_MERGE_STATES = 500;

const UNAVAILABLE: ReviewApiResult = {
  status: 503,
  body: { error: "Reviews can't be saved right now. Try again later." },
};

function guard(deps: ReviewApiDeps): ReviewApiResult | { userId: string } {
  if (!deps.user) return { status: 401, body: { error: "Sign in to sync reviews." } };
  if (!deps.user.canSync) return { status: 403, body: { error: "Verify your email to sync reviews." } };
  return { userId: deps.user.id };
}

/** A missing table reads as "not migrated yet"; anything else from the database is just "unavailable". */
function describe(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "P2021" ? "the ReviewState table is missing: run `pnpm db:deploy`" : "a database error";
}

async function guarded(
  deps: ReviewApiDeps,
  what: string,
  run: () => Promise<ReviewApiResult>,
): Promise<ReviewApiResult> {
  try {
    return await run();
  } catch (error) {
    (deps.log ?? console.error)(`[review] ${what}: ${describe(error)}`);
    return UNAVAILABLE;
  }
}

export async function getReview(deps: ReviewApiDeps): Promise<ReviewApiResult> {
  const g = guard(deps);
  if ("status" in g) return g;
  return guarded(deps, "schedule not loaded", async () => ({
    status: 200,
    body: { states: await deps.store.load(g.userId) },
  }));
}

/** Body: one `ReviewChange`. The session decides whose schedule changes. */
export async function postReview(deps: ReviewApiDeps, body: unknown): Promise<ReviewApiResult> {
  const g = guard(deps);
  if ("status" in g) return g;
  const parsed = reviewChangeSchema.safeParse(body);
  if (!parsed.success || !deps.isProblem(parsed.data.key))
    return { status: 400, body: { error: "Invalid change." } };
  if (!(await allowed(deps.limiter, [["reviewUser", g.userId]])))
    return { status: 429, body: { error: "Too many updates." } };
  return guarded(deps, "change not saved", async () => {
    await deps.store.apply(g.userId, parsed.data, (deps.now ?? Date.now)());
    return { status: 204, body: null };
  });
}

/** Body: `{ states }`, the guest's browser copy. Unknown problems are dropped, future times clamped. */
export async function mergeReview(deps: ReviewApiDeps, body: unknown): Promise<ReviewApiResult> {
  const g = guard(deps);
  if ("status" in g) return g;
  const parsed = reviewStatesSchema.safeParse((body as { states?: unknown } | null)?.states);
  if (!parsed.success || Object.keys(parsed.data).length > MAX_MERGE_STATES)
    return { status: 400, body: { error: "Invalid reviews." } };
  if (!(await allowed(deps.limiter, [["reviewUser", g.userId]])))
    return { status: 429, body: { error: "Too many updates." } };
  const now = (deps.now ?? Date.now)();
  const guest: Record<string, ReviewState> = {};
  for (const [key, state] of Object.entries(parsed.data)) {
    if (!deps.isProblem(key)) continue;
    // A clock in the future can't win every later merge, or snooze for a year.
    const out: ReviewState = { stage: state.stage, updatedAt: Math.min(state.updatedAt, now) };
    if (state.reviewedAt !== undefined) out.reviewedAt = Math.min(state.reviewedAt, now);
    if (state.snoozedUntil !== undefined)
      out.snoozedUntil = Math.min(state.snoozedUntil, now + SNOOZE_DAYS * DAY_MS);
    guest[key] = out;
  }
  return guarded(deps, "merge failed", async () => ({
    status: 200,
    body: { states: await deps.store.merge(g.userId, guest) },
  }));
}
