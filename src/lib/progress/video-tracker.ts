import { sceneIndexAtFrame, type SceneTiming } from "@/lib/storyboard/timing";

import type { ProgressChange } from "./records";
import { isResumable, positionAt, SAVE_INTERVAL_MS } from "./resume";

/** The parts of the player store the tracker reads. */
export type PlayerSnapshot = { frame: number; isPlaying: boolean; ended: boolean; holding: boolean };

export type VideoTrackerOptions = {
  problemKey: string;
  timings: readonly SceneTiming[];
  durationInFrames: number;
  fps: number;
  getState: () => PlayerSnapshot;
  subscribe: (listener: (state: PlayerSnapshot, prev: PlayerSnapshot) => void) => () => void;
  apply: (change: ProgressChange, options?: { beacon?: boolean }) => void;
  /** The learner did something (played, seeked): the "Resume" offer goes away. */
  onInteract?: () => void;
  now?: () => number;
};

/**
 * Watches a problem video and records its progress: the first play applies `mark-learning` (the rule decides
 * whether it changes anything); the position is saved every `SAVE_INTERVAL_MS` while playing, on pause, and on a
 * scene change; reaching the end clears it. `hide()` saves with `sendBeacon` (the page is going away). Plain
 * functions over the store, so it's tested with a fake player.
 */
export function trackVideoProgress(options: VideoTrackerOptions) {
  const { problemKey: key, timings, durationInFrames, fps, getState, apply } = options;
  const now = options.now ?? Date.now;
  let lastSave = 0;
  let lastScene = sceneIndexAtFrame(timings, getState().frame);

  const save = (beacon = false) => {
    const { frame, ended } = getState();
    lastScene = sceneIndexAtFrame(timings, frame);
    if (ended || !isResumable(frame, durationInFrames, fps)) return;
    apply({ op: "save-position", key, ...positionAt(timings, frame, fps) }, { beacon });
    lastSave = now();
  };

  const unsubscribe = options.subscribe((s, prev) => {
    if (s.isPlaying && !prev.isPlaying) {
      options.onInteract?.();
      apply({ op: "mark-learning", key });
    }
    if (s.frame !== prev.frame && s.frame !== 0) options.onInteract?.();
    if (s.ended && !prev.ended) {
      apply({ op: "clear-position", key });
      return;
    }
    if (s.ended) return;
    const scene = sceneIndexAtFrame(timings, s.frame);
    if (scene !== lastScene) save();
    else if (s.isPlaying && now() - lastSave >= SAVE_INTERVAL_MS) save();
    else if (prev.isPlaying && !s.isPlaying && !s.holding) save();
  });

  return {
    /** The page is being hidden or closed. */
    hide: () => save(true),
    dispose: unsubscribe,
  };
}
