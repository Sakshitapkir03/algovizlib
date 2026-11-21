"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  createAccountProgressRepository,
  createLocalProgressRepository,
  type ProgressChange,
  type ProgressRecords,
  type ProgressRepository,
  type ProgressSnapshot,
  type ProgressStatus,
  type ProgressTransport,
} from "./repository";

/**
 * The tab's active progress copy. Guests (and accounts whose email isn't verified yet) use the browser copy; once
 * a verified user is signed in, `ProgressSync` merges the browser copy into the account, clears it, and switches
 * here to the account copy. Components only see `useProgress()`, whichever copy is active.
 */
export type SyncState = "browser" | "unverified" | "syncing" | "account";

let local: ReturnType<typeof createLocalProgressRepository> | undefined;
let active: ProgressRepository | undefined;
let syncState: SyncState = "browser";
/** The user whose account copy is active, or whose merge is in flight. */
let accountUser: string | undefined;
let unsubscribeActive: (() => void) | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** One browser copy per tab, created lazily so the server never touches storage. */
function getLocal() {
  local ??= createLocalProgressRepository();
  return local;
}

export function getActiveRepository(): ProgressRepository {
  return active ?? getLocal();
}

function follow(repo: ProgressRepository) {
  unsubscribeActive?.();
  active = repo;
  unsubscribeActive = listeners.size > 0 ? repo.subscribe(emit) : undefined;
  emit();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) unsubscribeActive = getActiveRepository().subscribe(emit);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      unsubscribeActive?.();
      unsubscribeActive = undefined;
    }
  };
}

function setSyncState(state: SyncState) {
  if (syncState === state) return;
  syncState = state;
  emit();
}

export const httpTransport: ProgressTransport = {
  async send(change) {
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change),
      keepalive: true,
    });
    if (!res.ok) throw new Error(`Progress not saved (${res.status}).`);
  },
  beacon(change) {
    const body = new Blob([JSON.stringify(change)], { type: "text/plain" });
    if (!navigator.sendBeacon?.("/api/progress", body)) void httpTransport.send(change).catch(() => {});
  },
  async merge(records) {
    const res = await fetch("/api/progress/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records }),
    });
    if (!res.ok) throw new Error(`Progress not merged (${res.status}).`);
    return ((await res.json()) as { records: ProgressRecords }).records;
  },
  async load() {
    const res = await fetch("/api/progress", { cache: "no-store" });
    if (!res.ok) throw new Error(`Progress not loaded (${res.status}).`);
    return ((await res.json()) as { records: ProgressRecords }).records;
  },
};

/**
 * Called by `ProgressSync` when the session changes. A verified user: send the browser copy to be merged (more
 * advanced status wins, newer position wins), clear it once the account has it, and use the account copy. Anyone
 * else: the browser copy.
 */
export async function syncAccountProgress(
  user: { id: string; emailVerified: boolean } | null,
  transport: ProgressTransport = httpTransport,
): Promise<void> {
  if (!user || !user.emailVerified) {
    accountUser = undefined;
    if (active?.kind === "account") follow(getLocal());
    setSyncState(user ? "unverified" : "browser");
    return;
  }
  if (accountUser === user.id) return; // already active, or merging
  accountUser = user.id;
  if (active?.kind === "account") follow(getLocal());
  setSyncState("syncing");
  const browser = getLocal();
  try {
    const sent = browser.getRecords();
    let records = await transport.merge(sent);
    // Something changed here while the merge was in flight: merge that too before clearing.
    if (browser.getRecords() !== sent) records = await transport.merge(browser.getRecords());
    if (accountUser !== user.id) return; // signed out (or switched user) meanwhile
    browser.clear();
    follow(createAccountProgressRepository(records, transport));
    setSyncState("account");
  } catch {
    // Keep using the browser copy (nothing is lost); the next page load tries again.
    if (accountUser === user.id) accountUser = undefined;
    setSyncState("browser");
  }
}

const EMPTY: ProgressSnapshot = {};
const EMPTY_RECORDS: ProgressRecords = {};
const getSnapshot = () => getActiveRepository().getSnapshot();
const getRecords = () => getActiveRepository().getRecords();
const getSyncState = () => syncState;
// The server (and the first client render) shows everything as not started, so hydration always matches.
const getServerSnapshot = () => EMPTY;
const getServerRecords = () => EMPTY_RECORDS;

const noopSubscribe = () => () => {};

export function useProgress() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Assume storage works until the client proves otherwise, so the server never renders a warning.
  const persistent = useSyncExternalStore(
    noopSubscribe,
    () => getActiveRepository().persistent,
    () => true,
  );
  const sync = useSyncExternalStore(subscribe, getSyncState, () => "browser" as SyncState);
  const setStatus = useCallback(
    (key: string, status: ProgressStatus) => getActiveRepository().set(key, status),
    [],
  );
  return { snapshot, setStatus, persistent, sync };
}

/** Every record (status source, saved video position), for resume and /me. */
export function useProgressRecords(): ProgressRecords {
  return useSyncExternalStore(subscribe, getRecords, getServerRecords);
}

/** Apply a change to the active copy (`beacon` while the page is being hidden). */
/** Tests: forget the tab's state. */
export function resetProgressHubForTests() {
  unsubscribeActive?.();
  unsubscribeActive = undefined;
  local = undefined;
  active = undefined;
  accountUser = undefined;
  syncState = "browser";
  listeners.clear();
}

export function applyProgress(change: ProgressChange, options?: { beacon?: boolean }) {
  getActiveRepository().apply(change, options);
}
