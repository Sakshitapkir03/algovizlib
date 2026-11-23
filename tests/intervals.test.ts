import { describe, expect, it } from "vitest";

import { storyboards } from "@/content/storyboards";
import { getProblem } from "@/lib/catalog/repository";
import { assembleStoryboard, evaluateDraft, type GenerationContext } from "@/lib/generation/draft";
import {
  partialElementSchema,
  resolveStoryboard,
  storyboardSourceSchema,
  validateStoryboard,
  type Element,
} from "@/lib/storyboard";
import { getTraceDefinition } from "@/lib/traces";
import { layoutScene } from "@/video/layout";
import { PHONE_PLAYER_WIDTH, textMetrics } from "@/video/text";
import { layoutTimeline } from "@/video/timeline-layout";

import { buildDraft, traceFor } from "./fixtures/drafts";
import { heapProblems } from "./fixtures/heap-fit";
import { timelineProblems } from "./fixtures/timeline-fit";

const INTERVALS = [
  "intervals/meeting-rooms",
  "intervals/merge-intervals",
  "intervals/insert-interval",
  "intervals/non-overlapping-intervals",
  "intervals/minimum-interval-to-include-each-query",
];

describe("interval traces", () => {
  it.each(INTERVALS)("%s: fits a 10-scene video, and every bar stays a real interval", (key) => {
    const { trace } = traceFor(key);
    expect(trace.steps.filter((s) => s.key).length + 3).toBeLessThanOrEqual(10);
    expect(trace.steps.at(-1)!.key).toBe(true);
    for (const step of trace.steps) {
      const tl = step.timeline!;
      for (const bar of tl.bars) expect(bar.start).toBeLessThanOrEqual(bar.end);
      if (tl.grow) expect(tl.bars.find((b) => b.id === tl.grow!.id)).toBeDefined();
    }
  });

  it("Meeting Rooms sorts by start, then finds a gap and a clash", () => {
    const { trace } = traceFor("intervals/meeting-rooms");
    const [sort, fits, clash] = trace.steps;
    expect(sort.timeline!.bars.map((b) => [b.start, b.lane, b.fromLane])).toEqual([
      [15, 3, 0],
      [9, 0, 1],
      [11, 1, 2],
      [12, 2, 3],
    ]);
    expect(fits.equation).toMatchObject({ comparison: { op: ">", target: 10 }, tone: "positive" });
    expect(clash.equation).toMatchObject({ comparison: { op: "<", target: 13 }, tone: "negative" });
    expect(clash.timeline!.overlap).toEqual({ start: 12, end: 13 });
    expect(trace.answer).toBe(false);
  });

  it("Merge Intervals grows the merged range from 7 to 9 when [6, 9] overlaps", () => {
    const { trace } = traceFor("intervals/merge-intervals");
    const merge = trace.steps.find((s) => s.kind === "merge")!;
    expect(merge.timeline!.grow).toEqual({ id: 101, start: 4, end: 7 });
    expect(merge.timeline!.bars.find((b) => b.id === 101)).toMatchObject({
      start: 4,
      end: 9,
      state: "result",
    });
    expect(merge.equation).toMatchObject({ tone: "neutral" });
  });

  it("Insert Interval copies, absorbs two ranges as the new one grows, then places it", () => {
    const { trace } = traceFor("intervals/insert-interval");
    expect(trace.steps.map((s) => s.kind)).toEqual(["before", "absorb", "absorb", "place"]);
    expect(trace.steps.filter((s) => s.kind === "absorb").map((s) => s.timeline!.grow)).toEqual([
      { id: 50, start: 6, end: 10 },
      { id: 50, start: 5, end: 10 },
    ]);
    expect(trace.answer).toEqual([
      [1, 2],
      [5, 12],
    ]);
  });

  it("Non-overlapping Intervals keeps the range that ends first and says so in the choice", () => {
    const { trace } = traceFor("intervals/non-overlapping-intervals");
    const removes = trace.steps.filter((s) => s.kind === "remove");
    expect(removes.map((s) => s.choice)).toEqual([
      { chosen: "keep [2, 3]", rejected: "keep [1, 4]" },
      { chosen: "keep [3, 6]", rejected: "keep [5, 7]" },
    ]);
    expect(trace.steps.at(-1)!.counter!.value).toBe(2);
  });

  it("Minimum Interval pushes by left end, pops ranges that ended, and answers from the heap's top", () => {
    const { trace } = traceFor("intervals/minimum-interval-to-include-each-query");
    const pops = trace.steps.filter((s) => s.kind === "pop");
    expect(pops.map((s) => s.heaps![0].popped!.label)).toEqual(["1·6", "2·4", "4·5", "8·8"]);
    expect(trace.steps.at(-1)!.partial!.items).toEqual(["q1 → 8", "q3 → 2", "q6 → 1", "q9 → -1"]);
    // Each step is one heap operation, so the heap primitive can replay its swaps.
    for (const s of trace.steps.slice(1))
      expect(Number(!!s.heaps![0].pushed) + Number(!!s.heaps![0].popped)).toBe(1);
    expect(trace.answer).toEqual([2, 1, -1, 8]);
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
    patternName: "Intervals",
    definition: getTraceDefinition(key)!,
    args: traceFor(key).args,
  };
}

describe("interval storyboards", () => {
  it("Minimum Interval's and the trie videos' answer panels hide the found count; every other partial keeps it", () => {
    const partials = storyboards.flatMap((sb) =>
      sb.scenes.flatMap((scene) =>
        scene.elements.filter((e) => e.type === "partial").map((e) => [sb.id, e] as const),
      ),
    );
    for (const [id, el] of partials)
      // The answers being built are the whole answer here (Minimum Interval, the trie videos): no "found" row.
      expect(el.type === "partial" && el.showFound, id).toBe(
        !id.includes("minimum-interval") && !id.startsWith("trie-"),
      );
    // The default leaves existing panels as they were, and a hidden found row takes no room.
    const base = { id: "p", type: "partial", items: ["a"], found: [] };
    expect(partialElementSchema.parse(base).showFound).toBe(true);
    const bottom = (showFound: boolean) =>
      layoutScene([partialElementSchema.parse({ ...base, showFound }) as Element], textMetrics(1280))
        .bottomTop;
    expect(bottom(false)).toBeGreaterThanOrEqual(bottom(true));
  });

  it.each(INTERVALS)("%s: a fixture draft passes and fits at phone and full size", (key) => {
    const result = evaluateDraft(buildDraft(key), context(key), META);
    expect(result.issues).toEqual([]);
    if (!result.ok) return;
    for (const width of [PHONE_PLAYER_WIDTH, 1280])
      for (const scene of result.storyboard.scenes) {
        const t = textMetrics(width);
        expect(timelineProblems(scene.elements, t), `${scene.id} at ${width}`).toEqual([]);
        expect(heapProblems(scene.elements, t), `${scene.id} at ${width}`).toEqual([]);
      }
  });

  it("a heap beside a timeline takes the right of the stage, clear of the bars", () => {
    const key = "intervals/minimum-interval-to-include-each-query";
    const result = evaluateDraft(buildDraft(key), context(key), META);
    if (!result.ok) throw new Error("fixture invalid");
    const scene = result.storyboard.scenes.find((s) => s.elements.some((e) => e.type === "heap"))!;
    for (const width of [PHONE_PLAYER_WIDTH, 1280]) {
      const t = textMetrics(width);
      const layout = layoutScene(scene.elements, t);
      const tl = layoutTimeline(
        scene.elements.find((e) => e.type === "timeline") as never,
        scene.elements,
        t,
        layout.bottomTop,
      );
      expect(layout.heapPanels![0].left).toBeGreaterThan(tl.x(tl.ticks.at(-1)!.v) + 8);
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
  const MERGE = "intervals/merge-intervals";
  const mutate = (key: string, step: number, change: (el: Record<string, unknown>) => void) => {
    const sb = source(key);
    const scene = sb.scenes.find((s) => s.traceStep === step)!;
    change(scene.elements.find((e) => e.type === "timeline") as Record<string, unknown>);
    return issues(sb);
  };
  const resolved = (key: string, step: number) => traceFor(key).trace.steps[step].timeline!;

  it("the fixture sources resolve and validate", () => {
    for (const key of INTERVALS) expect(issues(source(key)), key).toBe("");
  });

  it("rejects a wrong bar, merge, overlap, or marker", () => {
    // Step 3 merges [6, 9] into [4, 7].
    const tl = resolved(MERGE, 3);
    const full = (extra: Record<string, unknown>) => (el: Record<string, unknown>) =>
      Object.assign(
        el,
        { min: 0, max: 15, lanes: 5, bars: tl.bars, overlap: tl.overlap, grow: tl.grow },
        extra,
      );
    expect(mutate(MERGE, 3, full({}))).toBe("");
    expect(
      mutate(MERGE, 3, full({ bars: tl.bars.map((b) => (b.id === 101 ? { ...b, end: 8 } : b)) })),
    ).toMatch(/timeline's bars doesn't match/);
    expect(mutate(MERGE, 3, full({ grow: { id: 101, start: 4, end: 9 } }))).toMatch(
      /timeline's grow doesn't match/,
    );
    expect(mutate(MERGE, 3, full({ overlap: { start: 6, end: 9 } }))).toMatch(
      /timeline's overlap doesn't match/,
    );
    expect(mutate(MERGE, 3, full({ sweep: { at: 7, label: "end" } }))).toMatch(
      /timeline's sweep doesn't match/,
    );
    expect(mutate(MERGE, 3, full({ max: 20 }))).toMatch(/axis or lanes don't match/);
  });

  it("schema: bars lie on the axis and their lanes, and a grown bar exists", () => {
    const tl = resolved(MERGE, 3);
    const base = { min: 0, max: 15, lanes: 5, bars: tl.bars, overlap: tl.overlap, grow: tl.grow };
    expect(
      mutate(MERGE, 3, (el) =>
        Object.assign(el, base, { bars: tl.bars.map((b) => (b.id === 0 ? { ...b, end: 20 } : b)) }),
      ),
    ).toMatch(/must have start ≤ end and lie on the axis/);
    expect(
      mutate(MERGE, 3, (el) =>
        Object.assign(el, base, { bars: tl.bars.map((b) => (b.id === 0 ? { ...b, lane: 9 } : b)) }),
      ),
    ).toMatch(/lanes are 0–4/);
    expect(mutate(MERGE, 3, (el) => Object.assign(el, base, { grow: { id: 7, start: 1, end: 2 } }))).toMatch(
      /bar 7 isn't on the timeline/,
    );
  });

  it("an unbound timeline shows the intervals as given (or as they end)", () => {
    const sb = source(MERGE);
    const intro = sb.scenes[0];
    intro.elements = [{ id: "tl", type: "timeline", enterAt: 0 } as never];
    expect(issues(sb)).toBe("");
    (intro.elements[0] as Record<string, unknown>).sweep = { at: 3, label: "x" };
    Object.assign(intro.elements[0], {
      min: 0,
      max: 15,
      lanes: 5,
      bars: traceFor(MERGE).trace.timeline!.input,
    });
    expect(issues(sb)).toMatch(/Without a traceStep, the timeline shows the intervals as given/);
  });
});
