import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { categories, patterns, problems } from "@/content/catalog";
import { DIFFICULTIES, categorySchema, patternSchema, problemSchema } from "@/lib/catalog";
import { validateStoryboard } from "@/lib/storyboard";
import {
  getAdjacentProblems,
  getPatternStats,
  getProblem,
  getProblems,
  getProblemStoryboard,
  getSearchIndex,
} from "@/lib/catalog/repository";

const duplicates = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i);

describe("catalog integrity", () => {
  it("every entry passes its schema", () => {
    for (const c of categories) expect(categorySchema.safeParse(c).success, c.slug).toBe(true);
    for (const p of patterns) expect(patternSchema.safeParse(p).success, p.slug).toBe(true);
    for (const p of problems) expect(problemSchema.safeParse(p).success, p.slug).toBe(true);
  });

  it("has unique slugs", () => {
    expect(duplicates(categories.map((c) => c.slug))).toEqual([]);
    expect(duplicates(patterns.map((p) => p.slug))).toEqual([]);
    expect(duplicates(problems.map((p) => p.slug))).toEqual([]);
  });

  it("has unique order values within each pattern and across patterns", () => {
    expect(duplicates(patterns.map((p) => String(p.order)))).toEqual([]);
    for (const pattern of patterns) {
      const orders = problems.filter((p) => p.patternSlug === pattern.slug).map((p) => String(p.order));
      expect(duplicates(orders), pattern.slug).toEqual([]);
    }
  });

  it("links every pattern to an existing category and every problem to an existing pattern", () => {
    const categorySlugs = new Set(categories.map((c) => c.slug));
    const patternSlugs = new Set(patterns.map((p) => p.slug));
    for (const p of patterns) expect(categorySlugs.has(p.categorySlug), p.slug).toBe(true);
    for (const p of problems)
      expect(patternSlugs.has(p.patternSlug), `${p.slug} → ${p.patternSlug}`).toBe(true);
  });

  it("gives every pattern 4–5 problems with at least one easy, one medium, and one hard", () => {
    for (const pattern of patterns) {
      const stats = getPatternStats(pattern.slug);
      expect(stats.total, pattern.slug).toBeGreaterThanOrEqual(4);
      expect(stats.total, pattern.slug).toBeLessThanOrEqual(5);
      for (const d of DIFFICULTIES)
        expect(stats.byDifficulty[d], `${pattern.slug}: ${d}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("only links storyboards that exist and pass the validator", () => {
    const linked = problems.filter((p) => p.storyboardId !== undefined);
    expect(linked.length).toBeGreaterThan(0);
    for (const problem of problems) {
      const storyboard = getProblemStoryboard(problem);
      if (problem.storyboardId) expect(storyboard, `${problem.slug} → ${problem.storyboardId}`).toBeDefined();
      if (!storyboard) continue;
      expect(validateStoryboard(storyboard).issues, problem.slug).toEqual([]);
    }
  });

  it("animates the problem's own example when a video is bound to a trace", () => {
    for (const problem of problems) {
      const trace = getProblemStoryboard(problem)?.trace;
      if (!trace) continue;
      expect(trace.problem, problem.slug).toBe(`${problem.patternSlug}/${problem.slug}`);
      expect(
        problem.examples.some((e) => JSON.stringify(e.args) === JSON.stringify(trace.args)),
        `${problem.slug} should include an example with args ${JSON.stringify(trace.args)}`,
      ).toBe(true);
    }
  });

  it("attaches the Two Pointers video to an easy two-pointers problem", () => {
    const problem = getProblem("two-pointers", "pair-with-target-sum");
    expect(problem?.difficulty).toBe("easy");
    expect(problem?.storyboardId).toBe("two-pointers");
  });

  it("keeps each pattern's starting signals and complexity filled in (no placeholders)", () => {
    const text = JSON.stringify([patterns, problems]);
    expect(text).not.toMatch(/\bTODO\b/);
  });
});

describe("catalog repository", () => {
  it("orders problems and walks previous/next within a pattern", () => {
    const list = getProblems("two-pointers");
    expect(list.map((p) => p.order)).toEqual([...list.map((p) => p.order)].sort((a, b) => a - b));
    const first = getAdjacentProblems(list[0]);
    expect(first.previous).toBeUndefined();
    expect(first.next?.slug).toBe(list[1].slug);
    const last = getAdjacentProblems(list[list.length - 1]);
    expect(last.next).toBeUndefined();
  });

  it("does not resolve a problem under the wrong pattern", () => {
    expect(getProblem("sliding-window", "pair-with-target-sum")).toBeUndefined();
  });

  it("builds a search index covering every DSA pattern and problem", () => {
    const index = getSearchIndex();
    expect(index.patterns).toHaveLength(patterns.filter((p) => p.categorySlug === "dsa").length);
    expect(index.problems).toHaveLength(problems.length);
    expect(index.problems.find((p) => p.slug === "pair-with-target-sum")?.hasVideo).toBe(true);
  });
});

describe("generation code stays out of the app", () => {
  it("no app source imports the generator or the AI SDK", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const file = path.join(dir, name);
        if (file.includes(`${path.sep}lib${path.sep}generation`)) continue;
        if (statSync(file).isDirectory()) walk(file);
        else if (
          /\.(ts|tsx)$/.test(name) &&
          /from ["'](@\/lib\/generation|ai["'/]|@ai-sdk\/)/.test(readFileSync(file, "utf8"))
        )
          offenders.push(file);
      }
    };
    walk(path.join(process.cwd(), "src"));
    expect(offenders).toEqual([]);
  });
});

describe("reference solutions stay test-only", () => {
  it("no app source imports from tests/", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const file = path.join(dir, name);
        if (statSync(file).isDirectory()) walk(file);
        else if (
          /\.(ts|tsx)$/.test(name) &&
          /from ["'][^"']*(tests|reference-solutions)\//.test(readFileSync(file, "utf8"))
        )
          offenders.push(file);
      }
    };
    walk(path.join(process.cwd(), "src"));
    expect(offenders).toEqual([]);
  });
});
