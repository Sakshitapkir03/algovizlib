import { describe, expect, it, vi } from "vitest";

import {
  createLocalProgressRepository,
  progressKey,
  PROGRESS_STORAGE_KEY,
  PROGRESS_STORAGE_KEY_V1,
  statusOf,
} from "@/lib/progress";

/** Minimal in-memory Storage. */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

const KEY = progressKey({ patternSlug: "two-pointers", slug: "pair-with-target-sum" });

describe("ProgressRepository with storage", () => {
  it("starts empty and persists changes", () => {
    const storage = memoryStorage();
    const repo = createLocalProgressRepository(storage);
    expect(repo.persistent).toBe(true);
    expect(statusOf(repo.getSnapshot(), KEY)).toBe("not-started");

    const repo2 = createLocalProgressRepository(storage, () => 1000);
    repo2.set(KEY, "learning");
    expect(statusOf(repo2.getSnapshot(), KEY)).toBe("learning");
    expect(JSON.parse(storage.getItem(PROGRESS_STORAGE_KEY)!)).toEqual({
      version: 2,
      records: { [KEY]: { status: "learning", manual: true, updatedAt: 1000 } },
    });

    // A fresh repository (a reload) reads it back.
    expect(statusOf(createLocalProgressRepository(storage).getSnapshot(), KEY)).toBe("learning");
  });

  it("drops the status when reset to not-started, but remembers it was the learner's choice", () => {
    const storage = memoryStorage();
    const repo = createLocalProgressRepository(storage);
    repo.set(KEY, "done");
    repo.set(KEY, "not-started");
    expect(repo.getSnapshot()).toEqual({});
    expect(repo.getRecords()[KEY]).toMatchObject({ status: "not-started", manual: true });
  });

  it("moves version 1 statuses to version 2 (as the learner's choices) and removes the old key", () => {
    const storage = memoryStorage({
      [PROGRESS_STORAGE_KEY_V1]: JSON.stringify({
        version: 1,
        statuses: { [KEY]: "done", "x/y": "learning" },
      }),
    });
    const repo = createLocalProgressRepository(storage, () => 42);
    expect(repo.getSnapshot()).toEqual({ [KEY]: "done", "x/y": "learning" });
    expect(repo.getRecords()[KEY]).toEqual({ status: "done", manual: true, updatedAt: 42 });
    expect(storage.getItem(PROGRESS_STORAGE_KEY_V1)).toBeNull();
    expect(JSON.parse(storage.getItem(PROGRESS_STORAGE_KEY)!).version).toBe(2);
  });

  it("keeps the status snapshot stable when only a video position changes", () => {
    const repo = createLocalProgressRepository(memoryStorage());
    repo.set(KEY, "learning");
    const before = repo.getSnapshot();
    repo.apply({ op: "save-position", key: KEY, sceneId: "intro", seconds: 12 });
    expect(repo.getSnapshot()).toBe(before);
    expect(repo.getRecords()[KEY].position).toMatchObject({ sceneId: "intro", seconds: 12 });
  });

  it("clear() forgets everything (after merging into an account)", () => {
    const storage = memoryStorage();
    const repo = createLocalProgressRepository(storage);
    repo.set(KEY, "done");
    repo.clear();
    expect(repo.getRecords()).toEqual({});
    expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
  });

  it("notifies subscribers and keeps the snapshot stable when nothing changes", () => {
    const repo = createLocalProgressRepository(memoryStorage());
    const listener = vi.fn();
    const unsubscribe = repo.subscribe(listener);
    repo.set(KEY, "done");
    expect(listener).toHaveBeenCalledTimes(1);
    const before = repo.getSnapshot();
    repo.set(KEY, "done"); // no-op
    expect(listener).toHaveBeenCalledTimes(1);
    expect(repo.getSnapshot()).toBe(before);
    unsubscribe();
    repo.set(KEY, "learning");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores corrupt or outdated stored data", () => {
    for (const raw of [
      "{not json",
      JSON.stringify({ version: 99, statuses: {} }),
      JSON.stringify({ version: 2, records: { [KEY]: { status: "mastered", manual: true, updatedAt: 1 } } }),
    ]) {
      const repo = createLocalProgressRepository(memoryStorage({ [PROGRESS_STORAGE_KEY]: raw }));
      expect(repo.getSnapshot()).toEqual({});
    }
  });

  it("keeps working in memory if a write fails mid-session (quota exceeded)", () => {
    const storage = memoryStorage();
    const repo = createLocalProgressRepository(storage);
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(() => repo.set(KEY, "done")).not.toThrow();
    expect(statusOf(repo.getSnapshot(), KEY)).toBe("done");
  });
});

describe("ProgressRepository without storage", () => {
  it("falls back to memory when storage is absent", () => {
    const repo = createLocalProgressRepository(null);
    expect(repo.persistent).toBe(false);
    repo.set(KEY, "done");
    expect(statusOf(repo.getSnapshot(), KEY)).toBe("done");
  });

  it("falls back to memory when storage throws on access (blocked site data, private mode)", () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    const repo = createLocalProgressRepository(throwing);
    expect(repo.persistent).toBe(false);
    expect(() => repo.set(KEY, "learning")).not.toThrow();
    expect(statusOf(repo.getSnapshot(), KEY)).toBe("learning");
  });

  it("defaults to memory on the server, where window is undefined", () => {
    const repo = createLocalProgressRepository();
    expect(repo.persistent).toBe(false);
    expect(repo.getSnapshot()).toEqual({});
  });
});
