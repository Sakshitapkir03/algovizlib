import type { Draft } from "@/lib/generation/draft";
import { getProblem } from "@/lib/catalog/repository";
import { getTraceDefinition, runTrace, type Trace } from "@/lib/traces";
import { traceScenes } from "@/lib/walkthrough/scenes";

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
  const { rows, stepScenes, wideTable, answerCard } = traceScenes(trace, {
    itemLabels: (count, row) =>
      Array.from({ length: count }, (_, i) => `${row === "first" ? "item" : "other"} ${i}`),
    text: (_type, _field, fallback) => fallback,
    caption: (step, index) => `Step ${index}: ${step.kind}`,
    verdict: (step) => step.kind,
    callout: (step) => step.note.slice(0, 120),
    choiceReason: "A short line on why this is safe, in the story's words.",
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
      { id: "problem", caption: "The problem", narration: "Here is the problem.", elements: rows() },
      {
        id: "brute-force",
        caption: "Brute force is slow",
        narration: "Checking everything is slow.",
        elements: rows(),
      },
      ...stepScenes,
      {
        id: "pattern",
        caption: "The pattern",
        narration: "That's the two-pointer pattern.",
        elements: wideTable ? [answerCard] : rows(),
      },
    ],
  };
}
