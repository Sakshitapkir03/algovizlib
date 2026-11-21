import type { PrismaClient } from "@/generated/prisma/client";
import type { RateLimiter } from "@/lib/auth/rate-limit";
import { allowed } from "@/lib/auth/rate-limit";

import {
  applyChange,
  mergeRecords,
  progressChangeSchema,
  progressRecordsSchema,
  progressStatusSchema,
  type ProgressChange,
  type ProgressRecord,
  type ProgressRecords,
} from "./records";

/**
 * The account copy of progress on the server. Every function takes the user id from the session (never from the
 * request), so nobody can read or write another user's progress. Changes go through the same `applyChange` as the
 * browser copy, so both follow the same rules.
 */
export interface ProgressStore {
  load(userId: string): Promise<ProgressRecords>;
  /** Apply one change to one problem's row (read, apply, write in one transaction). */
  apply(userId: string, change: ProgressChange, now: number): Promise<void>;
  /** Merge a guest's browser copy into the account; returns the merged records. */
  merge(userId: string, guest: ProgressRecords): Promise<ProgressRecords>;
}

type Row = {
  problemKey: string;
  status: string;
  statusManual: boolean;
  statusUpdatedAt: Date;
  sceneId: string | null;
  positionSeconds: number | null;
  positionUpdatedAt: Date | null;
};

export function rowToRecord(row: Row): ProgressRecord | undefined {
  const status = progressStatusSchema.safeParse(row.status);
  if (!status.success) return undefined;
  const record: ProgressRecord = {
    status: status.data,
    manual: row.statusManual,
    updatedAt: row.statusUpdatedAt.getTime(),
  };
  if (row.sceneId !== null && row.positionSeconds !== null && row.positionUpdatedAt !== null)
    record.position = {
      sceneId: row.sceneId,
      seconds: row.positionSeconds,
      updatedAt: row.positionUpdatedAt.getTime(),
    };
  return record;
}

export function recordToRow(record: ProgressRecord) {
  return {
    status: record.status,
    statusManual: record.manual,
    statusUpdatedAt: new Date(record.updatedAt),
    sceneId: record.position?.sceneId ?? null,
    positionSeconds: record.position?.seconds ?? null,
    positionUpdatedAt: record.position ? new Date(record.position.updatedAt) : null,
  };
}

const rowFields = {
  problemKey: true,
  status: true,
  statusManual: true,
  statusUpdatedAt: true,
  sceneId: true,
  positionSeconds: true,
  positionUpdatedAt: true,
} as const;

export function createPrismaProgressStore(prisma: PrismaClient): ProgressStore {
  type Tx = Pick<PrismaClient, "progress">;

  async function write(tx: Tx, userId: string, key: string, record: ProgressRecord | undefined) {
    if (!record) {
      await tx.progress.deleteMany({ where: { userId, problemKey: key } });
      return;
    }
    const data = recordToRow(record);
    await tx.progress.upsert({
      where: { userId_problemKey: { userId, problemKey: key } },
      create: { userId, problemKey: key, ...data },
      update: data,
    });
  }

  async function load(tx: Tx, userId: string): Promise<ProgressRecords> {
    const rows = await tx.progress.findMany({ where: { userId }, select: rowFields });
    const out: Record<string, ProgressRecord> = {};
    for (const row of rows) {
      const record = rowToRecord(row);
      if (record) out[row.problemKey] = record;
    }
    return out;
  }

  return {
    load: (userId) => load(prisma, userId),
    apply: (userId, change, now) =>
      prisma.$transaction(async (tx) => {
        const row = await tx.progress.findUnique({
          where: { userId_problemKey: { userId, problemKey: change.key } },
          select: rowFields,
        });
        const current = row ? rowToRecord(row) : undefined;
        const before: ProgressRecords = current ? { [change.key]: current } : {};
        const after = applyChange(before, change, now);
        if (after !== before) await write(tx, userId, change.key, after[change.key]);
      }),
    merge: (userId, guest) =>
      prisma.$transaction(async (tx) => {
        const account = await load(tx, userId);
        const merged = mergeRecords(account, guest);
        for (const key of Object.keys(merged))
          if (JSON.stringify(merged[key]) !== JSON.stringify(account[key]))
            await write(tx, userId, key, merged[key]);
        return merged;
      }),
  };
}

// --- The API (route handlers are thin wrappers) ---------------------------------------------------------------

export type ProgressApiDeps = {
  /** The signed-in user, from the session only. `canSync`: the email is verified. */
  user: { id: string; canSync: boolean } | null;
  store: ProgressStore;
  limiter: RateLimiter;
  /** Problem keys that exist ("<pattern>/<slug>"). */
  isProblem: (key: string) => boolean;
  now?: () => number;
};

export type ApiResult = { status: number; body: unknown };

const MAX_MERGE_RECORDS = 500;

function guard(deps: ProgressApiDeps): ApiResult | { userId: string } {
  if (!deps.user) return { status: 401, body: { error: "Sign in to sync progress." } };
  if (!deps.user.canSync) return { status: 403, body: { error: "Verify your email to sync progress." } };
  return { userId: deps.user.id };
}

export async function getProgress(deps: ProgressApiDeps): Promise<ApiResult> {
  const g = guard(deps);
  if ("status" in g) return g;
  return { status: 200, body: { records: await deps.store.load(g.userId) } };
}

/** Body: one `ProgressChange`. Any `userId` in it is ignored: the session decides whose progress changes. */
export async function postProgress(deps: ProgressApiDeps, body: unknown): Promise<ApiResult> {
  const g = guard(deps);
  if ("status" in g) return g;
  const parsed = progressChangeSchema.safeParse(body);
  if (!parsed.success || !deps.isProblem(parsed.data.key))
    return { status: 400, body: { error: "Invalid change." } };
  if (!(await allowed(deps.limiter, [["progressUser", g.userId]])))
    return { status: 429, body: { error: "Too many updates." } };
  await deps.store.apply(g.userId, parsed.data, (deps.now ?? Date.now)());
  return { status: 204, body: null };
}

/** Body: `{ records }`, the guest's browser copy. Unknown problems are dropped. Returns the merged records. */
export async function mergeProgress(deps: ProgressApiDeps, body: unknown): Promise<ApiResult> {
  const g = guard(deps);
  if ("status" in g) return g;
  const parsed = progressRecordsSchema.safeParse((body as { records?: unknown } | null)?.records);
  if (!parsed.success || Object.keys(parsed.data).length > MAX_MERGE_RECORDS)
    return { status: 400, body: { error: "Invalid progress." } };
  if (!(await allowed(deps.limiter, [["progressUser", g.userId]])))
    return { status: 429, body: { error: "Too many updates." } };
  const now = (deps.now ?? Date.now)();
  const guest: Record<string, ProgressRecord> = {};
  for (const [key, record] of Object.entries(parsed.data)) {
    if (!deps.isProblem(key)) continue;
    // A clock in the future can't win every later merge.
    const clamp = (t: number) => Math.min(t, now);
    guest[key] = {
      ...record,
      updatedAt: clamp(record.updatedAt),
      ...(record.position && {
        position: { ...record.position, updatedAt: clamp(record.position.updatedAt) },
      }),
    };
  }
  return { status: 200, body: { records: await deps.store.merge(g.userId, guest) } };
}

/**
 * Same-origin check for state-changing requests (on top of SameSite=Lax session cookies): the `Origin` header,
 * which browsers always send on POST (including `sendBeacon`), must be this site.
 */
export function sameOrigin(request: Request, expected: string = new URL(request.url).origin): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === expected;
}
