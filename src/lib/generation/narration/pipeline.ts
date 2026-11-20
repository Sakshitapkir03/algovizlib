import { narrationHash, type VoiceSpec } from "@/lib/narration/hash";
import { trackHash, type ClipEntry, type NarrationManifest, type TrackEntry } from "@/lib/narration/manifest";

import { GenerationConfigError, RateLimitError } from "../errors";
import { PaidPlanError, QuotaExceededError, type Synthesize, type SynthesisContext } from "./elevenlabs";
import { STITCH_SETTINGS } from "./stitch";

/** ≈ half the free plan's monthly credits on Flash (1 credit = 2 characters), leaving room for retakes. */
export const DEFAULT_MAX_CHARS = 9000;
const MAX_RETRIES = 3;
const BACKOFF_MS = [5_000, 15_000, 45_000];
/** ElevenLabs uses at most 3 previous request ids for continuity. */
const MAX_PREVIOUS_REQUESTS = 3;

export type NarrationTarget = {
  storyboardId: string;
  /** The catalog problem it belongs to ("pattern/slug"). */
  problemKey: string;
  scenes: readonly { id: string; narration: string }[];
};

/**
 * Where audio and the manifest live (files on disk in the script, memory in tests). Clips are paths under
 * `narration/clips/` ("storyboard/scene-hash.mp3"); tracks are public URLs ("/audio/…").
 */
export interface AudioStore {
  readManifest(): NarrationManifest;
  writeManifest(manifest: NarrationManifest): void;
  writeClip(file: string, bytes: Uint8Array): void;
  clipExists(file: string): boolean;
  removeClip(file: string): void;
  writeTrack(file: string, bytes: Uint8Array): void;
  trackExists(file: string): boolean;
  removeTrack(file: string): void;
}

/** Stitch a video's clips (in scene order) into one track and check it (see `stitch.ts`; ffmpeg in the script). */
export type Stitcher = (clipFiles: readonly string[]) => {
  bytes: Uint8Array;
  durationMs: number;
  scenes: { startMs: number; speechMs: number }[];
  problems: string[];
};

export type NarrationDeps = {
  synthesize: Synthesize;
  stitch: Stitcher;
  store: AudioStore;
  measureMs: (bytes: Uint8Array) => number;
  sleep: (ms: number) => Promise<void>;
  log: (line: string) => void;
};

export type NarrationOptions = {
  dryRun: boolean;
  /** Only (re)build stitched tracks from clips already voiced: no requests, no key needed. */
  stitchOnly?: boolean;
  maxChars: number;
  delayMs: number;
  voice: VoiceSpec;
};

export type NarrationStatus =
  "saved" | "up to date" | "stitched" | "dry run" | "failed" | "partial" | "not started" | "not voiced";

/** The stitched track: current, built by this run, needing a build (dry run), or impossible yet (scenes unvoiced). */
export type TrackStatus = "current" | "stitched" | "needs stitching" | "failed" | "-";

export type NarrationRow = {
  storyboardId: string;
  problemKey: string;
  scenes: number;
  /** Scenes whose current narration is already voiced. */
  voicedScenes: number;
  /** Characters of every scene's narration. */
  totalChars: number;
  /** Characters still to synthesize (what this video costs now). */
  chars: number;
  status: NarrationStatus;
  track: TrackStatus;
  detail?: string;
};

export type NarrationStopReason = "budget" | "quota" | "unavailable" | "paid-plan";

export type NarrationSummary = {
  rows: NarrationRow[];
  /** Characters ElevenLabs billed in this run (in a dry run: what it would send). */
  charsUsed: number;
  maxChars: number;
  requests: number;
  stoppedBy?: NarrationStopReason;
  /** Storyboards not (fully) voiced when the run stopped. */
  remaining: string[];
};

/** A scene's clip, under `narration/clips/`. The hash in the name means a changed narration never overwrites it. */
export const clipFile = (storyboardId: string, sceneId: string, hash: string) =>
  `${storyboardId}/${sceneId}-${hash}.mp3`;

/** A video's stitched track, under `public/`. */
export const trackFile = (storyboardId: string, hash: string) =>
  `/audio/${storyboardId}/narration-${hash}.mp3`;

type ScenePlan = { id: string; narration: string; hash: string; file: string; upToDate: boolean };

function planScenes(
  target: NarrationTarget,
  manifest: NarrationManifest,
  store: AudioStore,
  voice: VoiceSpec,
) {
  return target.scenes.map((scene): ScenePlan => {
    const hash = narrationHash(scene.narration, voice);
    const file = clipFile(target.storyboardId, scene.id, hash);
    const entry = manifest.storyboards[target.storyboardId]?.clips[scene.id];
    return {
      ...scene,
      hash,
      file,
      upToDate: entry?.hash === hash && entry.file === file && store.clipExists(file),
    };
  });
}

