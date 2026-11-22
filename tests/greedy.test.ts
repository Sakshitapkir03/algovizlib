import { describe, expect, it } from "vitest";

import { getProblem } from "@/lib/catalog/repository";
import { assembleStoryboard, evaluateDraft, type GenerationContext } from "@/lib/generation/draft";
import { resolveStoryboard, storyboardSourceSchema, validateStoryboard } from "@/lib/storyboard";
import { getTraceDefinition, runTrace } from "@/lib/traces";
import { layoutScene } from "@/video/layout";
import { PHONE_PLAYER_WIDTH, textMetrics } from "@/video/text";

import { buildDraft, traceFor } from "./fixtures/drafts";
import { greedyProblems } from "./fixtures/greedy-fit";

const GREEDY = [
  "greedy/lemonade-change",
  "greedy/jump-game",
  "greedy/gas-station",
  "greedy/partition-labels",
  "greedy/candy",
];

describe("greedy traces", () => {
  it.each(GREEDY)("%s: fits a 10-scene video, and every key decision records a choice", (key) => {
    const { trace } = traceFor(key);
    expect(trace.steps.filter((s) => s.key).length + 3).toBeLessThanOrEqual(10);
    expect(trace.steps.at(-1)!.key).toBe(true);
    // Every step that turns an option down says what it took instead.
    for (const step of trace.steps)
      if (step.choice?.rejected) expect(step.choice.chosen).not.toBe(step.choice.rejected);
    expect(trace.steps.some((s) => s.key && s.choice?.rejected)).toBe(true);
  });

  it("Lemonade Change pays the $20 with $10 + $5, which leaves a $5 for the last $10", () => {
    const { trace } = traceFor("greedy/lemonade-change");
    const twenty = trace.steps.find((s) => s.equation?.terms[0] === 20)!;
    expect(twenty.choice).toEqual({ chosen: "$10 + $5", rejected: "$5 + $5 + $5" });
    expect(twenty.freq!.entries).toEqual([
      { key: "$5", count: 2 },
      { key: "$10", count: 0 },
    ]);
    // Three $5s would have left 0 + 1 ten: the last $10 customer would get nothing.
    expect(trace.steps.at(-1)!.freq!.entries[0].count).toBe(1);
    expect(trace.answer).toBe(true);
  });

  it("Jump Game keeps one number, the reach, and passes the 0 because the reach already covers it", () => {
    const { trace } = traceFor("greedy/jump-game");
    expect(trace.steps.map((s) => s.reach!.value)).toEqual([3, 3, 3, 5]);
    const zero = trace.steps[2];
    expect(zero.kind).toBe("keep");
    expect(zero.reach!.jump).toBeUndefined();
    expect(trace.steps.at(-1)!.reach!.to).toBe(4);
    expect(trace.answer).toBe(true);
  });

  it("Jump Game stops where the reach ends when the last index is out of reach", () => {
    const stuck = runTrace("greedy/jump-game", [[2, 1, 1, 0, 5]]);
    expect(stuck.answer).toBe(false);
    expect(stuck.steps.at(-1)).toMatchObject({ kind: "stuck", rejected: [4], reach: { to: 3 } });
  });

  it("Gas Station rules out every stop up to where the tank ran dry, then restarts empty", () => {
    const { trace } = traceFor("greedy/gas-station");
    const dry = trace.steps.find((s) => s.kind === "dry")!;
    expect(dry.counter).toEqual({ value: -1, delta: -3 });
    expect(dry.rejected).toEqual([0, 1, 2]);
    const restart = trace.steps.find((s) => s.kind === "restart")!;
    expect(restart.pointers).toEqual({ start: 3 });
    expect(restart.counter).toEqual({ value: 0 });
    expect(restart.choice).toEqual({ chosen: "start at 3", rejected: "start at 1–2" });
    expect(trace.steps.at(-1)!.equation).toMatchObject({ terms: [12, 12], result: 0, tone: "positive" });
    expect(trace.answer).toBe(3);
  });

  it("Partition Labels stretches each piece to its letters' last positions and cuts as early as possible", () => {
    const { trace } = traceFor("greedy/partition-labels");
    const cuts = trace.steps.filter((s) => s.kind === "cut").map((s) => s.pointers.i);
    expect(cuts).toEqual([2, 5, 9]);
    expect(trace.steps.at(-1)!.reach!.pieces).toEqual([
      { from: 0, to: 2 },
      { from: 3, to: 5 },
      { from: 6, to: 9 },
    ]);
    expect(trace.steps[0].reach!.jump).toEqual({ from: 0, to: 2, label: "last a" });
    expect(trace.answer).toEqual([3, 3, 4]);
  });

  it("Candy takes the larger of the two one-sided counts, raising the child the right rule needs", () => {
    const { trace } = traceFor("greedy/candy");
    const raise = trace.steps.find((s) => s.kind === "right-raise")!;
    expect(raise.pointers.i).toBe(3);
    expect(raise.choice).toEqual({ chosen: "2: both rules", rejected: "1: left only" });
    expect(trace.steps.at(-1)!.table!.cells).toEqual([
      [1, 2, 1, 1, 1],
      [1, 2, 1, 2, 1],
    ]);
    expect(trace.answer).toBe(7);
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
    patternName: "Greedy",
    definition: getTraceDefinition(key)!,
    args: traceFor(key).args,
  };
}

describe("greedy storyboards", () => {
  it.each(GREEDY)(
    "%s: a fixture draft passes, and its choices and reaches fit at phone and full size",
    (key) => {
      const result = evaluateDraft(buildDraft(key), context(key), META);
      expect(result.issues).toEqual([]);
      if (!result.ok) return;
      for (const width of [PHONE_PLAYER_WIDTH, 1280])
        for (const scene of result.storyboard.scenes) {
          const t = textMetrics(width);
          expect(greedyProblems(scene.elements, t), `${scene.id} at ${width}`).toEqual([]);
          const { rows, bottomTop } = layoutScene(scene.elements, t);
          for (const row of Object.values(rows))
            expect(row.top + row.cardHeight, `${scene.id} at ${width}`).toBeLessThanOrEqual(bottomTop);
        }
    },
  );

  type Source = ReturnType<typeof assembleStoryboard>;
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
    const scene = sb.scenes.find((s) => s.traceStep === step)!;
    change(scene.elements.find((e) => e.type === type) as Record<string, unknown>);
    return issues(sb);
  };

  it("the fixture sources resolve and validate", () => {
    for (const key of GREEDY) expect(issues(source(key)), key).toBe("");
  });

  it("rejects a choice that isn't the step's", () => {
    // The $20 is step 5: it takes $10 + $5.
    expect(
      mutate("greedy/lemonade-change", 5, "choice", (c) => {
        c.chosen = "$5 + $5 + $5";
        c.rejected = "$10 + $5";
      }),
    ).toMatch(/choice's chosen option doesn't match/);
    expect(mutate("greedy/lemonade-change", 5, "choice", (c) => delete c.rejected)).toBe("");
    expect(mutate("greedy/lemonade-change", 5, "choice", (c) => (c.rejected = "nothing"))).toMatch(
      /choice's rejected option doesn't match/,
    );
  });

  it("rejects a wrong reach, jump, or pieces", () => {
    expect(mutate("greedy/jump-game", 0, "reach", (r) => (r.to = 4))).toMatch(/reach's range doesn't match/);
    expect(mutate("greedy/jump-game", 0, "reach", (r) => (r.jump = { from: 0, to: 2, label: "+2" }))).toMatch(
      /reach's jump doesn't match/,
    );
    expect(mutate("greedy/partition-labels", 5, "reach", (r) => (r.pieces = [{ from: 0, to: 2 }]))).toMatch(
      /reach's pieces doesn't match/,
    );
  });

  it("schema: a reach covers an item-row in range, pieces don't overlap, one choice per scene", () => {
    expect(mutate("greedy/jump-game", 0, "reach", (r) => (r.rowId = "nope"))).toMatch(
      /A reach covers an item-row in the same scene/,
    );
    expect(
      mutate(
        "greedy/partition-labels",
        9,
        "reach",
        (r) =>
          (r.pieces = [
            { from: 0, to: 4 },
            { from: 3, to: 9 },
          ]),
      ),
    ).toMatch(/pieces go left to right without overlapping/);
    const sb = source("greedy/gas-station");
    const scene = sb.scenes.find((s) => s.elements.some((e) => e.type === "choice"))!;
    scene.elements.push({ ...scene.elements.find((e) => e.type === "choice")!, id: "choice2" });
    expect(issues(sb)).toMatch(/only one choice/);
  });

  it("a reach needs a bound step; an unbound choice (the slow-way contrast) is free text", () => {
    const sb = source("greedy/jump-game");
    sb.scenes[1].elements.push({
      id: "c",
      type: "choice",
      chosen: "one pass",
      rejected: "every route",
      enterAt: 0,
    } as never);
    expect(issues(sb)).toBe("");
    sb.scenes[1].elements.push({ id: "r", type: "reach", rowId: "row", from: 0, to: 2, enterAt: 0 } as never);
    expect(issues(sb)).toMatch(/A reach needs the scene to set traceStep/);
  });
});
