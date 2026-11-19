import { describe, expect, it } from "vitest";

import { getGeneratedStoryboard } from "@/content/storyboards";
import { twoPointersStoryboard } from "@/content/storyboards/two-pointers";
import { getProblem } from "@/lib/catalog/repository";
import {
  assembleStoryboard,
  evaluateDraft,
  type Draft,
  type GenerationContext,
} from "@/lib/generation/draft";
import {
  formatIssue,
  resolveStoryboard,
  storyboardSourceSchema,
  validateStoryboard,
  type BarRowElement,
  type Storyboard,
} from "@/lib/storyboard";
import { getTraceDefinition, runTrace, traceRegistry } from "@/lib/traces";
import { palettes, verdictColor } from "@/video/theme";

import { buildDraft, traceFor } from "./fixtures/drafts";

const META = {
  promptVersion: "test",
  provider: "fake",
  model: "fake",
  generatedAt: "2026-01-01T00:00:00.000Z",
  repairAttempts: 0,
};

function context(problemKey: string): GenerationContext {
  const [pattern, slug] = problemKey.split("/");
  const definition = getTraceDefinition(problemKey)!;
  return {
    problem: getProblem(pattern, slug)!,
    patternName: "Two Pointers",
    definition,
    args: traceFor(problemKey).args,
  };
}

function evaluate(problemKey: string, draft: Draft) {
  return evaluateDraft(draft, context(problemKey), META);
}

const messages = (problemKey: string, draft: Draft) => {
  const result = evaluate(problemKey, draft);
  return result.ok ? [] : result.issues.map(formatIssue);
};

describe.each(Object.keys(traceRegistry))("a correct trace-bound storyboard for %s", (problemKey) => {
  it("resolves every omitted value from the trace and passes the validator", () => {
    expect(messages(problemKey, buildDraft(problemKey))).toEqual([]);
  });
});

describe("resolution", () => {
  it("fills pointers, slides, equations, highlights, fills, and the answer from the bound step", () => {
    const key = "two-pointers/container-with-most-water";
    const source = storyboardSourceSchema.parse(assembleStoryboard(buildDraft(key), context(key), META));
    const { storyboard, issues } = resolveStoryboard(source);
    expect(issues).toEqual([]);
    const second = storyboard!.scenes.find((s) => s.traceStep === 1)!;
    const left = second.elements.find((e) => e.id === "p-left");
    const eq = second.elements.find((e) => e.id === "eq");
    const bars = second.elements.find((e) => e.id === "row");
    expect(left).toMatchObject({ index: 1, fromIndex: 0 });
    expect(eq).toMatchObject({
      terms: [4, 5],
      operator: "×",
      result: 20,
      comparison: { op: ">", target: 10 },
    });
    expect(bars).toMatchObject({ type: "bar-row", fill: { from: 1, to: 5, level: 5 } });
    const answer = storyboard!.scenes.at(-2)!.elements.find((e) => e.id === "result");
    expect(answer).toMatchObject({ value: "20" });
  });
});

