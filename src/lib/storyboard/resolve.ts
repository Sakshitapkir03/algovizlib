import { runTrace, type Trace, type TraceStep } from "@/lib/traces";

import type { Element, ElementSource } from "./elements";
import { zodIssues, type ValidationIssue } from "./issues";
import { storyboardSchema, type Storyboard, type StoryboardSource } from "./schema";

export type ResolveResult = { storyboard?: Storyboard; trace?: Trace; issues: ValidationIssue[] };

const OPERATORS = {
  "+": (a: number, b: number) => a + b,
  "-": (a: number, b: number) => a - b,
  "×": (a: number, b: number) => a * b,
} as const;

export function applyOperator(operator: keyof typeof OPERATORS, terms: readonly number[]): number {
  return terms.slice(1).reduce(OPERATORS[operator], terms[0]);
}

/**
 * Turn an authored (or model-written) storyboard into the fully specified form the renderer and validator use.
 * Values the author omitted are taken from the trace: rows from `trace.row`, and pointers, equations, highlights,
 * fills, and water from the scene's bound step. Values the author did write are kept as written; the validator
 * checks them against the trace. Returns issues instead of throwing, so the generator can send them back.
 */
export function resolveStoryboard(source: StoryboardSource): ResolveResult {
  const issues: ValidationIssue[] = [];
  let trace: Trace | undefined;
  if (source.trace) {
    try {
      trace = runTrace(source.trace.problem, source.trace.args);
    } catch (err) {
      issues.push({ message: err instanceof Error ? err.message : String(err) });
    }
  }

  let previousStep: TraceStep | undefined;
  const scenes = source.scenes.map((scene) => {
    const step = scene.traceStep !== undefined ? trace?.steps[scene.traceStep] : undefined;
    if (scene.traceStep !== undefined && trace && !step) {
      issues.push({
        sceneId: scene.id,
        message: `traceStep ${scene.traceStep} does not exist (the trace has steps 0–${trace.steps.length - 1})`,
      });
    }
    const missing = (el: ElementSource, what: string) =>
      issues.push({
        sceneId: scene.id,
        elementId: el.id,
        message: `${what} is missing and can't be taken from the trace${step ? "" : " (the scene has no traceStep)"}`,
      });

    const elements = scene.elements.map((el): ElementSource | Element => {
      switch (el.type) {
        case "item-row": {
          if (el.items) return el;
          if (!trace) return (missing(el, "items"), el);
          const { labels, ...rest } = el;
          return {
            ...rest,
            items: trace.row.values.map((value, i) => ({ label: labels?.[i] ?? `[${i}]`, value })),
          };
        }
        case "bar-row": {
          const { labels, ...rest } = el;
          let bars = el.bars;
          if (!bars && trace) {
            if (trace.row.values.some((v) => typeof v !== "number")) {
              issues.push({
                sceneId: scene.id,
                elementId: el.id,
                message: "This trace's values can't be drawn as bars",
              });
            } else {
              bars = trace.row.values.map((value, i) => ({
                label: labels?.[i] ?? String(i),
                value: value as number,
              }));
            }
          }
          if (!bars) missing(el, "bars");
          return {
            ...rest,
            bars,
            fill: el.fill ?? step?.fill,
            water: el.water ?? step?.water,
          } as ElementSource;
        }
        case "pointer": {
          let index = el.index;
          if (index === undefined && el.binds) index = step?.pointers[el.binds];
          if (index === undefined) {
            if (el.binds && step) {
              issues.push({
                sceneId: scene.id,
                elementId: el.id,
                message: `Trace step ${scene.traceStep} has no pointer "${el.binds}" (it has: ${Object.keys(step.pointers).join(", ") || "none"}). Remove this pointer from the scene.`,
              });
            } else missing(el, "index");
            return el;
          }
          let fromIndex = el.fromIndex;
          if (fromIndex === undefined && el.binds && previousStep && step && previousStep !== step) {
            const before = previousStep.pointers[el.binds];
            if (before !== undefined && before !== index) fromIndex = before;
          }
          return { ...el, index, fromIndex };
        }
        case "highlight": {
          if (el.indices) return el;
          const fromStep = step?.[el.state];
          const indices = fromStep ?? (el.state === "found" ? trace?.answerIndices : undefined);
          if (!indices || indices.length === 0) {
            issues.push({
              sceneId: scene.id,
              elementId: el.id,
              message: `No "${el.state}" items to take from ${step ? `trace step ${scene.traceStep}` : "the trace"}; give indices or remove the highlight`,
            });
            return el;
          }
          return { ...el, indices };
        }
        case "equation": {
          if (el.terms) {
            const operator = el.operator ?? "+";
            return { ...el, operator, result: el.result ?? applyOperator(operator, el.terms) };
          }
          if (!step?.equation) {
            issues.push({
              sceneId: scene.id,
              elementId: el.id,
              message: step
                ? `Trace step ${scene.traceStep} has no arithmetic to show; remove the equation or bind another step`
                : "An equation without terms needs a scene.traceStep",
            });
            return el;
          }
          const { terms, operator, result, comparison } = step.equation;
          return { ...el, terms, operator, result, comparison: el.comparison ?? comparison };
        }
        case "result": {
          if (el.value !== undefined) return el;
          if (el.showsAnswer && trace) return { ...el, value: trace.answerDisplay };
          return (missing(el, "value"), el);
        }
        case "callout":
          return el;
      }
    });

    if (step) previousStep = step;
    return { ...scene, elements };
  });

  if (issues.length > 0) return { trace, issues };
  const parsed = storyboardSchema.safeParse({ ...source, scenes });
  if (!parsed.success) return { trace, issues: zodIssues("", parsed.error.issues) };
  return { storyboard: parsed.data, trace, issues: [] };
}
