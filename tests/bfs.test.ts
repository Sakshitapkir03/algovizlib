import { describe, expect, it } from "vitest";

import { getProblem } from "@/lib/catalog/repository";
import { assembleStoryboard, evaluateDraft, type GenerationContext } from "@/lib/generation/draft";
import { resolveStoryboard, storyboardSourceSchema, validateStoryboard } from "@/lib/storyboard";
import { getTraceDefinition } from "@/lib/traces";
import { layoutScene } from "@/video/layout";
import { PHONE_PLAYER_WIDTH, textMetrics } from "@/video/text";

import { buildDraft, traceFor } from "./fixtures/drafts";
import { searchProblems } from "@/video/fit/search";

const SEARCHES = [
  "graphs-bfs/flood-fill",
  "graphs-bfs/number-of-islands",
  "graphs-bfs/rotting-oranges",
  "graphs-bfs/shortest-path-in-binary-matrix",
  "graphs-bfs/word-ladder",
];

describe("BFS traces", () => {
  it.each(SEARCHES)("%s records the queue, the seen set, levels, and every neighbor check", (key) => {
    const { trace } = traceFor(key);
    const n = trace.grid ? trace.grid.rows * trace.grid.cols : trace.graph!.nodes.length;
    expect(trace.steps.filter((s) => s.key).length + 3).toBeLessThanOrEqual(10);
    let previous: number[] = [];
    for (const step of trace.steps) {
      const { bfs, queue } = step;
      // The frontier is the queue, and everything queued has been seen.
      expect(bfs!.frontier).toEqual(queue!.items.map((i) => i.id));
      for (const id of bfs!.frontier) expect(bfs!.visited).toContain(id);
      // A queue holds one level, then the next: levels never decrease front to back, and span at most two.
      const levels = queue!.items.map((i) => i.level);
      levels.forEach((l, k) => k > 0 && expect(l).toBeGreaterThanOrEqual(levels[k - 1]));
      if (levels.length > 0) expect(levels.at(-1)! - levels[0]).toBeLessThanOrEqual(1);
      // What left the front was at the front; what joined the back is at the back.
      if (queue!.dequeued) expect(previous[0]).toBe(queue!.dequeued.id);
      const added = queue!.enqueued ?? [];
      expect(queue!.items.slice(queue!.items.length - added.length).map((i) => i.id)).toEqual(added);
      expect(bfs!.checks?.filter((c) => c.result === "added").map((c) => c.to) ?? []).toEqual(
        added.filter(() => bfs!.checks !== undefined),
      );
      for (const check of bfs!.checks ?? []) {
        expect(check.from).toBe(bfs!.current);
        if (check.result === "out") expect(check.to).toBeUndefined();
        else expect(check.to).toBeLessThan(n);
      }
      previous = queue!.items.map((i) => i.id);
    }
  });

  it("Rotting Oranges starts from every rotten orange at once (multi-source)", () => {
    const { trace } = traceFor("graphs-bfs/rotting-oranges");
    expect(trace.steps[0].queue!.items.map((i) => [i.label, i.level])).toEqual([
      ["(0,0)", 0],
      ["(2,2)", 0],
    ]);
    expect(trace.steps.at(-1)!.counter).toEqual({ value: 0 });
    expect(trace.steps.at(-1)!.cells).toEqual([
      [2, 2, 2],
      [2, 2, 0],
      [0, 2, 2],
    ]);
  });

  it("checks say why a neighbor is skipped: off the grid, a wall, or already seen", () => {
    const { trace } = traceFor("graphs-bfs/shortest-path-in-binary-matrix");
    const first = trace.steps[1].bfs!.checks!;
    expect(first.map((c) => c.result)).toEqual([
      "out",
      "out",
      "out",
      "out",
      "added",
      "out",
      "blocked",
      "blocked",
    ]);
    expect(trace.steps.at(-1)!.kind).toBe("reached");
    expect(trace.steps.at(-1)!.bfs!.levels!.find((l) => l.id === 15)!.level).toBe(5);
  });

  it("Word Ladder builds the one-letter graph and reaches warm at level 5", () => {
    const { trace } = traceFor("graphs-bfs/word-ladder");
    const label = (id: number) => trace.graph!.nodes[id].label;
    expect(trace.graph!.edges.map(([a, b]) => `${label(a)}-${label(b)}`)).toContain("cold-cord");
    expect(trace.graph!.edges.map(([a, b]) => `${label(a)}-${label(b)}`)).not.toContain("cold-word");
    expect(trace.answer).toBe(5);
    const skip = trace.steps.find((s) => s.key && s.kind === "dead-end")!;
    expect(skip.bfs!.checks!.some((c) => c.result === "visited" && label(c.to!) === "ward")).toBe(true);
  });

  it("Number of Islands counts each island once", () => {
    const { trace } = traceFor("graphs-bfs/number-of-islands");
    expect(trace.steps.filter((s) => s.kind === "found").map((s) => s.counter!.value)).toEqual([1, 2, 3, 4]);
    expect(trace.steps.find((s) => s.kind === "island-done")!.queue!.items).toEqual([]);
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
    patternName: "Graphs (BFS)",
    definition: getTraceDefinition(key)!,
    args: traceFor(key).args,
  };
}

describe("BFS storyboards", () => {
  it.each(SEARCHES)("%s: a fixture draft passes, and fits at phone and full size", (key) => {
    const result = evaluateDraft(buildDraft(key), context(key), META);
    expect(result.issues).toEqual([]);
    if (!result.ok) return;
    for (const width of [PHONE_PLAYER_WIDTH, 1280]) {
      const t = textMetrics(width);
      for (const scene of result.storyboard.scenes)
        for (const type of ["grid", "graph", "queue"] as const)
          if (scene.elements.some((e) => e.type === type)) {
            expect(searchProblems(scene.elements, t, type), `${scene.id} ${type} at ${width}`).toEqual([]);
            expect(layoutScene(scene.elements, t).bottomTop).toBeGreaterThan(0);
          }
    }
  });

  type Source = ReturnType<typeof assembleStoryboard>;
  type SceneSource = Source["scenes"][number];
  const source = (key: string): Source =>
    structuredClone(assembleStoryboard(buildDraft(key), context(key), META));
  const issues = (sb: Source) => {
    const { storyboard, issues } = resolveStoryboard(storyboardSourceSchema.parse(sb));
    return [...issues, ...(storyboard ? validateStoryboard(storyboard).issues : [])]
      .map((i) => i.message)
      .join("\n");
  };
  const mutate = (key: string, step: number, change: (scene: SceneSource) => void) => {
    const sb = source(key);
    change(sb.scenes.find((s) => s.traceStep === step)!);
    return issues(sb);
  };
  const el = (scene: SceneSource, type: string) =>
    scene.elements.find((e) => e.type === type) as Record<string, unknown>;
  const rot = "graphs-bfs/rotting-oranges";

  it("the fixture source resolves and validates", () => {
    expect(mutate(rot, 1, () => {})).toBe("");
  });

  it("rejects wrong cells, seen set, frontier, levels, and checks", () => {
    expect(
      mutate(
        rot,
        1,
        (s) =>
          (el(s, "grid").cells = [
            [2, 1, 1],
            [1, 1, 0],
            [0, 1, 2],
          ]),
      ),
    ).toMatch(/grid's cells don't match/);
    expect(mutate(rot, 1, (s) => (el(s, "grid").visited = [0, 8]))).toMatch(/grid's visited doesn't match/);
    expect(mutate(rot, 1, (s) => (el(s, "grid").frontier = [3, 1, 8]))).toMatch(
      /grid's frontier doesn't match/,
    );
    expect(mutate(rot, 1, (s) => (el(s, "grid").levels = [{ id: 0, level: 3 }]))).toMatch(
      /grid's levels doesn't match/,
    );
    expect(
      mutate(rot, 1, (s) => (el(s, "grid").checks = [{ from: 0, to: 3, dir: [1, 0], result: "blocked" }])),
    ).toMatch(/grid's checks doesn't match/);
  });

  it("rejects a queue with the wrong items, the wrong level boundaries, or the wrong ends", () => {
    const items = traceFor(rot).trace.steps[1].queue!.items;
    expect(mutate(rot, 1, (s) => (el(s, "queue").items = [...items].reverse()))).toMatch(
      /queue doesn't match/,
    );
    // Same items, but a level marker in the wrong place.
    expect(mutate(rot, 1, (s) => (el(s, "queue").items = items.map((i) => ({ ...i, level: 1 }))))).toMatch(
      /queue doesn't match trace step 1 \(items and their levels\)/,
    );
    expect(mutate(rot, 1, (s) => (el(s, "queue").dequeued = { id: 8, label: "(2,2)", level: 0 }))).toMatch(
      /taken off the front doesn't match/,
    );
    expect(mutate(rot, 1, (s) => (el(s, "queue").enqueued = [1]))).toMatch(/added at the back don't match/);
  });

  it("rejects a queue in an unbound scene and a search drawn on an unbound grid", () => {
    const sb = source(rot);
    sb.scenes[0].elements.push({ id: "q", type: "queue", enterAt: 0, items: [] } as never);
    el(sb.scenes[1], "grid").visited = [0];
    const messages = issues(sb);
    expect(messages).toMatch(/queue needs the scene to set traceStep/);
    expect(messages).toMatch(/Without a traceStep, the grid shows no search/);
  });

  it("rejects a graph with a wrong edge", () => {
    const key = "graphs-bfs/word-ladder";
    const edges = traceFor(key).trace.graph!.edges.slice(1);
    expect(mutate(key, 1, (s) => (el(s, "graph").edges = edges))).toMatch(/graph's edges don't match/);
  });

  it("schema rejects ragged cells, an unknown value, and checks off a grid without a direction", () => {
    const sb = source(rot);
    el(sb.scenes[0], "grid").cells = [
      [2, 1],
      [1, 1, 0],
      [0, 1, 2],
    ];
    expect(issues(sb)).toMatch(/cells must be 3 rows of 3/);
    const sb2 = source(rot);
    el(sb2.scenes[0], "grid").cells = [
      [7, 1, 1],
      [1, 1, 0],
      [0, 1, 2],
    ];
    expect(issues(sb2)).toMatch(/needs a legend entry/);
    const sb3 = source(rot);
    el(
      sb3.scenes.find((s) => s.traceStep === 1)!,
      "grid",
    ).checks = [{ from: 0, result: "out" }];
    expect(issues(sb3)).toMatch(/grid's checks need dir/);
  });
});
