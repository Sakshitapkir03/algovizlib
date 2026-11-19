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
import { getTraceDefinition, traceRegistry } from "@/lib/traces";
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
    expect(passEnd.elements.find((e) => e.id === "sorted")).toMatchObject({ from: 4, to: 4 });
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
      /Sorted region doesn't match trace step 4 \(expected 4–4, got 3–4\)/,
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
