import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { GenerationConfigError } from "../errors";
import type { Stitcher } from "./pipeline";
import { checkTrack, SAMPLE_RATE, stitchPcm, toMs, TRACK_BITRATE } from "./stitch";

/**
 * ffmpeg for stitching (offline only). The stitched tracks are committed, so builds never need it: only
 * `pnpm generate:narration` does. Uses `FFMPEG_PATH`, else `ffmpeg` on PATH (`brew install ffmpeg`).
 */
export function ffmpegPath(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const bin = env.FFMPEG_PATH?.trim() || "ffmpeg";
  try {
    execFileSync(bin, ["-version"], { stdio: "ignore" });
  } catch {
    throw new GenerationConfigError(
      `Stitching narration needs ffmpeg ("${bin}" didn't run). Install it (brew install ffmpeg) or set FFMPEG_PATH.`,
    );
  }
  return bin;
}

const MAX_BUFFER = 512 * 1024 * 1024;

/**
 * Decode an MP3 to mono Float32 PCM at `SAMPLE_RATE`. ffmpeg honors the LAME header, so the encoder's delay and
 * padding are dropped and the samples are exactly what a browser plays. Bytes go through a temporary file: read
 * from a pipe, ffmpeg can't trim the end padding.
 */
export function decodeMp3(bin: string, source: string | Uint8Array): Float32Array {
  if (typeof source !== "string")
    return withTemp((file) => (writeFileSync(file, source), decodeMp3(bin, file)));
  const out = execFileSync(
    bin,
    ["-v", "error", "-i", source, "-f", "f32le", "-ac", "1", "-ar", String(SAMPLE_RATE), "pipe:1"],
    { maxBuffer: MAX_BUFFER },
  );
  return new Float32Array(out.buffer, out.byteOffset, out.byteLength / 4).slice();
}

function withTemp<T>(fn: (file: string) => T): T {
  const dir = mkdtempSync(path.join(tmpdir(), "narration-"));
  try {
    return fn(path.join(dir, "track.mp3"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Encode mono Float32 PCM to an MP3 at a constant bitrate. It goes to a temporary file, not a pipe: ffmpeg writes
 * the LAME header (encoder delay and padding) only when it can seek back, and without it every decoder plays
 * 1,105 samples (25 ms) of extra silence first, shifting every offset.
 */
export function encodeMp3(bin: string, pcm: Float32Array): Uint8Array {
  return withTemp((file) => {
    encodeTo(bin, pcm, file);
    return new Uint8Array(readFileSync(file));
  });
}

function encodeTo(bin: string, pcm: Float32Array, file: string) {
  execFileSync(
    bin,
    [
      "-v",
      "error",
      "-f",
      "f32le",
      "-ar",
      String(SAMPLE_RATE),
      "-ac",
      "1",
      "-i",
      "pipe:0",
      "-c:a",
      "libmp3lame",
      "-b:a",
      TRACK_BITRATE,
      "-y",
      file,
    ],
    { input: Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength), maxBuffer: MAX_BUFFER },
  );
}

/**
 * Stitch clips (paths resolved by `clipPath`) into one track: decode, trim edge silence, join with even pauses,
 * encode once, then decode the result and check it against the clips (`checkTrack`). Offsets and the length come
 * from the decoded track, which is what a browser plays.
 */
export function createFfmpegStitcher(bin: string, clipPath: (file: string) => string): Stitcher {
  return (files) => {
    const clips = files.map((file) => decodeMp3(bin, clipPath(file)));
    const stitched = stitchPcm(clips);
    const bytes = encodeMp3(bin, stitched.pcm);
    const decoded = decodeMp3(bin, bytes);
    const check = checkTrack(decoded, clips, stitched);
    return {
      bytes,
      durationMs: toMs(decoded.length),
      scenes: stitched.scenes.map((s) => ({ startMs: toMs(s.start), speechMs: toMs(s.length) })),
      problems: check.problems,
    };
  };
}
