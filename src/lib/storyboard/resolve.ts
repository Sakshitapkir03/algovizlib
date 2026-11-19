import { finalPositions, runTrace, type Trace, type TraceStep } from "@/lib/traces";

import type { Element, ElementSource } from "./elements";
import { zodIssues, type ValidationIssue } from "./issues";
import { storyboardSchema, type Storyboard, type StoryboardSource } from "./schema";

export type ResolveResult = { storyboard?: Storyboard; trace?: Trace; issues: ValidationIssue[] };

const OPERATORS = {
  "+": (a: number, b: number) => a + b,
  "-": (a: number, b: number) => a - b,
  "×": (a: number, b: number) => a * b,
} as const;

/** For traces whose steps carry their own arrays: the largest number the array ever holds, so bars keep one scale. */
function traceMaxValue(trace: Trace): number | undefined {
  if (!trace.steps.some((step) => step.values)) return undefined;
  const all = [trace.row.values, ...trace.steps.map((step) => step.values ?? [])].flat();
  const max = Math.max(...all.filter((v): v is number => typeof v === "number"));
  return max > 0 ? max : undefined;
}

export function applyOperator(operator: keyof typeof OPERATORS, terms: readonly number[]): number {
  return terms.slice(1).reduce(OPERATORS[operator], terms[0]);
}

