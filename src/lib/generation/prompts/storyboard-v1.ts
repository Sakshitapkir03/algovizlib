import type { Problem } from "@/lib/catalog";
import { primitiveCatalog, type ValidationIssue } from "@/lib/storyboard";
import type { Trace, TraceStep } from "@/lib/traces";

import { describeIssues, MAX_SCENES, MIN_SCENES } from "../draft";

/**
 * Prompt templates for storyboard generation. Bump the version on ANY wording change: it's recorded in each
 * generated storyboard and is part of the cache key, so changed prompts never reuse stale results.
 */
export const PROMPT_VERSION = "storyboard-v1";

export type StoryboardPromptInput = {
  problem: Problem;
  patternName: string;
  patternCoreIdea: string;
  exampleSource: "problem-native" | "analogy";
  trace: Trace;
  exampleIndex: number;
};

const ELEMENT_GUIDE = Object.entries(primitiveCatalog)
  .map(([type, text]) => `- ${type}: ${text}`)
  .join("\n");

export function systemPrompt(): string {
  return `You write storyboards for short animated videos that explain the APPROACH behind an algorithm through one concrete, real-world example. You are not writing code or a code walkthrough.

You return one JSON object matching the provided schema. Deterministic code has already run the algorithm and recorded every decision as a numbered trace step. Your job is the story: captions, narration, labels, callouts, and which trace step each scene shows. All state comes from the trace.

## Choosing the example
- "problem-native": the problem statement already describes a real-world scenario. Use that exact scenario, its wording, and its numbers. Do not substitute an analogy, and omit the "analogy" field.
- "analogy": the problem is abstract (arrays, strings, pointers). Use ONE relatable real-world analogy, describe it in analogy.scenario and analogy.mapping, and make the closing scene map it back to the abstract problem (relabel items as a[i] or s[i], name the pointers left/right/i).

## Scene arc (${MIN_SCENES}–${MAX_SCENES} scenes in total)
1. The problem in real-life terms (no traceStep).
2. Why brute force is slow (no traceStep).
3. The key idea. This may be the first KEY step's scene.
4. A few moves with the reasoning: one scene per KEY trace step, in trace order, each with traceStep set.
5. The answer: in the scene for the LAST trace step, add a result with showsAnswer: true.
6. A closing scene mapping back to the general pattern and its complexity.
Count before you write: KEY steps + 3 must fit in ${MAX_SCENES} scenes, so merge the key idea into the first step scene when needed.

## Elements
${ELEMENT_GUIDE}

## Binding rules (these are checked by a validator; violations are sent back to you)
- Every trace step marked KEY must be shown by a scene whose traceStep is that step's index. Other steps may be skipped.
- traceStep values never decrease from one scene to the next.
- Every scene that shows data starts with the row element (same id in every scene, e.g. "row"); omit its values so they come from the trace, and give labels that fit the story (one per value).
- Pointers: set binds to a pointer name the step actually has, set rowId, and OMIT index/fromIndex. A step that lists no pointers gets no bound pointers.
- Equations: only in scenes whose step has arithmetic. OMIT terms/operator/result/comparison; add unit and a short verdict.
- Highlights: OMIT indices in bound scenes. Only use a state the step lists (active/rejected/found).
- The answer: a result element with showsAnswer: true and value omitted.
- Never write a number that contradicts the trace. Narration may say numbers, but they must be the trace's numbers.
- Element ids are unique within a scene. Captions are at most 80 characters. Narration is 2–4 plain sentences, no markdown.`;
}

function describeStep(step: TraceStep, index: number): string {
  const parts = [`#${index}${step.key ? " KEY" : ""} ${step.kind}`];
  const pointers = Object.entries(step.pointers);
  parts.push(`pointers: ${pointers.length ? pointers.map(([k, v]) => `${k}=${v}`).join(", ") : "none"}`);
  if (step.equation) {
    const e = step.equation;
    parts.push(
      `equation: ${e.terms.join(` ${e.operator} `)} = ${e.result}${e.comparison ? ` ${e.comparison.op} ${e.comparison.target}` : ""}`,
    );
  }
  for (const state of ["active", "rejected", "found"] as const) {
    if (step[state]?.length) parts.push(`${state}: [${step[state]!.join(", ")}]`);
  }
  if (step.fill) parts.push(`container: bars ${step.fill.from}–${step.fill.to} filled to ${step.fill.level}`);
  if (step.water) parts.push(`water: [${step.water.join(", ")}]`);
  return `${parts.join(" | ")}\n   ${step.note}`;
}

export function generatePrompt(input: StoryboardPromptInput): string {
  const { problem, trace } = input;
  const example = problem.examples[input.exampleIndex];
  const keyCount = trace.steps.filter((s) => s.key).length;
  return `# Problem: ${problem.title} (${input.patternName}, ${problem.difficulty})

${problem.statement}

Example used in the video: ${example.input} → ${example.output}${example.explanation ? ` (${example.explanation})` : ""}

# Pattern
${input.patternName}: ${input.patternCoreIdea}

Key idea for this problem: ${problem.keyIdea}
Complexity: ${problem.complexity.time} time, ${problem.complexity.space} space.

# exampleSource for this problem: "${input.exampleSource}"

# Trace
Row (${trace.row.display === "bars" ? "use a bar-row" : "use an item-row"}), index: value
${trace.row.values.map((v, i) => `  ${i}: ${JSON.stringify(v)}`).join("\n")}
Pointer names: ${trace.pointerNames.join(", ")}
Answer: ${trace.answerDisplay}

Steps (${trace.steps.length} total, ${keyCount} KEY):
${trace.steps.map(describeStep).join("\n")}

Write the storyboard JSON now.`;
}

export function repairPrompt(
  input: StoryboardPromptInput,
  previousOutput: unknown,
  issues: readonly ValidationIssue[],
): string {
  return `${generatePrompt(input)}

# Your previous attempt was rejected
${"```json"}
${JSON.stringify(previousOutput, null, 2).slice(0, 12_000)}
${"```"}

The validator reported:
${describeIssues(issues)}

Return the complete corrected storyboard JSON. Fix every issue above and keep everything that was already right.`;
}

export const storyboardPromptV1 = { version: PROMPT_VERSION, systemPrompt, generatePrompt, repairPrompt };
