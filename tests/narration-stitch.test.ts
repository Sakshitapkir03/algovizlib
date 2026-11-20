import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { decodeMp3 } from "@/lib/generation/narration/ffmpeg";
import {
  checkTrack,
  EDGE_MARGIN_MS,
  PAUSE_MS,
  SAMPLE_RATE,
  SILENCE_THRESHOLD,
  speechBounds,
  stitchPcm,
  TAIL_MS,
  toMs,
} from "@/lib/generation/narration/stitch";
import { narrationManifestSchema } from "@/lib/narration/manifest";
import { TRACK_LEAD_MS } from "@/lib/storyboard";

const RATE = SAMPLE_RATE;
const ms = (n: number) => Math.round((n * RATE) / 1000);

/** `lead` ms of near-silence, `speech` ms of a voice-like signal (a modulated tone plus noise), `tail` ms of silence. */
function clip(leadMs: number, speechMs: number, tailMs: number, seed = 1): Float32Array {
  const pcm = new Float32Array(ms(leadMs + speechMs + tailMs));
  let r = seed;
  const noise = () => ((r = (r * 1103515245 + 12345) % 2 ** 31) / 2 ** 31 - 0.5) * 2;
  for (let i = 0; i < pcm.length; i++) {
    const inSpeech = i >= ms(leadMs) && i < ms(leadMs + speechMs);
    pcm[i] = inSpeech
      ? 0.3 * Math.sin((2 * Math.PI * (180 + 40 * seed) * i) / RATE) * (0.6 + 0.4 * Math.sin(i / 900)) +
        0.05 * noise()
      : 0.0004 * noise(); // −68 dBFS hiss: silence
  }
  return pcm;
}

describe("trimming edge silence", () => {
  it("keeps all the speech plus a margin, and trims only the silence around it", () => {
    const pcm = clip(200, 1500, 400);
    const { start, end } = speechBounds(pcm);
    expect(toMs(start)).toBeGreaterThanOrEqual(200 - EDGE_MARGIN_MS - 6);
    expect(toMs(start)).toBeLessThanOrEqual(200 - EDGE_MARGIN_MS + 1);
    expect(toMs(end)).toBeGreaterThanOrEqual(1700 + EDGE_MARGIN_MS - 1);
    expect(toMs(end)).toBeLessThanOrEqual(1700 + EDGE_MARGIN_MS + 6);
    // Nothing at or above the threshold is outside the kept range.
    for (let i = 0; i < pcm.length; i++)
      if (Math.abs(pcm[i]) >= SILENCE_THRESHOLD) expect(i >= start && i < end).toBe(true);
  });

  it("a quiet onset counts as speech", () => {
    const pcm = clip(100, 1000, 100);
    pcm[ms(50)] = SILENCE_THRESHOLD * 1.5; // a faint breath before the word
    expect(speechBounds(pcm).start).toBeLessThanOrEqual(ms(50));
  });

  it("refuses a silent clip", () => {
    expect(() => speechBounds(new Float32Array(ms(500)))).toThrow(/silent/);
  });
});

describe("stitching", () => {
  const clips = [clip(150, 1200, 300, 1), clip(0, 900, 200, 2), clip(80, 1600, 0, 3)];

  it("is lead + every clip's speech with equal pauses between + tail, with exact offsets", () => {
    const stitched = stitchPcm(clips);
    const kept = clips.map((c) => {
      const { start, end } = speechBounds(c);
      return end - start;
    });
    expect(stitched.pcm.length).toBe(
      ms(TRACK_LEAD_MS) + kept.reduce((a, b) => a + b) + 2 * ms(PAUSE_MS) + ms(TAIL_MS),
    );
    expect(stitched.scenes.map((s) => s.length)).toEqual(kept);
    expect(stitched.scenes[0].start).toBe(ms(TRACK_LEAD_MS));
    for (let i = 1; i < clips.length; i++)
      expect(stitched.scenes[i].start - (stitched.scenes[i - 1].start + kept[i - 1])).toBe(ms(PAUSE_MS));
  });

  it("the check passes a faithful copy and catches a shift or lost samples at a boundary", () => {
    const stitched = stitchPcm(clips);
    expect(checkTrack(stitched.pcm, clips, stitched).ok).toBe(true);

    // An encoder delay that was never trimmed: everything 25 ms late.
    const shifted = new Float32Array(stitched.pcm.length + ms(25));
    shifted.set(stitched.pcm, ms(25));
    const late = checkTrack(shifted, clips, stitched);
    expect(late.ok).toBe(false);
    expect(late.problems.join(" ")).toMatch(/off/);

    // The first 120 ms of scene 2 cut off.
    const cut = stitched.pcm.slice();
    cut.fill(0, stitched.scenes[1].start, stitched.scenes[1].start + ms(120));
    const clipped = checkTrack(cut, clips, stitched);
    expect(clipped.ok).toBe(false);
    expect(clipped.problems.join(" ")).toMatch(/scene 2 matches only/);
  });
});

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

// Decodes every committed track and its clips: needs ffmpeg (offline tooling), so it's skipped without it.
describe.skipIf(!hasFfmpeg)("every committed track (decoded with ffmpeg)", () => {
  const manifest = narrationManifestSchema.parse(
    JSON.parse(readFileSync("src/content/narration/manifest.json", "utf8")),
  );
  const voiced = Object.entries(manifest.storyboards).filter(([, sb]) => sb.track);

  it.each(voiced)(
    "%s: its length is lead + speech + pauses + tail, and every clip is there whole, where it belongs",
    (_, sb) => {
      const track = sb.track!;
      const clips = track.scenes.map((s) => decodeMp3("ffmpeg", `narration/clips/${sb.clips[s.id].file}`));
      const decoded = decodeMp3("ffmpeg", `public${track.file}`);
      const stitched = stitchPcm(clips);
      const check = checkTrack(decoded, clips, stitched);
      expect(check.problems).toEqual([]);
      const speech = track.scenes.reduce((sum, s) => sum + s.speechMs, 0);
      const expected = TRACK_LEAD_MS + speech + PAUSE_MS * (track.scenes.length - 1) + TAIL_MS;
      expect(Math.abs(toMs(decoded.length) - expected)).toBeLessThan(track.scenes.length + 1); // ms rounding
      expect(Math.abs(track.durationMs - toMs(decoded.length))).toBeLessThan(1);
      track.scenes.forEach((s, i) =>
        expect(Math.abs(s.startMs - toMs(stitched.scenes[i].start))).toBeLessThan(1),
      );
    },
    60_000,
  );
});
