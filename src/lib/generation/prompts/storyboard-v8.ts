import type { Problem } from "@/lib/catalog";
import { primitiveCatalog, type ValidationIssue } from "@/lib/storyboard";
import type { Trace, TraceStep } from "@/lib/traces";

import { describeIssues, MAX_SCENES, MIN_SCENES } from "../draft";

/**
 * Prompt templates for storyboard generation. Bump the version on ANY wording change: it's recorded in each
 * generated storyboard and is part of the cache key, so changed prompts never reuse stale results.
 */
export const PROMPT_VERSION = "storyboard-v8";

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
- Every scene that shows data starts with the row element (same id in every scene, e.g. "row"); omit its values so they come from the trace, and give labels that fit the story (one per value). When steps list an array, a bound scene's row shows that step's array, and its moves and empty slots appear automatically.
- Pointers: set binds to a pointer name the step actually has, set rowId, and OMIT index/fromIndex. A step that lists no pointers gets no bound pointers.
- Equations: only in scenes whose step has arithmetic. OMIT terms/operator/result/comparison; add unit and a short verdict. If the step lists a tone, OMIT verdictTone and make the verdict read that way (positive: "new best"; neutral: "not better").
- Highlights: OMIT indices in bound scenes. Only use a state the step lists (active/rejected/found).
- sorted-region / held-value / count-array: only in scenes whose step lists a sorted range or final positions / held value / tally; OMIT their indices, value/index, and keys/counts/active.
- segments / split-tree / merge-buffer / partition / counter: only in scenes whose step lists groups / a split tree / a buffer / a pivot / a count; OMIT their state fields. heap-tree: in every scene of a heap trace that shows the bars (bound or not); OMIT its state fields, and anchor callouts to the bars rather than floating them over the tree.
- window / freq-table / deque: only in scenes whose step lists a window / counts / a deque; OMIT their state fields (from/to/value, entries/active, indices/output/popped). Give the window a short label for its value ("sum", "length"); its edges slide on their own between bound scenes.
- search-range / number-line / cut: only in scenes whose step lists a search range / candidate answers / cuts; OMIT their state fields (from/to/mid/sorted, min/max/low/high/mid, at). A search range's bracket shrinks on its own between bound scenes; give an empty range a label for the gap ("insert here"). With two lists, add one cut per item-row, and give the second list's item-row traceRow: "second".
- linked-list: when the trace's row is a list ("list"), make it the first element of every scene that shows data, and OMIT nodes/rewired/fromPlaces (a bound scene takes the step's list, an unbound scene the starting list). Rewired links and moving nodes animate on their own. Give laneLabels that name each lane in your analogy. Put pointers on it with placement: "above" and rowId set to the linked-list's id, bound to the step's pointer names; a pointer the step doesn't list is null, so leave it out. Highlights on it use node ids (OMIT indices). Skip callouts in list scenes: the narration carries the reasoning. With a heap of list heads (step lists a heap), add a heap-tree in those scenes (OMIT values) and drop it once the heap is empty.
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
      `equation: ${e.terms.length > 1 ? `${e.terms.join(` ${e.operator} `)} = ${e.result}` : e.result}${e.comparison ? ` ${e.comparison.op} ${e.comparison.target}` : ""}${e.tone ? ` (tone: ${e.tone})` : ""}`,
    );
  }
  for (const state of ["active", "rejected", "found"] as const) {
    if (step[state]?.length) parts.push(`${state}: [${step[state]!.join(", ")}]`);
  }
  if (step.fill) parts.push(`container: bars ${step.fill.from}–${step.fill.to} filled to ${step.fill.level}`);
  if (step.water) parts.push(`water: [${step.water.join(", ")}]`);
  if (step.values) parts.push(`array: [${step.values.join(", ")}]`);
  if (step.moves) parts.push(`moves: ${step.moves.map((m) => `${m.from}→${m.to}`).join(", ")}`);
  if (step.empty) parts.push(`empty slots: [${step.empty.join(", ")}]`);
  if (step.final) parts.push(`final positions: [${step.final.join(", ")}]`);
  else if (step.sorted) parts.push(`sorted: ${step.sorted.from}–${step.sorted.to}`);
  if (step.held) parts.push(`holding ${step.held.value} above slot ${step.held.index}`);
  if (step.range)
    parts.push(
      `range: ${step.range.from}–${step.range.to}${step.depth !== undefined ? ` (level ${step.depth})` : ""}`,
    );
  if (step.segments)
    parts.push(
      `groups: ${step.segments.map((g) => (g.from === g.to ? g.from : `${g.from}–${g.to}`)).join(" | ")}`,
    );
  if (step.splitTree)
    parts.push(
      `split tree: ${step.splitTree.map((level) => level.map((g) => `[${g.join(",")}]`).join(" ")).join(" / ")}`,
    );
  if (step.buffer)
    parts.push(
      `buffer from ${step.buffer.from}: [${step.buffer.values.map((v) => v ?? "_").join(", ")}]${step.buffer.taken !== undefined ? ` (just wrote slot ${step.buffer.taken})` : ""}`,
    );
  if (step.pivot !== undefined)
    parts.push(
      `pivot at ${step.pivot}${step.boundary !== undefined ? `, boundary before ${step.boundary}` : ""}`,
    );
  if (step.heapSize !== undefined) parts.push(`heap size: ${step.heapSize}`);
  if (step.compare) parts.push(`comparing parent ${step.compare[0]} with child ${step.compare[1]}`);
  if (step.counter)
    parts.push(
      `count: ${step.counter.value}${step.counter.delta !== undefined ? ` (+${step.counter.delta})` : ""}`,
    );
  if (step.window)
    parts.push(
      `window: ${step.window.to < step.window.from ? "empty" : `${step.window.from}–${step.window.to}`}${step.window.value !== undefined ? ` (value ${step.window.value})` : ""}`,
    );
  if (step.freq)
    parts.push(
      `counts: ${step.freq.entries.map((e) => `${e.key}:${e.count}${e.need !== undefined ? `/${e.need}` : ""}`).join(" ")}${step.freq.active !== undefined ? ` (changed: ${step.freq.active})` : ""}`,
    );
  if (step.deque)
    parts.push(
      `deque (front→back positions): [${step.deque.indices.join(", ")}]${step.deque.poppedBack?.length ? `, removed from back: [${step.deque.poppedBack.join(", ")}]` : ""}${step.deque.poppedFront?.length ? `, removed from front: [${step.deque.poppedFront.join(", ")}]` : ""}, output: [${step.deque.output.join(", ")}]`,
    );
  if (step.search) {
    const s = step.search;
    parts.push(
      `search range: ${s.to < s.from ? `empty (the gap before ${s.from})` : `${s.from}–${s.to}`}${s.mid !== undefined ? `, mid ${s.mid}` : ""}${s.sorted ? `, sorted half ${s.sorted.from}–${s.sorted.to}` : ""}`,
    );
  }
  if (step.answers) {
    const a = step.answers;
    parts.push(
      `candidate answers ${a.min}–${a.max}: ruled out below ${a.low}, known to work from ${a.high}${a.mid !== undefined ? `, tested ${a.mid}` : ""}`,
    );
  }
  if (step.cuts)
    parts.push(`cuts: first list after ${step.cuts.first}, second list after ${step.cuts.second}`);
  if (step.counts)
    parts.push(
      `tally: ${step.counts.keys.map((k, i) => `${k}:${step.counts!.counts[i]}`).join(" ")}${step.counts.active !== undefined ? ` (changed: ${step.counts.keys[step.counts.active]})` : ""}`,
    );
  if (step.links) {
    // Each lane left to right, following slots: "#4 dummy → #0 …".
    const lanes = new Map<number, typeof step.links.nodes>();
    for (const node of [...step.links.nodes].sort((a, b) => a.slot - b.slot))
      lanes.set(node.lane, [...(lanes.get(node.lane) ?? []), node]);
    parts.push(
      `lanes: ${[...lanes.entries()]
        .sort(([a], [b]) => a - b)
        .map(
          ([lane, nodes]) =>
            `${lane}: ${nodes.map((n) => `#${n.id}(${n.value})→${n.next === null ? "null" : `#${n.next}`}`).join(" ")}`,
        )
        .join(" ; ")}`,
    );
    if (step.links.rewired?.length)
      parts.push(
        `rewired: ${step.links.rewired.map((r) => `#${r.node} ${r.from === null ? "null" : `#${r.from}`}⇒${r.to === null ? "null" : `#${r.to}`}`).join(", ")}`,
      );
  }
  if (step.heap) parts.push(`heap: [${step.heap.join(", ")}]`);
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
${
  trace.row.display === "list"
    ? "Nodes (use one linked-list; pointers and highlights refer to node ids), id: value"
    : `Row (${trace.row.display === "bars" ? "use a bar-row" : "use an item-row"}), index: value`
}
${trace.row.values.map((v, i) => `  ${i}: ${JSON.stringify(v)}`).join("\n")}${
    trace.secondRow
      ? `\nSecond list (a second item-row with traceRow: "second"), index: value\n${trace.secondRow.values.map((v, i) => `  ${i}: ${JSON.stringify(v)}`).join("\n")}`
      : ""
  }
Pointer names: ${trace.pointerNames.join(", ") || "none"}
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

export const storyboardPromptV8 = { version: PROMPT_VERSION, systemPrompt, generatePrompt, repairPrompt };
