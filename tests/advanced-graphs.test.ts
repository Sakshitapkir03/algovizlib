import { describe, expect, it } from "vitest";

import { getProblem } from "@/lib/catalog/repository";
import { assembleStoryboard, evaluateDraft, type GenerationContext } from "@/lib/generation/draft";
import { resolveStoryboard, storyboardSourceSchema, validateStoryboard } from "@/lib/storyboard";
import { getTraceDefinition, type TraceForest, type TraceNetwork } from "@/lib/traces";
import { layoutScene } from "@/video/layout";
import { PHONE_PLAYER_WIDTH, textMetrics } from "@/video/text";

import { buildDraft, traceFor } from "./fixtures/drafts";
import { forestProblems, networkProblems } from "./fixtures/graph-fit";

const GRAPHS = [
  "advanced-graphs/find-if-path-exists-in-graph",
  "advanced-graphs/course-schedule",
  "advanced-graphs/network-delay-time",
  "advanced-graphs/redundant-connection",
  "advanced-graphs/alien-dictionary",
];

describe("advanced graph traces", () => {
  it.each(GRAPHS)("%s: fits a 10-scene video and stays small enough for a phone", (key) => {
    const { trace } = traceFor(key);
    expect(trace.steps.filter((s) => s.key).length + 3).toBeLessThanOrEqual(10);
    expect(trace.steps.at(-1)!.key).toBe(true);
    for (const step of trace.steps) {
      expect((step.network?.nodes ?? step.forest?.labels ?? []).length).toBeLessThanOrEqual(7);
      expect(step.network || step.forest).toBeDefined();
    }
  });

  it("Course Schedule takes 0 and 4, then 1, 2, 3 are stuck on a cycle", () => {
    const { trace } = traceFor("advanced-graphs/course-schedule");
    const badges = (g: TraceNetwork) => g.nodes.map((n) => n.badge);
    expect(badges(trace.steps[0].network!)).toEqual(["in 0", "in 2", "in 1", "in 1", "in 1"]);
    expect(trace.steps.slice(1, 3).map((s) => s.partial!.added)).toEqual(["0", "4"]);
    // Taking 0 uses up its two arrows and frees 4.
    expect(trace.steps[1].network!.edges.filter((e) => e.state === "used")).toHaveLength(2);
    expect(trace.steps[1].queue!.enqueued).toEqual([4]);
    const end = trace.steps.at(-1)!.network!;
    expect(end.nodes.filter((n) => n.state === "stuck").map((n) => n.label)).toEqual(["1", "2", "3"]);
    expect(trace.steps.at(-1)!.equation).toMatchObject({
      comparison: { op: "<", target: 5 },
      tone: "negative",
    });
    expect(trace.answer).toBe(false);
  });

  it("Network Delay Time improves one distance, skips a stale entry, and turns down a slower route", () => {
    const { trace } = traceFor("advanced-graphs/network-delay-time");
    const better = trace.steps.find((s) => s.kind === "relax" && s.map!.updated?.from === "4")!;
    expect(better.map!.updated).toEqual({ key: "2", from: "4" });
    expect(better.equation).toMatchObject({
      terms: [1, 2],
      result: 3,
      comparison: { op: "<", target: 4 },
      tone: "positive",
    });
    expect(better.key).toBe(true);
    const stale = trace.steps.find((s) => s.kind === "stale")!;
    expect(stale.heaps![0].popped!.label).toBe("(4,2)");
    expect(stale.equation).toMatchObject({ comparison: { op: ">", target: 3 }, tone: "neutral" });
    const worse = trace.steps.find((s) => s.kind === "no-better")!;
    expect(worse.network!.edges.find((e) => e.state === "worse")).toMatchObject({ from: 3, to: 2 });
    expect(worse.equation).toMatchObject({ result: 6, comparison: { op: ">", target: 1 }, tone: "neutral" });
    // Every settled node is popped in order of time (Dijkstra's invariant).
    const settled = trace.steps.filter((s) => s.kind === "settle").map((s) => s.heaps![0].popped!.key);
    expect(settled).toEqual([...settled].sort((a, b) => a - b));
    expect(trace.answer).toBe(6);
  });

  it("Find if Path Exists unions by size, then compresses 4's path on the query", () => {
    const { trace } = traceFor("advanced-graphs/find-if-path-exists-in-graph");
    const bySize = trace.steps[3].forest!;
    // Root 3's group (2) joins root 0's (3), not the other way round.
    expect(bySize.union).toEqual({ child: 3, parent: 0 });
    expect(bySize.sizes![0]).toBe(5);
    const query = trace.steps.at(-1)!.forest!;
    expect(query.finds!.map((f) => f.path)).toEqual([[4, 3, 0], [0]]);
    expect(query.compressed).toEqual([{ node: 4, from: 3, to: 0 }]);
    expect(query.same).toBe(0);
    expect(trace.answer).toBe(true);
  });

  it("Redundant Connection halves a long find and stops at the edge whose ends share a root", () => {
    const { trace } = traceFor("advanced-graphs/redundant-connection");
    const end = trace.steps.at(-1)!;
    const f: TraceForest = end.forest!;
    expect(f.finds![0].path).toEqual([0, 1, 2, 3]);
    expect(f.compressed).toEqual([{ node: 0, from: 1, to: 2 }]);
    expect(f.same).toBe(3);
    expect(end.rejected).toEqual([3]);
    expect(trace.steps).toHaveLength(4);
    expect(trace.answer).toEqual([1, 4]);
  });

  it("Alien Dictionary finds two arrows, ignores a repeat, and always takes the smallest ready letter", () => {
    const { trace } = traceFor("advanced-graphs/alien-dictionary");
    expect(trace.steps.filter((s) => s.kind === "arrow")).toHaveLength(2);
    expect(trace.steps.find((s) => s.kind === "known")!.key).toBe(false);
    expect(trace.steps.find((s) => s.kind === "start")!.queue!.items.map((i) => i.label)).toEqual([
      "a",
      "c",
      "z",
    ]);
    expect(trace.steps.at(-1)!.partial!.items.join("")).toBe("aczxb");
    expect(trace.answer).toBe("aczxb");
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
    patternName: "Advanced Graphs",
    definition: getTraceDefinition(key)!,
    args: traceFor(key).args,
  };
}

describe("advanced graph storyboards", () => {
  it.each(GRAPHS)("%s: a fixture draft passes and fits at phone and full size", (key) => {
    const result = evaluateDraft(buildDraft(key), context(key), META);
    expect(result.issues).toEqual([]);
    if (!result.ok) return;
    for (const width of [PHONE_PLAYER_WIDTH, 1280])
      for (const scene of result.storyboard.scenes) {
        const t = textMetrics(width);
        expect(networkProblems(scene.elements, t), `${scene.id} at ${width}`).toEqual([]);
        expect(forestProblems(scene.elements, t), `${scene.id} at ${width}`).toEqual([]);
      }
  });

  it("a heap beside a graph takes the right of the stage", () => {
    const key = "advanced-graphs/network-delay-time";
    const result = evaluateDraft(buildDraft(key), context(key), META);
    if (!result.ok) throw new Error("fixture invalid");
    const scene = result.storyboard.scenes.find((s) => s.traceStep === 5)!;
    for (const width of [PHONE_PLAYER_WIDTH, 1280]) {
      const layout = layoutScene(scene.elements, textMetrics(width));
      const graphRight = layout.network!.region.x + layout.network!.region.w;
      expect(layout.heapPanels![0].left).toBeGreaterThan(graphRight);
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
  const mutateGraph = (key: string, step: number, change: (g: TraceNetwork) => void) => {
    const sb = source(key);
    const el = sb.scenes
      .find((s) => s.traceStep === step)!
      .elements.find((e) => e.type === "digraph") as Record<string, unknown>;
    const g = structuredClone(traceFor(key).trace.steps[step].network!);
    change(g);
    Object.assign(el, g);
    return issues(sb);
  };
  const mutateForest = (key: string, step: number, change: (f: TraceForest) => void) => {
    const sb = source(key);
    const el = sb.scenes
      .find((s) => s.traceStep === step)!
      .elements.find((e) => e.type === "union-find") as Record<string, unknown>;
    const f = structuredClone(traceFor(key).trace.steps[step].forest!) as TraceForest &
      Record<string, unknown>;
    change(f);
    for (const field of ["sizes", "finds", "compressed", "union", "same"])
      if (!(field in f)) f[field] = undefined;
    Object.assign(el, f);
    return issues(sb);
  };
  const COURSES = "advanced-graphs/course-schedule";
  const DELAY = "advanced-graphs/network-delay-time";
  const PATH = "advanced-graphs/find-if-path-exists-in-graph";
  const LOOP = "advanced-graphs/redundant-connection";

  it("the fixture sources resolve and validate", () => {
    for (const key of GRAPHS) expect(issues(source(key)), key).toBe("");
  });

  it("rejects a wrong in-degree, node state, edge state, or weight", () => {
    expect(mutateGraph(COURSES, 1, () => {})).toBe("");
    expect(mutateGraph(COURSES, 1, (g) => (g.nodes[1].badge = "in 2"))).toMatch(
      /digraph's nodes doesn't match/,
    );
    expect(mutateGraph(COURSES, 3, (g) => (g.nodes[3].state = "done"))).toMatch(
      /digraph's nodes doesn't match/,
    );
    expect(mutateGraph(COURSES, 1, (g) => (g.edges[0].state = "idle"))).toMatch(
      /digraph's edges doesn't match/,
    );
    expect(mutateGraph(DELAY, 5, (g) => (g.edges[2].weight = 1))).toMatch(/digraph's edges doesn't match/);
  });

  it("rejects wrong parents, sizes, finds, compression, union, or shared root", () => {
    expect(mutateForest(PATH, 4, () => {})).toBe("");
    // Union by size: root 0 pointing at root 3 is the wrong way round.
    expect(
      mutateForest(PATH, 3, (f) => {
        f.parents = [3, 0, 0, 3, 3, 5];
        f.union = { child: 0, parent: 3 };
      }),
    ).toMatch(/union-find's parents doesn't match/);
    expect(mutateForest(PATH, 3, (f) => (f.sizes![0] = 4))).toMatch(/union-find's sizes doesn't match/);
    // The query without path halving: 4 still points at 3.
    expect(
      mutateForest(PATH, 4, (f) => {
        f.parents = [0, 0, 0, 0, 3, 5];
        f.compressed = undefined;
      }),
    ).toMatch(/union-find's compressed doesn't match/);
    expect(mutateForest(LOOP, 3, (f) => (f.same = undefined))).toMatch(/union-find's same doesn't match/);
  });

  it("schema: finds follow parent links, a union joins two roots, edges join real nodes", () => {
    expect(mutateForest(LOOP, 3, (f) => (f.finds = [{ path: [0, 2, 3] }, { path: [3] }]))).toMatch(
      /a find follows parent links up to a root/,
    );
    expect(mutateForest(PATH, 1, (f) => (f.union = { child: 2, parent: 1 }))).toMatch(
      /a union points one root at another root/,
    );
    expect(mutateGraph(COURSES, 1, (g) => g.edges.push({ from: 0, to: 9, state: "idle" }))).toMatch(
      /every edge joins two different nodes/,
    );
    expect(mutateGraph(COURSES, 1, (g) => g.edges.push({ ...g.edges[0] }))).toMatch(
      /an edge can't appear twice/,
    );
  });

  it("an unbound graph is as given (or as it ends); an unbound union-find shows every element alone", () => {
    const sb = source(COURSES);
    expect(issues(sb)).toBe("");
    const el = sb.scenes[0].elements.find((e) => e.type === "digraph") as Record<string, unknown>;
    Object.assign(el, structuredClone(traceFor(COURSES).trace.steps[1].network!));
    expect(issues(sb)).toMatch(/Without a traceStep, the digraph is the graph as given/);

    const uf = source(PATH);
    const forest = uf.scenes[0].elements.find((e) => e.type === "union-find") as Record<string, unknown>;
    Object.assign(forest, {
      labels: ["0", "1", "2", "3", "4", "5"],
      parents: [0, 0, 2, 3, 4, 5],
      sizes: [2, 1, 1, 1, 1, 1],
    });
    expect(issues(uf)).toMatch(/Without a traceStep, the union-find shows every element alone/);
  });
});
