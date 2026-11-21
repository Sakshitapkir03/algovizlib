import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMemoryRateLimiter, LIMITS } from "@/lib/auth/rate-limit";
import {
  applyChange,
  applyAutoLearning,
  createAccountProgressRepository,
  mergeRecord,
  mergeRecords,
  shouldMarkLearning,
  type ProgressChange,
  type ProgressRecords,
  type ProgressTransport,
} from "@/lib/progress";
import { isResumable, positionAt, resumeFrame } from "@/lib/progress/resume";
import {
  getProgress,
  mergeProgress,
  postProgress,
  sameOrigin,
  type ProgressApiDeps,
  type ProgressStore,
} from "@/lib/progress/server";
import { continueList, recentlyDone } from "@/lib/progress/summary";
import {
  getActiveRepository,
  resetProgressHubForTests,
  syncAccountProgress,
} from "@/lib/progress/use-progress";
import { trackVideoProgress, type PlayerSnapshot } from "@/lib/progress/video-tracker";
import { getSceneTimeline } from "@/lib/storyboard";

const K = "two-pointers/pair-with-target-sum";
const K2 = "sorting/merge-sort";

describe("automatic status", () => {
  it("sets Learning only from a Not started that the learner didn't choose", () => {
    expect(shouldMarkLearning(undefined)).toBe(true);
    expect(shouldMarkLearning({ status: "not-started", manual: false, updatedAt: 1 })).toBe(true);
    expect(shouldMarkLearning({ status: "not-started", manual: true, updatedAt: 1 })).toBe(false);
    expect(shouldMarkLearning({ status: "learning", manual: false, updatedAt: 1 })).toBe(false);
    expect(shouldMarkLearning({ status: "done", manual: false, updatedAt: 1 })).toBe(false);
  });

  it("never downgrades and never sets Done", () => {
    const done: ProgressRecords = { [K]: { status: "done", manual: true, updatedAt: 1 } };
    expect(applyAutoLearning(done, K, 5)).toBe(done);
    const learned = applyAutoLearning({}, K, 5);
    expect(learned[K]).toEqual({ status: "learning", manual: false, updatedAt: 5 });
    // No change in this model ever produces Done except set-status.
    const ops: ProgressChange[] = [
      { op: "mark-learning", key: K },
      { op: "save-position", key: K, sceneId: "a", seconds: 10 },
      { op: "clear-position", key: K },
    ];
    let r: ProgressRecords = {};
    for (const op of ops) r = applyChange(r, op, 9);
    expect(r[K].status).toBe("learning");
  });

  it("manual choices always win, in either direction, and stop automatic updates", () => {
    let r = applyChange({}, { op: "mark-learning", key: K }, 1);
    r = applyChange(r, { op: "set-status", key: K, status: "not-started" }, 2);
    expect(r[K]).toMatchObject({ status: "not-started", manual: true });
    r = applyChange(r, { op: "mark-learning", key: K }, 3);
    expect(r[K].status).toBe("not-started");
    r = applyChange(r, { op: "set-status", key: K, status: "done" }, 4);
    r = applyChange(r, { op: "set-status", key: K, status: "learning" }, 5);
    expect(r[K]).toMatchObject({ status: "learning", manual: true, updatedAt: 5 });
  });

  it("a position keeps the status and its time", () => {
    let r = applyChange({}, { op: "set-status", key: K, status: "done" }, 1);
    r = applyChange(r, { op: "save-position", key: K, sceneId: "s", seconds: 4 }, 7);
    expect(r[K]).toEqual({
      status: "done",
      manual: true,
      updatedAt: 1,
      position: { sceneId: "s", seconds: 4, updatedAt: 7 },
    });
    r = applyChange(r, { op: "clear-position", key: K }, 8);
    expect(r[K].position).toBeUndefined();
  });
});

