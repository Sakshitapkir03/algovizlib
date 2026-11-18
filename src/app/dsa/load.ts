import { notFound } from "next/navigation";

import type { Pattern, Problem } from "@/lib/catalog";
import { getPattern, getProblem } from "@/lib/catalog/repository";

/** Resolve a DSA pattern from its URL slug, or render the 404 page. */
export function loadPattern(slug: string): Pattern {
  const pattern = getPattern(slug);
  if (!pattern || pattern.categorySlug !== "dsa") notFound();
  return pattern;
}

/** Resolve a problem from its URL; it must belong to that pattern. Otherwise 404. */
export function loadProblem(patternSlug: string, slug: string): { pattern: Pattern; problem: Problem } {
  const pattern = loadPattern(patternSlug);
  const problem = getProblem(pattern.slug, slug);
  if (!problem) notFound();
  return { pattern, problem };
}
