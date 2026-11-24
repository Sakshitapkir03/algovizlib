import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it } from "vitest";

import { createMemoryRateLimiter } from "@/lib/auth/rate-limit";
import { getProblem, getProblemStoryboard } from "@/lib/catalog/repository";
import { buildQuickChecks } from "@/lib/quickcheck";
import {
  CHECKS_STORAGE_KEY,
  type CheckResult,
  createCheckRecorder,
  type ResultStorage,
  type ResultTransport,
} from "@/lib/quickcheck/results";
import { checkKey, dueCheck, MAX_PLAY_STEP, pauseFrames, summarize } from "@/lib/quickcheck/schedule";
import { type CheckResultStore, getChecks, postChecks } from "@/lib/quickcheck/server";
import { getSceneTimeline } from "@/lib/storyboard";
import { runTrace } from "@/lib/traces";
import { QUICK_CHECKS_KEY, readQuickChecksPref, usePlayerStore } from "@/store/player-store";

const K = "two-pointers/pair-with-target-sum";
const storyboard = getProblemStoryboard(getProblem("two-pointers", "pair-with-target-sum")!)!;
const checks = buildQuickChecks(storyboard, runTrace(storyboard.trace!.problem, storyboard.trace!.args));
const { timings } = getSceneTimeline(storyboard.scenes);

class MemoryStorage implements ResultStorage {
  map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

const result = (id: string, over: Partial<CheckResult> = {}): CheckResult => ({
  id,
  problemKey: K,
  questionId: "check-found",
  sceneId: "found",
  step: 3,
  correct: true,
  source: "video",
  answeredAt: 1000,
  ...over,
});

describe("when a quick check is asked", () => {
  const frames = pauseFrames(checks, timings);
  const [id, at] = [...frames][0];

  it("pauses on the last frame before the question's scene starts to fade in", () => {
    const check = checks[0];
    const scene = timings.find((t) => t.sceneId === check.sceneId)!;
    expect(at).toBe(scene.sequenceStart - 1);
    expect(scene.index).toBeGreaterThan(0);
  });

  it("only when playback reaches it on its own, once", () => {
    expect(dueCheck(frames, new Set(), at - 1, at, true)).toBe(id);
    expect(dueCheck(frames, new Set(), at - 2, at + 1, true)).toBe(id);
    // A seek or a scene jump over it doesn't ask.
    expect(dueCheck(frames, new Set(), at - MAX_PLAY_STEP - 5, at + 1, true)).toBeUndefined();
    // Paused (stepping or scrubbing), backwards, or already asked: no.
    expect(dueCheck(frames, new Set(), at - 1, at, false)).toBeUndefined();
    expect(dueCheck(frames, new Set(), at + 1, at - 1, true)).toBeUndefined();
    expect(dueCheck(frames, new Set([id]), at - 1, at, true)).toBeUndefined();
  });

  it("keys: 1–n answer, arrows move, Enter answers the focused option, S or Esc skips", () => {
    expect(checkKey("1", 3)).toEqual({ choose: 0 });
    expect(checkKey("3", 3)).toEqual({ choose: 2 });
    expect(checkKey("4", 3)).toBeUndefined();
    expect(checkKey("ArrowDown", 3)).toEqual({ move: 1 });
    expect(checkKey("ArrowLeft", 3)).toEqual({ move: -1 });
    expect(checkKey("Enter", 3)).toBe("submit");
    expect(checkKey("s", 3)).toBe("skip");
    expect(checkKey("Escape", 3)).toBe("skip");
    expect(checkKey("x", 3)).toBeUndefined();
  });

  it("sums up a viewing's answers (skipped ones don't count)", () => {
    expect(summarize([{ correct: true }, { correct: false }, { correct: true }])).toEqual({
      correct: 2,
      answered: 3,
    });
  });
});

describe("the Quick checks setting", () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
    Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  });

  it("is on by default, remembered when turned off, and back on", () => {
    expect(readQuickChecksPref()).toBe(true);
    usePlayerStore.getState().setQuickChecks(false);
    expect(storage.getItem(QUICK_CHECKS_KEY)).toBe("off");
    expect(readQuickChecksPref()).toBe(false);
    usePlayerStore.getState().loadAudioPrefs();
    expect(usePlayerStore.getState().quickChecks).toBe(false);
    usePlayerStore.getState().setQuickChecks(true);
    expect(readQuickChecksPref()).toBe(true);
  });

  it("an open question holds the player's shortcuts, and attaching a new player clears it", () => {
    usePlayerStore.getState().setChecking(true);
    expect(usePlayerStore.getState().checking).toBe(true);
    usePlayerStore.getState().attach(null);
    expect(usePlayerStore.getState().checking).toBe(false);
  });
});

