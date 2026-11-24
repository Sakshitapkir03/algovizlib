import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMemoryRateLimiter, LIMITS } from "@/lib/auth/rate-limit";
import type { ProgressRecord, ProgressRecords } from "@/lib/progress";
import { getActiveRepository, resetProgressHubForTests } from "@/lib/progress/use-progress";
import { CHECKS_STORAGE_KEY, type CheckResult } from "@/lib/quickcheck/results";
import {
  applyReviewChange,
  buildReviewQueue,
  DAY_MS,
  mergeReviewState,
  mergeReviewStates,
  QUEUE_LIMIT,
  reviewDueAt,
  reviewItemFor,
  viewingReview,
  type ReviewChange,
  type ReviewState,
  type ReviewStates,
} from "@/lib/review/rules";
import {
  getReview,
  mergeReview,
  postReview,
  type ReviewApiDeps,
  type ReviewStore,
} from "@/lib/review/server";
import {
  applyReview,
  noteVideoViewing,
  resetReviewHubForTests,
  REVIEW_STORAGE_KEY,
  reviewHubState,
  syncAccountReview,
  type ReviewTransport,
} from "@/lib/review/use-review";

const K = "two-pointers/pair-with-target-sum";
const K2 = "two-pointers/three-sum";
const K3 = "sliding-window/maximum-sum-subarray";
const NOW = 100 * DAY_MS;
const ago = (days: number) => NOW - days * DAY_MS;

const rec = (
  status: ProgressRecord["status"],
  days: number,
  extra: Partial<ProgressRecord> = {},
): ProgressRecord => ({
  status,
  manual: true,
  updatedAt: ago(days),
  ...extra,
});

let n = 0;
function answer(
  key: string,
  question: string,
  correct: boolean,
  days: number,
  extra: Partial<CheckResult> = {},
): CheckResult {
  n += 1;
  return {
    id: `answer-${String(n).padStart(4, "0")}`,
    problemKey: key,
    questionId: question,
    sceneId: "s1",
    step: 1,
    correct,
    source: "video",
    answeredAt: ago(days),
    ...extra,
  };
}

const queue = (records: ProgressRecords, checks: CheckResult[] = [], states: ReviewStates = {}, now = NOW) =>
  buildReviewQueue({ records, checks, states, now });

describe("queue rules", () => {
  it("Learning untouched for 3 days is due, with how long ago it was last active", () => {
    expect(queue({ [K]: rec("learning", 2) })).toEqual([]);
    const [item] = queue({ [K]: rec("learning", 6) });
    expect(item).toMatchObject({
      key: K,
      kind: "stale-learning",
      reason: "Learning · last active 6 days ago",
    });
  });

  it("any activity counts: a recent position or quick check answer keeps Learning off the queue", () => {
    const position = { sceneId: "s2", seconds: 42, updatedAt: ago(0.5) };
    expect(queue({ [K]: rec("learning", 10, { position }) })).toEqual([]);
    expect(queue({ [K]: rec("learning", 10) }, [answer(K, "q1", true, 1)])).toEqual([]);
  });

  it("wrong latest answers since the last review: 'Missed 2 of 3 quick checks'", () => {
    const checks = [
      answer(K, "q1", false, 2),
      answer(K, "q2", false, 2),
      answer(K, "q3", true, 2),
      answer(K2, "q1", false, 3),
      answer(K2, "q1", true, 1), // answered again, right: the latest answer counts
    ];
    const items = queue({}, checks);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ key: K, kind: "missed-checks", reason: "Missed 2 of 3 quick checks" });
  });

  it("answers from before the last review don't count", () => {
    const checks = [answer(K, "q1", false, 5)];
    const states: ReviewStates = { [K]: { stage: 0, reviewedAt: ago(4), updatedAt: ago(4) } };
    expect(queue({}, checks, states)).toEqual([]);
  });

  it("walkthroughs of the learner's own input are never counted", () => {
    const checks = [
      answer(K, "q1", false, 2, { source: "walkthrough", input: "eyJhIjoxfQ" }),
      answer(K, "q2", false, 2, { source: "walkthrough", input: "eyJhIjoxfQ" }),
    ];
    expect(queue({}, checks)).toEqual([]);
    // Nor do they count as activity on a Learning problem.
    expect(queue({ [K]: rec("learning", 9) }, checks)[0].reason).toBe("Learning · last active 9 days ago");
  });

  it("Done comes back after 3 days at first", () => {
    expect(queue({ [K]: rec("done", 2) })).toEqual([]);
    const [item] = queue({ [K]: rec("done", 3) });
    expect(item).toMatchObject({ kind: "review-due", reason: "Done · 3-day review due", grade: "pass" });
  });

  it("a video stopped a day or more ago links to its resume point", () => {
    const position = { sceneId: "s3", seconds: 42, updatedAt: ago(2) };
    const [item] = queue({ [K]: rec("not-started", 2, { manual: false, position }) });
    expect(item).toMatchObject({ kind: "stopped-video", reason: "Stopped at 0:42", seconds: 42 });
    // Under a day: that's the "Continue" card's job.
    expect(queue({ [K]: rec("learning", 0.2, { position: { ...position, updatedAt: ago(0.2) } }) })).toEqual(
      [],
    );
  });

  it("unknown problems are left out", () => {
    expect(
      buildReviewQueue({
        records: { [K]: rec("learning", 9) },
        checks: [],
        states: {},
        now: NOW,
        known: () => false,
      }),
    ).toEqual([]);
  });
});