describe("the validator rejects", () => {
  const key = "two-pointers/pair-with-target-sum";

  it("a wrong pointer position", () => {
    const draft = buildDraft(key);
    const scene = draft.scenes.find((s) => s.traceStep === 1)!;
    scene.elements = scene.elements.map((e) =>
      e.type === "pointer" && e.binds === "left" ? { ...e, index: 3 } : e,
    );
    expect(messages(key, draft).join("\n")).toMatch(/Pointer "left" should be at 1 in trace step 1, not 3/);
  });

  it("a wrong equation", () => {
    const draft = buildDraft(key);
    const scene = draft.scenes.find((s) => s.traceStep === 0)!;
    scene.elements = scene.elements.map((e) =>
      e.type === "equation" ? { ...e, terms: [4, 46], result: 50, comparison: { op: "=", target: 50 } } : e,
    );
    expect(messages(key, draft).join("\n")).toMatch(/Equation should be 4 \+ 45/);
  });

  it("false arithmetic in a literal equation", () => {
    const draft = buildDraft(key);
    const scene = draft.scenes.find((s) => s.traceStep === 0)!;
    scene.elements = scene.elements.map((e) =>
      e.type === "equation" ? { ...e, terms: [4, 45], result: 50 } : e,
    );
    expect(messages(key, draft).join("\n")).toMatch(/4 \+ 45 is 49, not 50/);
  });

  it("a skipped key decision", () => {
    const draft = buildDraft(key);
    draft.scenes = draft.scenes.filter((s) => s.traceStep !== 2);
    expect(messages(key, draft).join("\n")).toMatch(/Key trace step 2 \(move-left\) is not shown/);
  });

  it("a binding to a step that doesn't exist", () => {
    const draft = buildDraft(key);
    draft.scenes[2].traceStep = 99;
    expect(messages(key, draft).join("\n")).toMatch(/traceStep 99 does not exist/);
  });

  it("scenes that go backwards in the trace", () => {
    const draft = buildDraft(key);
    const i = draft.scenes.findIndex((s) => s.traceStep === 1);
    [draft.scenes[i], draft.scenes[i + 1]] = [draft.scenes[i + 1], draft.scenes[i]];
    expect(messages(key, draft).join("\n")).toMatch(/go backwards/);
  });

  it("a wrong final answer", () => {
    const draft = buildDraft(key);
    const answer = draft.scenes.at(-2)!;
    answer.elements = answer.elements.map((e) => (e.type === "result" ? { ...e, value: "[1, 5]" } : e));
    expect(messages(key, draft).join("\n")).toMatch(/must display exactly "\[2, 5\]"/);
  });

  it("a pointer bound to a name the step doesn't have", () => {
    const tsKey = "two-pointers/three-sum";
    const draft = buildDraft(tsKey);
    const sort = draft.scenes.find((s) => s.traceStep === 0)!;
    sort.elements.push({
      id: "p-left",
      type: "pointer",
      rowId: "row",
      label: "left",
      binds: "left",
      enterAt: 0,
      placement: "below",
      tone: "primary",
    });
    expect(messages(tsKey, draft).join("\n")).toMatch(/has no pointer "left"/);
  });

  it("an analogy on a problem-native problem", () => {
    const rainKey = "two-pointers/trapping-rain-water";
    const draft = {
      ...buildDraft(rainKey),
      exampleSource: "analogy" as const,
      analogy: { scenario: "x", mapping: [{ real: "a", abstract: "b" }] },
    };
    expect(messages(rainKey, draft).join("\n")).toMatch(/already describes a real-world scenario/);
  });

  it("row values that differ from the trace", () => {
    const draft = buildDraft(key);
    const scene = draft.scenes.find((s) => s.traceStep === 0)!;
    scene.elements[0] = {
      id: "row",
      type: "item-row",
      unit: "",
      enterAt: 0,
      items: [1, 2, 3, 4, 5, 6, 7].map((v) => ({ label: String(v), value: v })),
    };
    expect(messages(key, draft).join("\n")).toMatch(/must hold the trace's values/);
  });
});

describe("validateStoryboard on a resolved storyboard", () => {
  it("accepts the fixture and reports the trace-checked issues only once", () => {
    const key = "two-pointers/valid-palindrome";
    const result = evaluate(key, buildDraft(key));
    expect(result.ok).toBe(true);
    if (result.ok) expect(validateStoryboard(result.storyboard).issues).toEqual([]);
  });
});

describe("verdict tone", () => {
  const containerKey = "two-pointers/container-with-most-water";
  const sumKey = "two-pointers/pair-with-target-sum";
  const equationsOf = (storyboard: Storyboard) =>
    storyboard.scenes.flatMap((scene) =>
      scene.elements.flatMap((e) => (e.type === "equation" ? [{ step: scene.traceStep, e }] : [])),
    );

  it("comes from the trace step: a new best is positive, a worse area is neutral", () => {
    const result = evaluate(containerKey, buildDraft(containerKey));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tones = equationsOf(result.storyboard).map(({ e }) => [e.comparison?.op, e.verdictTone]);
    expect(tones).toContainEqual([">", "positive"]);
    expect(tones).toContainEqual(["<", "neutral"]);
  });

  it("stays unset where the trace gives none, so the pair-sum signs keep their colors", () => {
    const result = evaluate(sumKey, buildDraft(sumKey));
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(equationsOf(result.storyboard).every(({ e }) => e.verdictTone === undefined)).toBe(true);
    expect(equationsOf(twoPointersStoryboard).every(({ e }) => e.verdictTone === undefined)).toBe(true);
  });

  it("is rejected when it contradicts the step", () => {
    const draft = buildDraft(containerKey);
    const scene = draft.scenes.find((s) => s.traceStep === 1)!;
    scene.elements = scene.elements.map((e) =>
      e.type === "equation" ? { ...e, verdictTone: "negative" } : e,
    );
    expect(messages(containerKey, draft).join("\n")).toMatch(
      /verdictTone: Trace step 1 reads as positive.*\(expected positive, got negative\)/,
    );
  });

  it("can be set by hand where the step has no tone", () => {
    const draft = buildDraft(sumKey);
    const scene = draft.scenes.find((s) => s.traceStep === 0)!;
    scene.elements = scene.elements.map((e) =>
      e.type === "equation" ? { ...e, verdictTone: "neutral" } : e,
    );
    const result = evaluate(sumKey, draft);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(equationsOf(result.storyboard).find(({ step }) => step === 0)?.e.verdictTone).toBe("neutral");
  });

  it("colors the pill by tone, falling back to the comparison sign", () => {
    const palette = palettes.light;
    const lt = { comparison: { op: "<" as const, target: 50 } };
    const gt = { comparison: { op: ">" as const, target: 50 } };
    const eq = { comparison: { op: "=" as const, target: 50 } };
    expect([lt, gt, eq, {}].map((e) => verdictColor(e, palette))).toEqual([
      palette.info,
      palette.danger,
      palette.success,
      palette.textMuted,
    ]);
    expect(verdictColor({ ...gt, verdictTone: "positive" }, palette)).toBe(palette.success);
    expect(verdictColor({ ...lt, verdictTone: "neutral" }, palette)).toBe(palette.textMuted);
    expect(verdictColor({ ...eq, verdictTone: "negative" }, palette)).toBe(palette.danger);
  });

  it("is derived for the saved Container With Most Water and Trapping Rain Water videos", () => {
    const byVerdict = (problemKey: string) =>
      Object.fromEntries(
        equationsOf(getGeneratedStoryboard(problemKey)!).map(({ e }) => [e.verdict, e.verdictTone]),
      );
    expect(byVerdict(containerKey)).toEqual({ "new best": "positive", "not better": "neutral" });
    expect(byVerdict("two-pointers/trapping-rain-water")).toEqual({
      "no water": "neutral",
      "2 units": "positive",
      "3 units": "positive",
    });
  });
});

describe("sorting primitives", () => {
  const bubble = "sorting/bubble-sort";
  const resolveDraft = (key: string, draft: Draft) => {
    const source = storyboardSourceSchema.parse(assembleStoryboard(draft, context(key), META));
    return resolveStoryboard(source);
  };
  const sceneAt = (draft: Draft, step: number) => draft.scenes.find((s) => s.traceStep === step)!;
  const replace = (draft: Draft, step: number, id: string, patch: Record<string, unknown>) => {
    const scene = sceneAt(draft, step);
    scene.elements = scene.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as typeof e) : e));
    return draft;
  };

  it("draws each bound scene's bars from that step's array, with its moves and sorted range", () => {
    const { storyboard, issues } = resolveDraft(bubble, buildDraft(bubble));
    expect(issues).toEqual([]);
    const first = storyboard!.scenes.find((s) => s.traceStep === 0)!;
    expect(first.elements.find((e) => e.id === "row")).toMatchObject({
      bars: [3, 7, 9, 1, 4].map((value) => expect.objectContaining({ value })),
      moves: [
        { from: 0, to: 1 },
        { from: 1, to: 0 },
      ],
    });
    const passEnd = storyboard!.scenes.find((s) => s.traceStep === 4)!;
    expect(passEnd.elements.find((e) => e.id === "sorted")).toMatchObject({ indices: [4] });
    const eq = first.elements.find((e) => e.id === "eq");
    expect(eq).toMatchObject({ terms: [7], comparison: { op: ">", target: 3 }, verdictTone: "negative" });
  });

  it("rejects bars that don't match the step's array", () => {
    const draft = replace(buildDraft(bubble), 0, "row", {
      bars: [7, 3, 9, 1, 4].map((value) => ({ value })),
    });
    expect(messages(bubble, draft).join("\n")).toMatch(
      /Row "row" must hold the array as it is after trace step 0.*expected \[3, 7, 9, 1, 4\], got \[7, 3, 9, 1, 4\]/,
    );
  });

  it("rejects wrong moves, a wrong sorted range, a wrong held value, and a wrong tally", () => {
    expect(
      messages(bubble, replace(buildDraft(bubble), 0, "row", { moves: [{ from: 0, to: 2 }] })).join("\n"),
    ).toMatch(/Bar moves don't match trace step 0/);
    expect(messages(bubble, replace(buildDraft(bubble), 4, "sorted", { from: 3, to: 4 })).join("\n")).toMatch(
      /Sorted positions don't match trace step 4 \(expected 4, got 3–4\)/,
    );
    const insertion = "sorting/insertion-sort";
    expect(
      messages(insertion, replace(buildDraft(insertion), 1, "held", { value: 6, index: 0 })).join("\n"),
    ).toMatch(/Held value doesn't match trace step 1 \(expected 2 above slot 0, got 6 above slot 0\)/);
    const counting = "sorting/counting-sort";
    expect(
      messages(
        counting,
        replace(buildDraft(counting), 3, "tally", { keys: [0, 1, 2, 3, 4], counts: [0, 1, 0, 1, 1] }),
      ).join("\n"),
    ).toMatch(/Tally counts don't match trace step 3 \(expected \[0, 2, 0, 1, 1\], got \[0, 1, 0, 1, 1\]\)/);
  });

  it("says when a step has no state for a primitive", () => {
    const draft = buildDraft(bubble);
    sceneAt(draft, 0).elements.push({
      id: "extra",
      type: "held-value",
      rowId: "row",
      label: "x",
      enterAt: 0,
    });
    expect(messages(bubble, draft).join("\n")).toMatch(/Trace step 0 isn't holding a value/);
  });

  it("checks layout room: a held value lowers the bars and a tally shortens them", async () => {
    const { layoutRows } = await import("@/video/layout");
    const bars: BarRowElement = {
      id: "row",
      type: "bar-row",
      enterAt: 0,
      unit: "",
      bars: [{ value: 3 }, { value: 1 }],
    };
    const plain = layoutRows([bars]).row;
    const held = layoutRows([
      bars,
      { id: "h", type: "held-value", rowId: "row", value: 2, index: 0, label: "x", enterAt: 0 },
    ]).row;
    const counted = layoutRows([
      bars,
      { id: "c", type: "count-array", keys: [0], counts: [1], label: "count", enterAt: 0 },
    ]).row;
    expect(held.top).toBeGreaterThan(plain.top);
    expect(held.reservedTop).toBe(plain.top);
    expect(held.top + held.cardHeight).toBe(plain.top + plain.cardHeight);
    expect(counted.top + counted.cardHeight).toBeLessThan(plain.top + plain.cardHeight);
  });
});

describe("divide-and-conquer primitives", () => {
  const merge = "sorting/merge-sort";
  const quick = "sorting/quick-sort";
  const heap = "sorting/heap-sort";
  const inversions = "sorting/count-inversions";
  const resolveDraft = (key: string, draft: Draft) => {
    const source = storyboardSourceSchema.parse(assembleStoryboard(draft, context(key), META));
    return resolveStoryboard(source);
  };
  const sceneAt = (draft: Draft, step: number) => draft.scenes.find((s) => s.traceStep === step)!;
  const replace = (draft: Draft, step: number, id: string, patch: Record<string, unknown>) => {
    const scene = sceneAt(draft, step);
    scene.elements = scene.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as typeof e) : e));
    return draft;
  };
  const element = (storyboard: Storyboard | undefined, step: number, id: string) =>
    storyboard!.scenes.find((s) => s.traceStep === step)!.elements.find((e) => e.id === id);

  it("resolves the split overview, the groups, and the merge buffer from the step", () => {
    const { storyboard, issues } = resolveDraft(merge, buildDraft(merge));
    expect(issues).toEqual([]);
    expect(element(storyboard, 0, "overview")).toMatchObject({
      levels: [
        [[15, 3, 11, 8, 1, 6]],
        [
          [15, 3, 11],
          [8, 1, 6],
        ],
        [[15, 3], [11], [8, 1], [6]],
        [[15], [3], [11], [8], [1], [6]],
      ],
    });
    // Step 4: merging [3, 15] with [11]; 3 is taken first.
    expect(element(storyboard, 4, "buffer")).toMatchObject({ from: 0, values: [3, null, null], taken: 0 });
    expect(element(storyboard, 4, "groups")).toMatchObject({
      groups: [
        { from: 0, to: 1 },
        { from: 2, to: 2 },
        { from: 3, to: 3 },
        { from: 4, to: 4 },
        { from: 5, to: 5 },
      ],
      active: { from: 0, to: 2 },
      depth: 1,
    });
  });

  it("rejects a wrong buffer, wrong groups, a wrong partition, a wrong heap, and a wrong count", () => {
    const text = (key: string, draft: Draft) => messages(key, draft).join("\n");
    expect(
      text(merge, replace(buildDraft(merge), 4, "buffer", { from: 0, values: [11, null, null] })),
    ).toMatch(
      /Merge buffer doesn't match trace step 4 \(expected \[3, _, _\] from 0, got \[11, _, _\] from 0\)/,
    );
    expect(
      text(
        merge,
        replace(buildDraft(merge), 4, "groups", {
          groups: [
            { from: 0, to: 2 },
            { from: 3, to: 5 },
          ],
        }),
      ),
    ).toMatch(/Groups don't match trace step 4/);
    expect(
      text(quick, replace(buildDraft(quick), 6, "partition", { pivot: 5, boundary: 1, from: 0, to: 5 })),
    ).toMatch(
      /Partition doesn't match trace step 6 \(expected pivot 1, boundary 1, range 0–5, got pivot 5, boundary 1, range 0–5\)/,
    );
    expect(text(heap, replace(buildDraft(heap), 2, "heap", { heapSize: 5 }))).toMatch(
      /Heap size doesn't match trace step 2 \(expected 6, got 5\)/,
    );
    expect(text(heap, replace(buildDraft(heap), 2, "heap", { compare: [1, 3] }))).toMatch(
      /Compared nodes don't match trace step 2/,
    );
    expect(text(inversions, replace(buildDraft(inversions), 15, "count", { value: 3 }))).toMatch(
      /Counter doesn't match trace step 15 \(expected 5, got 3\)/,
    );
  });

  it("gives the count-many-at-once take its own key step", async () => {
    const { trace } = traceFor(inversions);
    const big = trace.steps.filter((s) => (s.counter?.delta ?? 0) > 1);
    expect(big.length).toBeGreaterThan(0);
    expect(big.every((s) => s.key && s.kind === "take-right")).toBe(true);
    expect(trace.steps[15].counter).toEqual({ value: 5, delta: 3 });
  });

  it("draws an unbound heap-tree from the trace's row, the whole array as the heap", () => {
    const draft = buildDraft(heap);
    draft.scenes[0].elements.push({ id: "heap", type: "heap-tree", enterAt: 0 });
    const { storyboard, issues } = resolveDraft(heap, draft);
    expect(issues).toEqual([]);
    expect(storyboard!.scenes[0].elements.find((e) => e.id === "heap")).toMatchObject({
      values: [5, 13, 2, 25, 7, 17],
      heapSize: 6,
    });
  });

  it("rejects malformed groups, compares, and partitions in the schema", () => {
    const draft = buildDraft(merge);
    replace(draft, 4, "groups", {
      groups: [
        { from: 0, to: 1 },
        { from: 3, to: 5 },
      ],
    });
    expect(messages(merge, draft).join("\n")).toMatch(/groups must be in order, without gaps or overlaps/);
    expect(messages(heap, replace(buildDraft(heap), 2, "heap", { compare: [0, 3] })).join("\n")).toMatch(
      /compare must be a parent and one of its children/,
    );
    expect(
      messages(
        quick,
        replace(buildDraft(quick), 6, "partition", { pivot: 1, boundary: 1, from: 2, to: 5 }),
      ).join("\n"),
    ).toMatch(/from ≤ boundary ≤ to and from ≤ pivot ≤ to must hold/);
  });

  it("checks layout room: groups spread apart, the heap gets its own region, the buffer clears the pointers", async () => {
    const { layoutRows, layoutScene } = await import("@/video/layout");
    const bars: BarRowElement = {
      id: "row",
      type: "bar-row",
      enterAt: 0,
      unit: "",
      bars: [3, 1, 4, 1, 5, 9].map((value) => ({ value })),
    };
    const plain = layoutRows([bars]).row;
    const grouped = layoutRows([
      bars,
      {
        id: "g",
        type: "segments",
        rowId: "row",
        groups: [
          { from: 0, to: 2 },
          { from: 3, to: 5 },
        ],
        enterAt: 0,
      },
    ]).row;
    expect(grouped.lefts[3] - grouped.lefts[2]).toBeGreaterThan(plain.lefts[3] - plain.lefts[2]);
    expect(grouped.pointerTop).toBeGreaterThan(plain.pointerTop);
    const buffered = layoutRows([
      bars,
      {
        id: "b",
        type: "merge-buffer",
        rowId: "row",
        from: 0,
        values: [1, null],
        label: "merged",
        enterAt: 0,
      },
      {
        id: "p",
        type: "pointer",
        rowId: "row",
        label: "i",
        index: 0,
        placement: "below",
        tone: "primary",
        enterAt: 0,
      },
    ]).row;
    expect(buffered.panelTop).toBeGreaterThanOrEqual(buffered.pointerTop + 50);
    expect(buffered.panelTop + 44).toBeLessThan(500);
    const heapScene = layoutScene([
      bars,
      { id: "t", type: "heap-tree", values: [3, 1, 4, 1, 5, 9], heapSize: 6, enterAt: 0 },
    ]);
    const heaped = heapScene.rows.row;
    expect(heaped.lefts.at(-1)! + heaped.cardWidth).toBeLessThan(heapScene.heapRegion.left);
  });
});

