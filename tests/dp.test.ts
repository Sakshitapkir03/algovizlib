import { describe, expect, it } from "vitest";

import { getProblem } from "@/lib/catalog/repository";
import { assembleStoryboard, evaluateDraft, type GenerationContext } from "@/lib/generation/draft";
import { resolveStoryboard, storyboardSourceSchema, validateStoryboard } from "@/lib/storyboard";
import { getTraceDefinition } from "@/lib/traces";
import { PHONE_PLAYER_WIDTH, textMetrics } from "@/video/text";

import { dpProblems } from "@/video/fit/dp";
import { buildDraft, traceFor } from "./fixtures/drafts";
import { treeProblems } from "@/video/fit/tree";

const DPS = [
  "dynamic-programming/climbing-stairs",
  "dynamic-programming/house-robber",
  "dynamic-programming/coin-change",
  "dynamic-programming/longest-common-subsequence",
  "dynamic-programming/edit-distance",
];

describe("DP traces", () => {
  it.each(DPS)("%s fills one cell per step from cells already filled, and ends on the answer cell", (key) => {
    const { trace } = traceFor(key);
    expect(trace.steps.filter((s) => s.key).length + 3).toBeLessThanOrEqual(10);
    let before: (number | string | null)[][] | undefined;
    for (const step of trace.steps) {
      const table = step.table!;
      if (table.current && before) {
        const [r, c] = table.current;
        // Only the current cell changed, and everything it reads was filled already.
        for (const read of table.reads ?? []) expect(before?.[read.at[0]][read.at[1]]).not.toBeNull();
        const changed = table.cells.flatMap((row, i) =>
          row.flatMap((v, j) => (before && before[i][j] !== v ? [[i, j]] : [])),
        );
        expect(changed).toEqual([[r, c]]);
        for (const k of table.chosen ?? []) expect(k).toBeLessThan(table.reads!.length);
      }
      before = table.cells;
    }
    const last = trace.steps.at(-1)!.table!;
    expect(last.answer).toBeDefined();
    expect(String(last.cells[last.answer![0]][last.answer![1]])).toBe(trace.answerDisplay);
  });

  it("Climbing Stairs: the recursion repeats calls; the memoized version skips everything under a repeat", () => {
    const { trace } = traceFor("dynamic-programming/climbing-stairs");
    const nodes = trace.tree!.nodes;
    const [plain, memo] = trace.steps;
    expect(nodes).toHaveLength(15);
    // ways(4) is asked twice and ways(3) three times in the top four levels.
    expect(nodes.filter((n) => n.value === 4)).toHaveLength(2);
    expect(plain.tree!.repeats!.map((id) => nodes[id].value).sort()).toContain(4);
    expect(memo.tree!.repeats!.map((id) => nodes[id].value).sort()).toEqual([3, 4]);
    for (const id of memo.tree!.skipped!) expect(memo.tree!.repeats).not.toContain(id);
    // Each cell reads the two before it.
    const six = trace.steps.at(-1)!;
    expect(six.table!.reads!.map((r) => r.at[1])).toEqual([5, 4]);
    expect(six.climb).toEqual({
      at: 6,
      hops: [
        { from: 5, to: 6 },
        { from: 4, to: 6 },
      ],
    });
  });

  it("House Robber: skip winning is neutral; the plan never takes two neighbors", () => {
    const { trace } = traceFor("dynamic-programming/house-robber");
    const skip = trace.steps.find((s) => s.kind === "skip")!;
    expect(skip.equation).toMatchObject({
      terms: [3, 4],
      result: 7,
      comparison: { op: "<", target: 10 },
      tone: "neutral",
    });
    for (const step of trace.steps) {
      const taken = step.houses!.taken;
      expect(taken.some((i) => taken.includes(i + 1))).toBe(false);
    }
    expect(trace.steps.at(-1)!.houses!.taken).toEqual([1, 4]);
  });

  it("Coin Change: 8 is two 4s, beating the greedy 5 + 1 + 1 + 1", () => {
    const { trace } = traceFor("dynamic-programming/coin-change");
    const eight = trace.steps.at(-1)!;
    expect(eight.table!.choice).toBe("coin 4");
    expect(eight.table!.reads!.map((r) => r.label)).toEqual(["coin 1", "coin 4", "coin 5"]);
    expect(eight.table!.cells[0]).toEqual([0, 1, 2, 3, 1, 1, 2, 3, 2]);
  });

  it("Edit Distance and LCS fill row by row, labeling every option", () => {
    const edit = traceFor("dynamic-programming/edit-distance").trace;
    const order = edit.steps.flatMap((s) => (s.table!.current ? [s.table!.current] : []));
    expect(order.slice(0, 4)).toEqual([
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 1],
    ]);
    expect(edit.steps.find((s) => s.kind === "replace")!.table!.reads!.map((r) => r.label)).toEqual([
      "delete",
      "insert",
      "replace",
    ]);
    const lcs = traceFor("dynamic-programming/longest-common-subsequence").trace;
    expect(lcs.dp!.rowHeaders).toEqual(["", "s", "t", "o", "n", "e"]);
    expect(lcs.steps.filter((s) => s.kind === "match").map((s) => s.table!.current)).toContainEqual([5, 4]);
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
    patternName: "Dynamic Programming",
    definition: getTraceDefinition(key)!,
    args: traceFor(key).args,
  };
}

describe("DP storyboards", () => {
  it.each(DPS)("%s: a fixture draft passes, and fits at phone and full size", (key) => {
    const result = evaluateDraft(buildDraft(key), context(key), META);
    expect(result.issues).toEqual([]);
    if (!result.ok) return;
    for (const width of [PHONE_PLAYER_WIDTH, 1280]) {
      const t = textMetrics(width);
      for (const scene of result.storyboard.scenes) {
        expect(dpProblems(scene.elements, t), `${scene.id} at ${width}`).toEqual([]);
        expect(treeProblems(scene.elements, t, 720), `${scene.id} tree at ${width}`).toEqual([]);
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
  const mutate = (key: string, step: number, type: string, change: (el: Record<string, unknown>) => void) => {
    const sb = source(key);
    const scene = sb.scenes.find((s) => s.traceStep === step)! as SceneSource;
    change(scene.elements.find((e) => e.type === type) as Record<string, unknown>);
    return issues(sb);
  };
  const stairs = "dynamic-programming/climbing-stairs";
  const robber = "dynamic-programming/house-robber";
  const edit = "dynamic-programming/edit-distance";

  it("the fixture sources resolve and validate", () => {
    for (const key of [stairs, robber, edit]) expect(issues(source(key))).toBe("");
  });

  it("rejects a wrong cell value, reads, winning option, choice, and answer cell", () => {
    const cells = structuredClone(traceFor(stairs).trace.steps[3].table!.cells);
    cells[0][2] = 3;
    expect(mutate(stairs, 3, "dp-table", (t) => (t.cells = cells))).toMatch(/table's cells doesn't match/);
    expect(
      mutate(
        stairs,
        3,
        "dp-table",
        (t) =>
          (t.reads = [
            { at: [0, 1], label: "1 step" },
            { at: [0, 1], label: "2 steps" },
          ]),
      ),
    ).toMatch(/table's reads doesn't match/);
    expect(mutate(edit, 1, "dp-table", (t) => (t.chosen = [0]))).toMatch(/table's chosen doesn't match/);
    expect(mutate(edit, 1, "dp-table", (t) => (t.choice = "delete"))).toMatch(/table's choice doesn't match/);
    expect(mutate(stairs, 3, "dp-table", (t) => (t.answer = [0, 2]))).toMatch(/table's answer doesn't match/);
  });

  it("rejects a wrong climber or hop, and a wrong plan on the street", () => {
    expect(mutate(stairs, 3, "staircase", (s) => (s.at = 1))).toMatch(/climber or hops don't match/);
    expect(mutate(stairs, 3, "staircase", (s) => (s.hops = [{ from: 1, to: 2 }]))).toMatch(
      /climber or hops don't match/,
    );
    expect(mutate(robber, 2, "house-row", (h) => (h.taken = [0, 2]))).toMatch(/street's plan doesn't match/);
    // Two neighbors taken breaks the rule itself.
    expect(mutate(robber, 2, "house-row", (h) => (h.taken = [1, 2]))).toMatch(/two neighboring houses/);
  });

  it("rejects a recursion tree without its repeats, and a filled table in an unbound scene", () => {
    expect(mutate(stairs, 0, "binary-tree", (t) => (t.repeats = []))).toMatch(/tree's repeats doesn't match/);
    const sb = source(stairs);
    const intro = sb.scenes[0].elements.find((e) => e.type === "dp-table") as Record<string, unknown>;
    intro.cells = [[1, 1, null, null, null, null, null]];
    expect(issues(sb)).toMatch(/Without a traceStep, the table is empty/);
  });
});
