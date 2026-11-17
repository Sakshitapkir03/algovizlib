import type { ComparisonOp, EquationElement, PointerElement, Scene, Storyboard } from "@/lib/storyboard";

import { twoPointers } from "./two-pointers";

export type ValidationIssue = {
  sceneId?: string;
  elementId?: string;
  message: string;
};

export type ValidationResult = { ok: boolean; issues: ValidationIssue[] };

function compare(a: number, b: number): ComparisonOp {
  return a < b ? "<" : a > b ? ">" : "=";
}

/** Engine-independent checks: every equation's arithmetic must be true. */
function validateArithmetic(scene: Scene, issues: ValidationIssue[]) {
  for (const el of scene.elements) {
    if (el.type !== "equation") continue;
    const sum = el.terms.reduce((acc, t) => acc + t, 0);
    if (sum !== el.result) {
      issues.push({
        sceneId: scene.id,
        elementId: el.id,
        message: `Equation terms add up to ${sum}, not ${el.result}`,
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

function validateTwoPointers(
  storyboard: Storyboard,
  input: { values: number[]; target: number },
  issues: ValidationIssue[],
) {
  let run;
  try {
    run = twoPointers(input.values, input.target);
  } catch (err) {
    issues.push({ message: err instanceof Error ? err.message : String(err) });
    return;
  }
  const stateIndex = (left: number, right: number) =>
    run.states.findIndex((s) => s.left === left && s.right === right);

  let lastState = -1;
  let revealed = false;
  const samePair = (indices: readonly number[] | undefined) =>
    run.pair !== null &&
    indices !== undefined &&
    indices.length === 2 &&
    [...indices].sort((a, b) => a - b).every((v, i) => v === run.pair?.[i]);

  for (const scene of storyboard.scenes) {
    const bound = scene.elements.filter(
      (el): el is PointerElement => el.type === "pointer" && el.binds !== undefined,
    );
    const left = bound.find((p) => p.binds === "left");
    const right = bound.find((p) => p.binds === "right");

    for (const p of bound) {
      if (p.binds !== "left" && p.binds !== "right") {
        issues.push({
          sceneId: scene.id,
          elementId: p.id,
          message: `Unknown binding "${p.binds}" (expected "left" or "right")`,
        });
      }
      const row = scene.elements.find((el) => el.type === "item-row" && el.id === p.rowId);
      if (row?.type === "item-row") {
        const rowValues = row.items.map((it) => it.value);
        if (rowValues.length !== input.values.length || rowValues.some((v, i) => v !== input.values[i])) {
          issues.push({
            sceneId: scene.id,
            elementId: row.id,
            message: "Item values do not match the engine input",
          });
        }
      }
    }

    if ((left && !right) || (!left && right)) {
      issues.push({
        sceneId: scene.id,
        message: "A two-pointers scene must bind both a left and a right pointer",
      });
      continue;
    }

    let current: (typeof run.states)[number] | undefined;
    if (left && right) {
      const from = stateIndex(left.fromIndex ?? left.index, right.fromIndex ?? right.index);
      const to = stateIndex(left.index, right.index);
      if (to === -1) {
        issues.push({
          sceneId: scene.id,
          message: `Pointers at (${left.index}, ${right.index}) are never visited by the algorithm`,
        });
      } else if (from === -1) {
        issues.push({
          sceneId: scene.id,
          message: "Pointers start from a position the algorithm never visits",
        });
      } else if (to !== from && to !== from + 1) {
        issues.push({ sceneId: scene.id, message: `Pointers skip moves (step ${from} → ${to})` });
      } else {
        const expectedFrom = lastState === -1 ? 0 : lastState;
        if (from < expectedFrom) {
          issues.push({
            sceneId: scene.id,
            message: `Pointers go backwards (step ${expectedFrom} → ${from})`,
          });
        } else if (from > expectedFrom) {
          issues.push({
            sceneId: scene.id,
            message: `Moves happen off-screen (step ${expectedFrom} → ${from})`,
          });
        }
      }
      if (to !== -1) {
        lastState = Math.max(lastState, to);
        current = run.states[to];
      }
    }

    for (const el of scene.elements) {
      if (el.type === "equation" && current) checkEquation(scene, el, current, run.steps, input, issues);
      if (el.type === "highlight" && el.state === "found") {
        if (!samePair(el.indices)) {
          issues.push({
            sceneId: scene.id,
            elementId: el.id,
            message: "Highlighted answer does not match the engine's pair",
          });
        } else revealed = true;
      }
      if (el.type === "result" && el.indices) {
        if (!samePair(el.indices)) {
          issues.push({
            sceneId: scene.id,
            elementId: el.id,
            message: "Result indices do not match the engine's pair",
          });
        } else revealed = true;
      }
    }
  }

  if (run.pair && !revealed) {
    issues.push({ message: "Storyboard never reveals the pair the algorithm finds" });
  }
}

function checkEquation(
  scene: Scene,
  el: EquationElement,
  state: { left: number; right: number },
  steps: ReturnType<typeof twoPointers>["steps"],
  input: { values: number[]; target: number },
  issues: ValidationIssue[],
) {
  const step = steps.find((s) => s.left === state.left && s.right === state.right);
  if (!step) return;
  const expected = [step.leftValue, step.rightValue];
  if (el.terms.length !== 2 || el.terms.some((t, i) => t !== expected[i])) {
    issues.push({
      sceneId: scene.id,
      elementId: el.id,
      message: `Equation should add the pointed-at values ${expected.join(" + ")}`,
    });
  }
  if (el.comparison) {
    if (el.comparison.target !== input.target) {
      issues.push({
        sceneId: scene.id,
        elementId: el.id,
        message: `Equation target should be ${input.target}`,
      });
    }
    if (el.comparison.op !== step.comparison) {
      issues.push({
        sceneId: scene.id,
        elementId: el.id,
        message: `Engine compares ${step.sum} ${step.comparison} ${input.target}`,
      });
    }
  }
}

/**
 * Check a storyboard against its engine. Hand-written and AI-generated
 * storyboards both go through this before they are shown.
 */
export function validateStoryboard(storyboard: Storyboard): ValidationResult {
  const issues: ValidationIssue[] = [];
  for (const scene of storyboard.scenes) validateArithmetic(scene, issues);

  switch (storyboard.engine?.name) {
    case "two-pointers":
      validateTwoPointers(storyboard, storyboard.engine.input, issues);
      break;
    case undefined:
      break;
  }
  return { ok: issues.length === 0, issues };
}
