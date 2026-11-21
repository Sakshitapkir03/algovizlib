import { z } from "zod";

import {
  applyChange,
  progressRecordsSchema,
  progressStatusSchema,
  statusesOf,
  type ProgressChange,
  type ProgressRecords,
  type ProgressSnapshot,
  type ProgressStatus,
} from "./records";

export * from "./records";

/**
 * Where a learner's progress lives: the browser (guests, and accounts whose email isn't verified yet) or the
 * account's database copy (`createAccountProgressRepository`). UI code only talks to this interface, through
 * `useProgress`, so which copy is active never touches components.
 */
export interface ProgressRepository {
  readonly kind: "browser" | "account";
  /** Stable for a given state (same object until something changes), as `useSyncExternalStore` requires. */
  getSnapshot(): ProgressSnapshot;
  /** Every record, with who set the status and the saved video position. Stable like `getSnapshot`. */
  getRecords(): ProgressRecords;
  /** The learner picked a status (always applied; automatic updates never override it). */
  set(problemKey: string, status: ProgressStatus): void;
  /** Apply a change: `set-status`, `mark-learning`, `save-position`, `clear-position`. */
  apply(change: ProgressChange, options?: { beacon?: boolean }): void;
  subscribe(listener: () => void): () => void;
  /** False when progress can't be persisted (private mode, storage blocked); changes last until reload. */
  readonly persistent: boolean;
}

/** `pattern/slug`, so problem slugs never need to be globally unique for progress. */
export function progressKey(problem: { patternSlug: string; slug: string }): string {
  return `${problem.patternSlug}/${problem.slug}`;
}

export function statusOf(snapshot: ProgressSnapshot, key: string): ProgressStatus {
  return snapshot[key] ?? "not-started";
}

/**
 * In-memory records plus subscribers; `persist` runs after every change that changed something. The browser and
 * account copies differ only in how they persist.
 */
export function createRecordsStore(
  initial: ProgressRecords,
  persist: (records: ProgressRecords, change: ProgressChange, options: { beacon?: boolean }) => void,
  now: () => number = Date.now,
) {
  let records = initial;
  let snapshot = statusesOf(records);
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    getRecords: () => records,
    getSnapshot: () => snapshot,
    /** Replace everything (another tab wrote, or the server answered). */
    reset(next: ProgressRecords) {
      records = next;
      snapshot = statusesOf(next);
      emit();
    },
    apply(change: ProgressChange, options: { beacon?: boolean } = {}) {
      const next = applyChange(records, change, now());
      if (next === records) return;
      records = next;
      const statuses = statusesOf(next);
      // Keep the snapshot object when only a position moved, so status UI doesn't re-render every 5 seconds.
      if (JSON.stringify(statuses) !== JSON.stringify(snapshot)) snapshot = statuses;
      persist(records, change, options);
      emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

// --- The browser copy ---------------------------------------------------------------------------------------

export const PROGRESS_STORAGE_KEY = "algovizlib:progress:v2";
/** Version 1 stored statuses only; it's read once and moved to version 2. */
export const PROGRESS_STORAGE_KEY_V1 = "algovizlib:progress:v1";

const storedV2Schema = z.object({ version: z.literal(2), records: progressRecordsSchema });
const storedV1Schema = z.object({
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

function parse<T>(storage: StorageLike, key: string, schema: z.ZodType<T>): T | undefined {
  try {
    const raw = storage.getItem(key);
    if (!raw) return undefined;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function write(storage: StorageLike | undefined, records: ProgressRecords) {
  if (!storage) return;
  try {
    if (Object.keys(records).length === 0) storage.removeItem(PROGRESS_STORAGE_KEY);
    else storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, records }));
  } catch {
    // Quota exceeded or storage revoked mid-session: keep the in-memory state.
  }
}

/** Version 2 records, or version 1 statuses moved over (treated as chosen by the learner: they were). */
function read(storage: StorageLike | undefined, now: number): ProgressRecords {
  if (!storage) return {};
  const v2 = parse(storage, PROGRESS_STORAGE_KEY, storedV2Schema);
  if (v2) return v2.records;
  const v1 = parse(storage, PROGRESS_STORAGE_KEY_V1, storedV1Schema);
  if (!v1) return {};
  const records: Record<string, ProgressRecords[string]> = {};
  for (const [key, status] of Object.entries(v1.statuses))
    if (status !== "not-started") records[key] = { status, manual: true, updatedAt: now };
  write(storage, records);
  try {
    storage.removeItem(PROGRESS_STORAGE_KEY_V1);
  } catch {
    // Leave it; version 2 wins from now on.
  }
  return records;
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
 * The browser copy: versioned JSON in localStorage, kept in sync across tabs, falling back to memory when storage
 * is missing or throws. Pass `storage` in tests; pass `null` to force the in-memory fallback.
 */
export function createLocalProgressRepository(
  storage?: StorageLike | null,
  now: () => number = Date.now,
): ProgressRepository & { clear(): void } {
  const backing = probeStorage(storage === null ? undefined : (storage ?? defaultStorage()));
  const store = createRecordsStore(read(backing, now()), (records) => write(backing, records), now);

  return {
    kind: "browser",
    persistent: backing !== undefined,
    getSnapshot: store.getSnapshot,
    getRecords: store.getRecords,
    set: (key, status) => store.apply({ op: "set-status", key, status }),
    apply: (change) => store.apply(change),
    /** Forget everything here (after it was merged into an account). */
    clear() {
      write(backing, {});
      store.reset({});
    },
    subscribe(listener) {
      const unsubscribe = store.subscribe(listener);
      // Keep tabs in sync: another tab wrote progress.
      const onStorage = (event: StorageEvent) => {
        if (event.key !== PROGRESS_STORAGE_KEY) return;
        store.reset(read(backing, now()));
      };
      const canListen = backing !== undefined && typeof window !== "undefined";
      if (canListen) window.addEventListener("storage", onStorage);
      return () => {
        unsubscribe();
        if (canListen) window.removeEventListener("storage", onStorage);
      };
    },
  };
}

// --- The account copy ---------------------------------------------------------------------------------------

/** How the account copy talks to `/api/progress` (injected in tests). */
export type ProgressTransport = {
  /** POST a change; rejects if the server didn't save it. */
  send(change: ProgressChange): Promise<void>;
  /** Best effort while the page is being hidden (`navigator.sendBeacon`). */
  beacon(change: ProgressChange): void;
  /** The account's records. */
  load(): Promise<ProgressRecords>;
  /** Merge a guest's browser copy into the account; resolves to the merged records. */
  merge(records: ProgressRecords): Promise<ProgressRecords>;
};

/**
 * The account copy: starts from the records the server returned, applies changes immediately (so the UI never
 * waits), and sends each to the server, which applies it with the same rules. If a write fails, it reloads from
 * the server so the page never shows something that wasn't saved.
 */
export function createAccountProgressRepository(
  initial: ProgressRecords,
  transport: ProgressTransport,
  now: () => number = Date.now,
): ProgressRepository {
  const store = createRecordsStore(
    initial,
    (_records, change, { beacon }) => {
      if (beacon) return transport.beacon(change);
      transport.send(change).catch(() =>
        transport.load().then(store.reset, () => {
          // Offline: keep what's shown; the next successful write or page load reconciles.
        }),
      );
    },
    now,
  );
  return {
    kind: "account",
    persistent: true,
    getSnapshot: store.getSnapshot,
    getRecords: store.getRecords,
    set: (key, status) => store.apply({ op: "set-status", key, status }),
    apply: (change, options) => store.apply(change, options),
    subscribe: store.subscribe,
  };
}
