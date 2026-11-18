"use client";

import { useCallback, useSyncExternalStore } from "react";

import { createLocalProgressRepository, type ProgressRepository, type ProgressSnapshot } from "./repository";

let repository: ProgressRepository | undefined;

/** One repository per browser tab, created lazily so the server never touches storage. */
function getRepository(): ProgressRepository {
  repository ??= createLocalProgressRepository();
  return repository;
}

const EMPTY: ProgressSnapshot = {};
const subscribe = (listener: () => void) => getRepository().subscribe(listener);
const getSnapshot = () => getRepository().getSnapshot();
// The server (and the first client render) shows everything as not started, so hydration always matches.
const getServerSnapshot = () => EMPTY;

const noopSubscribe = () => () => {};

export function useProgress() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Assume storage works until the client proves otherwise, so the server never renders a warning.
  const persistent = useSyncExternalStore(
    noopSubscribe,
    () => getRepository().persistent,
    () => true,
  );
  const setStatus = useCallback<ProgressRepository["set"]>(
    (key, status) => getRepository().set(key, status),
    [],
  );
  return { snapshot, setStatus, persistent };
}
