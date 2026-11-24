import type { SceneTiming } from "@/lib/storyboard";

import type { QuickCheck } from "./schema";

/**
 * When each quick check is asked: on the last frame before its scene's cross-fade begins, so the scene before it is
 * still fully on screen and nothing of the answer is drawn yet. Checks on scenes the video doesn't have are dropped.
 */
export function pauseFrames(
  checks: readonly QuickCheck[],
  timings: readonly SceneTiming[],
): Map<string, number> {
  const frames = new Map<string, number>();
  for (const check of checks) {
    const timing = timings.find((t) => t.sceneId === check.sceneId);
    if (timing && timing.index > 0) frames.set(check.id, Math.max(0, timing.sequenceStart - 1));
  }
  return frames;
}

/** Frames per update during ordinary playback, with room for 2x speed and a busy main thread; a seek jumps further. */
export const MAX_PLAY_STEP = 12;

/**
 * The check playback has just reached on its own, if any: it was playing, the frame moved forward a little (not a
 * seek or a scene jump), and it crossed a check's pause frame that hasn't been asked yet.
 */
export function dueCheck(
  frames: ReadonlyMap<string, number>,
  asked: ReadonlySet<string>,
  previous: number,
  frame: number,
  playing: boolean,
): string | undefined {
  if (!playing || frame <= previous || frame - previous > MAX_PLAY_STEP) return undefined;
  for (const [id, at] of frames) if (!asked.has(id) && previous < at && frame >= at) return id;
  return undefined;
}

export type CheckKey = { choose: number } | { move: -1 | 1 } | "submit" | "skip" | undefined;

/**
 * What a key does while a question is open: 1–4 pick that option (and answer), arrows move between options, Enter
 * or Space answers the focused one, S or Escape skips.
 */
export function checkKey(key: string, options: number): CheckKey {
  if (/^[1-9]$/.test(key) && Number(key) <= options) return { choose: Number(key) - 1 };
  if (key === "ArrowDown" || key === "ArrowRight") return { move: 1 };
  if (key === "ArrowUp" || key === "ArrowLeft") return { move: -1 };
  if (key === "Enter" || key === " ") return "submit";
  if (key === "s" || key === "S" || key === "Escape") return "skip";
  return undefined;
}

/** "2 of 3 correct": the answers given in this viewing (skipped questions don't count). */
export function summarize(answers: readonly { correct: boolean }[]): { correct: number; answered: number } {
  return { correct: answers.filter((a) => a.correct).length, answered: answers.length };
}
