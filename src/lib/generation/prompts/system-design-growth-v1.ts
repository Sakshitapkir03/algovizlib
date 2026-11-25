import { primitiveCatalog, type ValidationIssue } from "@/lib/storyboard";
import { describeStep } from "@/lib/traces/describe";

import { describeIssues, MAX_SCENES, MIN_SCENES } from "../draft";
import type { LessonPromptInput } from "./system-design-v1";

/**
 * The prompt for system design growth stories (a system that grows from one server, a component added only after
 * the simulation measures the bottleneck that justifies it). Separate from the incident prompt, which stays
 * byte-identical; bump the version on any wording change.
 */
export const SYSTEM_DESIGN_GROWTH_PROMPT_VERSION = "system-design-growth-v1";

const ELEMENTS = ["system-diagram", "load-chart", "metrics", "equation", "choice", "result"] as const;

export function systemPrompt(): string {
  return `You write storyboards for short animated videos that grow a system from one server: estimate the load, measure where the system breaks, and add a component only after the simulation has measured the bottleneck that justifies it. You are not writing code.

You return one JSON object matching the provided schema. A deterministic simulation has already run every replay and measured each traffic window as a numbered step (the KEY steps are the story's beats). Your job is the story: captions, narration, which step each scene shows, and which panels it uses. Every number on screen comes from the simulation or the estimate.

## Example
Set exampleSource to "problem-native" and omit analogy: the product and its traffic are the real-world story. Use its own numbers.

## Scene arc (${MIN_SCENES}–${MAX_SCENES} scenes in total)
1. The plan: the product and its starting system (no traceStep; an unbound system-diagram).
2. The estimate: one scene per estimate step you show, each with that step's equation (OMIT terms/operator/result; add a unit and a short verdict). Narration may say the numbers of the steps before it.
3. The first replay: one scene per KEY window, in order, with a load-chart and metrics.
4. The growth step, AFTER the scene that shows the first saturation (a validator enforces it): an unbound system-diagram with stage "grown", and a choice contrasting the part that saturated with the tempting wrong fix.
5. The grown system: one scene per KEY window of the later replays, in order.
6. The closing scene, bound to the LAST step (the measured limits): metrics showing its ids, a result with showsAnswer: true, and narration naming the general lesson.
Count before you write: KEY steps + 2 must fit in ${MAX_SCENES} scenes.

## Elements (only these)
${ELEMENTS.map((type) => `- ${type}: ${primitiveCatalog[type]}`).join("\n")}

## Binding rules (checked by a validator; violations are sent back to you)
- Every KEY step must be shown by a scene whose traceStep is that step's index; traceStep values never decrease.
- A scene may show a component added after another saturates (the balancer, a second server) only after an earlier bound scene showed that saturation.
- Window scenes: a load-chart (OMIT windows/current) plus metrics (show up to 4 of the step's metric ids, OMIT items). A phone has room for no more.
- load-chart and metrics need a traceStep; an estimate step has only an equation.
- The answer: in the closing scene, a result with showsAnswer: true and value omitted.
- Say once that the latencies are illustrative (simulated service times, not real hardware).
- Never write a number that contradicts the simulation. Captions are at most 80 characters. Narration is 2–4 plain sentences, no markdown.
- takeaway: pattern = the general lesson's name; timeComplexity = how the limit scales; spaceComplexity = what each added server costs.`;
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
  const grown = (trace.system?.nodes ?? []).filter((n) => n.addedAfter);
  return `# Lesson: ${lesson.title} (${input.topicName}, growth story)

The report:
${lesson.report}

What went wrong:
${lesson.whatWentWrong}

The fix:
${lesson.fix}

What the simulation checks:
${lesson.proofScope}

Rules: ${lesson.rules.join(" ")}

# exampleSource for this lesson: "problem-native"

# Simulation
Starting components: ${(trace.systemStart ?? trace.system)?.nodes.map((n) => `${n.id} "${n.label}"`).join(", ")}
Grown components: ${trace.system?.nodes.map((n) => `${n.id} "${n.label}"`).join(", ")}
Added after a measured saturation: ${grown.map((n) => `${n.id} (after ${n.addedAfter})`).join(", ") || "none"}
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

export const systemDesignGrowthPromptV1 = {
  version: SYSTEM_DESIGN_GROWTH_PROMPT_VERSION,
  systemPrompt,
  generatePrompt,
  repairPrompt,
};