describe("ranking", () => {
  it("one item per problem, under the first rule that applies", () => {
    const position = { sceneId: "s3", seconds: 42, updatedAt: ago(10) };
    const items = queue({ [K]: rec("done", 30, { position }) }, [answer(K, "q1", false, 9)]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("missed-checks");
    expect(items[0].grade).toBe("miss");
  });

  it("missed checks, then review due, then stopped video, then stale Learning; oldest first within each", () => {
    const records: ProgressRecords = {
      "a/stale-old": rec("learning", 20),
      "a/stale-new": rec("learning", 5),
      "a/stopped": rec("not-started", 1, {
        manual: false,
        position: { sceneId: "s", seconds: 5, updatedAt: ago(2) },
      }),
      "a/due-old": rec("done", 30),
      "a/due-new": rec("done", 4),
    };
    const checks = [answer("a/missed-new", "q", false, 1), answer("a/missed-old", "q", false, 8)];
    expect(queue(records, checks).map((i) => i.key)).toEqual([
      "a/missed-old",
      "a/missed-new",
      "a/due-old",
      "a/due-new",
      "a/stopped",
      "a/stale-old",
      "a/stale-new",
    ]);
  });

  it("keeps the top 7", () => {
    const records: Record<string, ProgressRecord> = {};
    for (let i = 0; i < 12; i++) records[`p/x${i}`] = rec("learning", 4 + i);
    const items = queue(records);
    expect(items).toHaveLength(QUEUE_LIMIT);
    expect(items[0].key).toBe("p/x11");
  });
});

describe("spaced intervals", () => {
  const reviewed = (states: ReviewStates, grade: "pass" | "miss" | "none", at: number) =>
    applyReviewChange(states, { op: "reviewed", key: K, grade }, at);

  it("grow 3 → 7 → 21 → 60 days with each passing review, and stay at 60", () => {
    const done = rec("done", 100);
    let states: ReviewStates = {};
    let t = ago(100);
    const gaps: number[] = [];
    for (let i = 0; i < 5; i++) {
      const due = reviewDueAt(done, states[K])!;
      gaps.push((due - Math.max(t, done.updatedAt)) / DAY_MS);
      t = due;
      states = reviewed(states, "pass", t);
    }
    expect(gaps).toEqual([3, 7, 21, 60, 60]);
  });

  it("reset to 3 days after a miss", () => {
    let states = reviewed({}, "pass", ago(50));
    states = reviewed(states, "pass", ago(40));
    expect(states[K].stage).toBe(2);
    states = reviewed(states, "miss", ago(10));
    expect(states[K].stage).toBe(0);
    expect(reviewDueAt(rec("done", 60), states[K])).toBe(ago(7));
  });

  it("'Reviewed' on a problem that isn't Done leaves the interval alone", () => {
    const states = reviewed({ [K]: { stage: 2, updatedAt: 1 } }, "none", ago(1));
    expect(states[K]).toMatchObject({ stage: 2, reviewedAt: ago(1) });
  });

  it("'Reviewed' grades by the quick checks: a miss since the last review resets, otherwise it passes", () => {
    const done = rec("done", 30);
    expect(reviewItemFor(K, done, undefined, [answer(K, "q", false, 1)], NOW)?.grade).toBe("miss");
    expect(reviewItemFor(K, done, undefined, [answer(K, "q", true, 1)], NOW)?.grade).toBe("pass");
  });

  it("a due Done video with every quick check right counts as a review; a miss or a not-due problem doesn't", () => {
    const right = [{ correct: true }, { correct: true }];
    expect(viewingReview(K, rec("done", 5), undefined, right, NOW)).toEqual({
      op: "reviewed",
      key: K,
      grade: "pass",
    });
    expect(
      viewingReview(K, rec("done", 5), undefined, [{ correct: true }, { correct: false }], NOW),
    ).toBeUndefined();
    expect(viewingReview(K, rec("done", 1), undefined, right, NOW)).toBeUndefined();
    expect(viewingReview(K, rec("learning", 9), undefined, right, NOW)).toBeUndefined();
  });
});

describe("Reviewed and Snooze", () => {
  it("Reviewed takes the problem off the queue (every rule) until something new happens", () => {
    const position = { sceneId: "s", seconds: 9, updatedAt: ago(5) };
    const records = { [K]: rec("learning", 10, { position }), [K2]: rec("done", 10) };
    const checks = [answer(K, "q", false, 5)];
    let states: ReviewStates = {};
    for (const item of queue(records, checks))
      states = applyReviewChange(states, { op: "reviewed", key: item.key, grade: item.grade }, NOW);
    expect(queue(records, checks, states)).toEqual([]);
    // Three days later the Learning one is stale again; the Done one waits for its 7-day interval.
    expect(queue(records, checks, states, NOW + 3 * DAY_MS).map((i) => i.key)).toEqual([K]);
    expect(queue(records, checks, states, NOW + 7 * DAY_MS).map((i) => i.kind)).toEqual([
      "review-due",
      "stale-learning",
    ]);
  });

  it("Snooze hides it for 3 days, then it's back", () => {
    const records = { [K]: rec("learning", 10) };
    const states = applyReviewChange({}, { op: "snooze", key: K }, NOW);
    expect(queue(records, [], states)).toEqual([]);
    expect(queue(records, [], states, NOW + 3 * DAY_MS - 1)).toEqual([]);
    expect(queue(records, [], states, NOW + 3 * DAY_MS)).toHaveLength(1);
  });

  it("Reviewed clears a snooze", () => {
    let states = applyReviewChange({}, { op: "snooze", key: K }, NOW);
    states = applyReviewChange(states, { op: "reviewed", key: K, grade: "none" }, NOW + 1);
    expect(states[K].snoozedUntil).toBeUndefined();
  });
});

describe("merging a guest's schedule into an account", () => {
  const s = (stage: number, reviewedAt?: number, snoozedUntil?: number): ReviewState => ({
    stage,
    updatedAt: Math.max(reviewedAt ?? 0, snoozedUntil ?? 0, 1),
    ...(reviewedAt !== undefined && { reviewedAt }),
    ...(snoozedUntil !== undefined && { snoozedUntil }),
  });

  it("the more recent review keeps its interval; the later snooze wins", () => {
    expect(mergeReviewState(s(3, 10), s(0, 20))).toMatchObject({ stage: 0, reviewedAt: 20 });
    expect(mergeReviewState(s(0, 20), s(3, 10))).toMatchObject({ stage: 0, reviewedAt: 20 });
    expect(mergeReviewState(s(2, 10, 50), s(0, undefined, 90))).toMatchObject({
      stage: 2,
      reviewedAt: 10,
      snoozedUntil: 90,
    });
    expect(mergeReviewStates({ [K]: s(1, 5) }, { [K2]: s(2, 6) })).toEqual({ [K]: s(1, 5), [K2]: s(2, 6) });
  });

  it("is the same whichever side is which", () => {
    const a = { [K]: s(2, 10, 40), [K2]: s(1, 30) };
    const b = { [K]: s(0, 12), [K3]: s(3, 2, 99) };
    expect(mergeReviewStates(a, b)).toEqual(mergeReviewStates(b, a));
  });
});

// --- The browser and account copies ----------------------------------------------------------------------------

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    key: () => null,
    clear: () => data.clear(),
    get length() {
      return data.size;
    },
  };
}