/** The track a fully voiced video should have, and whether the manifest already has it. */
function planTrack(
  target: NarrationTarget,
  plan: readonly ScenePlan[],
  manifest: NarrationManifest,
  store: AudioStore,
) {
  const hash = trackHash(
    plan.map((s) => s.hash),
    STITCH_SETTINGS,
  );
  const file = trackFile(target.storyboardId, hash);
  const existing = manifest.storyboards[target.storyboardId]?.track;
  const current =
    existing?.hash === hash &&
    existing.file === file &&
    store.trackExists(file) &&
    existing.scenes.length === plan.length &&
    existing.scenes.every((s, i) => s.id === plan[i].id && s.hash === plan[i].hash);
  return { hash, file, current };
}

type Attempt =
  | { bytes: Uint8Array; requestId?: string; billed: number; requests: number }
  | { stop: NarrationStopReason; message: string; requests: number }
  | { failed: true; message: string; requests: number };

/** One clip: retries per-minute limits and overloads with backoff; anything else ends the attempt. */
async function synthesizeWithRetry(
  scene: { id: string; narration: string },
  context: SynthesisContext,
  voice: VoiceSpec,
  deps: NarrationDeps,
): Promise<Attempt> {
  for (let attempt = 0; ; attempt++) {
    const requests = attempt + 1;
    try {
      const result = await deps.synthesize(scene.narration, voice, context);
      return {
        bytes: result.bytes,
        requestId: result.requestId,
        billed: result.characterCost ?? scene.narration.length,
        requests,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof GenerationConfigError) throw error;
      if (error instanceof QuotaExceededError) return { stop: "quota", message, requests };
      if (error instanceof PaidPlanError) return { stop: "paid-plan", message, requests };
      if (!(error instanceof RateLimitError)) return { failed: true, message, requests };
      if (attempt >= MAX_RETRIES) return { stop: "unavailable", message, requests };
      const wait = error.retryAfterMs ?? BACKOFF_MS[attempt];
      deps.log(`  ${scene.id}: ${message} Retrying in ${Math.round(wait / 1000)}s.`);
      await deps.sleep(wait);
    }
  }
}

/** Characters each target still needs (unchanged narration costs nothing). */
export function plannedChars(target: NarrationTarget, store: AudioStore, voice: VoiceSpec): number {
  return planScenes(target, store.readManifest(), store, voice)
    .filter((s) => !s.upToDate)
    .reduce((sum, s) => sum + s.narration.length, 0);
}

/** Whether a target needs any work: unvoiced scenes, or a stale or missing track. */
export function needsWork(target: NarrationTarget, store: AudioStore, voice: VoiceSpec): boolean {
  const manifest = store.readManifest();
  const plan = planScenes(target, manifest, store, voice);
  return plan.some((s) => !s.upToDate) || !planTrack(target, plan, manifest, store).current;
}

/** Build and check the track for a fully voiced target; record it, replacing (and deleting) an older one. */
function stitchTarget(
  target: NarrationTarget,
  plan: readonly ScenePlan[],
  manifest: NarrationManifest,
  deps: NarrationDeps,
): { ok: true } | { ok: false; message: string } {
  const { hash, file } = planTrack(target, plan, manifest, deps.store);
  const built = deps.stitch(plan.map((s) => s.file));
  if (built.problems.length > 0)
    return { ok: false, message: `stitch check failed: ${built.problems.join("; ")}` };
  const track: TrackEntry = {
    hash,
    file,
    durationMs: Math.round(built.durationMs),
    scenes: plan.map((s, i) => ({
      id: s.id,
      hash: s.hash,
      startMs: Math.round(built.scenes[i].startMs),
      speechMs: Math.round(built.scenes[i].speechMs),
    })),
  };
  deps.store.writeTrack(file, built.bytes);
  const entry = manifest.storyboards[target.storyboardId];
  const previous = entry.track;
  if (previous && previous.file !== file && deps.store.trackExists(previous.file))
    deps.store.removeTrack(previous.file);
  entry.track = track;
  deps.store.writeManifest(manifest);
  return { ok: true };
}

/**
 * Voice each target's scenes one request at a time, then stitch each fully voiced video into one track:
 * - a scene whose narration, voice, and model are unchanged (same hash, clip present) is skipped and costs nothing;
 * - a video is only started if all of its remaining characters fit in `maxChars` (no half-voiced videos), and every
 *   request is counted against the budget before it's sent;
 * - each request passes its neighbors' text (and the ids of up to 3 earlier requests for the same video in this
 *   run), so adjacent scenes sound like one take;
 * - per-minute limits and overloads retry with backoff; an exhausted quota or a paid-plan error stops the run;
 * - the manifest is written after every clip and track, so whatever was saved before a stop is kept.
 * A dry run computes the same plan and calls nothing; `stitchOnly` builds tracks from existing clips only.
 */
