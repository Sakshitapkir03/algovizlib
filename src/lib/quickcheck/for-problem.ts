import "server-only";

import type { Lesson, Problem } from "@/lib/catalog";
import { getLessonStoryboard, getProblemStoryboard } from "@/lib/catalog/repository";
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

/** A system design lesson's quick checks (the same rules: built from the simulation's steps, never shown unvalidated). */
export function getLessonQuickChecks(lesson: Lesson): QuickCheck[] {
  const storyboard = getLessonStoryboard(lesson);
  if (!storyboard?.trace) return [];
  const trace = runTrace(storyboard.trace.problem, storyboard.trace.args);
  const checks = buildQuickChecks(storyboard, trace);
  return validateQuickChecks(storyboard, trace, checks).length === 0 ? checks : [];
}