function fakeServer(initial: ReviewStates = {}, checks: CheckResult[] = []) {
  let states = initial;
  const sent: ReviewChange[] = [];
  const transport: ReviewTransport & { fail: boolean } = {
    fail: false,
    async send(change) {
      if (transport.fail) throw new Error("503");
      sent.push(change);
      states = applyReviewChange(states, change, Date.now());
    },
    async merge(guest) {
      if (transport.fail) throw new Error("503");
      states = mergeReviewStates(states, guest);
      return states;
    },
    async loadChecks() {
      return checks;
    },
  };
  return { transport, sent, states: () => states };
}

describe("guest and signed-in data", () => {
  beforeEach(() => {
    resetProgressHubForTests();
    resetReviewHubForTests();
    vi.stubGlobal("window", {
      localStorage: memoryStorage(),
      addEventListener() {},
      removeEventListener() {},
    });
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("a guest's schedule and quick check answers live in this browser", async () => {
    await syncAccountReview(null);
    window.localStorage.setItem(
      CHECKS_STORAGE_KEY,
      JSON.stringify({ version: 1, results: [answer(K, "q", false, 1)] }),
    );
    resetReviewHubForTests();
    await syncAccountReview(null);
    expect(reviewHubState().mode).toBe("browser");
    expect(reviewHubState().checks).toHaveLength(1);
    expect(await applyReview({ op: "snooze", key: K })).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(REVIEW_STORAGE_KEY)!).states[K].snoozedUntil).toBe(
      NOW + 3 * DAY_MS,
    );
  });

  it("an unverified account keeps the schedule in this browser and sends nothing", async () => {
    const server = fakeServer();
    await syncAccountReview({ id: "u1", emailVerified: false }, server.transport);
    await applyReview({ op: "snooze", key: K });
    expect(reviewHubState().mode).toBe("browser");
    expect(server.sent).toEqual([]);
  });

  it("signing in as a verified user merges the guest schedule, clears it here, and reads the account's answers", async () => {
    await syncAccountReview(null);
    await applyReview({ op: "reviewed", key: K, grade: "pass" }, ago(1));
    const server = fakeServer(
      { [K]: { stage: 3, reviewedAt: ago(30), updatedAt: ago(30) }, [K2]: { stage: 1, updatedAt: 1 } },
      [answer(K3, "q", false, 1)],
    );
    await syncAccountReview({ id: "u1", emailVerified: true }, server.transport);
    const hub = reviewHubState();
    expect(hub.mode).toBe("account");
    expect(hub.states[K]).toMatchObject({ stage: 1, reviewedAt: ago(1) }); // the newer review won
    expect(hub.states[K2]).toMatchObject({ stage: 1 });
    expect(window.localStorage.getItem(REVIEW_STORAGE_KEY)).toBeNull();
    expect(hub.checks.map((c) => c.problemKey)).toEqual([K3]);
    // Changes now go to the account.
    expect(await applyReview({ op: "snooze", key: K2 })).toBe(true);
    expect(server.sent).toEqual([{ op: "snooze", key: K2 }]);
  });

  it("a write the account didn't save is undone and reported", async () => {
    const server = fakeServer();
    await syncAccountReview({ id: "u1", emailVerified: true }, server.transport);
    server.transport.fail = true;
    expect(await applyReview({ op: "snooze", key: K })).toBe(false);
    expect(reviewHubState().states[K]).toBeUndefined();
  });

  it("fails safely when the account's schedule is unavailable (table not migrated): queue stays, nothing lost", async () => {
    await syncAccountReview(null);
    await applyReview({ op: "snooze", key: K });
    const server = fakeServer();
    server.transport.fail = true;
    await syncAccountReview({ id: "u1", emailVerified: true }, server.transport);
    expect(reviewHubState().mode).toBe("unavailable");
    expect(reviewHubState().states[K].snoozedUntil).toBeDefined(); // still shown
    expect(window.localStorage.getItem(REVIEW_STORAGE_KEY)).not.toBeNull(); // kept for the next try
    expect(await applyReview({ op: "snooze", key: K2 })).toBe(false);
  });

  it("finishing a due Done video with every quick check right records the review", async () => {
    await syncAccountReview(null);
    vi.setSystemTime(ago(10));
    getActiveRepository().set(K, "done");
    vi.setSystemTime(NOW);
    noteVideoViewing(K, [{ correct: true }, { correct: true }]);
    expect(reviewHubState().states[K]).toMatchObject({ stage: 1, reviewedAt: NOW });
    // Not due any more: another viewing changes nothing.
    noteVideoViewing(K, [{ correct: true }]);
    expect(reviewHubState().states[K].stage).toBe(1);
    // A viewing with a miss writes nothing.
    noteVideoViewing(K2, [{ correct: false }]);
    expect(reviewHubState().states[K2]).toBeUndefined();
  });
});

