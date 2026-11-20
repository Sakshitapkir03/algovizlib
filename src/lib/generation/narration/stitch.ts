import { TRACK_LEAD_MS } from "@/lib/storyboard/timing";

/**
 * Stitching a video's per-scene clips into one narration track (offline). Pure functions over mono PCM samples
 * (Float32, −1…1), so they're testable without ffmpeg; `ffmpeg.ts` does the decoding and encoding.
 *
 * Each clip's edges are trimmed of true silence only: a window counts as speech when any sample in it reaches
 * `SILENCE_THRESHOLD` (−50 dBFS, far below quiet speech), and `EDGE_MARGIN_MS` is kept on both sides, so a soft
 * onset or a trailing breath is never cut. The track is: `TRACK_LEAD_MS` of silence, clip 1, `PAUSE_MS`, clip 2, …,
 * clip n, `TAIL_MS`. Offsets are exact sample counts.
 */
export const SAMPLE_RATE = 44_100;
export const PAUSE_MS = 600;
export const TAIL_MS = 600;
/** −50 dBFS. */
export const SILENCE_THRESHOLD = 10 ** (-50 / 20);
export const EDGE_MARGIN_MS = 30;
const WINDOW_MS = 5;
/** The stitched track's bitrate: above the clips' 64 kbps, so re-encoding loses nothing audible. */
export const TRACK_BITRATE = "96k";
/** Bump when the stitching itself changes: it's part of every track's hash, so tracks get rebuilt. */
export const STITCH_VERSION = 1;

export const STITCH_SETTINGS = {
  version: STITCH_VERSION,
  sampleRate: SAMPLE_RATE,
  leadMs: TRACK_LEAD_MS,
  pauseMs: PAUSE_MS,
  tailMs: TAIL_MS,
  bitrate: TRACK_BITRATE,
} as const;

const samples = (ms: number, rate = SAMPLE_RATE) => Math.round((ms * rate) / 1000);
export const toMs = (count: number, rate = SAMPLE_RATE) => (count * 1000) / rate;

/** [start, end) of the part of `pcm` to keep: from the first loud window to the last, plus the margin. */
export function speechBounds(pcm: Float32Array, rate = SAMPLE_RATE): { start: number; end: number } {
  const win = Math.max(1, samples(WINDOW_MS, rate));
  const loud = (w: number) => {
    for (let i = w * win; i < Math.min(pcm.length, (w + 1) * win); i++)
      if (Math.abs(pcm[i]) >= SILENCE_THRESHOLD) return true;
    return false;
  };
  const windows = Math.ceil(pcm.length / win);
  let first = 0;
  while (first < windows && !loud(first)) first++;
  if (first === windows) throw new Error("The clip is silent: nothing to stitch.");
  let last = windows - 1;
  while (last > first && !loud(last)) last--;
  const margin = samples(EDGE_MARGIN_MS, rate);
  return { start: Math.max(0, first * win - margin), end: Math.min(pcm.length, (last + 1) * win + margin) };
}

export type StitchedPcm = {
  pcm: Float32Array;
  /** Where each clip's kept audio starts in the track, and how many samples it has. */
  scenes: { start: number; length: number }[];
};

/** Lead silence, the clips (edges trimmed of silence) separated by equal pauses, then the tail. */
export function stitchPcm(clips: readonly Float32Array[], rate = SAMPLE_RATE): StitchedPcm {
  const trimmed = clips.map((pcm) => {
    const { start, end } = speechBounds(pcm, rate);
    return pcm.subarray(start, end);
  });
  const lead = samples(TRACK_LEAD_MS, rate);
  const pause = samples(PAUSE_MS, rate);
  const tail = samples(TAIL_MS, rate);
  const total = lead + trimmed.reduce((sum, c) => sum + c.length, 0) + pause * (trimmed.length - 1) + tail;
  const pcm = new Float32Array(total);
  const scenes: StitchedPcm["scenes"] = [];
  let at = lead;
  trimmed.forEach((clip, i) => {
    pcm.set(clip, at);
    scenes.push({ start: at, length: clip.length });
    at += clip.length + (i < trimmed.length - 1 ? pause : 0);
  });
  return { pcm, scenes };
}

/**
 * Where `clip` sits in `track` near `expected` (±`searchMs`), by normalized cross-correlation over the clip's whole
 * length, and how well it matches there (1 = identical; a re-encoded copy scores ~0.99). A coarse pass over a
 * 4× decimated signal finds the neighborhood, then a full-rate pass refines it.
 */
export function locateClip(
  track: Float32Array,
  clip: Float32Array,
  expected: number,
  searchMs = 60,
  rate = SAMPLE_RATE,
): { offset: number; score: number } {
  const score = (offset: number, step: number) => {
    let dot = 0;
    let a = 0;
    let b = 0;
    for (let i = 0; i < clip.length; i += step) {
      const t = track[offset + i] ?? 0;
      dot += t * clip[i];
      a += t * t;
      b += clip[i] * clip[i];
    }
    return a === 0 || b === 0 ? 0 : dot / Math.sqrt(a * b);
  };
  const range = samples(searchMs, rate);
  let best = { offset: expected, score: -Infinity };
  for (let o = Math.max(0, expected - range); o <= expected + range; o += 4) {
    const s = score(o, 4);
    if (s > best.score) best = { offset: o, score: s };
  }
  const coarse = best.offset;
  best = { offset: coarse, score: score(coarse, 1) };
  for (let o = Math.max(0, coarse - 6); o <= coarse + 6; o++) {
    const s = score(o, 1);
    if (s > best.score) best = { offset: o, score: s };
  }
  return best;
}

export type TrackCheck = {
  /** Expected length (lead + clips + pauses + tail) vs the decoded track, in ms. */
  expectedMs: number;
  actualMs: number;
  scenes: { offsetErrorMs: number; score: number; speechMs: number }[];
  ok: boolean;
  problems: string[];
};

/**
 * Check a decoded track against the clips it was stitched from: its length equals lead + Σ kept clip lengths +
 * pauses + tail (within one MP3 frame), and every clip's kept audio is found whole, where it was placed (within
 * 2 ms) and matching closely (score ≥ 0.97 over every sample, so nothing was lost at a boundary).
 */
export function checkTrack(
  decoded: Float32Array,
  clips: readonly Float32Array[],
  stitched: StitchedPcm,
  rate = SAMPLE_RATE,
): TrackCheck {
  const problems: string[] = [];
  const expectedMs = toMs(stitched.pcm.length, rate);
  const actualMs = toMs(decoded.length, rate);
  if (Math.abs(actualMs - expectedMs) > 27)
    problems.push(`length ${actualMs.toFixed(1)} ms, expected ${expectedMs.toFixed(1)}`);
  const scenes = clips.map((clip, i) => {
    const { start, end } = speechBounds(clip, rate);
    const kept = clip.subarray(start, end);
    const placed = stitched.scenes[i].start;
    const found = locateClip(decoded, kept, placed, 10, rate);
    const offsetErrorMs = toMs(found.offset - placed, rate);
    if (Math.abs(offsetErrorMs) > 2) problems.push(`scene ${i + 1} sits ${offsetErrorMs.toFixed(1)} ms off`);
    if (found.score < 0.97) problems.push(`scene ${i + 1} matches only ${found.score.toFixed(3)}`);
    return { offsetErrorMs, score: found.score, speechMs: toMs(kept.length, rate) };
  });
  return { expectedMs, actualMs, scenes, ok: problems.length === 0, problems };
}
