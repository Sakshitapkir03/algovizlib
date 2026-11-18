import { runTrace, type Trace, type TraceStep } from "@/lib/traces";

import type { ComparisonOp, Element, EquationElement } from "./elements";
import type { ValidationIssue, ValidationResult } from "./issues";
import { applyOperator } from "./resolve";
import type { Scene, Storyboard } from "./schema";

function compare(a: number, b: number): ComparisonOp {
  return a < b ? "<" : a > b ? ">" : "=";
}

const sameSet = (a: readonly number[] | undefined, b: readonly number[] | undefined) =>
  a !== undefined &&
  b !== undefined &&
  a.length === b.length &&
  [...a].sort((x, y) => x - y).every((v, i) => v === [...b].sort((x, y) => x - y)[i]);

const sameList = <T>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** Engine-independent checks: every equation's arithmetic must be true. */
function validateArithmetic(scene: Scene, issues: ValidationIssue[]) {
  for (const el of scene.elements) {
    if (el.type !== "equation") continue;
    const value = applyOperator(el.operator, el.terms);
    if (value !== el.result) {
      issues.push({
        sceneId: scene.id,
        elementId: el.id,
        message: `${el.terms.join(` ${el.operator} `)} is ${value}, not ${el.result}`,
      });
    }
    if (el.comparison && compare(el.result, el.comparison.target) !== el.comparison.op) {
      issues.push({
        sceneId: scene.id,
        elementId: el.id,
        message: `${el.result} ${el.comparison.op} ${el.comparison.target} is false`,
      });
    }
  }
}

function checkEquation(
  scene: Scene,
  el: EquationElement,
  step: TraceStep,
  stepIndex: number,
  issues: ValidationIssue[],
) {
  const push = (message: string) => issues.push({ sceneId: scene.id, elementId: el.id, message });
  const expected = step.equation;
  if (!expected) {
    push(`Trace step ${stepIndex} has no arithmetic, so this scene can't show an equation`);
    return;
  }
  const show = (terms: readonly number[], op: string) => terms.join(` ${op} `);
  if (el.operator !== expected.operator || !sameList(el.terms, expected.terms)) {
    push(
      `Equation should be ${show(expected.terms, expected.operator)} (trace step ${stepIndex}), not ${show(el.terms, el.operator)}`,
    );
  }
  if (el.result !== expected.result) push(`Equation result should be ${expected.result}`);
  if (el.comparison && !expected.comparison) push(`Trace step ${stepIndex} doesn't compare against anything`);
  if (el.comparison && expected.comparison) {
    if (el.comparison.target !== expected.comparison.target) {
      push(`Equation should compare against ${expected.comparison.target}`);
    }
    if (el.comparison.op !== expected.comparison.op) {
      push(`The trace compares ${expected.result} ${expected.comparison.op} ${expected.comparison.target}`);
    }
  }
}

function rowValues(el: Element): readonly (number | string)[] | undefined {
  if (el.type === "item-row") return el.items.map((i) => i.value);
  if (el.type === "bar-row") return el.bars.map((b) => b.value);
  return undefined;
}

