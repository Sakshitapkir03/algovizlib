import { describe, expect, it } from "vitest";

import { getProblem } from "@/lib/catalog/repository";
import { assembleStoryboard, evaluateDraft, type GenerationContext } from "@/lib/generation/draft";
import { resolveStoryboard, storyboardSourceSchema, validateStoryboard } from "@/lib/storyboard";
import { getTraceDefinition, isHeap } from "@/lib/traces";
import { PHONE_PLAYER_WIDTH, textMetrics } from "@/video/text";

import { buildDraft, traceFor } from "./fixtures/drafts";
import { heapProblems } from "./fixtures/heap-fit";

const HEAPS = [
  "heap/last-stone-weight",
  "heap/kth-largest-element-in-an-array",
  "heap/top-k-frequent-elements",
  "heap/k-closest-points-to-origin",
  "heap/find-median-from-data-stream",
];

describe("heap traces", () => {
  it.each(HEAPS)(
    "%s keeps the heap property, and each step's swaps lead from the last step's heap",
    (key) => {
      const { trace } = traceFor(key);
      expect(trace.steps.filter((s) => s.key).length + 3).toBeLessThanOrEqual(10);
      let before = trace.steps[0].heaps!.map((h) => h.items);
      trace.steps.forEach((step, s) => {
        step.heaps!.forEach((heap, h) => {
          expect(isHeap(heap.kind, heap.items)).toBe(true);
          if (heap.capacity !== undefined) expect(heap.items.length).toBeLessThanOrEqual(heap.capacity + 1);
          if (s === 0) return;
          // Replay: the previous array, plus the push (at the end) or minus the pop (last item to the root), then the
          // swaps in order, must give this step's array.
          const items = [...before[h]];
          if (heap.pushed) items.push(heap.pushed);
          if (heap.popped) {
            expect(items[0]).toEqual(heap.popped);
            const last = items.pop()!;
            if (items.length > 0) items[0] = last;
          }
          for (const [a, b] of heap.swaps ?? []) [items[a], items[b]] = [items[b], items[a]];
          expect(items).toEqual(heap.items);
        });
        before = step.heaps!.map((h) => h.items);
      });
    },
  );

  it("a size-k heap evicts its root: the weakest of the k kept", () => {
    const { trace } = traceFor("heap/kth-largest-element-in-an-array");
    const evicted = trace.steps
      .filter((s) => s.kind === "evict" || s.kind === "bounce")
      .map((s) => s.heaps![0].popped!.key);
    expect(evicted).toEqual([2, 4, 7, 1]);
    expect(trace.steps.at(-1)!.heaps![0].items.map((i) => i.key)).toEqual([9, 9]);
  });

  it("Find Median keeps the halves balanced: the lower half never smaller, never more than one bigger", () => {
    const { trace } = traceFor("heap/find-median-from-data-stream");
    for (const step of trace.steps.filter((s) => s.kind === "median" || s.kind.startsWith("move"))) {
      const [lower, upper] = step.heaps!;
      expect(lower.kind).toBe("max");
      expect(upper.kind).toBe("min");
      expect(lower.items.length - upper.items.length).toBeGreaterThanOrEqual(0);
      expect(lower.items.length - upper.items.length).toBeLessThanOrEqual(1);
      if (upper.items.length) expect(lower.items[0].key).toBeLessThanOrEqual(upper.items[0].key);
    }
    expect(trace.answerDisplay).toBe("null, null, 6, null, 4, null, 6, null, 4");
  });

  it("Last Stone Weight: equal stones destroying each other read as neutral", () => {
    const { trace } = traceFor("heap/last-stone-weight");
    const destroy = trace.steps.find((s) => s.kind === "destroy")!;
    expect(destroy.equation).toMatchObject({ terms: [2, 2], operator: "-", result: 0, tone: "neutral" });
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
    patternName: "Heap / Priority Queue",
    definition: getTraceDefinition(key)!,
    args: traceFor(key).args,
  };
}

describe("heap storyboards", () => {
  it.each(HEAPS)("%s: a fixture draft passes, and fits at phone and full size", (key) => {
    const result = evaluateDraft(buildDraft(key), context(key), META);
    expect(result.issues).toEqual([]);
    if (!result.ok) return;
    for (const width of [PHONE_PLAYER_WIDTH, 1280])
      for (const scene of result.storyboard.scenes)
        expect(heapProblems(scene.elements, textMetrics(width)), `${scene.id} at ${width}`).toEqual([]);
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
  const kth = "heap/kth-largest-element-in-an-array";
  const heapAt = (step: number) => structuredClone(traceFor(kth).trace.steps[step].heaps!);
  const mutate = (step: number, change: (heaps: ReturnType<typeof heapAt>) => void) => {
    const sb = source(kth);
    const scene = sb.scenes.find((s) => s.traceStep === step)! as SceneSource;
    const heaps = heapAt(step);
    change(heaps);
    (scene.elements.find((e) => e.type === "heap") as Record<string, unknown>).heaps = heaps;
    return issues(sb);
  };

  it("accepts the step's own heaps written out", () => {
    expect(mutate(1, () => {})).toBe("");
  });

  it("rejects a wrong array, wrong swaps, a wrong capacity, and a wrong push or pop", () => {
    expect(mutate(3, (h) => h[0].items.reverse())).toMatch(/Heap 1 doesn't match trace step 3/);
    expect(mutate(1, (h) => (h[0].swaps = []))).toMatch(/Heap 1 doesn't match trace step 1/);
    expect(mutate(1, (h) => (h[0].capacity = 3))).toMatch(/Heap 1 doesn't match/);
    expect(mutate(3, (h) => (h[0].popped = { key: 9, label: "9" }))).toMatch(/Heap 1 doesn't match/);
  });

  it("rejects a drawn heap that breaks the heap property, bound or not", () => {
    // [9, 7] is a valid array for a max-heap, not a min-heap.
    expect(mutate(3, (h) => (h[0].items = [h[0].items[1], h[0].items[0]]))).toMatch(
      /breaks the min-heap property/,
    );
    const sb = source(kth);
    sb.scenes[0].elements.push({
      id: "bad",
      type: "heap",
      enterAt: 0,
      heaps: [
        {
          kind: "max",
          items: [
            { key: 1, label: "1" },
            { key: 5, label: "5" },
          ],
        },
      ],
    } as never);
    expect(issues(sb)).toMatch(/breaks the max-heap property/);
  });

  it("an unbound heap must be the final heaps, with no push or pop", () => {
    const sb = source(kth);
    sb.scenes[0].elements.push({ id: "recap", type: "heap", enterAt: 0 } as never);
    expect(issues(sb)).toBe("");
    sb.scenes[1].elements.push({ id: "early", type: "heap", enterAt: 0, heaps: heapAt(1) } as never);
    expect(issues(sb)).toMatch(/Without a traceStep, a heap shows the final heaps/);
  });
});