// --- The API --------------------------------------------------------------------------------------------------

function memoryStore(): ReviewStore & { data: Map<string, ReviewStates>; broken?: unknown } {
  const data = new Map<string, ReviewStates>();
  const store = {
    data,
    broken: undefined as unknown,
    async load(userId: string) {
      if (store.broken) throw store.broken;
      return data.get(userId) ?? {};
    },
    async apply(userId: string, change: ReviewChange, now: number) {
      if (store.broken) throw store.broken;
      data.set(userId, applyReviewChange(data.get(userId) ?? {}, change, now));
    },
    async merge(userId: string, guest: ReviewStates) {
      if (store.broken) throw store.broken;
      const merged = mergeReviewStates(data.get(userId) ?? {}, guest);
      data.set(userId, merged);
      return merged;
    },
  };
  return store;
}

describe("/api/review", () => {
  const deps = (
    over: Partial<ReviewApiDeps> = {},
  ): ReviewApiDeps & { store: ReturnType<typeof memoryStore>; logs: string[] } => {
    const logs: string[] = [];
    return {
      user: { id: "u1", canSync: true },
      store: memoryStore(),
      limiter: createMemoryRateLimiter(),
      isProblem: (key) => key === K || key === K2,
      now: () => NOW,
      log: (m) => void logs.push(m),
      logs,
      ...over,
    } as ReviewApiDeps & { store: ReturnType<typeof memoryStore>; logs: string[] };
  };

  it("needs a verified sign-in", async () => {
    expect((await getReview(deps({ user: null }))).status).toBe(401);
    expect(
      (await postReview(deps({ user: { id: "u1", canSync: false } }), { op: "snooze", key: K })).status,
    ).toBe(403);
    expect((await mergeReview(deps({ user: null }), { states: {} })).status).toBe(401);
  });

  it("applies a change to the session's user only", async () => {
    const d = deps();
    expect(
      (await postReview(d, { op: "reviewed", key: K, grade: "pass", userId: "someone-else" })).status,
    ).toBe(204);
    expect(d.store.data.get("u1")?.[K]).toMatchObject({ stage: 1, reviewedAt: NOW });
    expect(d.store.data.has("someone-else")).toBe(false);
    expect(await getReview(d)).toEqual({ status: 200, body: { states: d.store.data.get("u1") } });
  });

  it("refuses bad changes and unknown problems", async () => {
    const d = deps();
    expect((await postReview(d, { op: "reviewed", key: K })).status).toBe(400);
    expect((await postReview(d, { op: "snooze", key: "nope/nope" })).status).toBe(400);
    expect((await postReview(d, { op: "delete", key: K })).status).toBe(400);
  });

  it("is rate limited per user", async () => {
    const d = deps();
    for (let i = 0; i < LIMITS.reviewUser.max; i++) await postReview(d, { op: "snooze", key: K });
    expect((await postReview(d, { op: "snooze", key: K })).status).toBe(429);
  });

  it("merge drops unknown problems and clamps future times", async () => {
    const d = deps();
    const res = await mergeReview(d, {
      states: {
        [K]: {
          stage: 2,
          reviewedAt: NOW + 50 * DAY_MS,
          snoozedUntil: NOW + 400 * DAY_MS,
          updatedAt: NOW + 50 * DAY_MS,
        },
        "other/problem": { stage: 1, updatedAt: 1 },
      },
    });
    expect(res.status).toBe(200);
    expect((res.body as { states: ReviewStates }).states).toEqual({
      [K]: { stage: 2, reviewedAt: NOW, snoozedUntil: NOW + 3 * DAY_MS, updatedAt: NOW },
    });
    expect((await mergeReview(d, { states: { [K]: { stage: 9, updatedAt: 1 } } })).status).toBe(400);
  });

  it("a missing table is a 503 with a log line naming the fix, never a crash", async () => {
    const d = deps();
    d.store.broken = Object.assign(new Error("relation does not exist"), { code: "P2021" });
    expect((await getReview(d)).status).toBe(503);
    expect((await postReview(d, { op: "snooze", key: K })).status).toBe(503);
    expect((await mergeReview(d, { states: {} })).status).toBe(503);
    expect(d.logs[0]).toContain("the ReviewState table is missing: run `pnpm db:deploy`");
  });
});

describe("boundaries", () => {
  it("the review hub never imports server code", () => {
    const src = readFileSync("src/lib/review/use-review.ts", "utf8");
    expect(src).not.toMatch(/@\/lib\/db|server-only|\.\/server|@\/auth/);
  });
});
