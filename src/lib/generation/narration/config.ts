import type { VoiceSpec } from "@/lib/narration/hash";

import { GenerationConfigError } from "../errors";

/**
 * "Sarah", one of ElevenLabs' default voices: clear, neutral, and usable through the API on the free plan (Voice
 * Library voices aren't). Every video uses the same voice; override with ELEVENLABS_VOICE_ID.
 */
export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
/** Flash: the cheapest per character (the Turbo models are deprecated in its favor). Override: ELEVENLABS_MODEL_ID. */
export const DEFAULT_MODEL_ID = "eleven_flash_v2_5";
/** 44.1 kHz at 64 kbps: clear speech at ~8 KB per second (the free plan allows up to 128 kbps). */
export const OUTPUT_FORMAT = "mp3_44100_64";
export const API_KEY_VAR = "ELEVENLABS_API_KEY";
export const DEFAULT_DELAY_MS = 500;
export const DEFAULT_TIMEOUT_MS = 60_000;

export type NarrationConfig = {
  voice: VoiceSpec;
  /** Pause between requests (the free plan allows few concurrent requests; we send one at a time anyway). */
  delayMs: number;
  timeoutMs: number;
};

type Env = Readonly<Record<string, string | undefined>>;

function readMs(env: Env, name: string, fallback: number, min: number): number {
  const raw = env[name];
  const value = raw ? Number(raw) : fallback;
  if (!Number.isFinite(value) || value < min)
    throw new GenerationConfigError(`${name} must be a number of milliseconds ≥ ${min}.`);
  return value;
}

/** Voice, model, and pacing. The API key is checked separately (a dry run doesn't need one). */
export function readNarrationConfig(env: Env): NarrationConfig {
  return {
    voice: {
      voiceId: env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID,
      modelId: env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL_ID,
      outputFormat: OUTPUT_FORMAT,
    },
    delayMs: readMs(env, "ELEVENLABS_DELAY_MS", DEFAULT_DELAY_MS, 0),
    timeoutMs: readMs(env, "ELEVENLABS_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, 1000),
  };
}

/** The key's value, or a clear error naming the variable. Never echoes the value. */
export function readApiKey(env: Env): string {
  const key = env[API_KEY_VAR]?.trim();
  if (!key)
    throw new GenerationConfigError(
      `${API_KEY_VAR} is not set. Add it to .env.local (see .env.example), or use --dry-run.`,
    );
  return key;
}
