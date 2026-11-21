import type { SceneTiming } from "@/lib/storyboard";

/**
 * Video resume: where a position is saved and where "Resume" lands. A position is the scene plus seconds from the
 * video's start, so a video whose timing changed since (re-voiced narration) still resumes in the right scene.
 */
export const SAVE_INTERVAL_MS = 5000;
/** Less than this into a video, or this close to its end, isn't worth resuming. */
export const MIN_RESUME_SECONDS = 3;
export const END_MARGIN_SECONDS = 2;

export function positionAt(
  timings: readonly SceneTiming[],
  frame: number,
  fps: number,
): { sceneId: string; seconds: number } {
  const timing =
    timings.find((t) => frame >= t.startFrame && frame < t.endFrame) ?? timings[timings.length - 1];
  return { sceneId: timing.sceneId, seconds: Math.round((frame / fps) * 100) / 100 };
}

/** Worth saving: past the first seconds and not at the very end. */
export function isResumable(frame: number, durationInFrames: number, fps: number): boolean {
  return frame >= MIN_RESUME_SECONDS * fps && frame < durationInFrames - END_MARGIN_SECONDS * fps;
}

/**
 * The frame "Resume" seeks to, or null when there's nothing to offer. The saved second is used when it still falls
 * inside the saved scene; if the video's timing changed, the scene's start (where its narration begins); if the
 * scene no longer exists, nothing.
 */
export function resumeFrame(
  position: { sceneId: string; seconds: number } | undefined,
  timings: readonly SceneTiming[],
  durationInFrames: number,
  fps: number,
): number | null {
  if (!position) return null;
  const timing = timings.find((t) => t.sceneId === position.sceneId);
  if (!timing) return null;
  const frame = Math.round(position.seconds * fps);
  const target = frame >= timing.startFrame && frame < timing.endFrame ? frame : timing.seekFrame;
  return isResumable(target, durationInFrames, fps) ? target : null;
}
