import type { Scene, Storyboard } from "./schema";

export const FPS = 30;
export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;
/** Frames two adjacent scenes overlap while cross-fading. */
export const TRANSITION_FRAMES = 15;

/** Average narration pace (~150 wpm) used until real audio exists. */
const WORDS_PER_SECOND = 2.5;
const PADDING_SECONDS = 1.2;
const MIN_SECONDS = 3;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Estimate a scene's length from its narration. Used by videos without a voiced track (they're read by the browser
 * voice, which waits at the scene's end if it runs long); voiced videos use `trackSceneDurations`.
 */
export function estimateDurationInFrames(narration: string, fps: number = FPS): number {
  const seconds = Math.max(MIN_SECONDS, countWords(narration) / WORDS_PER_SECOND + PADDING_SECONDS);
  return Math.ceil(seconds * fps);
}

/** Narration starts this far into a scene (inside its fade-in), so the cut never clips the first word. */
export const NARRATION_LEAD_FRAMES = 9;
/** A stitched narration track opens with this much silence: scene 0's speech starts at its narration start. */
export const TRACK_LEAD_MS = (NARRATION_LEAD_FRAMES / FPS) * 1000;

/**
 * Scene lengths that put every scene's narration start exactly where its speech begins in the stitched track
 * (`startsMs[i]`, ms from the track's start), so the video follows the audio. Scene i's sequence begins
 * `NARRATION_LEAD_FRAMES` before its speech; adjacent scenes overlap by `transitionFrames` (see
 * `getSceneTimeline`); the last scene ends with the track.
 */
export function trackSceneDurations(
  startsMs: readonly number[],
  totalMs: number,
  fps: number = FPS,
  transitionFrames: number = TRANSITION_FRAMES,
): number[] {
  const frame = (ms: number) => Math.round((ms * fps) / 1000);
  const starts = startsMs.map((ms, i) => (i === 0 ? 0 : frame(ms) - NARRATION_LEAD_FRAMES));
  return starts.map((start, i) =>
    i === starts.length - 1 ? frame(totalMs) - start : starts[i + 1] - start + transitionFrames,
  );
}

export type SceneTiming = {
  sceneId: string;
  index: number;
  /** Frame where the scene's sequence begins (its fade-in starts here). */
  sequenceStart: number;
  /** First frame (inclusive) where this scene counts as "current". */
  startFrame: number;
  /** Last frame (exclusive) where this scene counts as "current". */
  endFrame: number;
  /** Where "jump to scene" seeks: where its narration starts (past the cross-fade's midpoint, so it's current). */
  seekFrame: number;
  /** Where this scene's narration starts. */
  narrationStart: number;
};

/**
 * Where each scene sits on the composition timeline. Adjacent scenes overlap
 * by `transitionFrames` during the cross-fade, so the total length is the sum
 * of durations minus the overlaps. The player UI and the composition both use
 * this, so scene jumps always line up with what is rendered.
 */
export function getSceneTimeline(
  scenes: readonly Pick<Scene, "id" | "durationInFrames">[],
  transitionFrames: number = TRANSITION_FRAMES,
): { timings: SceneTiming[]; durationInFrames: number } {
  const starts: number[] = [];
  let cursor = 0;
  scenes.forEach((scene, i) => {
    starts.push(cursor);
    cursor += scene.durationInFrames - (i === scenes.length - 1 ? 0 : transitionFrames);
  });
  const durationInFrames = Math.max(1, cursor);
  const half = Math.floor(transitionFrames / 2);
  const narrationStart = (i: number) => starts[i] + Math.max(NARRATION_LEAD_FRAMES, half + 1);
  // The midpoint of each cross-fade is where "current" switches scenes.
  const boundary = (i: number) => (i === 0 ? 0 : starts[i] + half);

  const timings = scenes.map((scene, i) => ({
    sceneId: scene.id,
    index: i,
    sequenceStart: starts[i],
    startFrame: boundary(i),
    endFrame: i === scenes.length - 1 ? durationInFrames : boundary(i + 1),
    seekFrame: i === 0 ? 0 : narrationStart(i),
    narrationStart: narrationStart(i),
  }));
  return { timings, durationInFrames };
}

export function getStoryboardDuration(storyboard: Pick<Storyboard, "scenes">): number {
  return getSceneTimeline(storyboard.scenes).durationInFrames;
}

export function sceneIndexAtFrame(timings: readonly SceneTiming[], frame: number): number {
  const i = timings.findIndex((t) => frame >= t.startFrame && frame < t.endFrame);
  if (i !== -1) return i;
  return frame < 0 ? 0 : Math.max(0, timings.length - 1);
}

export function formatTime(frames: number, fps: number = FPS): string {
  const total = Math.max(0, Math.floor(frames / fps));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
