import "server-only";

import type { Problem } from "@/lib/catalog";
import { getProblemStoryboard } from "@/lib/catalog/repository";
import { runTrace } from "@/lib/traces";

import { buildQuickChecks } from "./build";
import type { QuickCheck } from "./schema";
import { validateQuickChecks } from "./validate";

/**
 * A problem video's quick checks, built when the page is rendered (so no trace code reaches the browser) and passed
 * to the player as data. A question that doesn't validate is never shown (tests keep there being none).
 */
export function getQuickChecks(problem: Problem): QuickCheck[] {
  const storyboard = getProblemStoryboard(problem);
  if (!storyboard?.trace) return [];
  const trace = runTrace(storyboard.trace.problem, storyboard.trace.args);
  const checks = buildQuickChecks(storyboard, trace);
  return validateQuickChecks(storyboard, trace, checks).length === 0 ? checks : [];
}