function validateAgainstTrace(storyboard: Storyboard, trace: Trace, issues: ValidationIssue[]) {
  const covered = new Set<number>();
  let lastStep = -1;
  let previous: TraceStep | undefined;
  let revealed = false;

  for (const scene of storyboard.scenes) {
    const push = (message: string, elementId?: string) =>
      issues.push({ sceneId: scene.id, elementId, message });
    const rows = new Map(scene.elements.flatMap((el) => (rowValues(el) ? [[el.id, el] as const] : [])));
    const checkRow = (rowId: string, elementId: string) => {
      const row = rows.get(rowId);
      const values = row && rowValues(row);
      if (values && !sameList(values, trace.row.values)) {
        push(`Row "${rowId}" must hold the trace's values [${trace.row.values.join(", ")}]`, elementId);
      }
    };

    // Reveals and answer checks apply with or without a bound step.
    for (const el of scene.elements) {
      if (
        el.type === "highlight" &&
        el.state === "found" &&
        trace.answerIndices &&
        scene.traceStep === undefined
      ) {
        if (sameSet(el.indices, trace.answerIndices)) revealed = true;
        else push(`Highlighted answer should be items [${trace.answerIndices.join(", ")}]`, el.id);
      }
      if (el.type === "result") {
        if (el.indices && trace.answerIndices) {
          if (sameSet(el.indices, trace.answerIndices)) revealed = true;
          else push(`Result indices should be [${trace.answerIndices.join(", ")}]`, el.id);
        } else if (el.indices) {
          push("This trace's answer isn't a set of positions; drop indices", el.id);
        }
        if (el.showsAnswer) {
          if (el.value === trace.answerDisplay) revealed = true;
          else push(`A result with showsAnswer must display exactly "${trace.answerDisplay}"`, el.id);
        }
      }
    }

    if (scene.traceStep === undefined) {
      for (const el of scene.elements) {
        if (el.type === "pointer" && el.binds) {
          push(`Pointer bound to "${el.binds}" needs the scene to set traceStep`, el.id);
        }
      }
      continue;
    }

    const stepIndex = scene.traceStep;
    const step = trace.steps[stepIndex];
    if (!step) {
      push(`traceStep ${stepIndex} does not exist (the trace has steps 0–${trace.steps.length - 1})`);
      continue;
    }
    if (stepIndex < lastStep) push(`Scenes go backwards in the trace (step ${lastStep} → ${stepIndex})`);
    covered.add(stepIndex);

    for (const el of scene.elements) {
      switch (el.type) {
        case "pointer": {
          if (!el.binds) break;
          checkRow(el.rowId, el.id);
          const expected = step.pointers[el.binds];
          if (expected === undefined) {
            push(`Trace step ${stepIndex} has no pointer "${el.binds}"`, el.id);
          } else if (el.index !== expected) {
            push(
              `Pointer "${el.binds}" should be at ${expected} in trace step ${stepIndex}, not ${el.index}`,
              el.id,
            );
          }
          if (el.fromIndex !== undefined && el.fromIndex !== el.index) {
            const before = previous?.pointers[el.binds];
            if (before === undefined)
              push(`Pointer "${el.binds}" slides in from nowhere (no earlier bound step)`, el.id);
            else if (el.fromIndex !== before) {
              push(
                `Pointer "${el.binds}" should slide from ${before}, where the previous scene left it`,
                el.id,
              );
            }
          }
          break;
        }
        case "equation":
          checkEquation(scene, el, step, stepIndex, issues);
          break;
        case "highlight": {
          checkRow(el.rowId, el.id);
          const expected = step[el.state] ?? (el.state === "found" ? trace.answerIndices : undefined);
          if (!expected) push(`Trace step ${stepIndex} has no "${el.state}" items`, el.id);
          else if (!sameSet(el.indices, expected)) {
            push(`"${el.state}" items in trace step ${stepIndex} are [${expected.join(", ")}]`, el.id);
          } else if (el.state === "found" && sameSet(el.indices, trace.answerIndices)) revealed = true;
          break;
        }
        case "bar-row":
          if (
            el.fill &&
            !(
              step.fill &&
              el.fill.from === step.fill.from &&
              el.fill.to === step.fill.to &&
              el.fill.level === step.fill.level
            )
          ) {
            push(`Container fill doesn't match trace step ${stepIndex}`, el.id);
          }
          if (el.water && !(step.water && sameList(el.water, step.water))) {
            push(`Water levels don't match trace step ${stepIndex}`, el.id);
          }
          break;
        default:
          break;
      }
    }
    lastStep = Math.max(lastStep, stepIndex);
    previous = step;
  }

  trace.steps.forEach((step, i) => {
    if (step.key && !covered.has(i)) {
      issues.push({ message: `Key trace step ${i} (${step.kind}) is not shown by any scene: ${step.note}` });
    }
  });
  if (!revealed) {
    issues.push({
      message: `The storyboard never states the answer: add a result with showsAnswer (value "${trace.answerDisplay}")${trace.answerIndices ? " or a found highlight on the answer items" : ""}`,
    });
  }
}

/**
 * Check a resolved storyboard. Always: equation arithmetic. With a `trace` binding: bound steps exist and never
 * go backwards, every key step is shown, rows hold the trace's values, bound pointers, equations, highlights, and
 * fills match their step, and the answer is revealed correctly. Hand-written and generated storyboards both pass
 * through this before they are shown.
 */
export function validateStoryboard(storyboard: Storyboard): ValidationResult {
  const issues: ValidationIssue[] = [];
  for (const scene of storyboard.scenes) validateArithmetic(scene, issues);

  if (storyboard.trace) {
    let trace: Trace | undefined;
    try {
      trace = runTrace(storyboard.trace.problem, storyboard.trace.args);
    } catch (err) {
      issues.push({ message: err instanceof Error ? err.message : String(err) });
    }
    if (trace) validateAgainstTrace(storyboard, trace, issues);
  }
  return { ok: issues.length === 0, issues };
}
