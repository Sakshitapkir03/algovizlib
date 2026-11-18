import { describe, expect, it, vi } from "vitest";

import { createLocalProgressRepository, progressKey, PROGRESS_STORAGE_KEY, statusOf } from "@/lib/progress";

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

    repo.set(KEY, "learning");
    expect(statusOf(repo.getSnapshot(), KEY)).toBe("learning");
    expect(JSON.parse(storage.getItem(PROGRESS_STORAGE_KEY)!)).toEqual({
      version: 1,
      statuses: { [KEY]: "learning" },
    });

    // A fresh repository (a reload) reads it back.
    expect(statusOf(createLocalProgressRepository(storage).getSnapshot(), KEY)).toBe("learning");
  });

  it("removes the entry when reset to not-started", () => {
    const storage = memoryStorage();
    const repo = createLocalProgressRepository(storage);
    repo.set(KEY, "done");
    repo.set(KEY, "not-started");
    expect(repo.getSnapshot()).toEqual({});
  });

  it("notifies subscribers and keeps the snapshot stable when nothing changes", () => {
    const repo = createLocalProgressRepository(memoryStorage());
    const listener = vi.fn();
    const unsubscribe = repo.subscribe(listener);
    const before = repo.getSnapshot();
    repo.set(KEY, "not-started"); // no-op
    expect(listener).not.toHaveBeenCalled();
    expect(repo.getSnapshot()).toBe(before);
    repo.set(KEY, "done");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    repo.set(KEY, "learning");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores corrupt or outdated stored data", () => {
    for (const raw of [
      "{not json",
      JSON.stringify({ version: 99, statuses: {} }),
      JSON.stringify({ version: 1, statuses: { [KEY]: "mastered" } }),
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
