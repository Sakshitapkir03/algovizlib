import { describe, expect, it } from "vitest";

import { getProblem } from "@/lib/catalog/repository";
import { assembleStoryboard, evaluateDraft, type GenerationContext } from "@/lib/generation/draft";
import { resolveStoryboard, storyboardSourceSchema, validateStoryboard } from "@/lib/storyboard";
import { getTraceDefinition, runTrace } from "@/lib/traces";
import { buildTree, treeArgs } from "@/lib/traces/trees-dfs/shared";
import { layoutScene } from "@/video/layout";
import { PHONE_PLAYER_WIDTH, textMetrics } from "@/video/text";

import { buildDraft, traceFor } from "./fixtures/drafts";
import { treeProblems } from "./fixtures/tree-fit";

const TREES = [
  "trees-dfs/maximum-depth-of-binary-tree",
  "trees-dfs/path-sum",
  "trees-dfs/validate-binary-search-tree",
  "trees-dfs/count-good-nodes-in-binary-tree",
  "trees-dfs/binary-tree-maximum-path-sum",
];

describe("tree traces", () => {
  it("build trees with level-order ids, skipping missing children", () => {
    expect(buildTree([5, 2, 8, null, 4, 7, 9, null, null, 1])).toEqual([
      { id: 0, value: 5, left: 1, right: 2 },
      { id: 1, value: 2, left: null, right: 3 },
      { id: 2, value: 8, left: 4, right: 5 },
      { id: 3, value: 4, left: null, right: null },
      { id: 4, value: 7, left: 6, right: null },
      { id: 5, value: 9, left: null, right: null },
      { id: 6, value: 1, left: null, right: null },
    ]);
    expect(buildTree([])).toEqual([]);
    // More than 4 levels or 8 nodes won't fit on screen.
    expect(treeArgs.safeParse([1, 2, null, 3, null, 4, null, 5]).success).toBe(false);
    expect(treeArgs.safeParse([1, 2, 3, 4, 5, 6, 7, 8, 9]).success).toBe(false);
  });

  it.each(TREES)("%s records the walk: stack, open path, finished calls, and returns", (key) => {
    const { trace } = traceFor(key);
    expect(trace.row.display).toBe("tree");
    expect(trace.steps.filter((s) => s.key).length + 3).toBeLessThanOrEqual(10);
    expect(trace.steps.at(-1)!.key).toBe(true);
    for (const step of trace.steps) {
      const walk = step.tree!;
      const stack = step.stack!;
      // The stack's real frames are the open path (plus a returning node's own frame).
      const real = stack.filter((f) => f.node !== null).map((f) => f.node);
      const returning = stack.at(-1)?.returns !== undefined && stack.at(-1)!.node !== null;
      expect(real).toEqual(returning ? [...walk.path, walk.current] : walk.path);
      // Only the top frame can be returning; every frame under it waits on a child.
      stack.slice(0, -1).forEach((f) => {
        expect(f.returns).toBeUndefined();
        expect(f.waiting).toBeDefined();
      });
      expect(stack.at(-1)?.waiting).toBeUndefined();
      // A finished node is never on the open path, and every finished call has a result.
      for (const id of walk.done) {
        expect(walk.path).not.toContain(id);
        expect(walk.results?.some((r) => r.node === id)).toBe(true);
      }
      // A value handed up goes to the caller, which is waiting on that side.
      if (walk.returned) {
        const caller = stack.at(-2);
        expect(caller?.node).toBe(walk.returned.to);
        expect(caller?.waiting).toBe(walk.returned.side);
        expect(stack.at(-1)?.returns).toBe(walk.returned.value);
      }
      if (walk.nullVisit) {
        expect(stack.at(-1)?.node).toBeNull();
        expect(trace.tree!.nodes[walk.nullVisit.parent][walk.nullVisit.side]).toBeNull();
      }
    }
  });

  it("Path Sum and Validate BST exit early and skip the rest of the tree", () => {
    const path = traceFor("trees-dfs/path-sum").trace;
    expect(path.steps.at(-1)!.tree!.skipped).toEqual([2, 5]); // 9 and 2 are never visited
    expect(path.steps.at(-1)!.found).toEqual([0, 1, 4]); // 6 → 3 → 4
    const bst = traceFor("trees-dfs/validate-binary-search-tree").trace;
    expect(bst.answer).toBe(false);
    expect(bst.steps.at(-1)!.tree!.skipped).toEqual([2]); // 15
    expect(bst.steps.find((s) => s.kind === "outside")!.equation).toMatchObject({
      result: 12,
      comparison: { op: ">", target: 10 },
      tone: "negative",
    });
  });

  it("Maximum Path Sum drops a negative chain and finds 3 → 5 → 4", () => {
    const { trace } = traceFor("trees-dfs/binary-tree-maximum-path-sum");
    const root = trace.steps.at(-1)!;
    expect(root.equation).toMatchObject({
      terms: [0, 2, 9],
      result: 11,
      comparison: { op: "<", target: 12 },
    });
    expect(root.equation!.tone).toBe("neutral");
    expect(root.found).toEqual([2, 3, 4]);
    expect(trace.answer).toBe(12);
  });

  it("Count Good Nodes reads a not-good node as neutral, not bad news", () => {
    const { trace } = traceFor("trees-dfs/count-good-nodes-in-binary-tree");
    const notGood = trace.steps.find((s) => s.kind === "not-good")!;
    expect(notGood.equation).toMatchObject({ comparison: { op: "<" }, tone: "neutral" });
    expect(trace.steps.at(-1)!.counter).toEqual({ value: 4 });
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
    patternName: "Trees (DFS)",
    definition: getTraceDefinition(key)!,
    args: traceFor(key).args,
  };
}

describe("tree storyboards", () => {
  it.each(TREES)("%s: a fixture draft passes, and fits at phone and full size", (key) => {
    const result = evaluateDraft(buildDraft(key), context(key), META);
    expect(result.issues).toEqual([]);
    if (!result.ok) return;
    for (const width of [PHONE_PLAYER_WIDTH, 1280]) {
      const t = textMetrics(width);
      for (const scene of result.storyboard.scenes) {
        const { bottomTop } = layoutScene(scene.elements, t);
        expect(treeProblems(scene.elements, t, bottomTop), `${scene.id} at ${width}`).toEqual([]);
      }
    }
  });

  type Source = ReturnType<typeof assembleStoryboard>;
  type SceneSource = Source["scenes"][number];
  const source = (key: string): Source =>
    structuredClone(assembleStoryboard(buildDraft(key), context(key), META));

  const mutate = (key: string, change: (scene: SceneSource) => void) => {
    const sb = source(key);
    // Node 2 returning 2 to the root (step 7).
    const scene = sb.scenes.find((s) => s.traceStep === 7)!;
    change(scene);
    const { storyboard, issues } = resolveStoryboard(storyboardSourceSchema.parse(sb));
    return [...issues, ...(storyboard ? validateStoryboard(storyboard).issues : [])].map((i) => i.message);
  };
  const tree = (scene: SceneSource) =>
    scene.elements.find((e) => e.type === "binary-tree") as Record<string, unknown>;
  const stack = (scene: SceneSource) =>
    scene.elements.find((e) => e.type === "call-stack") as Record<string, unknown>;
  const key = "trees-dfs/maximum-depth-of-binary-tree";

  it("the fixture source resolves and validates", () => {
    expect(mutate(key, () => {})).toEqual([]);
  });

  it("rejects a wrong tree shape", () => {
    const nodes = runTrace(key, traceFor(key).args).tree!.nodes.map((n) => ({ ...n }));
    [nodes[1].left, nodes[1].right] = [nodes[1].right, nodes[1].left];
    expect(mutate(key, (s) => (tree(s).nodes = nodes)).join("\n")).toMatch(/tree's nodes don't match/);
  });

  it("rejects a wrong running call, open path, finished set, and returned value", () => {
    expect(mutate(key, (s) => (tree(s).current = 6)).join("\n")).toMatch(/tree's current doesn't match/);
    expect(mutate(key, (s) => (tree(s).path = [0, 1])).join("\n")).toMatch(/tree's path doesn't match/);
    expect(mutate(key, (s) => (tree(s).done = [0, 1])).join("\n")).toMatch(/tree's done doesn't match/);
    expect(mutate(key, (s) => (tree(s).returned = { to: 0, side: "left", value: "9" })).join("\n")).toMatch(
      /tree's returned doesn't match/,
    );
    expect(mutate(key, (s) => (tree(s).results = [{ node: 0, value: "9" }])).join("\n")).toMatch(
      /tree's results doesn't match/,
    );
  });

  it("rejects a wrong call stack and a wrong push count", () => {
    expect(mutate(key, (s) => (stack(s).frames = [{ label: "depth(5)", node: 0 }])).join("\n")).toMatch(
      /call stack doesn't match/,
    );
    expect(mutate(key, (s) => (stack(s).kept = 0)).join("\n")).toMatch(/kept must count|kept from nowhere/);
  });

  it("rejects a call stack in an unbound scene and a walk on an unbound tree", () => {
    const sb = source(key);
    sb.scenes[0].elements.push({ id: "stack", type: "call-stack", enterAt: 0, frames: [] } as never);
    (sb.scenes[1].elements[0] as Record<string, unknown>).path = [0];
    const { storyboard } = resolveStoryboard(storyboardSourceSchema.parse(sb));
    const messages = validateStoryboard(storyboard!)
      .issues.map((i) => i.message)
      .join("\n");
    expect(messages).toMatch(/call-stack needs the scene to set traceStep/);
    expect(messages).toMatch(/Without a traceStep, the tree is drawn bare/);
  });

  it("schema rejects a missing child that isn't missing and a node with two parents", () => {
    const sb = source(key);
    const scene = sb.scenes.find((s) => s.traceStep !== undefined)!;
    tree(scene).nullVisit = { parent: 0, side: "left" };
    expect(
      resolveStoryboard(storyboardSourceSchema.parse(sb))
        .issues.map((i) => i.message)
        .join("\n"),
    ).toMatch(/has a left child/);
    const nodes = runTrace(key, traceFor(key).args).tree!.nodes.map((n) => ({ ...n }));
    nodes[2].left = 3;
    const sb2 = source(key);
    tree(sb2.scenes[0]).nodes = nodes;
    expect(
      resolveStoryboard(storyboardSourceSchema.parse(sb2))
        .issues.map((i) => i.message)
        .join("\n"),
    ).toMatch(/exactly one node's child/);
  });
});
