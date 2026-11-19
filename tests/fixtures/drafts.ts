import type { Draft } from "@/lib/generation/draft";
import { getProblem } from "@/lib/catalog/repository";
import type { ElementSource } from "@/lib/storyboard";
import { getTraceDefinition, runTrace, type Trace } from "@/lib/traces";

/** The trace a problem's generator would use. */
export function traceFor(problemKey: string): { trace: Trace; args: unknown[] } {
  const def = getTraceDefinition(problemKey)!;
  const [pattern, slug] = problemKey.split("/");
  const args = getProblem(pattern, slug)!.examples[def.exampleIndex].args;
  return { trace: runTrace(problemKey, args), args };
}

/**
 * A correct, model-shaped draft for any trace: intro scenes, one scene per key step (binding values omitted so
 * they come from the trace) with the answer on the last one, and a closing scene. Tests mutate copies of it.
 */
export function buildDraft(problemKey: string): Draft {
  const def = getTraceDefinition(problemKey)!;
  const { trace } = traceFor(problemKey);
  const rowType = trace.row.display === "bars" ? "bar-row" : "item-row";
  const row = (): ElementSource =>
    rowType === "bar-row"
      ? { id: "row", type: "bar-row", unit: "", enterAt: 0 }
      : {
          id: "row",
          type: "item-row",
          unit: "",
          enterAt: 0,
          labels: trace.row.values.map((_, i) => `item ${i}`),
        };

  const stepScenes = trace.steps.flatMap((step, index) => {
    if (!step.key) return [];
    const elements: ElementSource[] = [row()];
    for (const name of Object.keys(step.pointers)) {
      elements.push({
        id: `p-${name}`,
        type: "pointer",
        rowId: "row",
        label: name,
        binds: name,
        enterAt: 0,
        placement: "below",
        tone: "primary",
      });
    }
    if (step.active)
      elements.push({ id: "active", type: "highlight", rowId: "row", state: "active", enterAt: 0 });
    if (step.found)
      elements.push({ id: "found", type: "highlight", rowId: "row", state: "found", enterAt: 0 });
    if (step.sorted)
      elements.push({ id: "sorted", type: "sorted-region", rowId: "row", label: "sorted", enterAt: 0 });
    if (step.held)
      elements.push({ id: "held", type: "held-value", rowId: "row", label: "holding", enterAt: 0 });
    if (step.counts) elements.push({ id: "tally", type: "count-array", label: "count", enterAt: 0 });
    if (step.segments) elements.push({ id: "groups", type: "segments", rowId: "row", enterAt: 0 });
    if (step.splitTree) elements.push({ id: "overview", type: "split-tree", label: "split", enterAt: 0 });
    if (step.buffer)
      elements.push({ id: "buffer", type: "merge-buffer", rowId: "row", label: "merged", enterAt: 0 });
    if (step.pivot !== undefined)
      elements.push({ id: "partition", type: "partition", rowId: "row", label: "pivot", enterAt: 0 });
    if (step.heapSize !== undefined) elements.push({ id: "heap", type: "heap-tree", enterAt: 0 });
    if (step.counter) elements.push({ id: "count", type: "counter", label: "inversions", enterAt: 0 });
    if (step.equation)
      elements.push({ id: "eq", type: "equation", unit: "", verdict: step.kind, enterAt: 0.1 });
    elements.push({ id: "why", type: "callout", text: step.note.slice(0, 120), enterAt: 0.3 });
    // The last step is where the answer is known: state it there (a real story does the same).
    if (index === trace.steps.length - 1) {
      elements.push({
        id: "result",
        type: "result",
        title: "Answer",
        showsAnswer: true,
        enterAt: 0.5,
        tone: "success",
      });
    }
    return [
      {
        id: `step-${index}`,
        caption: `Step ${index}: ${step.kind}`,
        narration: step.note,
        traceStep: index,
        elements,
      },
    ];
  });

  return {
    title: `Test storyboard for ${problemKey}`,
    summary: "A storyboard built by the test fixture.",
    exampleSource: def.exampleSource,
    ...(def.exampleSource === "analogy"
      ? { analogy: { scenario: "A shelf of items.", mapping: [{ real: "item", abstract: "value" }] } }
      : {}),
    takeaway: {
      pattern: "Two Pointers",
      summary: "Walk inward.",
      timeComplexity: "O(n)",
      spaceComplexity: "O(1)",
      whenToUse: [],
    },
    scenes: [
      { id: "problem", caption: "The problem", narration: "Here is the problem.", elements: [row()] },
      {
        id: "brute-force",
        caption: "Brute force is slow",
        narration: "Checking everything is slow.",
        elements: [row()],
      },
      ...stepScenes,
      {
        id: "pattern",
        caption: "The pattern",
        narration: "That's the two-pointer pattern.",
        elements: [row()],
      },
    ],
  };
}