export async function runNarration(
  targets: readonly NarrationTarget[],
  options: NarrationOptions,
  deps: NarrationDeps,
): Promise<NarrationSummary> {
  const { store, log } = deps;
  const manifest = store.readManifest();
  const rows: NarrationRow[] = [];
  let charsUsed = 0;
  let requests = 0;
  let stoppedBy: NarrationStopReason | undefined;

  for (const target of targets) {
    const plan = planScenes(target, manifest, store, options.voice);
    const todo = plan.filter((s) => !s.upToDate);
    const row: NarrationRow = {
      storyboardId: target.storyboardId,
      problemKey: target.problemKey,
      scenes: plan.length,
      voicedScenes: plan.length - todo.length,
      totalChars: plan.reduce((sum, s) => sum + s.narration.length, 0),
      chars: todo.reduce((sum, s) => sum + s.narration.length, 0),
      status: "not started",
      track:
        todo.length > 0
          ? "-"
          : planTrack(target, plan, manifest, store).current
            ? "current"
            : "needs stitching",
    };
    rows.push(row);

    const finish = () => {
      if (row.voicedScenes < row.scenes || row.track === "current") return;
      if (options.dryRun) {
        row.track = "needs stitching";
        return;
      }
      const result = stitchTarget(target, plan, manifest, deps);
      row.track = result.ok ? "stitched" : "failed";
      if (!result.ok) {
        row.detail = result.message;
        row.status = "failed";
      } else log(`  ${target.storyboardId}: stitched ${plan.length} scenes into one track`);
    };

    if (options.stitchOnly) {
      if (todo.length > 0) {
        row.status = "not voiced";
        continue;
      }
      row.status = "up to date";
      finish();
      if (row.track === "stitched") row.status = "stitched";
      continue;
    }
    if (stoppedBy) continue;
    if (todo.length === 0) {
      row.status = "up to date";
      finish();
      if (row.track === "stitched") row.status = "stitched";
      continue;
    }
    if (options.dryRun) {
      row.status = "dry run";
      charsUsed += row.chars;
      continue;
    }
    if (charsUsed + row.chars > options.maxChars) {
      stoppedBy = "budget";
      row.detail = `needs ${row.chars} characters, ${options.maxChars - charsUsed} left in the budget`;
      continue;
    }

    log(`${target.storyboardId}: voicing ${todo.length} scene(s), ${row.chars} characters`);
    const requestIds: string[] = [];
    let lastAt = -2;
    for (const scene of todo) {
      if (charsUsed + scene.narration.length > options.maxChars) {
        stoppedBy = "budget";
        break;
      }
      if (requests > 0 && options.delayMs > 0) await deps.sleep(options.delayMs);
      const at = target.scenes.findIndex((s) => s.id === scene.id);
      // Request ids only chain scenes that are next to each other.
      if (at !== lastAt + 1) requestIds.length = 0;
      const context: SynthesisContext = {
        previousText: target.scenes[at - 1]?.narration,
        nextText: target.scenes[at + 1]?.narration,
        // Only ids of this video's scenes voiced just before this one (ElevenLabs: ≤ 3, newest last, < 2 hours old).
        previousRequestIds: requestIds.slice(-MAX_PREVIOUS_REQUESTS),
      };
      const result = await synthesizeWithRetry(scene, context, options.voice, deps);
      requests += result.requests;
      if (!("bytes" in result)) {
        row.detail = `${scene.id}: ${result.message}`;
        if ("stop" in result) stoppedBy = result.stop;
        else row.status = row.voicedScenes > 0 ? "partial" : "failed";
        break;
      }
      // Only a successful request is billed.
      charsUsed += result.billed;
      if (result.requestId) requestIds.push(result.requestId);
      else requestIds.length = 0;
      lastAt = at;

      const entry: ClipEntry = {
        hash: scene.hash,
        file: scene.file,
        durationMs: deps.measureMs(result.bytes),
        chars: scene.narration.length,
        ...options.voice,
      };
      store.writeClip(scene.file, result.bytes);
      const sb = (manifest.storyboards[target.storyboardId] ??= { clips: {} });
      const previous = sb.clips[scene.id];
      if (previous && previous.file !== scene.file && store.clipExists(previous.file))
        store.removeClip(previous.file);
      sb.clips[scene.id] = entry;
      store.writeManifest(manifest);
      row.voicedScenes++;
      log(`  ${scene.id}: ${scene.narration.length} chars, ${(entry.durationMs / 1000).toFixed(1)}s`);
    }
    if (row.status === "not started") {
      row.status = row.voicedScenes === row.scenes ? "saved" : "partial";
      if (row.status === "saved") finish();
    }
  }

  const remaining = rows
    .filter((r) => r.voicedScenes < r.scenes && r.status !== "dry run")
    .map((r) => r.storyboardId);
  return { rows, charsUsed, maxChars: options.maxChars, requests, stoppedBy, remaining };
}
