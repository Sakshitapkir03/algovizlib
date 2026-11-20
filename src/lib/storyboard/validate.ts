import { finalPositions, runTrace, type Trace, type TraceStep } from "@/lib/traces";

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

/** Structural equality for small trace-shaped values (key order matches: both come from the same schemas). */
const sameJson = (a: unknown, b: unknown) => b !== undefined && JSON.stringify(a) === JSON.stringify(b);

/** A set of positions as compact runs, e.g. "0–2, 5". */
const positions = (indices: readonly number[]) => {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let k = 0; k < sorted.length;) {
    let end = k;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end++;
    runs.push(end === k ? `${sorted[k]}` : `${sorted[k]}–${sorted[end]}`);
    k = end + 1;
  }
  return runs.join(", ");
};

const ranges = (groups: readonly { from: number; to: number }[]) =>
  groups.map((g) => (g.from === g.to ? `${g.from}` : `${g.from}–${g.to}`)).join(" | ");

/** Engine-independent checks: every equation's arithmetic must be true. */
function validateArithmetic(scene: Scene, issues: ValidationIssue[]) {
  for (const el of scene.elements) {
    if (el.type !== "equation") continue;
    const value = applyOperator(el.operator, el.terms);
    if (value !== el.result) {
      issues.push({
        sceneId: scene.id,
        elementId: el.id,
        field: "result",
        message: `${el.terms.join(` ${el.operator} `)} is ${value}, not ${el.result}`,
      });
    }
    if (el.comparison && compare(el.result, el.comparison.target) !== el.comparison.op) {
      issues.push({
        sceneId: scene.id,
        elementId: el.id,
        field: "comparison",
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
  const push = (field: string, message: string, values?: { expected: string; actual: string }) =>
    issues.push({ sceneId: scene.id, elementId: el.id, field, message, ...values });
  const expected = step.equation;
  if (!expected) {
    push("type", `Trace step ${stepIndex} has no arithmetic, so this scene can't show an equation`);
    return;
  }
  const show = (terms: readonly number[], op: string) => terms.join(` ${op} `);
  if (el.operator !== expected.operator || !sameList(el.terms, expected.terms)) {
    push(
      "terms",
      `Equation should be ${show(expected.terms, expected.operator)} (trace step ${stepIndex}), not ${show(el.terms, el.operator)}`,
    );
  }
  if (el.result !== expected.result) {
    push("result", "Equation result doesn't match the trace", {
      expected: String(expected.result),
      actual: String(el.result),
    });
  }
  if (expected.tone && el.verdictTone !== expected.tone) {
    push(
      "verdictTone",
      `Trace step ${stepIndex} reads as ${expected.tone}; omit verdictTone to take it from the step`,
      {
        expected: expected.tone,
        actual: String(el.verdictTone),
      },
    );
  }
  if (el.comparison && !expected.comparison) {
    push("comparison", `Trace step ${stepIndex} doesn't compare against anything; omit comparison`);
  }
  if (el.comparison && expected.comparison) {
    if (el.comparison.target !== expected.comparison.target) {
      push("comparison.target", "Equation compares against the wrong target", {
        expected: String(expected.comparison.target),
        actual: String(el.comparison.target),
      });
    }
    if (el.comparison.op !== expected.comparison.op) {
      push(
        "comparison.op",
        `The trace compares ${expected.result} ${expected.comparison.op} ${expected.comparison.target}`,
        { expected: expected.comparison.op, actual: el.comparison.op },
      );
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
    const push = (
      message: string,
      elementId?: string,
      field?: string,
      values?: { expected: string; actual: string },
    ) => issues.push({ sceneId: scene.id, elementId, field, message, ...values });
    const list = (values: readonly unknown[]) => `[${values.join(", ")}]`;
    const rows = new Map(scene.elements.flatMap((el) => (rowValues(el) ? [[el.id, el] as const] : [])));
    const boundStep = scene.traceStep !== undefined ? trace.steps[scene.traceStep] : undefined;
    // The array as it stands at this scene's step (sorting rearranges it), else the trace's starting row.
    const expectedValues = boundStep?.values ?? trace.row.values;
    const checkedRows = new Set<string>();
    const isSecond = (rowId: string) => {
      const row = rows.get(rowId);
      return row?.type === "item-row" && row.traceRow === "second";
    };
    const checkRow = (rowId: string) => {
      if (checkedRows.has(rowId)) return;
      checkedRows.add(rowId);
      const row = rows.get(rowId);
      const values = row && rowValues(row);
      if (!values) return;
      if (isSecond(rowId)) {
        const second = trace.secondRow?.values;
        if (!second) push("This trace has only one list; remove traceRow", rowId, "traceRow");
        else if (!sameList(values, second))
          push(`Row "${rowId}" must hold the trace's second list`, rowId, "items", {
            expected: list(second),
            actual: list(values),
          });
        return;
      }
      if (!sameList(values, expectedValues)) {
        push(
          boundStep?.values
            ? `Row "${rowId}" must hold the array as it is after trace step ${scene.traceStep}`
            : `Row "${rowId}" must hold the trace's values`,
          rowId,
          "items",
          { expected: list(expectedValues), actual: list(values) },
        );
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
        else
          push("Highlighted answer is wrong", el.id, "indices", {
            expected: list(trace.answerIndices),
            actual: list(el.indices),
          });
      }
      if (el.type === "result") {
        if (el.indices && trace.answerIndices) {
          if (sameSet(el.indices, trace.answerIndices)) revealed = true;
          else
            push("Result indices are wrong", el.id, "indices", {
              expected: list(trace.answerIndices),
              actual: list(el.indices),
            });
        } else if (el.indices) {
          push("This trace's answer isn't a set of positions; drop indices", el.id, "indices");
        }
        if (el.showsAnswer) {
          if (el.value === trace.answerDisplay) revealed = true;
          else
            push(`A result with showsAnswer must display exactly "${trace.answerDisplay}"`, el.id, "value", {
              expected: JSON.stringify(trace.answerDisplay),
              actual: JSON.stringify(el.value),
            });
        }
      }
    }

    if (scene.traceStep === undefined) {
      for (const el of scene.elements) {
        if (el.type === "pointer" && el.binds) {
          push(`Pointer bound to "${el.binds}" needs the scene to set traceStep`, el.id, "binds");
        }
      }
      continue;
    }

    const stepIndex = scene.traceStep;
    const step = trace.steps[stepIndex];
    if (!step) {
      push(
        `traceStep ${stepIndex} does not exist (the trace has steps 0–${trace.steps.length - 1})`,
        undefined,
        "traceStep",
      );
      continue;
    }
    if (stepIndex < lastStep) {
      push(`Scenes go backwards in the trace (step ${lastStep} → ${stepIndex})`, undefined, "traceStep", {
        expected: `≥ ${lastStep}`,
        actual: String(stepIndex),
      });
    }
    covered.add(stepIndex);

    for (const el of scene.elements) {
      switch (el.type) {
        case "pointer": {
          if (!el.binds) break;
          checkRow(el.rowId);
          const expected = step.pointers[el.binds];
          if (expected === undefined) {
            push(
              `Trace step ${stepIndex} has no pointer "${el.binds}" (it has: ${Object.keys(step.pointers).join(", ") || "none"})`,
              el.id,
              "binds",
            );
          } else if (el.index !== expected) {
            push(
              `Pointer "${el.binds}" should be at ${expected} in trace step ${stepIndex}, not ${el.index}`,
              el.id,
              "index",
            );
          }
          if (el.fromIndex !== undefined && el.fromIndex !== el.index) {
            const before = previous?.pointers[el.binds];
            if (before === undefined)
              push(
                `Pointer "${el.binds}" slides in from nowhere (no earlier bound step)`,
                el.id,
                "fromIndex",
              );
            else if (el.fromIndex !== before) {
              push(
                `Pointer "${el.binds}" should slide from ${before}, where the previous scene left it`,
                el.id,
                "fromIndex",
                { expected: String(before), actual: String(el.fromIndex) },
              );
            }
          }
          break;
        }
        case "equation":
          checkEquation(scene, el, step, stepIndex, issues);
          break;
        case "highlight": {
          checkRow(el.rowId);
          const expected = step[el.state] ?? (el.state === "found" ? trace.answerIndices : undefined);
          if (!expected) push(`Trace step ${stepIndex} has no "${el.state}" items`, el.id, "state");
          else if (!sameSet(el.indices, expected)) {
            push(`Wrong "${el.state}" items for trace step ${stepIndex}`, el.id, "indices", {
              expected: list(expected),
              actual: list(el.indices),
            });
          } else if (el.state === "found" && sameSet(el.indices, trace.answerIndices)) revealed = true;
          break;
        }
        case "bar-row":
          if (step.values) checkRow(el.id);
          if (el.moves && JSON.stringify(el.moves) !== JSON.stringify(step.moves ?? [])) {
            push(`Bar moves don't match trace step ${stepIndex}`, el.id, "moves", {
              expected: JSON.stringify(step.moves ?? []),
              actual: JSON.stringify(el.moves),
            });
          }
          if (el.empty && !sameSet(el.empty, step.empty ?? [])) {
            push(`Empty slots don't match trace step ${stepIndex}`, el.id, "empty", {
              expected: list(step.empty ?? []),
              actual: list(el.empty),
            });
          }
          if (
            el.fill &&
            !(
              step.fill &&
              el.fill.from === step.fill.from &&
              el.fill.to === step.fill.to &&
              el.fill.level === step.fill.level
            )
          ) {
            push(`Container fill doesn't match trace step ${stepIndex}`, el.id, "fill", {
              expected: JSON.stringify(step.fill ?? null),
              actual: JSON.stringify(el.fill),
            });
          }
          if (el.water && !(step.water && sameList(el.water, step.water))) {
            push(`Water levels don't match trace step ${stepIndex}`, el.id, "water", {
              expected: list(step.water ?? []),
              actual: list(el.water),
            });
          }
          break;
        case "sorted-region": {
          checkRow(el.rowId);
          const expected = finalPositions(step);
          if (!expected) push(`Trace step ${stepIndex} has no sorted positions yet`, el.id, "indices");
          else if (!sameSet(el.indices, expected)) {
            push(`Sorted positions don't match trace step ${stepIndex}`, el.id, "indices", {
              expected: positions(expected),
              actual: positions(el.indices),
            });
          }
          break;
        }
        case "held-value": {
          checkRow(el.rowId);
          const expected = step.held;
          if (!expected) push(`Trace step ${stepIndex} isn't holding a value`, el.id, "value");
          else if (el.value !== expected.value || el.index !== expected.index) {
            push(`Held value doesn't match trace step ${stepIndex}`, el.id, "value", {
              expected: `${expected.value} above slot ${expected.index}`,
              actual: `${el.value} above slot ${el.index}`,
            });
          }
          break;
        }
        case "count-array": {
          const expected = step.counts;
          if (!expected) push(`Trace step ${stepIndex} has no tally`, el.id, "counts");
          else {
            if (!sameList(el.keys, expected.keys))
              push(`Tally keys don't match trace step ${stepIndex}`, el.id, "keys", {
                expected: list(expected.keys),
                actual: list(el.keys),
              });
            if (!sameList(el.counts, expected.counts))
              push(`Tally counts don't match trace step ${stepIndex}`, el.id, "counts", {
                expected: list(expected.counts),
                actual: list(el.counts),
              });
            if (el.active !== undefined && el.active !== expected.active)
              push(`The active tally cell doesn't match trace step ${stepIndex}`, el.id, "active", {
                expected: String(expected.active ?? "none"),
                actual: String(el.active),
              });
          }
          break;
        }
        case "segments": {
          checkRow(el.rowId);
          if (!step.segments) push(`Trace step ${stepIndex} has no split into groups`, el.id, "groups");
          else {
            if (!sameJson(el.groups, step.segments))
              push(`Groups don't match trace step ${stepIndex}`, el.id, "groups", {
                expected: ranges(step.segments),
                actual: ranges(el.groups),
              });
            if (el.active && !sameJson(el.active, step.range))
              push(`The active group doesn't match trace step ${stepIndex}`, el.id, "active", {
                expected: step.range ? ranges([step.range]) : "none",
                actual: ranges([el.active]),
              });
            if (el.depth !== undefined && el.depth !== step.depth)
              push(`The level doesn't match trace step ${stepIndex}`, el.id, "depth", {
                expected: String(step.depth ?? "none"),
                actual: String(el.depth),
              });
          }
          break;
        }
        case "split-tree":
          if (!step.splitTree) push(`Trace step ${stepIndex} has no split tree`, el.id, "levels");
          else if (!sameJson(el.levels, step.splitTree))
            push(`Split levels don't match trace step ${stepIndex}`, el.id, "levels", {
              expected: JSON.stringify(step.splitTree),
              actual: JSON.stringify(el.levels),
            });
          break;
        case "merge-buffer": {
          checkRow(el.rowId);
          const expected = step.buffer;
          if (!expected) push(`Trace step ${stepIndex} has no merge buffer`, el.id, "values");
          else {
            if (el.from !== expected.from || !sameJson(el.values, expected.values))
              push(`Merge buffer doesn't match trace step ${stepIndex}`, el.id, "values", {
                expected: `${list(expected.values.map((v) => v ?? "_"))} from ${expected.from}`,
                actual: `${list(el.values.map((v) => v ?? "_"))} from ${el.from}`,
              });
            if (el.taken !== undefined && el.taken !== expected.taken)
              push(`The slot just written doesn't match trace step ${stepIndex}`, el.id, "taken", {
                expected: String(expected.taken ?? "none"),
                actual: String(el.taken),
              });
          }
          break;
        }
        case "partition": {
          checkRow(el.rowId);
          if (step.pivot === undefined || !step.range)
            push(`Trace step ${stepIndex} has no pivot`, el.id, "pivot");
          else {
            const expected = `pivot ${step.pivot}, boundary ${step.boundary ?? step.pivot}, range ${step.range.from}–${step.range.to}`;
            const actual = `pivot ${el.pivot}, boundary ${el.boundary}, range ${el.from}–${el.to}`;
            if (expected !== actual)
              push(`Partition doesn't match trace step ${stepIndex}`, el.id, "pivot", { expected, actual });
          }
          break;
        }
        case "heap-tree": {
          if (!sameList(el.values, expectedValues))
            push(`The heap must show the array as it is after trace step ${stepIndex}`, el.id, "values", {
              expected: list(expectedValues),
              actual: list(el.values),
            });
          const heapSize = step.heapSize ?? expectedValues.length;
          if (el.heapSize !== heapSize)
            push(`Heap size doesn't match trace step ${stepIndex}`, el.id, "heapSize", {
              expected: String(heapSize),
              actual: String(el.heapSize),
            });
          if (el.compare && !sameJson(el.compare, step.compare))
            push(`Compared nodes don't match trace step ${stepIndex}`, el.id, "compare", {
              expected: JSON.stringify(step.compare ?? null),
              actual: JSON.stringify(el.compare),
            });
          if (el.moves && !sameJson(el.moves, step.moves ?? []))
            push(`Node moves don't match trace step ${stepIndex}`, el.id, "moves", {
              expected: JSON.stringify(step.moves ?? []),
              actual: JSON.stringify(el.moves),
            });
          break;
        }
        case "counter":
          if (!step.counter) push(`Trace step ${stepIndex} has no running total`, el.id, "value");
          else {
            if (el.value !== step.counter.value)
              push(`Counter doesn't match trace step ${stepIndex}`, el.id, "value", {
                expected: String(step.counter.value),
                actual: String(el.value),
              });
            if (el.delta !== undefined && el.delta !== step.counter.delta)
              push(`Counter change doesn't match trace step ${stepIndex}`, el.id, "delta", {
                expected: String(step.counter.delta ?? "none"),
                actual: String(el.delta),
              });
          }
          break;
        case "window": {
          checkRow(el.rowId);
          const expected = step.window;
          const show = (w: { from: number; to: number }) => (w.to < w.from ? "empty" : `${w.from}–${w.to}`);
          if (!expected) push(`Trace step ${stepIndex} has no window`, el.id, "from");
          else {
            if (el.from !== expected.from || el.to !== expected.to)
              push(`Window doesn't match trace step ${stepIndex}`, el.id, "from", {
                expected: show(expected),
                actual: show(el),
              });
            if (el.value !== undefined && String(el.value) !== String(expected.value ?? ""))
              push(
                expected.value === undefined
                  ? `Trace step ${stepIndex}'s window has no value; omit value`
                  : `Window value doesn't match trace step ${stepIndex}`,
                el.id,
                "value",
                { expected: String(expected.value ?? "none"), actual: String(el.value) },
              );
          }
          if (el.fromRange) {
            const before = previous?.window;
            if (!before) push("Window slides in from nowhere (no earlier bound window)", el.id, "fromRange");
            else if (before.from !== el.fromRange.from || before.to !== el.fromRange.to)
              push("Window should slide from where the previous scene left it", el.id, "fromRange", {
                expected: show(before),
                actual: show(el.fromRange),
              });
          }
          break;
        }
        case "freq-table": {
          const expected = step.freq;
          if (!expected) push(`Trace step ${stepIndex} has no character counts`, el.id, "entries");
          else {
            const show = (entries: typeof el.entries) =>
              entries.map((e) => `${e.key}:${e.count}${e.need !== undefined ? `/${e.need}` : ""}`).join(" ");
            if (!sameJson(el.entries, expected.entries))
              push(`Character counts don't match trace step ${stepIndex}`, el.id, "entries", {
                expected: show(expected.entries),
                actual: show(el.entries),
              });
            if (el.active !== undefined && el.active !== expected.active)
              push(`The changed count doesn't match trace step ${stepIndex}`, el.id, "active", {
                expected: expected.active ?? "none",
                actual: el.active,
              });
          }
          break;
        }
        case "deque": {
          checkRow(el.rowId);
          const expected = step.deque;
          if (!expected) push(`Trace step ${stepIndex} has no deque`, el.id, "indices");
          else {
            const checks = [
              ["indices", el.indices, expected.indices, "Deque positions don't"],
              [
                "poppedBack",
                el.poppedBack ?? [],
                expected.poppedBack ?? [],
                "Values removed from the back don't",
              ],
              [
                "poppedFront",
                el.poppedFront ?? [],
                expected.poppedFront ?? [],
                "Values removed from the front don't",
              ],
              ["output", el.output, expected.output, "The output so far doesn't"],
            ] as const;
            for (const [field, actual, want, what] of checks)
              if (!sameList(actual, want))
                push(`${what} match trace step ${stepIndex}`, el.id, field, {
                  expected: list(want),
                  actual: list(actual),
                });
          }
          break;
        }
        case "search-range": {
          checkRow(el.rowId);
          const expected = step.search;
          const show = (r: { from: number; to: number }) =>
            r.to < r.from ? `empty (before ${r.from})` : `${r.from}–${r.to}`;
          if (!expected) push(`Trace step ${stepIndex} has no search range`, el.id, "from");
          else {
            if (el.from !== expected.from || el.to !== expected.to)
              push(`Search range doesn't match trace step ${stepIndex}`, el.id, "from", {
                expected: show(expected),
                actual: show(el),
              });
            if (el.mid !== undefined && el.mid !== expected.mid)
              push(`The middle doesn't match trace step ${stepIndex}`, el.id, "mid", {
                expected: String(expected.mid ?? "none"),
                actual: String(el.mid),
              });
            if (el.sorted && !sameJson(el.sorted, expected.sorted))
              push(`The sorted half doesn't match trace step ${stepIndex}`, el.id, "sorted", {
                expected: expected.sorted ? show(expected.sorted) : "none",
                actual: show(el.sorted),
              });
          }
          if (el.fromRange) {
            const before = previous?.search;
            if (!before)
              push("Search range slides in from nowhere (no earlier bound range)", el.id, "fromRange");
            else if (before.from !== el.fromRange.from || before.to !== el.fromRange.to)
              push("Search range should shrink from where the previous scene left it", el.id, "fromRange", {
                expected: show(before),
                actual: show(el.fromRange),
              });
          }
          break;
        }
        case "number-line": {
          const expected = step.answers;
          if (!expected) push(`Trace step ${stepIndex} has no candidate answers`, el.id, "low");
          else {
            const show = (a: { min: number; max: number; low: number; high: number; mid?: number }) =>
              `${a.min}–${a.max}, low ${a.low}, high ${a.high}${a.mid !== undefined ? `, mid ${a.mid}` : ""}`;
            const actual = { min: el.min, max: el.max, low: el.low, high: el.high, mid: el.mid };
            if (
              el.min !== expected.min ||
              el.max !== expected.max ||
              el.low !== expected.low ||
              el.high !== expected.high ||
              (el.mid !== undefined && el.mid !== expected.mid)
            )
              push(`Candidate answers don't match trace step ${stepIndex}`, el.id, "low", {
                expected: show(expected),
                actual: show(actual),
              });
          }
          break;
        }
        case "cut": {
          checkRow(el.rowId);
          const which = isSecond(el.rowId) ? "second" : "first";
          const expected = step.cuts?.[which];
          if (expected === undefined) push(`Trace step ${stepIndex} has no cut`, el.id, "at");
          else if (el.at !== expected)
            push(`The cut in "${el.rowId}" doesn't match trace step ${stepIndex}`, el.id, "at", {
              expected: String(expected),
              actual: String(el.at),
            });
          if (el.fromAt !== undefined) {
            const before = previous?.cuts?.[which];
            if (before === undefined)
              push("The cut slides in from nowhere (no earlier bound cut)", el.id, "fromAt");
            else if (before !== el.fromAt)
              push("The cut should slide from where the previous scene left it", el.id, "fromAt", {
                expected: String(before),
                actual: String(el.fromAt),
              });
          }
          break;
        }
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
 * go backwards, every key step is shown, rows hold the trace's values (the step's own array when the algorithm
 * rearranges it), and bound pointers, equations, highlights, fills, moves, sorted regions, held values, tallies,
 * groups, split trees, merge buffers, partitions, heaps, counters, windows, character counts, deques, search ranges,
 * candidate answers, and cuts match their step (a `traceRow: "second"` row holds the trace's second list), and the answer is revealed correctly. Hand-written and generated storyboards both pass
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
