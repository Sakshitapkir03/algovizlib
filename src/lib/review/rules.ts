import { z } from "zod";

import { formatSeconds, type ProgressRecord, type ProgressRecords } from "@/lib/progress/records";
import type { CheckResult } from "@/lib/quickcheck/results";

/**
 * The review queue: which problems to revisit, and why. Computed from data that already exists (progress records and
 * quick check answers) plus one small record per problem the learner has reviewed or snoozed (`ReviewState`: the
 * spaced-review interval and the snooze). Pure functions only, shared by the browser copy, the server, and tests.
 *
 * Rules (a problem appears once, under the first that applies, in this order):
 *  1. missed-checks: among the quick checks answered on the problem's video since it was last reviewed, the latest
 *     answer to some question is wrong. "Missed 2 of 3 quick checks".
 *  2. review-due: marked Done, and the current interval (3, 7, 21, then 60 days) has passed since it was marked Done
 *     or last reviewed, whichever is later. "Done · 7-day review due".
 *  3. stopped-video: a saved video position at least a day old (newer ones are the "Continue" card's), saved after the
 *     last review. "Stopped at 0:42", linking to the resume point.
 *  4. stale-learning: marked Learning and no activity (a status change, a saved position, a quick check answer, or a
 *     review) for 3 days. "Learning · last active 6 days ago".
 * Within a rule, the problem that has waited longest comes first (oldest wrong answer, longest overdue, oldest
 * position, longest inactive). Snoozed problems are left out until the snooze ends. The queue keeps the top 7.
 *
 * Walkthroughs of a learner's own input never count: only `source: "video"` answers are read.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Spaced review intervals, in days; `stage` indexes this list. */
export const REVIEW_INTERVAL_DAYS = [3, 7, 21, 60] as const;
export const MAX_STAGE = REVIEW_INTERVAL_DAYS.length - 1;
export const STALE_LEARNING_DAYS = 3;
export const STOPPED_VIDEO_DAYS = 1;
export const SNOOZE_DAYS = 3;
export const QUEUE_LIMIT = 7;

const keySchema = z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/);

export const reviewStateSchema = z.object({
  /** Index into `REVIEW_INTERVAL_DAYS`: the interval until a Done problem is due again. */
  stage: z.number().int().min(0).max(MAX_STAGE),
  /** Epoch ms of the last review ("Reviewed", or a Done video's quick checks all answered right). */
  reviewedAt: z.number().int().nonnegative().optional(),
  /** Hidden from the queue until then (epoch ms). */
  snoozedUntil: z.number().int().nonnegative().optional(),
  /** Epoch ms of the last change. */
  updatedAt: z.number().int().nonnegative(),
});
export type ReviewState = z.infer<typeof reviewStateSchema>;

export const reviewStatesSchema = z.record(keySchema, reviewStateSchema);
export type ReviewStates = Readonly<Record<string, ReviewState>>;

/**
 * What "Reviewed" records: `pass` moves a Done problem to the next interval, `miss` (a quick check missed since the
 * last review) sends it back to the first, `none` (not Done) leaves the interval alone.
 */
export const reviewGradeSchema = z.enum(["pass", "miss", "none"]);
export type ReviewGrade = z.infer<typeof reviewGradeSchema>;

export const reviewChangeSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("reviewed"), key: keySchema, grade: reviewGradeSchema }),
  z.object({ op: z.literal("snooze"), key: keySchema }),
]);
export type ReviewChange = z.infer<typeof reviewChangeSchema>;

const FRESH: ReviewState = { stage: 0, updatedAt: 0 };

export function applyReviewChange(states: ReviewStates, change: ReviewChange, now: number): ReviewStates {
  const current = states[change.key] ?? FRESH;
  let next: ReviewState;
  if (change.op === "snooze") {
    next = { ...current, snoozedUntil: now + SNOOZE_DAYS * DAY_MS, updatedAt: now };
  } else {
    const stage =
      change.grade === "pass"
        ? Math.min(current.stage + 1, MAX_STAGE)
        : change.grade === "miss"
          ? 0
          : current.stage;
    next = { stage, reviewedAt: now, updatedAt: now };
  }
  return { ...states, [change.key]: next };
}

/**
 * Merge two copies of one problem's review state (a guest's into the account): the one reviewed more recently keeps
 * its interval and review time; the later snooze wins.
 */
export function mergeReviewState(a: ReviewState | undefined, b: ReviewState | undefined): ReviewState {
  if (!a) return b ?? FRESH;
  if (!b) return a;
  const base = (b.reviewedAt ?? -1) > (a.reviewedAt ?? -1) ? b : a;
  const snoozedUntil = Math.max(a.snoozedUntil ?? -1, b.snoozedUntil ?? -1);
  const out: ReviewState = { stage: base.stage, updatedAt: Math.max(a.updatedAt, b.updatedAt) };
  if (base.reviewedAt !== undefined) out.reviewedAt = base.reviewedAt;
  if (snoozedUntil >= 0) out.snoozedUntil = snoozedUntil;
  return out;
}

export function mergeReviewStates(account: ReviewStates, guest: ReviewStates): ReviewStates {
  const out: Record<string, ReviewState> = {};
  for (const key of new Set([...Object.keys(account), ...Object.keys(guest)]))
    out[key] = mergeReviewState(account[key], guest[key]);
  return out;
}

// --- The queue ----------------------------------------------------------------------------------------------

export type ReviewKind = "missed-checks" | "review-due" | "stopped-video" | "stale-learning";
/** Rule order: the first that applies is the problem's reason, and the queue is sorted by it. */
export const REVIEW_KINDS: readonly ReviewKind[] = [
  "missed-checks",
  "review-due",
  "stopped-video",
  "stale-learning",
];

