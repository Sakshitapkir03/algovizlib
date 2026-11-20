import { narrationManifestSchema, withNarration } from "@/lib/narration/manifest";
import type { Storyboard } from "@/lib/storyboard";

import narrationManifest from "../narration/manifest.json";
import { generatedStoryboards as generated } from "./generated";
import { twoPointersStoryboard } from "./two-pointers";

/** Voiced audio from `pnpm generate:narration`; scenes it covers take their length from the clip. */
const manifest = narrationManifestSchema.parse(narrationManifest);
const voiced = (sb: Storyboard) => withNarration(sb, manifest);

/** Hand-written storyboards. A catalog problem links one with `storyboardId`. */
const handWritten: readonly Storyboard[] = [twoPointersStoryboard].map(voiced);

const generatedStoryboards: Readonly<Record<string, Storyboard>> = Object.fromEntries(
  Object.entries(generated).map(([key, sb]) => [key, voiced(sb)]),
);

/** Every published storyboard: hand-written plus generated, with narration audio attached where it exists. */
export const storyboards: readonly Storyboard[] = [...handWritten, ...Object.values(generatedStoryboards)];

export function getStoryboard(id: string): Storyboard | undefined {
  return storyboards.find((sb) => sb.id === id);
}

/** The generated storyboard for a catalog problem ("pattern/slug"), if one has been generated. */
export function getGeneratedStoryboard(problemKey: string): Storyboard | undefined {
  return generatedStoryboards[problemKey];
}