describe("merging a guest's progress into an account", () => {
  const rec = (status: "not-started" | "learning" | "done", updatedAt: number, manual = false) => ({
    status,
    manual,
    updatedAt,
  });

  it("keeps the more advanced status, never downgrading either side", () => {
    expect(mergeRecord(rec("done", 1), rec("learning", 9)).status).toBe("done");
    expect(mergeRecord(rec("learning", 9), rec("done", 1)).status).toBe("done");
    expect(mergeRecord(rec("not-started", 9, true), rec("learning", 1)).status).toBe("learning");
  });

  it("keeps the most recently saved video position", () => {
    const a = { ...rec("learning", 1), position: { sceneId: "a", seconds: 10, updatedAt: 100 } };
    const b = { ...rec("learning", 1), position: { sceneId: "b", seconds: 20, updatedAt: 200 } };
    expect(mergeRecord(a, b).position?.sceneId).toBe("b");
    expect(mergeRecord(b, a).position?.sceneId).toBe("b");
    expect(mergeRecord(rec("done", 1), a).position?.sceneId).toBe("a");
  });

  it("merges whole sets", () => {
    const account: ProgressRecords = { [K]: rec("done", 5, true), [K2]: rec("learning", 1) };
    const guest: ProgressRecords = { [K]: rec("learning", 9), "x/y": rec("learning", 2) };
    expect(mergeRecords(account, guest)).toEqual({
      [K]: { status: "done", manual: true, updatedAt: 9 },
      [K2]: rec("learning", 1),
      "x/y": rec("learning", 2),
    });
  });
});

// --- The tab's hub: guest → account ---------------------------------------------------------------------------

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

function fakeServer(initial: ProgressRecords = {}) {
  let records = initial;
  const sent: ProgressChange[] = [];
  const beacons: ProgressChange[] = [];
  const transport: ProgressTransport & { fail: boolean } = {
    fail: false,
    async send(change) {
      if (transport.fail) throw new Error("offline");
      sent.push(change);
      records = applyChange(records, change, 1);
    },
    beacon: (change) => void beacons.push(change),
    async load() {
      return records;
    },
    async merge(guest) {
      if (transport.fail) throw new Error("offline");
      records = mergeRecords(records, guest);
      return records;
    },
  };
  return { transport, sent, beacons, records: () => records };
}

