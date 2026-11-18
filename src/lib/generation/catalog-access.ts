import { getPattern, getPatterns, getProblems } from "@/lib/catalog/repository";

import { selectTargets, type CatalogAccess } from "./cli";
import type { GenerationTarget } from "./pipeline";
import type { StoryboardWriter } from "./writer";

/** The real catalog, with "existing storyboard" read from problem files (hand-written) and the generated folder. */
export function createCatalogAccess(writer: Pick<StoryboardWriter, "exists">): CatalogAccess {
  return {
    getPatterns: () => getPatterns("dsa"),
    getPattern,
    getProblems,
    existingStoryboard: (problem) =>
      problem.storyboardId
        ? "hand-written"
        : writer.exists(`${problem.patternSlug}/${problem.slug}`)
          ? "generated"
          : undefined,
  };
}

/** One problem's target by "pattern/slug", or undefined if it isn't in the catalog. */
export function findTarget(catalog: CatalogAccess, problem: string): GenerationTarget | undefined {
  try {
    const opts = { problem, missing: false, dryRun: false, force: false, maxRequests: 1 };
    return selectTargets(opts, catalog)[0];
  } catch {
    return undefined;
  }
}