export type ReviewItem = {
  key: string;
  kind: ReviewKind;
  /** The short reason shown with the item. */
  reason: string;
  /** Since when it has waited (epoch ms): the sort key within a rule, oldest first. */
  since: number;
  /** What "Reviewed" records for it. */
  grade: ReviewGrade;
  /** stopped-video: where the video was left (link to the resume point). */
  seconds?: number;
};

/** The latest answer to each question of the problem's video, answered after `after`. */
export function latestVideoAnswers(
  checks: readonly CheckResult[],
  key: string,
  after: number,
): CheckResult[] {
  const latest = new Map<string, CheckResult>();
  for (const c of checks) {
    if (c.source !== "video" || c.problemKey !== key || c.answeredAt <= after) continue;
    const seen = latest.get(c.questionId);
    if (!seen || c.answeredAt > seen.answeredAt) latest.set(c.questionId, c);
  }
  return [...latest.values()];
}

/** When a Done problem is next due (epoch ms), or undefined when it isn't Done. */
export function reviewDueAt(record: ProgressRecord | undefined, state: ReviewState | undefined) {
  if (record?.status !== "done") return undefined;
  const base = Math.max(record.updatedAt, state?.reviewedAt ?? 0);
  return base + REVIEW_INTERVAL_DAYS[state?.stage ?? 0] * DAY_MS;
}

/** "1 day ago", "6 days ago". */
export function daysAgo(ms: number): string {
  const days = Math.max(1, Math.floor(ms / DAY_MS));
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/** One problem's queue item, or undefined when nothing is due (or it's snoozed). */
export function reviewItemFor(
  key: string,
  record: ProgressRecord | undefined,
  state: ReviewState | undefined,
  checks: readonly CheckResult[],
  now: number,
): ReviewItem | undefined {
  if (state?.snoozedUntil !== undefined && state.snoozedUntil > now) return undefined;
  const reviewedAt = state?.reviewedAt ?? 0;
  const answers = latestVideoAnswers(checks, key, reviewedAt);
  const wrong = answers.filter((a) => !a.correct);
  const done = record?.status === "done";
  const grade: ReviewGrade = done ? (wrong.length > 0 ? "miss" : "pass") : "none";

  if (wrong.length > 0)
    return {
      key,
      kind: "missed-checks",
      reason: `Missed ${wrong.length} of ${answers.length} quick ${answers.length === 1 ? "check" : "checks"}`,
      since: Math.max(...wrong.map((a) => a.answeredAt)),
      grade,
    };

  const due = reviewDueAt(record, state);
  if (due !== undefined && now >= due)
    return {
      key,
      kind: "review-due",
      reason: `Done · ${REVIEW_INTERVAL_DAYS[state?.stage ?? 0]}-day review due`,
      since: due,
      grade,
    };

  const position = record?.position;
  if (position && position.updatedAt > reviewedAt && now - position.updatedAt >= STOPPED_VIDEO_DAYS * DAY_MS)
    return {
      key,
      kind: "stopped-video",
      reason: `Stopped at ${formatSeconds(position.seconds)}`,
      since: position.updatedAt,
      grade,
      seconds: position.seconds,
    };

  if (record?.status === "learning") {
    const lastActive = Math.max(
      record.updatedAt,
      position?.updatedAt ?? 0,
      reviewedAt,
      ...answers.map((a) => a.answeredAt),
    );
    if (now - lastActive >= STALE_LEARNING_DAYS * DAY_MS)
      return {
        key,
        kind: "stale-learning",
        reason: `Learning · last active ${daysAgo(now - lastActive)}`,
        since: lastActive,
        grade,
      };
  }
  return undefined;
}

export type QueueInput = {
  records: ProgressRecords;
  checks: readonly CheckResult[];
  states: ReviewStates;
  now: number;
  /** Problems that exist (unknown keys are left out). */
  known?: (key: string) => boolean;
  limit?: number;
};

/** Every due problem, ranked by rule and then by how long it has waited (oldest first), cut to `limit`. */
export function buildReviewQueue({
  records,
  checks,
  states,
  now,
  known = () => true,
  limit = QUEUE_LIMIT,
}: QueueInput): ReviewItem[] {
  const videoChecks = checks.filter((c) => c.source === "video");
  const keys = new Set([...Object.keys(records), ...videoChecks.map((c) => c.problemKey)]);
  const items: ReviewItem[] = [];
  for (const key of keys) {
    if (!known(key)) continue;
    const item = reviewItemFor(key, records[key], states[key], videoChecks, now);
    if (item) items.push(item);
  }
  const rank = (k: ReviewKind) => REVIEW_KINDS.indexOf(k);
  items.sort((a, b) => rank(a.kind) - rank(b.kind) || a.since - b.since || a.key.localeCompare(b.key));
  return items.slice(0, limit);
}

/**
 * A viewing of a Done problem's video ended with every quick check answered right (`answers`: this viewing's): that
 * counts as a review (the next interval) when the problem was due. Returns the change to apply, or undefined.
 */
export function viewingReview(
  key: string,
  record: ProgressRecord | undefined,
  state: ReviewState | undefined,
  answers: readonly { correct: boolean }[],
  now: number,
): ReviewChange | undefined {
  const due = reviewDueAt(record, state);
  if (due === undefined || now < due) return undefined;
  if (answers.length === 0 || answers.some((a) => !a.correct)) return undefined;
  return { op: "reviewed", key, grade: "pass" };
}
