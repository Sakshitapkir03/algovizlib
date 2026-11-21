import { z } from "zod";

/**
 * The data behind a learner's progress, shared by the browser copy (guests) and the account copy (database): per
 * problem, a status (who set it, when) and where its video was left. Pure functions only, so the rules (merging,
 * automatic status) are tested once and used by both copies and the server.
 */
export const progressStatusSchema = z.enum(["not-started", "learning", "done"]);
export type ProgressStatus = z.infer<typeof progressStatusSchema>;

export const PROGRESS_STATUSES: readonly ProgressStatus[] = progressStatusSchema.options;
export const PROGRESS_LABEL: Record<ProgressStatus, string> = {
  "not-started": "Not started",
  learning: "Learning",
  done: "Done",
};

const RANK: Record<ProgressStatus, number> = { "not-started": 0, learning: 1, done: 2 };
export const statusRank = (status: ProgressStatus) => RANK[status];

/** The longest video is a few minutes; anything past an hour is bad input. */
export const MAX_POSITION_SECONDS = 3600;

export const videoPositionSchema = z.object({
  sceneId: z.string().min(1).max(100),
  /** Seconds from the start of the video. */
  seconds: z.number().min(0).max(MAX_POSITION_SECONDS),
  /** Epoch ms. */
  updatedAt: z.number().int().nonnegative(),
});
export type VideoPosition = z.infer<typeof videoPositionSchema>;

export const progressRecordSchema = z.object({
  status: progressStatusSchema,
  /** The learner chose this status (the selector or "Mark as done"); automatic updates never override it. */
  manual: z.boolean(),
  /** Epoch ms of the last status change. */
  updatedAt: z.number().int().nonnegative(),
  position: videoPositionSchema.optional(),
});
export type ProgressRecord = z.infer<typeof progressRecordSchema>;

/** Problem key ("<pattern>/<slug>") → record. Problems without one are not started, with no saved position. */
export const progressRecordsSchema = z.record(z.string().min(1).max(200), progressRecordSchema);
export type ProgressRecords = Readonly<Record<string, ProgressRecord>>;

/** Problem key → status: what the status UI reads. */
export type ProgressSnapshot = Readonly<Record<string, ProgressStatus>>;

export function statusesOf(records: ProgressRecords): ProgressSnapshot {
  const out: Record<string, ProgressStatus> = {};
  for (const [key, record] of Object.entries(records))
    if (record.status !== "not-started") out[key] = record.status;
  return out;
}

const EMPTY: ProgressRecord = { status: "not-started", manual: false, updatedAt: 0 };

/** A record worth keeping: a status other than not-started, a manual choice, or a saved position. */
const isEmpty = (r: ProgressRecord) => r.status === "not-started" && !r.manual && !r.position;

function withRecord(records: ProgressRecords, key: string, next: ProgressRecord): ProgressRecords {
  const out = { ...records };
  if (isEmpty(next)) delete out[key];
  else out[key] = next;
  return out;
}

/** The learner picked a status. Always applied, up or down, and remembered as manual. */
export function applyManualStatus(
  records: ProgressRecords,
  key: string,
  status: ProgressStatus,
  now: number,
): ProgressRecords {
  const current = records[key] ?? EMPTY;
  if (current.status === status && current.manual) return records;
  return withRecord(records, key, { ...current, status, manual: true, updatedAt: now });
}

/** What may set "Learning" automatically: playing the video, revealing a hint, or opening "Show approach". */
export type LearningTrigger = "video-play" | "hint" | "approach";

/**
 * The automatic rule: "Learning" only from "Not started", and never over a status the learner chose (even a
 * manual "Not started"). "Done" is never set automatically.
 */
export function shouldMarkLearning(record: ProgressRecord | undefined): boolean {
  return !record || (record.status === "not-started" && !record.manual);
}

export function applyAutoLearning(records: ProgressRecords, key: string, now: number): ProgressRecords {
  const current = records[key];
  if (!shouldMarkLearning(current)) return records;
  return withRecord(records, key, {
    ...(current ?? EMPTY),
    status: "learning",
    manual: false,
    updatedAt: now,
  });
}

export function applyPosition(
  records: ProgressRecords,
  key: string,
  position: VideoPosition | undefined,
): ProgressRecords {
  const current = records[key] ?? EMPTY;
  if (!position && !current.position) return records;
  const next: ProgressRecord = {
    status: current.status,
    manual: current.manual,
    updatedAt: current.updatedAt,
  };
  if (position) next.position = position;
  return withRecord(records, key, next);
}

/**
 * Merge two copies of one problem's progress (a guest's browser copy into the account): the more advanced status
 * wins, so nothing is ever downgraded (on a tie, the newer one, and manual if either is); the more recently saved
 * video position wins.
 */
export function mergeRecord(a: ProgressRecord | undefined, b: ProgressRecord | undefined): ProgressRecord {
  if (!a) return b ?? EMPTY;
  if (!b) return a;
  const ra = statusRank(a.status);
  const rb = statusRank(b.status);
  const status = ra > rb ? a : rb > ra ? b : a.updatedAt >= b.updatedAt ? a : b;
  const manual = ra === rb ? a.manual || b.manual : status.manual;
  const position =
    !a.position || (b.position && b.position.updatedAt > a.position.updatedAt) ? b.position : a.position;
  const out: ProgressRecord = {
    status: status.status,
    manual,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
  if (position) out.position = position;
  return out;
}

export function mergeRecords(account: ProgressRecords, guest: ProgressRecords): ProgressRecords {
  const out: Record<string, ProgressRecord> = {};
  for (const key of new Set([...Object.keys(account), ...Object.keys(guest)])) {
    const merged = mergeRecord(account[key], guest[key]);
    if (!isEmpty(merged)) out[key] = merged;
  }
  return out;
}

/** "0:42", "12:05". */
export function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * One change to progress: what the UI asks for, applied to the browser copy directly and sent to the server for
 * the account copy (which applies it with the same function, so both follow the same rules).
 */
export const progressChangeSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set-status"), key: z.string().min(1).max(200), status: progressStatusSchema }),
  z.object({ op: z.literal("mark-learning"), key: z.string().min(1).max(200) }),
  z.object({
    op: z.literal("save-position"),
    key: z.string().min(1).max(200),
    sceneId: videoPositionSchema.shape.sceneId,
    seconds: videoPositionSchema.shape.seconds,
  }),
  z.object({ op: z.literal("clear-position"), key: z.string().min(1).max(200) }),
]);
export type ProgressChange = z.infer<typeof progressChangeSchema>;

export function applyChange(records: ProgressRecords, change: ProgressChange, now: number): ProgressRecords {
  switch (change.op) {
    case "set-status":
      return applyManualStatus(records, change.key, change.status, now);
    case "mark-learning":
      return applyAutoLearning(records, change.key, now);
    case "save-position":
      return applyPosition(records, change.key, {
        sceneId: change.sceneId,
        seconds: change.seconds,
        updatedAt: now,
      });
    case "clear-position":
      return applyPosition(records, change.key, undefined);
  }
}
