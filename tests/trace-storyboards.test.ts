import { describe, expect, it } from "vitest";

import { getProblem } from "@/lib/catalog/repository";
import {
  assembleStoryboard,
  evaluateDraft,
  type Draft,
  type GenerationContext,
} from "@/lib/generation/draft";
import { formatIssue, resolveStoryboard, storyboardSourceSchema, validateStoryboard } from "@/lib/storyboard";
import { getTraceDefinition, traceRegistry } from "@/lib/traces";

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
