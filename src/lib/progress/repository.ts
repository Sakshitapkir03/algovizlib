import { z } from "zod";

export const progressStatusSchema = z.enum(["not-started", "learning", "done"]);
export type ProgressStatus = z.infer<typeof progressStatusSchema>;

export const PROGRESS_STATUSES: readonly ProgressStatus[] = progressStatusSchema.options;
export const PROGRESS_LABEL: Record<ProgressStatus, string> = {
  "not-started": "Not started",
  learning: "Learning",
  done: "Done",
};

/** Problem key → status. Problems without an entry are "not-started". */
export type ProgressSnapshot = Readonly<Record<string, ProgressStatus>>;

/**
 * Where a learner's per-problem status lives. Today: the browser's localStorage. Later: a database keyed by user,
 * behind auth. UI code only talks to this interface (through `useProgress`), so swapping the backend doesn't
 * touch components.
 */
export interface ProgressRepository {
  /** Stable for a given state (same object until something changes), as `useSyncExternalStore` requires. */
  getSnapshot(): ProgressSnapshot;
  set(problemKey: string, status: ProgressStatus): void;
  subscribe(listener: () => void): () => void;
  /** False when progress can't be persisted (private mode, storage blocked); changes last until reload. */
  readonly persistent: boolean;
}

/** `pattern/slug`, so problem slugs never need to be globally unique for progress. */
export function progressKey(problem: { patternSlug: string; slug: string }): string {
  return `${problem.patternSlug}/${problem.slug}`;
}

export const PROGRESS_STORAGE_KEY = "algovizlib:progress:v1";

const storedSchema = z.object({
  version: z.literal(1),
  statuses: z.record(z.string(), progressStatusSchema),
});

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Returns `localStorage` if it exists and accepts writes; otherwise undefined. */
function probeStorage(storage: StorageLike | undefined): StorageLike | undefined {
  if (!storage) return undefined;
  try {
    const probe = `${PROGRESS_STORAGE_KEY}:probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return undefined;
  }
}

function read(storage: StorageLike | undefined): ProgressSnapshot {
  if (!storage) return {};
  try {
    const raw = storage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.statuses : {};
  } catch {
    return {};
  }
}

function defaultStorage(): StorageLike | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    // Accessing localStorage throws when site data is blocked.
    return undefined;
  }
}

/**
 * A ProgressRepository backed by localStorage that falls back to memory when storage is missing or throws.
 * Pass `storage` in tests; pass `null` to force the in-memory fallback.
 */
export function createLocalProgressRepository(storage?: StorageLike | null): ProgressRepository {
  const backing = probeStorage(storage === null ? undefined : (storage ?? defaultStorage()));
  let snapshot = read(backing);
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  return {
    persistent: backing !== undefined,
    getSnapshot: () => snapshot,
    set(problemKey, status) {
      if ((snapshot[problemKey] ?? "not-started") === status) return;
      const next = { ...snapshot };
      if (status === "not-started") delete next[problemKey];
      else next[problemKey] = status;
      snapshot = next;
      if (backing) {
        try {
          backing.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 1, statuses: snapshot }));
        } catch {
          // Quota exceeded or storage revoked mid-session: keep the in-memory state.
        }
      }
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      // Keep tabs in sync: another tab wrote progress.
      const onStorage = (event: StorageEvent) => {
        if (event.key !== PROGRESS_STORAGE_KEY) return;
        snapshot = read(backing);
        listener();
      };
      const canListen = backing !== undefined && typeof window !== "undefined";
      if (canListen) window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        if (canListen) window.removeEventListener("storage", onStorage);
      };
    },
  };
}

export function statusOf(snapshot: ProgressSnapshot, key: string): ProgressStatus {
  return snapshot[key] ?? "not-started";
}
