import { describe, expect, it } from "vitest";

import { getProblem } from "@/lib/catalog/repository";
import { assembleStoryboard, evaluateDraft, type GenerationContext } from "@/lib/generation/draft";
import { resolveStoryboard, storyboardSourceSchema, validateStoryboard } from "@/lib/storyboard";
import { getTraceDefinition } from "@/lib/traces";
import { layoutScene } from "@/video/layout";
import { PHONE_PLAYER_WIDTH, textMetrics } from "@/video/text";

import { buildDraft, traceFor } from "./fixtures/drafts";
import { prefixProblems } from "./fixtures/prefix-fit";

const PREFIX = [
  "prefix-sum/find-pivot-index",
  "prefix-sum/range-sum-queries",
  "prefix-sum/subarray-sum-equals-k",
  "prefix-sum/product-of-array-except-self",
  "prefix-sum/submatrices-that-sum-to-target",
];

describe("prefix-sum traces", () => {
  it.each(PREFIX)("%s: fits a 10-scene video, and every span is the difference of its two cells", (key) => {
    const { trace } = traceFor(key);
    expect(trace.steps.filter((s) => s.key).length + 3).toBeLessThanOrEqual(10);
    expect(trace.steps.at(-1)!.key).toBe(true);
    for (const step of trace.steps)
      for (const row of step.prefix ?? []) {
        if (row.op !== "+") continue;
        for (const sp of row.spans ?? []) {
          const [a, b] = [row.values[sp.from]!, row.values[sp.to]!];
          expect(sp.value).toBe(row.direction === "prefix" ? b - a : a - b);
        }
      }
  });

  it("prefix cell i holds the total of the items before boundary i", () => {
    const { trace } = traceFor("prefix-sum/range-sum-queries");
    const nums = trace.row.values as number[];
    const built = trace.steps.filter((s) => s.kind === "build").at(-1)!.prefix![0].values;
    expect(built).toEqual(nums.reduce((acc, v) => [...acc, acc.at(-1)! + v], [0]));
    const queries = trace.steps.filter((s) => s.kind === "query");
    expect(queries.map((s) => s.prefix![0].spans![0])).toEqual([
      { from: 0, to: 3, value: 6 },
      { from: 1, to: 4, value: 8 },
      { from: 4, to: 5, value: 2 },
      { from: 0, to: 5, value: 14 },
    ]);
    expect(queries[1].equation).toMatchObject({ terms: [12, 4], operator: "-", result: 8 });
  });

  it("Find Pivot Index compares the two sides from three cells, and stops at the first balance", () => {
    const { trace } = traceFor("prefix-sum/find-pivot-index");
    const pivot = trace.steps.at(-1)!;
    expect(pivot.kind).toBe("pivot");
    expect(pivot.prefix![0].spans).toEqual([
      { from: 0, to: 2, value: 4 },
      { from: 3, to: 5, value: 4 },
    ]);
    expect(pivot.equation).toMatchObject({ comparison: { op: "=", target: 4 }, tone: "positive" });
    expect(trace.answer).toBe(2);
  });

  it("Subarray Sum Equals K looks up prefix − k in a map seeded with {0: 1}", () => {
    const { trace } = traceFor("prefix-sum/subarray-sum-equals-k");
    expect(trace.steps[0].map!.entries).toEqual([{ key: "0", value: "1" }]);
    const first = trace.steps.find((s) => s.kind === "found")!;
    expect(first.map!.lookup).toEqual({ key: "0", found: true });
    expect(first.prefix![0].spans).toEqual([{ from: 0, to: 2, value: 3 }]);
    expect(trace.steps.at(-1)!.counter!.value).toBe(5);
  });

  it("Product of Array Except Self multiplies the two cells on either side of each item", () => {
    const { trace } = traceFor("prefix-sum/product-of-array-except-self");
    for (const step of trace.steps.filter((s) => s.kind === "right")) {
      const i = step.pointers.i;
      const [left, right] = step.prefix!;
      expect(step.equation!.result).toBe(left.values[i]! * right.values[i + 1]!);
    }
    expect(trace.answer).toEqual([60, 40, 30, 24]);
  });

  it("Submatrices builds the prefix grid by inclusion-exclusion and answers strips as differences", () => {
    const { trace } = traceFor("prefix-sum/submatrices-that-sum-to-target");
    const full = trace.steps.find((s) => s.kind === "build" && s.key)!.prefixGrid!;
    expect(full.prefix).toEqual([
      [0, 0, 0],
      [0, 1, 3],
      [0, 4, 10],
    ]);
    expect(full.rects.map((r) => r.sign)).toEqual(["+", "+", "+", "−"]);
    const found = trace.steps.filter((s) => s.kind === "found").map((s) => s.prefixGrid!.found);
    expect(found).toEqual([
      { r1: 0, c1: 0, r2: 0, c2: 1 },
      { r1: 1, c1: 0, r2: 1, c2: 0 },
    ]);
    expect(trace.answer).toBe(2);
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
    patternName: "Prefix Sum",
    definition: getTraceDefinition(key)!,
    args: traceFor(key).args,
  };
}

describe("prefix-sum storyboards", () => {
  it.each(PREFIX)("%s: a fixture draft passes and fits at phone and full size", (key) => {
    const result = evaluateDraft(buildDraft(key), context(key), META);
    expect(result.issues).toEqual([]);
    if (!result.ok) return;
    for (const width of [PHONE_PLAYER_WIDTH, 1280])
      for (const scene of result.storyboard.scenes) {
        const t = textMetrics(width);
        expect(prefixProblems(scene.elements, t), `${scene.id} at ${width}`).toEqual([]);
        const { rows, bottomTop } = layoutScene(scene.elements, t);
        for (const row of Object.values(rows))
          expect(row.top + row.cardHeight, `${scene.id} at ${width}`).toBeLessThanOrEqual(bottomTop);
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
  const mutate = (key: string, step: number, type: string, change: (el: Record<string, unknown>) => void) => {
    const sb = source(key);
    const scene = sb.scenes.find((s) => s.traceStep === step)!;
    change(scene.elements.find((e) => e.type === type) as Record<string, unknown>);
    return issues(sb);
  };
  const RANGE = "prefix-sum/range-sum-queries";

  it("the fixture sources resolve and validate", () => {
    for (const key of PREFIX) expect(issues(source(key)), key).toBe("");
  });

  it("rejects a wrong prefix value, current cell, read, or span", () => {
    // Step 4 builds the last cell (14); step 6 answers [1, 3] as 12 − 4.
    expect(
      mutate(RANGE, 4, "prefix-row", (r) => {
        r.op = "+";
        r.direction = "prefix";
        r.values = [0, 4, 3, 6, 12, 15];
      }),
    ).toMatch(/prefix row's values doesn't match/);
    expect(mutate(RANGE, 4, "prefix-row", (r) => (r.current = 4))).toMatch(
      /prefix row's current doesn't match/,
    );
    expect(mutate(RANGE, 6, "prefix-row", (r) => (r.reads = [1, 3]))).toMatch(
      /prefix row's reads doesn't match/,
    );
    // The off-by-one: [1, 3] is cells 1 and 4, not 1 and 3.
    expect(mutate(RANGE, 6, "prefix-row", (r) => (r.spans = [{ from: 1, to: 3, value: 2 }]))).toMatch(
      /prefix row's spans doesn't match/,
    );
  });

  it("schema: a span is the difference of its cells, and a row has one cell per boundary", () => {
    expect(
      mutate(RANGE, 6, "prefix-row", (r) => {
        r.op = "+";
        r.direction = "prefix";
        r.values = [0, 4, 3, 6, 12, 14];
        r.spans = [{ from: 1, to: 4, value: 9 }];
      }),
    ).toMatch(/the span 1–4 is 12 − 4 = 8, not 9/);
    expect(
      mutate(RANGE, 6, "prefix-row", (r) => {
        r.op = "+";
        r.direction = "prefix";
        r.values = [0, 4, 3, 6, 12];
      }),
    ).toMatch(/one cell per boundary: 6 for 5 items/);
  });

  it("rejects a wrong prefix grid, rectangle, sign, or found rectangle", () => {
    const key = "prefix-sum/submatrices-that-sum-to-target";
    // Step 3 builds the last prefix cell; step 5 finds the top row.
    expect(mutate(key, 3, "prefix-grid", (g) => (g.marks = [{ at: [1, 1], sign: "+" }]))).toMatch(
      /prefix grid's marks doesn't match/,
    );
    expect(
      mutate(key, 3, "prefix-grid", (g) => {
        const rects = g.rects as { sign: string }[];
        if (rects) rects[3] = { ...rects[3], sign: "+" };
        else g.rects = [{ r1: 0, c1: 0, r2: 0, c2: 0, sign: "+" }];
      }),
    ).toMatch(/prefix grid's rects doesn't match/);
    expect(mutate(key, 5, "prefix-grid", (g) => (g.found = { r1: 0, c1: 0, r2: 1, c2: 1 }))).toMatch(
      /prefix grid's found doesn't match/,
    );
    expect(mutate(key, 5, "prefix-grid", (g) => (g.found = { r1: 0, c1: 0, r2: 2, c2: 0 }))).toMatch(
      /rectangles lie inside the 2 × 2 matrix/,
    );
  });

  it("an unbound prefix row is empty, or the final row", () => {
    const sb = source(RANGE);
    sb.scenes[0].elements.push({
      id: "pr",
      type: "prefix-row",
      rowId: "row",
      name: "prefix",
      enterAt: 0,
    } as never);
    expect(issues(sb)).toBe("");
    (sb.scenes[0].elements.at(-1) as Record<string, unknown>).current = 2;
    expect(issues(sb)).toMatch(/Without a traceStep, the prefix row is empty/);
  });
});