describe("sorted-region with scattered final positions", () => {
  const storyboardFor = (sorted: Record<string, unknown>, step: number) =>
    storyboardSourceSchema.parse({
      id: "quick-sort-out-of-order",
      title: "Quick sort",
      concept: "Sorting",
      category: "dsa",
      summary: "Out-of-order final positions.",
      exampleSource: "analogy",
      analogy: { scenario: "Books.", mapping: [{ real: "book", abstract: "value" }] },
      takeaway: {
        pattern: "Quick sort",
        summary: "Partition.",
        timeComplexity: "O(n log n)",
        spaceComplexity: "O(log n)",
      },
      trace: { problem: "sorting/quick-sort", args: [[3, 1, 2]] },
      scenes: [
        {
          id: "placed",
          caption: "The pivot lands in the middle",
          narration: "The pivot lands in the middle.",
          durationInFrames: 90,
          traceStep: step,
          elements: [
            { id: "row", type: "bar-row" },
            { id: "sorted", type: "sorted-region", rowId: "row", ...sorted },
          ],
        },
      ],
    });

  it("binds exactly the positions the trace has finalized, even when they aren't a prefix", () => {
    const trace = runTrace("sorting/quick-sort", [[3, 1, 2]]);
    const place = trace.steps.findIndex((s) => s.kind === "place");
    // The pivot 2 lands at position 1 before either side is sorted: the middle is final, the ends are not.
    expect(trace.steps[place].final).toEqual([1]);
    const { storyboard, issues } = resolveStoryboard(storyboardFor({}, place));
    expect(issues).toEqual([]);
    expect(storyboard!.scenes[0].elements.find((e) => e.id === "sorted")).toMatchObject({ indices: [1] });
    expect(validateStoryboard(storyboard!).issues.map(formatIssue).join("\n")).not.toMatch(
      /Sorted positions/,
    );
  });

  it("rejects a prefix where the trace has scattered positions", () => {
    const trace = runTrace("sorting/quick-sort", [[3, 1, 2]]);
    const place = trace.steps.findIndex((s) => s.kind === "place");
    const { storyboard } = resolveStoryboard(storyboardFor({ indices: [0, 1] }, place));
    expect(validateStoryboard(storyboard!).issues.map(formatIssue).join("\n")).toMatch(
      new RegExp(`Sorted positions don't match trace step ${place} \\(expected 1, got 0–1\\)`),
    );
  });

  it("still accepts a contiguous from/to shorthand (bubble sort's sorted tail)", () => {
    const { storyboard } = resolveStoryboard(storyboardFor({ from: 1, to: 2 }, 0));
    expect(storyboard?.scenes[0].elements.find((e) => e.id === "sorted")).toMatchObject({ indices: [1, 2] });
  });
});
