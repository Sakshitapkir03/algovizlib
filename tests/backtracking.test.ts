import { describe, expect, it } from "vitest";

import { getProblem } from "@/lib/catalog/repository";
import { assembleStoryboard, evaluateDraft, type GenerationContext } from "@/lib/generation/draft";
import { resolveStoryboard, storyboardSourceSchema, validateStoryboard } from "@/lib/storyboard";
import { getTraceDefinition } from "@/lib/traces";
import { PHONE_PLAYER_WIDTH, textMetrics } from "@/video/text";

import { backtrackProblems } from "@/video/fit/backtrack";
import { buildDraft, traceFor } from "./fixtures/drafts";
import { searchProblems } from "@/video/fit/search";

const SEARCHES = [
  "backtracking/sum-of-all-subset-xor-totals",
  "backtracking/subsets",
  "backtracking/permutations",
  "backtracking/combination-sum",
  "backtracking/n-queens",
];

describe("backtracking traces", () => {
  it.each(SEARCHES)("%s: choose, explore, undo, and record follow the tree", (key) => {
    const { trace } = traceFor(key);
    const nodes = trace.searchTree!.nodes;
    expect(trace.steps.filter((s) => s.key).length + 3).toBeLessThanOrEqual(10);
    let reached = 0;
    for (const step of trace.steps) {
      const x = step.explore!;
      // The path runs from the root, parent to child, and ends at the current node.
      expect(x.path[0]).toBe(0);
      x.path.forEach((id, k) => k > 0 && expect(nodes[id].parent).toBe(x.path[k - 1]));
      expect(x.path.at(-1)).toBe(x.current);
      // Nodes are only ever added; an undo's node is the child of the new current one.
      expect(x.reached.length).toBeGreaterThanOrEqual(reached);
      reached = x.reached.length;
      if (x.undone !== undefined) expect(nodes[x.undone].parent).toBe(x.current);
      // Dead ends and solutions are reached, and never both.
      for (const id of [...x.dead, ...x.solutions]) expect(x.reached).toContain(id);
      expect(x.dead.some((id) => x.solutions.includes(id))).toBe(false);
      expect(step.partial!.found.length).toBe(x.solutions.length);
    }
    for (const node of nodes) if (node.pruned) expect(node.pruned.length).toBeGreaterThan(0);
  });

  it("Combination Sum prunes a candidate bigger than what's left, with the reason", () => {
    const { trace } = traceFor("backtracking/combination-sum");
    expect(trace.searchTree!.nodes.filter((n) => n.pruned).map((n) => n.pruned)).toEqual(["6 > 4", "6 > 2"]);
    expect(trace.steps.at(-1)!.partial!.found).toEqual(["[4, 4, 4]", "[6, 6]"]);
    const prune = trace.steps.find((s) => s.kind === "prune")!;
    expect(prune.equation).toMatchObject({ comparison: { op: ">", target: 4 }, tone: "negative" });
  });

  it("N-Queens cuts attacked squares, folds dead subtrees, and keeps the board in sync", () => {
    const { trace } = traceFor("backtracking/n-queens");
    const firstDead = trace.steps.find((s) => s.kind === "dead-end")!;
    expect(firstDead.cells!.flat().filter((v) => v === "Q")).toHaveLength(2);
    expect(trace.steps.some((s) => (s.explore!.collapsed ?? []).length > 0)).toBe(true);
    const first = trace.steps.find((s) => s.kind === "solution")!;
    expect(first.cells!.map((row) => row.join(""))).toEqual([".Q..", "...Q", "Q...", "..Q."].map((r) => r));
    expect(trace.answerDisplay).toBe("2 boards");
  });

  it("Subsets and Permutations record every leaf", () => {
    expect(traceFor("backtracking/subsets").trace.steps.at(-1)!.partial!.found).toHaveLength(8);
    expect(traceFor("backtracking/permutations").trace.steps.at(-1)!.partial!.found).toHaveLength(6);
  });
});

const META = {
  promptVersion: "test",
  provider: "fake",
  model: "fake",
  generatedAt: "2026-01-01T00:00:00.000Z",
  repairAttempts: 0,
};

