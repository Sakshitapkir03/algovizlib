"use client";

import { useEffect, useSyncExternalStore } from "react";

import { getActiveRepository, useProgressRecords } from "@/lib/progress/use-progress";
import { checkRecorder, type CheckResult } from "@/lib/quickcheck/results";

import {
  applyReviewChange,
  buildReviewQueue,
  reviewStatesSchema,
  viewingReview,
  type ReviewChange,
  type ReviewItem,
  type ReviewStates,
} from "./rules";

/**
 * The tab's review schedule, like progress: guests (and accounts whose email isn't verified yet) keep it in this
 * browser; a verified user's browser copy is merged into the account on sign-in and cleared, and changes go to
 * `/api/review`. If the account's schedule can't be reached (the table isn't migrated yet, or the database is down),
 * the mode is "unavailable": the queue still shows from progress and quick checks, the browser copy is kept for the
 * next try, and "Reviewed" / "Snooze" report that they couldn't be saved.
 */
export type ReviewMode = "browser" | "account" | "unavailable";

export type ReviewTransport = {
  /** POST a change; rejects if the server didn't save it. */
  send(change: ReviewChange): Promise<void>;
  /** Merge a guest's browser copy into the account; resolves to the merged schedule. */
  merge(states: ReviewStates): Promise<ReviewStates>;
  /** The account's latest quick check answers. */
  loadChecks(): Promise<CheckResult[]>;
};

export const httpReviewTransport: ReviewTransport = {
  async send(change) {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change),
    });
    if (!res.ok) throw new Error(`Review not saved (${res.status}).`);
  },
  async merge(states) {
    const res = await fetch("/api/review/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ states }),
    });
    if (!res.ok) throw new Error(`Reviews not merged (${res.status}).`);
    return ((await res.json()) as { states: ReviewStates }).states;
  },
  async loadChecks() {
    const res = await fetch("/api/checks", { cache: "no-store" });
    if (!res.ok) throw new Error(`Quick checks not loaded (${res.status}).`);
    return ((await res.json()) as { results: CheckResult[] }).results;
  },
};

export const REVIEW_STORAGE_KEY = "algovizlib:review:v1";

function storage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function readLocal(): ReviewStates {
  try {
    const raw = storage()?.getItem(REVIEW_STORAGE_KEY);
    if (!raw) return {};
    const parsed = reviewStatesSchema.safeParse((JSON.parse(raw) as { states?: unknown }).states);
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

function writeLocal(states: ReviewStates) {
  try {
    if (Object.keys(states).length === 0) storage()?.removeItem(REVIEW_STORAGE_KEY);
    else storage()?.setItem(REVIEW_STORAGE_KEY, JSON.stringify({ version: 1, states }));
  } catch {
    // Storage blocked or full: the change lasts until reload.
  }
}

type HubState = {
  mode: ReviewMode;
  states: ReviewStates;
  /** Quick check answers the queue reads: this browser's, plus the account's when signed in. */
  checks: readonly CheckResult[];
  /** When the hub last changed: the queue's "now" (rendering stays pure). */
  now: number;
};

const EMPTY: HubState = { mode: "browser", states: {}, checks: [], now: 0 };

let state: HubState | undefined;
let accountUser: string | undefined;
let transport: ReviewTransport = httpReviewTransport;
let serverChecks: readonly CheckResult[] = [];
const listeners = new Set<() => void>();

function current(): HubState {
  state ??= { mode: "browser", states: readLocal(), checks: checkRecorder.local(), now: Date.now() };
  return state;
}

function set(next: Partial<HubState>) {
  state = { ...current(), ...next, now: Date.now() };
  listeners.forEach((l) => l());
}

function withServerChecks(): readonly CheckResult[] {
  const local = checkRecorder.local();
  if (current().mode === "browser") return local;
  const ids = new Set(serverChecks.map((c) => c.id));
  return [...serverChecks, ...local.filter((c) => !ids.has(c.id))];
}

/** Read this browser's answers again (and the account's, when signed in): called when a queue is shown. */
export async function refreshReviewChecks(): Promise<void> {
  if (current().mode !== "browser") {
    try {
      serverChecks = await transport.loadChecks();
    } catch {
      // Keep the last answers we had; the queue still shows.
    }
  }
  set({ checks: withServerChecks() });
}

/** Called by `AccountProvider` when the session changes (the same rule as progress). */
export async function syncAccountReview(
  user: { id: string; emailVerified: boolean } | null,
  t: ReviewTransport = httpReviewTransport,
): Promise<void> {
  transport = t;
  if (!user || !user.emailVerified) {
    accountUser = undefined;
    serverChecks = [];
    set({ mode: "browser", states: readLocal(), checks: checkRecorder.local() });
    return;
  }
  if (accountUser === user.id) return;
  accountUser = user.id;
  const guest = readLocal();
  try {
    const states = await t.merge(guest);
    if (accountUser !== user.id) return; // signed out (or switched user) meanwhile
    writeLocal({});
    set({ mode: "account", states });
  } catch {
    // Unavailable: show the queue from progress and quick checks, keep the browser copy for the next page load.
    if (accountUser !== user.id) return;
    accountUser = undefined;
    set({ mode: "unavailable", states: guest });
  }
  await refreshReviewChecks();
}

/** "Reviewed" or "Snooze": applied at once; resolves false (and undoes it) when it couldn't be saved. */
export async function applyReview(change: ReviewChange, now: number = Date.now()): Promise<boolean> {
  const { mode, states } = current();
  if (mode === "unavailable") return false;
  const next = applyReviewChange(states, change, now);
  if (mode === "browser") {
    writeLocal(next);
    set({ states: next });
    return true;
  }
  set({ states: next });
  try {
    await transport.send(change);
    return true;
  } catch {
    const { [change.key]: _, ...rest } = current().states;
    set({ states: states[change.key] ? { ...rest, [change.key]: states[change.key] } : rest });
    return false;
  }
}

/**
 * A viewing of the problem's video ended with every quick check answered right: when the problem is Done and its
 * review was due, that counts as the review (the next interval). Called by the quick checks with this viewing's
 * answers. A viewing with a miss writes nothing: the problem shows "Missed …" and "Reviewed" then resets it.
 */
export function noteVideoViewing(problemKey: string, answers: readonly { correct: boolean }[]) {
  const { states, mode } = current();
  if (mode === "unavailable" || answers.some((a) => !a.correct)) return;
  const change = viewingReview(
    problemKey,
    getActiveRepository().getRecords()[problemKey],
    states[problemKey],
    answers,
    Date.now(),
  );
  if (change) void applyReview(change);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === REVIEW_STORAGE_KEY && current().mode === "browser") set({ states: readLocal() });
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

const getServer = () => EMPTY;

/** The review queue for the active progress copy, ranked and cut to `limit`. */
export function useReviewQueue(known: (key: string) => boolean, limit?: number) {
  const records = useProgressRecords();
  const hub = useSyncExternalStore(subscribe, current, getServer);
  useEffect(() => {
    void refreshReviewChecks();
  }, []);
  const items: ReviewItem[] =
    hub === EMPTY
      ? []
      : buildReviewQueue({
          records,
          checks: hub.checks,
          states: hub.states,
          now: hub.now,
          known,
          limit,
        });
  return { items, mode: hub.mode };
}

/** Tests: forget the tab's state. */
export function resetReviewHubForTests() {
  state = undefined;
  accountUser = undefined;
  serverChecks = [];
  transport = httpReviewTransport;
  listeners.clear();
}

/** Tests: the hub's current schedule and mode. */
export const reviewHubState = () => current();
