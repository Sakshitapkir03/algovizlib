import { z } from "zod";

import { trackSceneDurations, type Storyboard } from "@/lib/storyboard";

import { cyrb53, narrationHash, type VoiceSpec } from "./hash";

/**
 * `src/content/narration/manifest.json`, written by `pnpm generate:narration`. Per video:
 *
 * - `clips`: one ElevenLabs MP3 per scene, kept under `narration/clips/` (not served) as the source for stitching,
 *   so unchanged narration is never paid for twice.
 * - `track`: every clip stitched into one MP3 under `public/audio/` (what the player plays), with where each scene's
 *   speech starts. Scene timing comes from those offsets.
 *
 * The app reads it through `withNarration()`; it never calls ElevenLabs.
 */
export const clipEntrySchema = z.object({
  /** `narrationHash(narration, voice)` at the time it was voiced. */
  hash: z.string().min(1),
  /** Path under `narration/clips/`, e.g. "two-pointers/intro-0a1b2c3d4e5f60.mp3". */
  file: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+-[0-9a-f]+\.mp3$/),
  /** Measured length of the MP3 (frames × samples, so it includes the encoder's padding). */
  durationMs: z.number().positive(),
  /** Characters sent to ElevenLabs (what it cost). */
  chars: z.number().int().positive(),
  voiceId: z.string().min(1),
  modelId: z.string().min(1),
  outputFormat: z.string().min(1),
});

export const trackEntrySchema = z.object({
  /** Covers every clip's hash and the stitching settings: a changed clip or setting means a new file. */
  hash: z.string().min(1),
  /** Public URL, e.g. "/audio/two-pointers/narration-0a1b2c3d4e5f60.mp3". */
  file: z.string().startsWith("/audio/"),
  /** Length of the stitched audio. */
  durationMs: z.number().positive(),
  /** Every scene in order: the clip it came from, where its speech starts, and how long the speech runs. */
  scenes: z
    .array(
      z.object({
        id: z.string().min(1),
        hash: z.string().min(1),
        startMs: z.number().nonnegative(),
        speechMs: z.number().positive(),
      }),
    )
    .min(1),
});

export const narrationManifestSchema = z.object({
  version: z.literal(2),
  storyboards: z.record(
    z.string(),
    z.object({
      clips: z.record(z.string(), clipEntrySchema),
      track: trackEntrySchema.optional(),
    }),
  ),
});

export type ClipEntry = z.infer<typeof clipEntrySchema>;
export type TrackEntry = z.infer<typeof trackEntrySchema>;
export type NarrationManifest = z.infer<typeof narrationManifestSchema>;

export const emptyManifest = (): NarrationManifest => ({ version: 2, storyboards: {} });

/** The manifest's clip for a scene, only if it was voiced from the scene's current narration. */
export function currentClip(
  manifest: NarrationManifest,
  storyboardId: string,
  scene: { id: string; narration: string },
): ClipEntry | undefined {
  const entry = manifest.storyboards[storyboardId]?.clips[scene.id];
  if (!entry) return undefined;
  return entry.hash === narrationHash(scene.narration, entry) ? entry : undefined;
}

/** The stitched track's identity: its clips in order plus how they were stitched. */
export function trackHash(
  clipHashes: readonly string[],
  settings: Readonly<Record<string, string | number>>,
): string {
  return cyrb53(JSON.stringify([settings, clipHashes]));
}

/**
 * The video's stitched track, only if it covers exactly the storyboard's scenes, in order, each voiced from its
 * current narration. Anything else (a scene added, removed, reordered, or reworded) means the video isn't voiced
 * until the narration script restitches it; the browser voice reads it meanwhile.
 */
export function currentTrack(
  manifest: NarrationManifest,
  storyboard: { id: string; scenes: readonly { id: string; narration: string }[] },
): TrackEntry | undefined {
  const track = manifest.storyboards[storyboard.id]?.track;
  if (!track || track.scenes.length !== storyboard.scenes.length) return undefined;
  const ok = storyboard.scenes.every((scene, i) => {
    const clip = currentClip(manifest, storyboard.id, scene);
    return track.scenes[i].id === scene.id && clip !== undefined && track.scenes[i].hash === clip.hash;
  });
  return ok ? track : undefined;
}

/** The voice a storyboard's clips were made with (they all share one). */
export function trackVoice(manifest: NarrationManifest, storyboardId: string): VoiceSpec | undefined {
  const clip = Object.values(manifest.storyboards[storyboardId]?.clips ?? {})[0];
  return clip && { voiceId: clip.voiceId, modelId: clip.modelId, outputFormat: clip.outputFormat };
}

/**
 * Attach the voiced track to a storyboard: `narrationTrack` plus scene lengths that line every scene's narration
 * start up with its speech in the track (`trackSceneDurations`). A video without a current track keeps its
 * estimated durations and is read by the browser voice.
 */
export function withNarration(storyboard: Storyboard, manifest: NarrationManifest): Storyboard {
  const track = currentTrack(manifest, storyboard);
  if (!track) return storyboard;
  const sceneStartsMs = track.scenes.map((s) => s.startMs);
  const durations = trackSceneDurations(sceneStartsMs, track.durationMs);
  return {
    ...storyboard,
    narrationTrack: { src: track.file, durationMs: track.durationMs, sceneStartsMs },
    scenes: storyboard.scenes.map((scene, i) => ({ ...scene, durationInFrames: durations[i] })),
  };
}