function context(key: string): GenerationContext {
  const [pattern, slug] = key.split("/");
  return {
    problem: getProblem(pattern, slug)!,
    patternName: "Backtracking",
    definition: getTraceDefinition(key)!,
    args: traceFor(key).args,
  };
}

describe("backtracking storyboards", () => {
  it.each(SEARCHES)("%s: a fixture draft passes, and fits at phone and full size", (key) => {
    const result = evaluateDraft(buildDraft(key), context(key), META);
    expect(result.issues).toEqual([]);
    if (!result.ok) return;
    for (const width of [PHONE_PLAYER_WIDTH, 1280]) {
      const t = textMetrics(width);
      for (const scene of result.storyboard.scenes) {
        for (const type of ["search-tree", "partial"] as const)
          expect(backtrackProblems(scene.elements, t, type), `${scene.id} ${type} at ${width}`).toEqual([]);
        if (scene.elements.some((e) => e.type === "grid"))
          expect(searchProblems(scene.elements, t, "grid"), `${scene.id} board at ${width}`).toEqual([]);
      }
    }
  });

  type Source = ReturnType<typeof assembleStoryboard>;
  const source = (key: string): Source =>
    structuredClone(assembleStoryboard(buildDraft(key), context(key), META));
  const issues = (sb: Source) => {
    const { storyboard, issues } = resolveStoryboard(storyboardSourceSchema.parse(sb));
    return [...issues, ...(storyboard ? validateStoryboard(storyboard).issues : [])]
      .map((i) => i.message)
      .join("\n");
  };
  const combo = "backtracking/combination-sum";
  const mutate = (step: number, type: string, change: (el: Record<string, unknown>) => void) => {
    const sb = source(combo);
    const scene = sb.scenes.find((s) => s.traceStep === step)!;
    change(scene.elements.find((e) => e.type === type) as Record<string, unknown>);
    return issues(sb);
  };

  it("the fixture source resolves and validates", () => {
    expect(issues(source(combo))).toBe("");
  });

  it("rejects a wrong path, reached set, dead end, solution, undo, or pruning reason", () => {
    expect(mutate(3, "search-tree", (t) => (t.path = [0, 1]))).toMatch(/search's path doesn't match/);
    expect(mutate(3, "search-tree", (t) => (t.reached = [0, 1, 2]))).toMatch(
      /search's reached doesn't match/,
    );
    expect(mutate(5, "search-tree", (t) => (t.dead = [1]))).toMatch(/search's dead doesn't match/);
    expect(mutate(3, "search-tree", (t) => (t.solutions = []))).toMatch(/search's solutions doesn't match/);
    expect(mutate(4, "search-tree", (t) => (t.undone = 1))).toMatch(/search's undone doesn't match/);
    const nodes = structuredClone(traceFor(combo).trace.searchTree!.nodes);
    nodes.find((n) => n.pruned)!.pruned = "too big";
    expect(mutate(5, "search-tree", (t) => (t.nodes = nodes))).toMatch(/decision tree doesn't match/);
  });

  it("rejects a wrong answer being built, a wrong added or removed choice, and wrong answers found", () => {
    expect(mutate(3, "partial", (p) => (p.items = ["4", "4"]))).toMatch(/answer's items doesn't match/);
    expect(mutate(4, "partial", (p) => (p.removed = "6"))).toMatch(/answer's removed doesn't match/);
    expect(mutate(0, "partial", (p) => (p.added = "6"))).toMatch(/answer's added doesn't match/);
    expect(mutate(3, "partial", (p) => (p.found = []))).toMatch(/answer's found doesn't match/);
  });

  it("an unbound tree shows only the root and an unbound answer is empty", () => {
    const sb = source(combo);
    sb.scenes[0].elements.push({
      id: "t",
      type: "search-tree",
      enterAt: 0,
      reached: [0, 1],
      path: [0, 1],
    } as never);
    sb.scenes[1].elements.push({ id: "p", type: "partial", enterAt: 0, items: ["4"], found: [] } as never);
    const messages = issues(sb);
    expect(messages).toMatch(/Without a traceStep, the search-tree shows the start/);
    expect(messages).toMatch(/Without a traceStep, the partial shows the start/);
  });
});
