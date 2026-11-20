import { getPatterns, getProblems, getProblemStoryboard } from "@/lib/catalog/repository";

import type { NarrationCatalog } from "./cli";

/** Every problem's video in catalog order (one entry per storyboard). */
export function narrationCatalog(): NarrationCatalog {
  const seen = new Set<string>();
  return getPatterns().flatMap((pattern) =>
    getProblems(pattern.slug).flatMap((problem) => {
      const storyboard = getProblemStoryboard(problem);
      if (!storyboard || seen.has(storyboard.id)) return [];
      seen.add(storyboard.id);
      return [
        {
          storyboardId: storyboard.id,
          problemKey: `${problem.patternSlug}/${problem.slug}`,
          pattern: pattern.slug,
          scenes: storyboard.scenes.map(({ id, narration }) => ({ id, narration })),
        },
      ];
    }),
  );
}
