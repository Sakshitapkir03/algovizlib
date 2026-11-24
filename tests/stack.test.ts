import { describe, expect, it } from "vitest";

import { getProblem } from "@/lib/catalog/repository";
import { assembleStoryboard, evaluateDraft, type GenerationContext } from "@/lib/generation/draft";
import { resolveStoryboard, storyboardSourceSchema, validateStoryboard } from "@/lib/storyboard";
import { getTraceDefinition, keepsOrder } from "@/lib/traces";
import { PHONE_PLAYER_WIDTH, textMetrics } from "@/video/text";

import { buildDraft, traceFor } from "./fixtures/drafts";
import { stackProblems } from "@/video/fit/stack";

const STACKS = [
  "stack/valid-parentheses",
  "stack/daily-temperatures",
  "stack/evaluate-reverse-polish-notation",
  "stack/decode-string",
  "stack/largest-rectangle-in-histogram",
];

describe("stack traces", () => {
  it.each(STACKS)("%s: each step's pops and pushes lead from the last step's stack", (key) => {
    const { trace } = traceFor(key);
    expect(trace.steps.filter((s) => s.key).length + 3).toBeLessThanOrEqual(10);
    let before: { label: string }[] = [];
    for (const step of trace.steps) {
      const pile = step.pile!;
      if (pile.order) expect(keepsOrder(pile.order, pile.items)).toBe(true);
      // Replay: pop the popped items off the old top (in order), then the pushed ones are on top.
      const items = [...before];
      for (const out of pile.popped ?? []) expect(items.pop()?.label).toBe(out.label);
      const kept = pile.items.length - (pile.pushed ?? 0);
      expect(pile.items.slice(0, kept).map((i) => i.label)).toEqual(items.map((i) => i.label));
      // Every link starts at a popped item.
      for (const link of pile.links ?? []) expect(pile.popped?.some((p) => p.ref === link.from)).toBe(true);
      before = pile.items;
    }
  });

  it("Daily Temperatures: 71 resolves three waiting days at once, and the stack stays decreasing", () => {
    const { trace } = traceFor("stack/daily-temperatures");
    const day4 = trace.steps.find((s) => s.pointers.i === 4)!;
    expect(day4.pile!.links).toEqual([
      { from: 3, to: 4, label: "+1" },
      { from: 2, to: 4, label: "+2" },
      { from: 1, to: 4, label: "+3" },
    ]);
    expect(day4.equation).toMatchObject({
      terms: [71],
      comparison: { op: ">", target: 66 },
      tone: "positive",
    });
    expect(trace.steps.at(-1)!.pile!.answers!.map((a) => a.label)).toEqual(["1", "3", "2", "1", "0", "0"]);
  });

  it("Largest Rectangle: each pop shades its rectangle; 9 is the best, 8 is neutral", () => {
    const { trace } = traceFor("stack/largest-rectangle-in-histogram");
    const nine = trace.steps.find((s) => s.equation?.result === 9)!;
    expect(nine.fill).toEqual({ from: 1, to: 3, level: 3, cover: true, label: "9" });
    expect(nine.equation!.tone).toBe("positive");
    expect(trace.steps.find((s) => s.equation?.result === 8)!.equation!.tone).toBe("neutral");
  });

  it("Decode String saves the text so far on '[' and builds it back on ']'", () => {
    const { trace } = traceFor("stack/decode-string");
    const closes = trace.steps.filter((s) => s.kind === "close").map((s) => s.pile!.text!.value);
    expect(closes).toEqual(["xyzyz", "xyzyzxyzyzxyzyz"]);
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
    patternName: "Stack",
    definition: getTraceDefinition(key)!,
    args: traceFor(key).args,
  };
}

describe("stack storyboards", () => {
  it.each(STACKS)("%s: a fixture draft passes, and fits at phone and full size", (key) => {
    const result = evaluateDraft(buildDraft(key), context(key), META);
    expect(result.issues).toEqual([]);
    if (!result.ok) return;
    for (const width of [PHONE_PLAYER_WIDTH, 1280])
      for (const scene of result.storyboard.scenes)
        expect(stackProblems(scene.elements, textMetrics(width)), `${scene.id} at ${width}`).toEqual([]);
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
  const daily = "stack/daily-temperatures";
  const pileAt = (step: number) => structuredClone(traceFor(daily).trace.steps[step].pile!);
  const mutate = (step: number, change: (el: Record<string, unknown>) => void) => {
    const sb = source(daily);
    const scene = sb.scenes.find((s) => s.traceStep === step)!;
    const el = scene.elements.find((e) => e.type === "stack") as Record<string, unknown>;
    Object.assign(el, pileAt(step));
    change(el);
    return issues(sb);
  };

  it("accepts the step's own stack written out", () => {
    expect(mutate(4, () => {})).toBe("");
  });

  it("rejects wrong items, order of items, pushes, pops, links, and answers", () => {
    expect(mutate(3, (el) => (el.items = [...(el.items as unknown[])].reverse()))).toMatch(
      /stack's items doesn't match/,
    );
    expect(mutate(4, (el) => (el.popped = []))).toMatch(/stack's popped doesn't match/);
    expect(mutate(4, (el) => (el.pushed = 0))).toMatch(/stack's pushed doesn't match/);
    expect(mutate(4, (el) => (el.links = [{ from: 3, to: 4, label: "+2" }]))).toMatch(
      /stack's links doesn't match/,
    );
    expect(mutate(4, (el) => (el.answers = []))).toMatch(/stack's answers doesn't match/);
  });

  it("rejects a stack labeled decreasing whose items rise, bound or not", () => {
    const rising = [
      { label: "65", ref: 0, key: 65 },
      { label: "70", ref: 1, key: 70 },
    ];
    expect(mutate(3, (el) => (el.items = rising))).toMatch(/labeled decreasing but its items aren't/);
    const sb = source(daily);
    sb.scenes[0].elements.push({
      id: "s2",
      type: "stack",
      enterAt: 0,
      items: rising,
      order: "decreasing",
    } as never);
    expect(issues(sb)).toMatch(/labeled decreasing but its items aren't/);
  });

  it("an unbound stack is empty", () => {
    const sb = source(daily);
    sb.scenes[0].elements.push({ id: "s3", type: "stack", enterAt: 0, items: [{ label: "65" }] } as never);
    expect(issues(sb)).toMatch(/Without a traceStep, the stack is empty/);
  });
});