describe("recording answers", () => {
  const sent: CheckResult[][] = [];
  let failing = false;
  const transport: ResultTransport = {
    async send(results) {
      if (failing) throw new Error("503");
      sent.push([...results]);
    },
  };
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
    sent.length = 0;
    failing = false;
  });
  const recorder = () => createCheckRecorder({ storage: () => storage, transport });

  it("a guest's answers stay in the browser, all of them", async () => {
    const r = recorder();
    await r.record(result("aaaaaaaa1"));
    await r.record(result("aaaaaaaa2", { correct: false, source: "walkthrough", input: "W1sxXV0" }));
    expect(sent).toEqual([]);
    expect(r.local().map((x) => [x.id, x.pending ?? false])).toEqual([
      ["aaaaaaaa1", false],
      ["aaaaaaaa2", false],
    ]);
    expect(JSON.parse(storage.getItem(CHECKS_STORAGE_KEY)!).version).toBe(1);
  });

  it("signing in as a verified user sends them to the account and clears them here", async () => {
    const r = recorder();
    await r.record(result("aaaaaaaa1"));
    await r.record(result("aaaaaaaa2"));
    await r.setAccount(true);
    expect(sent.flat().map((x) => x.id)).toEqual(["aaaaaaaa1", "aaaaaaaa2"]);
    expect(sent.flat().every((x) => !("pending" in x))).toBe(true);
    expect(r.local()).toEqual([]);
    // New answers go straight to the account.
    await r.record(result("aaaaaaaa3"));
    expect(sent.flat().map((x) => x.id)).toContain("aaaaaaaa3");
    expect(r.local()).toEqual([]);
  });

  it("if the server can't save (the table isn't there yet), answers wait here and go later", async () => {
    const r = recorder();
    await r.setAccount(true);
    failing = true;
    await r.record(result("aaaaaaaa1"));
    expect(r.local().map((x) => [x.id, x.pending])).toEqual([["aaaaaaaa1", true]]);
    failing = false;
    await r.record(result("aaaaaaaa2"));
    expect(sent.flat().map((x) => x.id)).toEqual(["aaaaaaaa1", "aaaaaaaa2"]);
    expect(r.local()).toEqual([]);
  });

  it("ignores a malformed answer and survives broken storage", async () => {
    const r = recorder();
    await r.record({ ...result("x"), id: "no spaces allowed" });
    expect(r.local()).toEqual([]);
    storage.setItem(CHECKS_STORAGE_KEY, "{not json");
    expect(r.local()).toEqual([]);
    const blocked = createCheckRecorder({ storage: () => undefined, transport });
    await expect(blocked.record(result("aaaaaaaa1"))).resolves.toBeUndefined();
  });

  it("never touches progress: answering doesn't change Learning or Done", () => {
    for (const file of [
      "src/lib/quickcheck/results.ts",
      "src/lib/quickcheck/schedule.ts",
      "src/components/learn/use-quick-checks.ts",
      "src/components/learn/quick-check.tsx",
    ])
      expect(readFileSync(file, "utf8"), file).not.toMatch(/from "[^"]*progress[^"]*"/);
  });
});

describe("/api/checks", () => {
  const saved: { userId: string; results: readonly CheckResult[] }[] = [];
  let broken: unknown;
  const store: CheckResultStore = {
    async save(userId, results) {
      if (broken) throw broken;
      saved.push({ userId, results });
      return results.length;
    },
    async load() {
      if (broken) throw broken;
      return [result("aaaaaaaa1")];
    },
  };
  const logs: string[] = [];
  const deps = (over: Partial<Parameters<typeof postChecks>[0]> = {}) => ({
    user: { id: "u1", canSync: true },
    store,
    limiter: createMemoryRateLimiter(),
    isProblem: (key: string) => key === K,
    now: () => 5000,
    log: (m: string) => logs.push(m),
    ...over,
  });
  beforeEach(() => {
    saved.length = 0;
    logs.length = 0;
    broken = undefined;
  });

  it("needs a verified sign-in", async () => {
    expect((await postChecks(deps({ user: null }), { results: [] })).status).toBe(401);
    expect((await postChecks(deps({ user: { id: "u1", canSync: false } }), { results: [] })).status).toBe(
      403,
    );
    expect((await getChecks(deps({ user: null }))).status).toBe(401);
  });

  it("saves for the session's user only, drops unknown problems, and clamps future times", async () => {
    const res = await postChecks(deps(), {
      userId: "someone-else",
      results: [
        result("aaaaaaaa1", { answeredAt: 99_999 }),
        result("aaaaaaaa2", { problemKey: "nope/missing" }),
      ],
    });
    expect(res).toEqual({ status: 200, body: { saved: 1 } });
    expect(saved[0].userId).toBe("u1");
    expect(saved[0].results.map((r) => [r.id, r.answeredAt])).toEqual([["aaaaaaaa1", 5000]]);
  });

  it("refuses malformed or oversized batches", async () => {
    expect((await postChecks(deps(), { results: [{ id: "x" }] })).status).toBe(400);
    expect((await postChecks(deps(), {})).status).toBe(400);
    const many = Array.from({ length: 101 }, (_, i) => result(`aaaaaaa${String(i).padStart(3, "0")}`));
    expect((await postChecks(deps(), { results: many })).status).toBe(400);
  });

  it("a missing table or a database error is a 503 (the browser keeps the answers), never a crash", async () => {
    broken = Object.assign(new Error("relation does not exist"), { code: "P2021" });
    const res = await postChecks(deps(), { results: [result("aaaaaaaa1")] });
    expect(res.status).toBe(503);
    expect(logs[0]).toMatch(/CheckResult table is missing: run `pnpm db:deploy`/);
    broken = new Error("connection reset");
    expect((await getChecks(deps())).status).toBe(503);
    expect(logs[1]).toMatch(/a database error/);
    expect(logs.join()).not.toMatch(/connection reset|relation/);
  });

  it("is rate limited per user", async () => {
    const limiter = createMemoryRateLimiter();
    const d = deps({ limiter });
    let last = 200;
    for (let i = 0; i < 121; i++) last = (await postChecks(d, { results: [] })).status;
    expect(last).toBe(429);
  });
});
