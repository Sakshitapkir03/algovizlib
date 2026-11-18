import { categories, patterns, problems } from "@/content/catalog";
import { getGeneratedStoryboard, getStoryboard } from "@/content/storyboards";

import {
  DIFFICULTIES,
  type Category,
  type CategorySlug,
  type Difficulty,
  type Pattern,
  type Problem,
} from "./schema";

/**
 * The only way pages read catalog content. Everything here is synchronous today because content lives in
 * TypeScript files; when it moves to a database, these become async and the callers (server components) add
 * `await`. Nothing else in the UI needs to change.
 *
 * Kept out of `@/lib/catalog`'s index on purpose: content files import that index, so re-exporting this module
 * there would create an import cycle.
 */

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export function getCategories(): readonly Category[] {
  return categories;
}

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function getPatterns(categorySlug: CategorySlug = "dsa"): Pattern[] {
  return patterns.filter((p) => p.categorySlug === categorySlug).sort(byOrder);
}

export function getPattern(slug: string): Pattern | undefined {
  return patterns.find((p) => p.slug === slug);
}

export function getProblems(patternSlug: string): Problem[] {
  return problems.filter((p) => p.patternSlug === patternSlug).sort(byOrder);
}

export function getAllProblems(): readonly Problem[] {
  return problems;
}

/** A problem by its URL: it must belong to the given pattern. */
export function getProblem(patternSlug: string, slug: string): Problem | undefined {
  return problems.find((p) => p.patternSlug === patternSlug && p.slug === slug);
}

/**
 * A problem's video: the hand-written storyboard it names with `storyboardId`, otherwise the one generated for it
 * (content/storyboards/generated), so generating a storyboard never requires editing the problem file.
 */
export function getProblemStoryboard(problem: Problem) {
  if (problem.storyboardId) return getStoryboard(problem.storyboardId);
  return getGeneratedStoryboard(`${problem.patternSlug}/${problem.slug}`);
}

export function hasVideo(problem: Problem): boolean {
  return getProblemStoryboard(problem) !== undefined;
}

export function problemHref(problem: Pick<Problem, "patternSlug" | "slug">): string {
  return `/dsa/${problem.patternSlug}/${problem.slug}`;
}

export function patternHref(pattern: Pick<Pattern, "slug">): string {
  return `/dsa/${pattern.slug}`;
}

export function getAdjacentProblems(problem: Problem): { previous?: Problem; next?: Problem } {
  const siblings = getProblems(problem.patternSlug);
  const i = siblings.findIndex((p) => p.slug === problem.slug);
  return { previous: siblings[i - 1], next: siblings[i + 1] };
}

export type PatternStats = {
  total: number;
  byDifficulty: Record<Difficulty, number>;
  videos: number;
};

export function getPatternStats(patternSlug: string): PatternStats {
  const list = getProblems(patternSlug);
  const byDifficulty = Object.fromEntries(DIFFICULTIES.map((d) => [d, 0])) as Record<Difficulty, number>;
  for (const p of list) byDifficulty[p.difficulty]++;
  return { total: list.length, byDifficulty, videos: list.filter(hasVideo).length };
}

/** Compact, serializable rows for client-side lists (the command palette, the problem table). */
export type ProblemSummary = {
  slug: string;
  patternSlug: string;
  title: string;
  difficulty: Difficulty;
  hasVideo: boolean;
  tags: string[];
  href: string;
};

export function toProblemSummary(problem: Problem): ProblemSummary {
  return {
    slug: problem.slug,
    patternSlug: problem.patternSlug,
    title: problem.title,
    difficulty: problem.difficulty,
    hasVideo: hasVideo(problem),
    tags: problem.tags,
    href: problemHref(problem),
  };
}

export type SearchIndex = {
  patterns: { slug: string; name: string; href: string; problemCount: number }[];
  problems: (ProblemSummary & { patternName: string })[];
};

/** Everything the command palette can jump to. */
export function getSearchIndex(): SearchIndex {
  const dsa = getPatterns("dsa");
  return {
    patterns: dsa.map((p) => ({
      slug: p.slug,
      name: p.name,
      href: patternHref(p),
      problemCount: getProblems(p.slug).length,
    })),
    problems: dsa.flatMap((pattern) =>
      getProblems(pattern.slug).map((problem) => ({
        ...toProblemSummary(problem),
        patternName: pattern.name,
      })),
    ),
  };
}