describe("signing in: the browser copy merges into the account", () => {
  beforeEach(() => {
    resetProgressHubForTests();
    vi.stubGlobal("window", {
      localStorage: memoryStorage(),
      addEventListener() {},
      removeEventListener() {},
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("a guest uses the browser copy (no sign-in needed)", async () => {
    await syncAccountProgress(null);
    const repo = getActiveRepository();
    expect(repo.kind).toBe("browser");
    repo.set(K, "learning");
    expect(repo.getSnapshot()).toEqual({ [K]: "learning" });
  });

  it("a verified user's guest progress is merged, the local copy cleared, and the account used", async () => {
    getActiveRepository().set(K, "done");
    getActiveRepository().apply({ op: "save-position", key: K2, sceneId: "s", seconds: 30 });
    const server = fakeServer({ [K]: { status: "learning", manual: false, updatedAt: 1 } });
    await syncAccountProgress({ id: "u1", emailVerified: true }, server.transport);
    const repo = getActiveRepository();
    expect(repo.kind).toBe("account");
    expect(repo.getSnapshot()).toEqual({ [K]: "done" });
    expect(repo.getRecords()[K2].position?.seconds).toBe(30);
    expect(window.localStorage.getItem("algovizlib:progress:v2")).toBeNull();
    // Changes now go to the server.
    repo.apply({ op: "mark-learning", key: "x/y" });
    await Promise.resolve();
    expect(server.sent).toEqual([{ op: "mark-learning", key: "x/y" }]);
    // Page hide: the beacon.
    repo.apply({ op: "save-position", key: K, sceneId: "s", seconds: 9 }, { beacon: true });
    expect(server.beacons).toHaveLength(1);
  });

  it("an unverified user keeps progress in this browser", async () => {
    const server = fakeServer();
    getActiveRepository().set(K, "learning");
    await syncAccountProgress({ id: "u1", emailVerified: false }, server.transport);
    expect(getActiveRepository().kind).toBe("browser");
    expect(getActiveRepository().getSnapshot()).toEqual({ [K]: "learning" });
    expect(server.records()).toEqual({});
  });

  it("if the merge fails, nothing is lost: the browser copy stays", async () => {
    const server = fakeServer();
    server.transport.fail = true;
    getActiveRepository().set(K, "learning");
    await syncAccountProgress({ id: "u1", emailVerified: true }, server.transport);
    expect(getActiveRepository().kind).toBe("browser");
    expect(getActiveRepository().getSnapshot()).toEqual({ [K]: "learning" });
  });

  it("signing out returns to the (now empty) browser copy; another user gets their own account copy", async () => {
    const a = fakeServer({ [K]: { status: "done", manual: true, updatedAt: 1 } });
    await syncAccountProgress({ id: "a", emailVerified: true }, a.transport);
    await syncAccountProgress(null);
    expect(getActiveRepository().kind).toBe("browser");
    expect(getActiveRepository().getSnapshot()).toEqual({});
    const b = fakeServer({ [K2]: { status: "learning", manual: false, updatedAt: 1 } });
    await syncAccountProgress({ id: "b", emailVerified: true }, b.transport);
    expect(getActiveRepository().getSnapshot()).toEqual({ [K2]: "learning" });
  });

  it("the account copy reloads from the server if a write fails", async () => {
    const server = fakeServer({ [K]: { status: "learning", manual: false, updatedAt: 1 } });
    const repo = createAccountProgressRepository(await server.transport.load(), server.transport);
    server.transport.fail = true;
    repo.set(K, "done");
    expect(repo.getSnapshot()[K]).toBe("done"); // optimistic
    await new Promise((r) => setTimeout(r, 0));
    expect(repo.getSnapshot()[K]).toBe("learning"); // the server's truth
  });
});

// --- The API: access control ----------------------------------------------------------------------------------

function memoryProgressStore(): ProgressStore & { data: Map<string, ProgressRecords> } {
  const data = new Map<string, ProgressRecords>();
  return {
    data,
    async load(userId) {
      return data.get(userId) ?? {};
    },
    async apply(userId, change, now) {
      data.set(userId, applyChange(data.get(userId) ?? {}, change, now));
    },
    async merge(userId, guest) {
      const merged = mergeRecords(data.get(userId) ?? {}, guest);
      data.set(userId, merged);
      return merged;
    },
  };
}

function api(user: ProgressApiDeps["user"], store = memoryProgressStore()): ProgressApiDeps {
  return {
    user,
    store,
    limiter: createMemoryRateLimiter(() => 0),
    isProblem: (key) => key === K || key === K2,
    now: () => 1000,
  };
}

describe("progress API access control", () => {
  it("needs a signed-in, verified user", async () => {
    expect((await getProgress(api(null))).status).toBe(401);
    expect((await postProgress(api(null), { op: "mark-learning", key: K })).status).toBe(401);
    expect((await mergeProgress(api(null), { records: {} })).status).toBe(401);
    expect((await getProgress(api({ id: "u1", canSync: false }))).status).toBe(403);
  });

  it("users can't read or write each other's progress: the session decides, never the body", async () => {
    const store = memoryProgressStore();
    store.data.set("victim", { [K]: { status: "done", manual: true, updatedAt: 1 } });
    const attacker = api({ id: "attacker", canSync: true }, store);
    expect((await getProgress(attacker)).body).toEqual({ records: {} });
    await postProgress(attacker, { op: "set-status", key: K, status: "not-started", userId: "victim" });
    await mergeProgress(attacker, {
      userId: "victim",
      records: { [K2]: { status: "done", manual: true, updatedAt: 1 } },
    });
    expect(store.data.get("victim")).toEqual({ [K]: { status: "done", manual: true, updatedAt: 1 } });
    expect(Object.keys(store.data.get("attacker")!)).toEqual([K, K2]);
  });

  it("rejects malformed changes and unknown problems", async () => {
    const deps = api({ id: "u1", canSync: true });
    expect((await postProgress(deps, { op: "set-status", key: K, status: "mastered" })).status).toBe(400);
    expect((await postProgress(deps, { op: "mark-learning", key: "nope/nope" })).status).toBe(400);
    expect(
      (await postProgress(deps, { op: "save-position", key: K, sceneId: "s", seconds: 99_999 })).status,
    ).toBe(400);
    expect((await postProgress(deps, { op: "mark-learning", key: K })).status).toBe(204);
  });

  it("merge drops unknown problems and clamps timestamps from a clock in the future", async () => {
    const deps = api({ id: "u1", canSync: true });
    const res = await mergeProgress(deps, {
      records: {
        [K]: {
          status: "learning",
          manual: false,
          updatedAt: 9e12,
          position: { sceneId: "s", seconds: 5, updatedAt: 9e12 },
        },
        "nope/nope": { status: "done", manual: true, updatedAt: 1 },
      },
    });
    expect(res.body).toEqual({
      records: {
        [K]: {
          status: "learning",
          manual: false,
          updatedAt: 1000,
          position: { sceneId: "s", seconds: 5, updatedAt: 1000 },
        },
      },
    });
  });

  it("is rate limited per user", async () => {
    const deps = api({ id: "u1", canSync: true });
    for (let i = 0; i < LIMITS.progressUser.max; i++)
      await postProgress(deps, { op: "mark-learning", key: K });
    expect((await postProgress(deps, { op: "mark-learning", key: K })).status).toBe(429);
  });

  it("refuses cross-site posts", () => {
    const req = (origin?: string) =>
      new Request("https://algoviz.test/api/progress", {
        method: "POST",
        headers: origin ? { origin } : {},
      });
    expect(sameOrigin(req("https://algoviz.test"))).toBe(true);
    expect(sameOrigin(req("https://evil.example"))).toBe(false);
    expect(sameOrigin(req())).toBe(false);
  });
});

// --- Resume -----------------------------------------------------------------------------------------------------

const scenes = [
  { id: "intro", durationInFrames: 150 },
  { id: "idea", durationInFrames: 300 },
  { id: "answer", durationInFrames: 300 },
];
const { timings, durationInFrames } = getSceneTimeline(scenes);
const FPS = 30;

describe("resume positions", () => {
  it("records the scene and seconds", () => {
    expect(positionAt(timings, 200, FPS)).toEqual({ sceneId: "idea", seconds: 6.67 });
  });

  it("resumes at the saved second, or the scene's start if the video's timing changed", () => {
    expect(resumeFrame({ sceneId: "idea", seconds: 200 / FPS }, timings, durationInFrames, FPS)).toBe(200);
    const idea = timings[1];
    expect(resumeFrame({ sceneId: "idea", seconds: 1 }, timings, durationInFrames, FPS)).toBe(idea.seekFrame);
    expect(resumeFrame({ sceneId: "gone", seconds: 10 }, timings, durationInFrames, FPS)).toBeNull();
    expect(resumeFrame(undefined, timings, durationInFrames, FPS)).toBeNull();
  });

  it("offers nothing in the first seconds or at the very end", () => {
    expect(resumeFrame({ sceneId: "intro", seconds: 1 }, timings, durationInFrames, FPS)).toBeNull();
    expect(isResumable(durationInFrames - 10, durationInFrames, FPS)).toBe(false);
  });

  it("lists what to continue (saved positions first) and what's done", () => {
    const records: ProgressRecords = {
      a: { status: "learning", manual: false, updatedAt: 5 },
      b: {
        status: "learning",
        manual: false,
        updatedAt: 1,
        position: { sceneId: "s", seconds: 3, updatedAt: 2 },
      },
      c: { status: "done", manual: true, updatedAt: 9, position: { sceneId: "s", seconds: 3, updatedAt: 9 } },
      d: { status: "done", manual: true, updatedAt: 3 },
      gone: { status: "learning", manual: false, updatedAt: 99 },
    };
    const known = (k: string) => k !== "gone";
    expect(continueList(records, known).map((i) => i.key)).toEqual(["b", "a"]);
    expect(recentlyDone(records, known).map((i) => i.key)).toEqual(["c", "d"]);
  });
});

describe("video progress tracking (mocked player)", () => {
  function fakePlayer() {
    let state: PlayerSnapshot = { frame: 0, isPlaying: false, ended: false, holding: false };
    const listeners = new Set<(s: PlayerSnapshot, p: PlayerSnapshot) => void>();
    return {
      getState: () => state,
      subscribe: (l: (s: PlayerSnapshot, p: PlayerSnapshot) => void) => (
        listeners.add(l),
        () => listeners.delete(l)
      ),
      set(patch: Partial<PlayerSnapshot>) {
        const prev = state;
        state = { ...state, ...patch };
        listeners.forEach((l) => l(state, prev));
      },
    };
  }

  function setup() {
    const player = fakePlayer();
    let clock = 0;
    const changes: { change: ProgressChange; beacon?: boolean }[] = [];
    let interactions = 0;
    const tracker = trackVideoProgress({
      problemKey: K,
      timings,
      durationInFrames,
      fps: FPS,
      getState: player.getState,
      subscribe: player.subscribe,
      apply: (change, o) => changes.push({ change, beacon: o?.beacon }),
      onInteract: () => interactions++,
      now: () => clock,
    });
    const play = (toFrame: number, stepMs = 1000) => {
      while (player.getState().frame < toFrame) {
        clock += stepMs;
        player.set({ frame: Math.min(toFrame, player.getState().frame + (stepMs / 1000) * FPS) });
      }
    };
    return {
      player,
      tracker,
      changes,
      play,
      interactions: () => interactions,
      ops: () => changes.map((c) => c.change.op),
    };
  }

  it("the first play marks Learning; positions save every 5 seconds while playing", () => {
    const t = setup();
    t.player.set({ isPlaying: true });
    expect(t.changes[0].change).toEqual({ op: "mark-learning", key: K });
    t.play(5 * FPS); // 5 s in
    const saves = t.changes.filter((c) => c.change.op === "save-position");
    expect(saves).toHaveLength(1);
    t.play(10 * FPS);
    expect(t.changes.filter((c) => c.change.op === "save-position")).toHaveLength(2);
    expect(t.interactions()).toBeGreaterThan(0);
  });

  it("saves on pause, on a scene change, and with a beacon when the page is hidden", () => {
    const t = setup();
    t.player.set({ isPlaying: true, frame: 120 });
    t.changes.length = 0;
    t.player.set({ isPlaying: false });
    expect(t.changes.at(-1)!.change).toEqual({ op: "save-position", key: K, sceneId: "intro", seconds: 4 });
    t.player.set({ frame: timings[1].seekFrame }); // scene jump while paused
    expect(t.changes.at(-1)!.change).toMatchObject({ op: "save-position", sceneId: "idea" });
    t.tracker.hide();
    expect(t.changes.at(-1)).toMatchObject({ beacon: true, change: { op: "save-position" } });
  });

  it("a hold for the browser voice isn't a pause", () => {
    const t = setup();
    t.player.set({ isPlaying: true, frame: 120 });
    t.changes.length = 0;
    t.player.set({ isPlaying: false, holding: true });
    expect(t.changes).toEqual([]);
  });

  it("watching to the end clears the position and saves nothing after", () => {
    const t = setup();
    t.player.set({ isPlaying: true });
    t.play(durationInFrames - 1, 500);
    t.player.set({ ended: true, isPlaying: false });
    expect(t.changes.at(-1)!.change).toEqual({ op: "clear-position", key: K });
    const count = t.changes.length;
    t.tracker.hide();
    expect(t.changes).toHaveLength(count);
  });

  it("restores: a saved position round-trips to the same frame", () => {
    const t = setup();
    t.player.set({ isPlaying: true, frame: 333 });
    t.player.set({ isPlaying: false });
    const saved = t.changes.at(-1)!.change as Extract<ProgressChange, { op: "save-position" }>;
    expect(resumeFrame(saved, timings, durationInFrames, FPS)).toBe(333);
  });

  it("stops listening when disposed", () => {
    const t = setup();
    t.tracker.dispose();
    t.player.set({ isPlaying: true });
    expect(t.changes).toEqual([]);
  });
});
