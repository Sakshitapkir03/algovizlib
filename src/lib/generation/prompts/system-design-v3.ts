import { primitiveCatalog, type ValidationIssue } from "@/lib/storyboard";
import { describeStep } from "@/lib/traces/describe";

import { describeIssues, MAX_SCENES, MIN_SCENES } from "../draft";

import type { LessonPromptInput } from "./system-design-v1";

/**
 * The incident-replay prompt, version 3: version 2 plus reads from replicas (the two stores side by side), sweeps
 * (one measured column per setting, such as the mean replication lag), the fix's measured cost, and a closing scene
 * that states any proof's range and conditions. Versions 1 and 2 stay as they were (earlier storyboards record
 * them); bump on any wording change.
 */
export const SYSTEM_DESIGN_PROMPT_V3_VERSION = "system-design-v3";

const ELEMENTS = [
  "system-diagram",
  "sequence",
  "data-table",
  "metrics",
  "load-chart",
  "choice",
  "result",
] as const;

export function systemPrompt(): string {
  return `You write storyboards for short animated videos that replay a real class of production bug in a system, request by request, then replay the fix and show the bug can no longer happen. You are not writing code.

You return one JSON object matching the provided schema. A deterministic simulation has already run every replay and recorded each event as a numbered step (the KEY steps are the story's beats). Your job is the story: captions, narration, which step each scene shows, and which panels it uses. Every number on screen comes from the simulation.

## Example
Set exampleSource to "problem-native" and omit analogy: the incident is the real-world story. Use its own names and numbers (the order, the key, the amounts, the times).

## Scene arc (${MIN_SCENES}–${MAX_SCENES} scenes in total)
1. The report: the symptom as the customer or support saw it (no traceStep; an unbound system-diagram).
2. The bug, replayed: one scene per KEY step of the first replay, in order.
3. The idea behind the fix (no traceStep; the unbound system-diagram, and a choice contrasting the fix with the tempting non-fix).
4. The fix, replayed: one scene per KEY step of the later replays, in order; say what each replay changes (which message is lost, or the overlap).
5. The closing scene, bound to the LAST step (the proof): metrics showing how many runs broke the rule with and without the fix, a result with showsAnswer: true (title says what the number is; detail states the range the proof covers), and narration naming the general pattern and the conditions the guarantee depends on.
Count before you write: KEY steps + 2 must fit in ${MAX_SCENES} scenes.

## Elements (only these)
${ELEMENTS.map((type) => `- ${type}: ${primitiveCatalog[type]}`).join("\n")}

## Binding rules (checked by a validator; violations are sent back to you)
- Every KEY step must be shown by a scene whose traceStep is that step's index; traceStep values never decrease.
- Bound replay scenes: a sequence (OMIT lanes/rows/current; title = the replay's name) plus ONE of a data-table (show ["keys", "ledger"], OMIT tables) or metrics (show the ids the step lists, OMIT items). A phone has room for no more.
- Measured windows (steps that list measured load for the current window): a load-chart (OMIT windows/current; set limitLine: false when the windows break from a fault, not from load) plus metrics. A phone has room for no more.
- Followed requests and health checks are rows of the sequence: show the step whose row matters (a routing decision, a wait, a health verdict) with a data-table of the step's tables (e.g. ["servers", "outstanding"] or ["health"]).
- Reads from copies (steps that record a read): the sequence shows the read's rows; pair it with a data-table of both stores (show ["primary", "replica"]) so the versions are side by side, or with metrics of the versions.
- Sweeps (steps whose measured columns are settings such as a mean lag, not traffic windows): a load-chart with labelUnit " ms", chips: false, limitLine: false, and a label naming what the bars count (e.g. "stale reloads"), plus metrics.
- A step that measures the fix's cost: a data-table of its table (OMIT tables) or its metrics. Say plainly what the fix costs.
- When the steps check a rule over a range of runs, the closing scene states that exact range (seeds, conditions, traffic) and any condition the guarantee depends on.
- The system-diagram is for unbound scenes (OMIT nodes/edges/tokens), or a bound scene that shows messages on their links instead of a sequence.
- sequence, data-table, and metrics need a traceStep.
- The answer: in the closing scene, a result with showsAnswer: true and value omitted.
- Never write a number that contradicts the simulation. Narration may say numbers, but they must be the steps' numbers.
- Captions are at most 80 characters. Narration is 2–4 plain sentences, no markdown. Element ids are unique within a scene.
- takeaway: pattern = the fix's name; timeComplexity = its cost per request; spaceComplexity = what it stores.`;
}

export function generatePrompt(input: LessonPromptInput): string {
  const { lesson, trace } = input;
  const keyCount = trace.steps.filter((s) => s.key).length;
  const replays = [
    ...new Set(
      trace.steps
        .map((s) => s.sim)
        .filter((s) => s !== undefined)
        .map((s) => `${s.run}: ${s.runLabel}`),
    ),
  ];
  return `# Lesson: ${lesson.title} (${input.topicName}, ${lesson.kind} replay)

The report:
${lesson.report}

What went wrong:
${lesson.whatWentWrong}

The fix:
${lesson.fix}

What the proof covers:
${lesson.proofScope}

Rules the simulation checks: ${lesson.rules.join(" ")}

# exampleSource for this lesson: "problem-native"

# Simulation
Components (one system-diagram): ${(trace.system?.nodes ?? []).map((n) => `${n.id} "${n.label}" (${n.kind})`).join(", ")}; links ${(trace.system?.edges ?? []).map((e) => `${e.from}–${e.to}`).join(", ")}
Replays: ${replays.join("; ")}
Answer: ${trace.answerDisplay}

Steps (${trace.steps.length} total, ${keyCount} KEY):
${trace.steps.map(describeStep).join("\n")}

Write the storyboard JSON now.`;
}

export function repairPrompt(
  input: LessonPromptInput,
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

export const systemDesignPromptV3 = {
  version: SYSTEM_DESIGN_PROMPT_V3_VERSION,
  systemPrompt,
  generatePrompt,
  repairPrompt,
};
