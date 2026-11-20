import { narrationHash, type VoiceSpec } from "@/lib/narration/hash";
import type { NarrationManifest, SceneAudioEntry } from "@/lib/narration/manifest";

import { GenerationConfigError, RateLimitError } from "../errors";
import { PaidPlanError, QuotaExceededError, type Synthesize } from "./elevenlabs";

/** ≈ half the free plan's monthly credits on Flash (1 credit = 2 characters), leaving room for retakes. */
export const DEFAULT_MAX_CHARS = 9000;
const MAX_RETRIES = 3;
const BACKOFF_MS = [5_000, 15_000, 45_000];

export type NarrationTarget = {
  storyboardId: string;
  /** The catalog problem it belongs to ("pattern/slug"). */
  problemKey: string;
  scenes: readonly { id: string; narration: string }[];
};

/** Where audio and the manifest live (files on disk in the script, memory in tests). */
export interface AudioStore {
  readManifest(): NarrationManifest;
  writeManifest(manifest: NarrationManifest): void;
  /** `file` is the public URL ("/audio/…"). */
  writeAudio(file: string, bytes: Uint8Array): void;
  exists(file: string): boolean;
  remove(file: string): void;
}

export type NarrationDeps = {
  synthesize: Synthesize;
  store: AudioStore;
  measureMs: (bytes: Uint8Array) => number;
  sleep: (ms: number) => Promise<void>;
  log: (line: string) => void;
};

export type NarrationOptions = { dryRun: boolean; maxChars: number; delayMs: number; voice: VoiceSpec };

export type NarrationStatus = "saved" | "up to date" | "dry run" | "failed" | "partial" | "not started";

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
  detail?: string;
};

export type NarrationStopReason = "budget" | "quota" | "unavailable" | "paid-plan";

export type NarrationSummary = {
  rows: NarrationRow[];
  /** Characters sent to ElevenLabs in this run (in a dry run: what it would send). */
  charsUsed: number;
  maxChars: number;
  requests: number;
  stoppedBy?: NarrationStopReason;
  /** Storyboards not (fully) voiced when the run stopped. */
  remaining: string[];
};

/** Public URL of a scene's clip. The hash in the name means a changed narration never overwrites the old file. */
export const audioFile = (storyboardId: string, sceneId: string, hash: string) =>
  `/audio/${storyboardId}/${sceneId}-${hash}.mp3`;

type ScenePlan = { id: string; narration: string; hash: string; file: string; upToDate: boolean };

function planScenes(
  target: NarrationTarget,
  manifest: NarrationManifest,
  store: AudioStore,
  voice: VoiceSpec,
) {
  return target.scenes.map((scene): ScenePlan => {
    const hash = narrationHash(scene.narration, voice);
    const file = audioFile(target.storyboardId, scene.id, hash);
    const entry = manifest.storyboards[target.storyboardId]?.[scene.id];
    return {
      ...scene,
      hash,
      file,
      upToDate: entry?.hash === hash && entry.file === file && store.exists(file),
    };
  });
}

type Attempt =
  | { bytes: Uint8Array; requests: number }
  | { stop: NarrationStopReason; message: string; requests: number }
  | { failed: true; message: string; requests: number };

/** One clip: retries per-minute limits and overloads with backoff; anything else ends the attempt. */
async function synthesizeWithRetry(
  scene: { id: string; narration: string },
  voice: VoiceSpec,
  deps: NarrationDeps,
): Promise<Attempt> {
  for (let attempt = 0; ; attempt++) {
    const requests = attempt + 1;
    try {
      return { bytes: await deps.synthesize(scene.narration, voice), requests };
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

/**
 * Voice each target's scenes, one request at a time:
 * - a scene whose narration, voice, and model are unchanged (same hash, file present) is skipped and costs nothing;
 * - a video is only started if all of its remaining characters fit in `maxChars` (no half-voiced videos), and every
 *   request is counted against the budget before it's sent;
 * - per-minute limits and overloads retry with backoff; an exhausted quota or a paid-plan error stops the run;
 * - the manifest is written after every clip, so whatever was saved before a stop is kept.
 * A dry run computes the same plan and calls nothing.
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
    };
    rows.push(row);

    if (stoppedBy) continue;
    if (todo.length === 0) {
      row.status = "up to date";
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
    for (const scene of todo) {
      if (charsUsed + scene.narration.length > options.maxChars) {
        stoppedBy = "budget";
        break;
      }
      if (requests > 0 && options.delayMs > 0) await deps.sleep(options.delayMs);
      const result = await synthesizeWithRetry(scene, options.voice, deps);
      requests += result.requests;
      if (!("bytes" in result)) {
        row.detail = `${scene.id}: ${result.message}`;
        if ("stop" in result) stoppedBy = result.stop;
        else row.status = row.voicedScenes > 0 ? "partial" : "failed";
        break;
      }
      // Only a successful request is billed.
      charsUsed += scene.narration.length;
      const { bytes } = result;

      const entry: SceneAudioEntry = {
        hash: scene.hash,
        file: scene.file,
        durationMs: deps.measureMs(bytes),
        chars: scene.narration.length,
        ...options.voice,
      };
      store.writeAudio(scene.file, bytes);
      const previous = manifest.storyboards[target.storyboardId]?.[scene.id];
      if (previous && previous.file !== scene.file && store.exists(previous.file))
        store.remove(previous.file);
      manifest.storyboards[target.storyboardId] = {
        ...manifest.storyboards[target.storyboardId],
        [scene.id]: entry,
      };
      store.writeManifest(manifest);
      row.voicedScenes++;
      log(`  ${scene.id}: ${scene.narration.length} chars, ${(entry.durationMs / 1000).toFixed(1)}s`);
    }
    if (row.status === "not started") row.status = row.voicedScenes === row.scenes ? "saved" : "partial";
  }

  const remaining = rows
    .filter((r) => r.voicedScenes < r.scenes && r.status !== "dry run")
    .map((r) => r.storyboardId);
  return { rows, charsUsed, maxChars: options.maxChars, requests, stoppedBy, remaining };
}
