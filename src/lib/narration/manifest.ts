import { z } from "zod";

import { narrationDurationInFrames, type Storyboard } from "@/lib/storyboard";

import { narrationHash } from "./hash";

/**
 * `src/content/narration/manifest.json`, written by `pnpm generate:narration`: for every voiced scene, the MP3 under
 * `public/` and its measured length. The app reads it through `withNarration()`; it never calls ElevenLabs.
 */
export const sceneAudioEntrySchema = z.object({
  /** `narrationHash(narration, voice)` at the time it was voiced. */
  hash: z.string().min(1),
  /** Public URL of the MP3, e.g. "/audio/two-pointers/intro-0a1b2c3d4e5f60.mp3". */
  file: z.string().startsWith("/audio/"),
  /** Measured length of the MP3. */
  durationMs: z.number().positive(),
  /** Characters sent to ElevenLabs (what it cost). */
  chars: z.number().int().positive(),
  voiceId: z.string().min(1),
  modelId: z.string().min(1),
  outputFormat: z.string().min(1),
});

export const narrationManifestSchema = z.object({
  version: z.literal(1),
  /** storyboard id → scene id → audio. */
  storyboards: z.record(z.string(), z.record(z.string(), sceneAudioEntrySchema)),
});

export type SceneAudioEntry = z.infer<typeof sceneAudioEntrySchema>;
export type NarrationManifest = z.infer<typeof narrationManifestSchema>;

export const emptyManifest = (): NarrationManifest => ({ version: 1, storyboards: {} });

/** The manifest's entry for a scene, only if it was voiced from the scene's current narration. */
export function currentAudio(
  manifest: NarrationManifest,
  storyboardId: string,
  scene: { id: string; narration: string },
): SceneAudioEntry | undefined {
  const entry = manifest.storyboards[storyboardId]?.[scene.id];
  if (!entry) return undefined;
  return entry.hash === narrationHash(scene.narration, entry) ? entry : undefined;
}

/**
 * Attach voiced audio to a storyboard: a scene with current audio gets `audio` and its duration from the measured
 * clip (lead-in + clip + pause). Scenes without audio, or whose narration changed since it was voiced, keep the
 * estimated duration and are read by the browser voice instead.
 */
export function withNarration(storyboard: Storyboard, manifest: NarrationManifest): Storyboard {
  if (!manifest.storyboards[storyboard.id]) return storyboard;
  return {
    ...storyboard,
    scenes: storyboard.scenes.map((scene) => {
      const entry = currentAudio(manifest, storyboard.id, scene);
      if (!entry) return scene;
      return {
        ...scene,
        audio: { src: entry.file, durationMs: entry.durationMs },
        durationInFrames: narrationDurationInFrames(entry.durationMs),
      };
    }),
  };
}
