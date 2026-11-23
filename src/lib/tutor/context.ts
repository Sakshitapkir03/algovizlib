import { getProblem, getProblemStoryboard } from "@/lib/catalog/repository";
import { runTrace, type Trace, type TraceStep } from "@/lib/traces";
import { describeStep } from "@/lib/traces/describe";

/**
 * What the tutor knows about one moment of a video, built on the server from the catalog, the storyboard, and the
 * trace (rerun here), never from anything the browser sends but the problem key and scene id. `text` is the block
 * the model answers from: the problem, the example being animated, the scene's caption and narration, and the bound
 * trace step's state with the steps before and after it, each in the same form the storyboard prompt uses.
 */
export type StepContext = {
  problemKey: string;
  sceneId: string;
  /** "Step 4 of 9: 3 needs a 6" (scene number, scene count, caption). */
  label: string;
  /** The bound trace step and its neighbors, when the scene has one. */
  step?: TraceStep;
  previous?: TraceStep;
  next?: TraceStep;
  /** The trace step index, when the scene has one. */
  stepIndex?: number;
  sceneIndex: number;
  sceneCount: number;
  text: string;
};

const traces = new Map<string, Trace>();

export function buildStepContext(problemKey: string, sceneId: string): StepContext | undefined {
  const [patternSlug, slug] = problemKey.split("/");
  if (!patternSlug || !slug) return undefined;
  const problem = getProblem(patternSlug, slug);
  const storyboard = problem && getProblemStoryboard(problem);
  if (!problem || !storyboard) return undefined;
  const sceneIndex = storyboard.scenes.findIndex((s) => s.id === sceneId);
  if (sceneIndex < 0) return undefined;
  const scene = storyboard.scenes[sceneIndex];

  let trace: Trace | undefined;
  if (storyboard.trace) {
    const key = `${storyboard.id}`;
    trace = traces.get(key) ?? runTrace(storyboard.trace.problem, storyboard.trace.args);
    traces.set(key, trace);
  }
  const index = scene.traceStep;
  const step = index !== undefined ? trace?.steps[index] : undefined;
  const previous = index !== undefined && index > 0 ? trace?.steps[index - 1] : undefined;
  const next = index !== undefined ? trace?.steps[index + 1] : undefined;
  // The example the video animates: the one whose args the trace runs on (falls back to the first).
  const example =
    problem.examples.find(
      (e) => storyboard.trace && JSON.stringify(e.args) === JSON.stringify(storyboard.trace.args),
    ) ?? problem.examples[0];

  const label = `Step ${sceneIndex + 1} of ${storyboard.scenes.length}: ${scene.caption}`;
  const lines = [
    `Problem: ${problem.title} (${problem.difficulty})`,
    problem.statement,
    "",
    `Example the video animates: ${example.input} → ${example.output}`,
    ...(storyboard.analogy ? [`The video tells it as: ${storyboard.analogy.scenario}`] : []),
    "",
    `Current moment: scene ${sceneIndex + 1} of ${storyboard.scenes.length}, "${scene.caption}"`,
    `Narration: ${scene.narration}`,
  ];
  if (step && index !== undefined) {
    lines.push(
      "",
      "The algorithm's state at this moment (trace step, exact values):",
      describeStep(step, index),
      "",
      previous
        ? `The step before it:\n${describeStep(previous, index - 1)}`
        : "This is the algorithm's first step.",
      "",
      next ? `The step after it:\n${describeStep(next, index + 1)}` : "This is the algorithm's last step.",
    );
  } else {
    lines.push("", "This scene shows no algorithm step: it introduces the problem or sums up the approach.");
  }
  return {
    problemKey,
    sceneId,
    label,
    step,
    previous,
    next,
    stepIndex: index,
    sceneIndex,
    sceneCount: storyboard.scenes.length,
    text: lines.join("\n"),
  };
}
