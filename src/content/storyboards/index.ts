import type { Storyboard } from "@/lib/storyboard";

import { twoPointersStoryboard } from "./two-pointers";

/** Every published storyboard. Add new problems here. */
export const storyboards: readonly Storyboard[] = [twoPointersStoryboard];

export function getStoryboard(id: string): Storyboard | undefined {
  return storyboards.find((sb) => sb.id === id);
}