/**
 * Turn an authored (or model-written) storyboard into the fully specified form the renderer and validator use.
 * Values the author omitted are taken from the trace: rows from the bound step's `values` (else `trace.row`), and
 * pointers, equations, highlights, fills, water, moves, empty slots, sorted regions, held values, tallies, groups,
 * split trees, merge buffers, partitions, heaps, and counters from the scene's bound step. Values the author did write are kept as written; the validator
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
        field: "traceStep",
        message: `traceStep ${scene.traceStep} does not exist (the trace has steps 0–${trace.steps.length - 1})`,
      });
    }
    const missing = (el: ElementSource, what: string) =>
      issues.push({
        sceneId: scene.id,
        elementId: el.id,
        field: what,
        message: `${what} is missing and can't be taken from the trace${step ? "" : " (the scene has no traceStep)"}`,
      });
    const noState = (el: ElementSource, field: string, state: string) =>
      issues.push({
        sceneId: scene.id,
        elementId: el.id,
        field,
        message: step
          ? `Trace step ${scene.traceStep} has no ${state}; remove the ${el.type} or bind another step`
          : `A ${el.type} without ${field} needs a scene.traceStep`,
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
          // Sorting rearranges the array, so a bound step's own snapshot wins over the trace's starting row.
          const values = step?.values ?? trace?.row.values;
          if (!bars && values) {
            if (values.some((v) => typeof v !== "number")) {
              issues.push({
                sceneId: scene.id,
                elementId: el.id,
                field: "bars",
                message: "This trace's values can't be drawn as bars",
              });
            } else {
              bars = values.map((value, i) => ({
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
            moves: el.moves ?? step?.moves,
            empty: el.empty ?? step?.empty,
            maxValue: el.maxValue ?? (trace ? traceMaxValue(trace) : undefined),
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
                field: "binds",
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
              field: "indices",
              message: `No "${el.state}" items to take from ${step ? `trace step ${scene.traceStep}` : "the trace"}; give indices or remove the highlight`,
            });
            return el;
          }
          return { ...el, indices };
        }
        case "equation": {
          const verdictTone = el.verdictTone ?? step?.equation?.tone;
          if (el.terms) {
            const operator = el.operator ?? "+";
            return { ...el, operator, result: el.result ?? applyOperator(operator, el.terms), verdictTone };
          }
          if (!step?.equation) {
            issues.push({
              sceneId: scene.id,
              elementId: el.id,
              field: "terms",
              message: step
                ? `Trace step ${scene.traceStep} has no arithmetic to show; remove the equation or bind another step`
                : "An equation without terms needs a scene.traceStep",
            });
            return el;
          }
          const { terms, operator, result, comparison } = step.equation;
          return { ...el, terms, operator, result, comparison: el.comparison ?? comparison, verdictTone };
        }
        case "result": {
          if (el.value !== undefined) return el;
          if (el.showsAnswer && trace) return { ...el, value: trace.answerDisplay };
          return (missing(el, "value"), el);
        }
        case "callout":
          return el;
        case "sorted-region": {
          const { from, to, ...rest } = el;
          if (rest.indices) return rest;
          if (from !== undefined && to !== undefined)
            return {
              ...rest,
              indices: Array.from({ length: Math.max(0, to - from + 1) }, (_, k) => from + k),
            };
          const indices = step && finalPositions(step);
          if (!indices) {
            issues.push({
              sceneId: scene.id,
              elementId: el.id,
              field: "indices",
              message: step
                ? `Trace step ${scene.traceStep} has no sorted positions yet; remove the sorted-region or bind another step`
                : "A sorted-region without indices needs a scene.traceStep",
            });
            return el;
          }
          return { ...rest, indices };
        }
        case "held-value": {
          if (el.value !== undefined && el.index !== undefined) return el;
          if (!step?.held) {
            issues.push({
              sceneId: scene.id,
              elementId: el.id,
              field: "value",
              message: step
                ? `Trace step ${scene.traceStep} isn't holding a value; remove the held-value or bind another step`
                : "A held-value without value/index needs a scene.traceStep",
            });
            return el;
          }
          return { ...el, value: el.value ?? step.held.value, index: el.index ?? step.held.index };
        }
        case "count-array": {
          if (el.keys && el.counts) return el;
          if (!step?.counts) {
            issues.push({
              sceneId: scene.id,
              elementId: el.id,
              field: "counts",
              message: step
                ? `Trace step ${scene.traceStep} has no tally; remove the count-array or bind another step`
                : "A count-array without keys/counts needs a scene.traceStep",
            });
            return el;
          }
          return {
            ...el,
            keys: el.keys ?? step.counts.keys,
            counts: el.counts ?? step.counts.counts,
            active: el.active ?? step.counts.active,
          };
        }
        case "segments": {
          if (el.groups) return el;
          if (!step?.segments) return (noState(el, "groups", "split into groups"), el);
          return {
            ...el,
            groups: step.segments,
            active: el.active ?? step.range,
            depth: el.depth ?? step.depth,
          };
        }
        case "split-tree": {
          if (el.levels) return el;
          if (!step?.splitTree) return (noState(el, "levels", "split tree"), el);
          return { ...el, levels: step.splitTree };
        }
        case "merge-buffer": {
          if (el.from !== undefined && el.values) return el;
          if (!step?.buffer) return (noState(el, "values", "merge buffer"), el);
          return {
            ...el,
            from: el.from ?? step.buffer.from,
            values: el.values ?? step.buffer.values,
            taken: el.taken ?? step.buffer.taken,
          };
        }
        case "partition": {
          if (
            el.pivot !== undefined &&
            el.boundary !== undefined &&
            el.from !== undefined &&
            el.to !== undefined
          )
            return el;
          if (step?.pivot === undefined || !step.range) return (noState(el, "pivot", "pivot"), el);
          return {
            ...el,
            pivot: el.pivot ?? step.pivot,
            boundary: el.boundary ?? step.boundary ?? step.pivot,
            from: el.from ?? step.range.from,
            to: el.to ?? step.range.to,
          };
        }
        case "heap-tree": {
          const values = el.values ?? step?.values ?? trace?.row.values;
          if (!values) return (missing(el, "values"), el);
          if (values.some((v) => typeof v !== "number")) {
            issues.push({
              sceneId: scene.id,
              elementId: el.id,
              field: "values",
              message: "This trace's values can't be drawn as a heap",
            });
            return el;
          }
          return {
            ...el,
            values: values as number[],
            heapSize: el.heapSize ?? step?.heapSize ?? values.length,
            compare: el.compare ?? step?.compare,
            moves: el.moves ?? step?.moves,
          };
        }
        case "counter": {
          if (el.value !== undefined) return el;
          if (!step?.counter) return (noState(el, "value", "running total"), el);
          return { ...el, value: step.counter.value, delta: el.delta ?? step.counter.delta };
        }
      }
    });

    if (step) previousStep = step;
    return { ...scene, elements };
  });

  if (issues.length > 0) return { trace, issues };
  const resolved = { ...source, scenes };
  const parsed = storyboardSchema.safeParse(resolved);
  if (!parsed.success) return { trace, issues: zodIssues("", parsed.error.issues, resolved) };
  return { storyboard: parsed.data, trace, issues: [] };
}
