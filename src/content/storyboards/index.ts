import type { Storyboard } from "@/lib/storyboard";

import { generatedStoryboards } from "./generated";
import { twoPointersStoryboard } from "./two-pointers";

/** Hand-written storyboards. A catalog problem links one with `storyboardId`. */
const handWritten: readonly Storyboard[] = [twoPointersStoryboard];

/** Every published storyboard: hand-written plus generated. */
export const storyboards: readonly Storyboard[] = [...handWritten, ...Object.values(generatedStoryboards)];

export function getStoryboard(id: string): Storyboard | undefined {
  return storyboards.find((sb) => sb.id === id);
}

/** The generated storyboard for a catalog problem ("pattern/slug"), if one has been generated. */
export function getGeneratedStoryboard(problemKey: string): Storyboard | undefined {
  return generatedStoryboards[problemKey];
}
