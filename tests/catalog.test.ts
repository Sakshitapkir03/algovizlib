import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { operationRows } from "@/components/catalog/examples";
import { categories, patternGroups, patterns, problems } from "@/content/catalog";
import {
  DIFFICULTIES,
  categorySchema,
  patternGroupSchema,
  patternSchema,
  problemSchema,
} from "@/lib/catalog";
import { validateStoryboard } from "@/lib/storyboard";
import {
  getAdjacentProblems,
  getPatternListing,
  getPatternsByGroup,
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

  it("gives every pattern 4–5 problems (Sorting: one per algorithm, up to 8) with at least one easy, medium, and hard", () => {
    for (const pattern of patterns) {
      const stats = getPatternStats(pattern.slug);
      expect(stats.total, pattern.slug).toBeGreaterThanOrEqual(4);
      expect(stats.total, pattern.slug).toBeLessThanOrEqual(pattern.slug === "sorting" ? 8 : 5);
      for (const d of DIFFICULTIES)
        expect(stats.byDifficulty[d], `${pattern.slug}: ${d}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("puts every pattern in a real group and leaves no group empty", () => {
    for (const g of patternGroups) expect(patternGroupSchema.safeParse(g).success, g.slug).toBe(true);
    expect(duplicates(patternGroups.map((g) => g.slug))).toEqual([]);
    expect(duplicates(patternGroups.map((g) => String(g.order)))).toEqual([]);
    const groupSlugs = new Set(patternGroups.map((g) => g.slug));
    for (const p of patterns) expect(groupSlugs.has(p.group), `${p.slug} → ${p.group}`).toBe(true);
    for (const g of patternGroups)
      expect(patterns.filter((p) => p.group === g.slug).length, g.slug).toBeGreaterThan(0);
    // Every DSA pattern appears in exactly one section of /dsa.
    const listed = getPatternsByGroup("dsa").flatMap((s) => s.patterns.map((p) => p.slug));
    expect(listed.sort()).toEqual(
      patterns
        .filter((p) => p.categorySlug === "dsa")
        .map((p) => p.slug)
        .sort(),
    );
  });

  it("covers the planned 20 patterns", () => {
    expect(patterns.map((p) => p.slug).sort()).toEqual(
      [
        "arrays-hashing",
        "prefix-sum",
        "sorting",
        "bit-manipulation",
        "two-pointers",
        "fast-slow-pointers",
        "sliding-window",
        "binary-search",
        "stack",
        "linked-list",
        "intervals",
        "greedy",
        "trees-dfs",
        "graphs-bfs",
        "heap",
        "trie",
        "advanced-graphs",
        "backtracking",
        "dynamic-programming",
        "design",
      ].sort(),
    );
  });

  it("cross-lists problems only in real patterns other than their home, without repeats", () => {
    const patternSlugs = new Set(patterns.map((p) => p.slug));
    for (const problem of problems) {
      for (const slug of problem.relatedPatterns) {
        expect(patternSlugs.has(slug), `${problem.slug} → related ${slug}`).toBe(true);
        expect(slug, `${problem.slug} lists its own home as related`).not.toBe(problem.patternSlug);
      }
      expect(duplicates(problem.relatedPatterns), problem.slug).toEqual([]);
    }
  });

  it("lists cross-listed problems after a pattern's own, linking to their home URL", () => {
    const heap = getPatternListing("heap");
    const mergeK = heap.find((p) => p.slug === "merge-k-sorted-lists");
    expect(mergeK).toMatchObject({
      href: "/dsa/linked-list/merge-k-sorted-lists",
      homePatternName: "Linked List",
    });
    const own = heap.filter((p) => !p.homePatternName);
    expect(own.every((p) => p.patternSlug === "heap")).toBe(true);
    expect(heap.indexOf(mergeK!)).toBeGreaterThanOrEqual(own.length);
    expect(getPatternStats("heap").related).toBe(heap.length - own.length);
  });

  it("shapes every operations example as [operations, arguments] with one output per operation", () => {
    const design = problems.filter((p) => p.exampleFormat === "operations");
    expect(design.length).toBeGreaterThanOrEqual(5);
    for (const problem of design) {
      problem.examples.forEach((example, i) => {
        const label = `${problem.slug} example ${i + 1}`;
        expect(example.args, label).toHaveLength(2);
        const [ops, argLists] = example.args as [unknown[], unknown[]];
        expect(
          ops.every((op) => typeof op === "string"),
          label,
        ).toBe(true);
        expect(argLists.every(Array.isArray), label).toBe(true);
        expect(argLists, label).toHaveLength(ops.length);
        expect(example.expected, label).toHaveLength(ops.length);
        expect((example.expected as unknown[])[0], `${label}: the constructor returns nothing`).toBeNull();
      });
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

  it("builds a search index covering every group, DSA pattern, and problem", () => {
    const index = getSearchIndex();
    expect(index.groups.map((g) => g.href)).toEqual([
      "/dsa#foundations",
      "/dsa#core",
      "/dsa#trees-graphs",
      "/dsa#advanced",
    ]);
    expect(index.groups.reduce((n, g) => n + g.patternCount, 0)).toBe(index.patterns.length);
    expect(index.patterns.find((p) => p.slug === "heap")?.groupName).toBe("Trees & Graphs");
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

describe("operation examples", () => {
  it("render as call → output rows, with the constructor first and void results empty", () => {
    const rows = operationRows({
      args: [
        ["MinStack", "push", "getMin", "top"],
        [[], [-2], [], []],
      ],
      expected: [null, null, -2, "x"],
    });
    expect(rows).toEqual([
      { call: "new MinStack()", output: undefined },
      { call: "push(-2)", output: undefined },
      { call: "getMin()", output: "-2" },
      { call: "top()", output: '"x"' },
    ]);
    expect(
      operationRows({
        args: [
          ["Cache", "put"],
          [[2], [1, [3, 4]]],
        ],
        expected: [null, null],
      })[1].call,
    ).toBe("put(1, [3, 4])");
  });
});
