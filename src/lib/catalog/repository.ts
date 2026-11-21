import { categories, patternGroups, patterns, problems } from "@/content/catalog";
import { getGeneratedStoryboard, getStoryboard } from "@/content/storyboards";

import {
  DIFFICULTIES,
  type Category,
  type CategorySlug,
  type Difficulty,
  type Pattern,
  type PatternGroup,
  type PatternGroupSlug,
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

export function getPatternGroups(): PatternGroup[] {
  return [...patternGroups].sort(byOrder);
}

export function getPatternGroup(slug: PatternGroupSlug): PatternGroup | undefined {
  return patternGroups.find((g) => g.slug === slug);
}

/** The /dsa page's sections: every group with its patterns, both in order. */
export function getPatternsByGroup(
  categorySlug: CategorySlug = "dsa",
): { group: PatternGroup; patterns: Pattern[] }[] {
  const list = getPatterns(categorySlug);
  return getPatternGroups()
    .map((group) => ({ group, patterns: list.filter((p) => p.group === group.slug) }))
    .filter((section) => section.patterns.length > 0);
}

export function groupHref(group: Pick<PatternGroup, "slug">): string {
  return `/dsa#${group.slug}`;
}

/** A pattern's own problems (the ones whose URL lives under it), in order. */
export function getProblems(patternSlug: string): Problem[] {
  return problems.filter((p) => p.patternSlug === patternSlug).sort(byOrder);
}

const DIFFICULTY_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

/** Problems homed elsewhere that list this pattern in `relatedPatterns`, easiest first. */
export function getRelatedProblems(patternSlug: string): Problem[] {
  return problems
    .filter((p) => p.relatedPatterns.includes(patternSlug))
    .sort(
      (a, b) =>
        DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] || a.title.localeCompare(b.title),
    );
}

/** The other patterns a problem is cross-listed in, in catalog order. */
export function getRelatedPatterns(problem: Problem): Pattern[] {
  return patterns.filter((p) => problem.relatedPatterns.includes(p.slug)).sort(byOrder);
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
  /** Own problems only; cross-listed ones are counted in `related`. */
  total: number;
  byDifficulty: Record<Difficulty, number>;
  videos: number;
  related: number;
};

export function getPatternStats(patternSlug: string): PatternStats {
  const list = getProblems(patternSlug);
  const byDifficulty = Object.fromEntries(DIFFICULTIES.map((d) => [d, 0])) as Record<Difficulty, number>;
  for (const p of list) byDifficulty[p.difficulty]++;
  return {
    total: list.length,
    byDifficulty,
    videos: list.filter(hasVideo).length,
    related: getRelatedProblems(patternSlug).length,
  };
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
  /** Set when the row is listed outside its home pattern: the home pattern's name, for an "also in" label. */
  homePatternName?: string;
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

/** A pattern's table: its own problems in order, then problems cross-listed from other patterns. */
export function getPatternListing(patternSlug: string): ProblemSummary[] {
  return [
    ...getProblems(patternSlug).map(toProblemSummary),
    ...getRelatedProblems(patternSlug).map((problem) => ({
      ...toProblemSummary(problem),
      homePatternName: getPattern(problem.patternSlug)?.name ?? problem.patternSlug,
    })),
  ];
}

export type SearchIndex = {
  groups: { slug: string; name: string; href: string; patternCount: number }[];
  patterns: { slug: string; name: string; groupName: string; href: string; problemCount: number }[];
  problems: (ProblemSummary & { patternName: string })[];
};

/** Everything the command palette can jump to. */
export function getSearchIndex(): SearchIndex {
  const dsa = getPatterns("dsa");
  return {
    groups: getPatternsByGroup("dsa").map(({ group, patterns: list }) => ({
      slug: group.slug,
      name: group.name,
      href: groupHref(group),
      patternCount: list.length,
    })),
    patterns: dsa.map((p) => ({
      slug: p.slug,
      name: p.name,
      groupName: getPatternGroup(p.group)?.name ?? p.group,
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

/** What /me and the landing page's "Continue" card need to show progress: every group, pattern, and problem. */
export type ProgressIndex = {
  groups: {
    slug: string;
    name: string;
    patterns: {
      slug: string;
      name: string;
      href: string;
      problems: { patternSlug: string; slug: string }[];
    }[];
  }[];
  /** Problem key ("<pattern>/<slug>") → display data. */
  problems: Record<string, { title: string; href: string; patternName: string; hasVideo: boolean }>;
};

export function getProgressIndex(): ProgressIndex {
  const patternName = new Map(getPatterns("dsa").map((p) => [p.slug, p.name]));
  return {
    groups: getPatternsByGroup("dsa").map(({ group, patterns }) => ({
      slug: group.slug,
      name: group.name,
      patterns: patterns.map((p) => ({
        slug: p.slug,
        name: p.name,
        href: patternHref(p),
        problems: getProblems(p.slug).map(({ patternSlug, slug }) => ({ patternSlug, slug })),
      })),
    })),
    problems: Object.fromEntries(
      getAllProblems().map((p) => [
        `${p.patternSlug}/${p.slug}`,
        {
          title: p.title,
          href: problemHref(p),
          patternName: patternName.get(p.patternSlug) ?? p.patternSlug,
          hasVideo: hasVideo(p),
        },
      ]),
    ),
  };
}
