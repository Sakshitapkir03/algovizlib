import { applyOperator, type Storyboard } from "@/lib/storyboard";
import type { Trace, TraceStep } from "@/lib/traces/types";

import { DECISION_OPTIONS, quickCheckSchema, type QuickCheck } from "./schema";

/**
 * Proves every quick check against the trace, without the builder's code: for each option it works out from the
 * trace's state whether that option is true, and requires the marked answer to be the only true one. It also checks
 * the question sits on a scene bound to its step, after another scene, and at most three per video.
 */
export function validateQuickChecks(
  storyboard: Pick<Storyboard, "scenes">,
  trace: Trace,
  checks: readonly QuickCheck[],
): string[] {
  const issues: string[] = [];
  if (checks.length > 3) issues.push(`${checks.length} quick checks: at most 3 per video`);
  if (new Set(checks.map((c) => c.sceneId)).size !== checks.length)
    issues.push("two quick checks share a scene");
  for (const check of checks) {
    const where = `quick check "${check.id}"`;
    const parsed = quickCheckSchema.safeParse(check);
    if (!parsed.success) {
      issues.push(`${where}: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
      continue;
    }
    const index = storyboard.scenes.findIndex((s) => s.id === check.sceneId);
    if (index < 1) issues.push(`${where}: needs a scene before it to pause on`);
    else if (storyboard.scenes[index].traceStep !== check.step)
      issues.push(`${where}: its scene isn't bound to step ${check.step}`);
    const step = trace.steps[check.step];
    if (!step) {
      issues.push(`${where}: no step ${check.step}`);
      continue;
    }
    if (check.explanation !== step.note) issues.push(`${where}: the explanation isn't the step's note`);
    let truths: (boolean | undefined)[];
    try {
      truths = check.options.map((option, k) => truth(check, option, k, trace, step, storyboard.scenes));
    } catch (error) {
      issues.push(`${where}: ${(error as Error).message}`);
      continue;
    }
    truths.forEach((t, k) => {
      if (t === undefined)
        issues.push(`${where}: option "${check.options[k]}" can't be checked against the trace`);
      else if (k === check.answer && !t) issues.push(`${where}: the answer "${check.options[k]}" is wrong`);
      else if (k !== check.answer && t)
        issues.push(`${where}: the wrong option "${check.options[k]}" is also right`);
    });
  }
  return issues;
}

const before = (trace: Trace, i: number): TraceStep | undefined => (i > 0 ? trace.steps[i - 1] : undefined);

/** Whether one option is a true answer to the check's question, worked out from the trace alone. */
function truth(
  check: QuickCheck,
  option: string,
  k: number,
  trace: Trace,
  step: TraceStep,
  scenes: Pick<Storyboard, "scenes">["scenes"],
): boolean | undefined {
  const c = check.claim;
  const yes = option === "Yes" ? true : option === "No" ? false : undefined;
  switch (c.kind) {
    case "compare": {
      const eq = step.equation;
      if (!eq?.comparison || eq.comparison.target !== c.target || eq.operator !== c.operator)
        return undefined;
      if (eq.terms.join() !== c.terms.join()) return undefined;
      const value = applyOperator(c.operator, c.terms);
      const sign = value < c.target ? 0 : value === c.target ? 1 : 2;
      return sign === k;
    }
    case "verdict": {
      const eq = step.equation;
      if (!eq?.comparison || eq.comparison.target !== c.target || eq.operator !== c.operator)
        return undefined;
      if (eq.terms.join() !== c.terms.join()) return undefined;
      const sign = (value: number, target: number) => Math.sign(value - target);
      const mine = sign(applyOperator(c.operator, c.terms), c.target);
      // The results (by the arithmetic) of every scene whose equation shows this verdict word.
      const uses = new Set<number>();
      for (const scene of scenes) {
        const shown = scene.elements.find((e) => e.type === "equation");
        const bound = scene.traceStep === undefined ? undefined : trace.steps[scene.traceStep]?.equation;
        if (shown?.type !== "equation" || shown.verdict !== option || !bound?.comparison) continue;
        uses.add(sign(applyOperator(bound.operator, bound.terms), bound.comparison.target));
      }
      if (uses.size === 0) return undefined;
      return uses.size === 1 && uses.has(mine);
    }
    case "rewire": {
      const node = step.links?.nodes.find((n) => n.id === c.node);
      const earlier = before(trace, check.step)?.links?.nodes ?? [];
      if (!node) return undefined;
      if (option === "null") return node.next === null;
      const named = earlier.filter((n) => String(n.value) === option);
      if (named.length !== 1) return undefined;
      return node.next === named[0].id;
    }
    case "explore": {
      const node = trace.searchTree?.nodes[c.node];
      if (!node || !step.explore?.reached.includes(c.node)) return undefined;
      const outcome = node.pruned
        ? "Cut the branch"
        : step.explore.solutions.includes(c.node)
          ? "Record an answer"
          : "Go deeper";
      if (!["Go deeper", "Record an answer", "Cut the branch"].includes(option)) return undefined;
      return option === outcome;
    }
    case "trie-child": {
      if (yes === undefined || !step.trie) return undefined;
      const earlier = before(trace, check.step)?.trie?.nodes ?? [{ id: 0, parent: null, letter: "" }];
      return earlier.some((n) => n.parent === c.parent && n.letter === c.letter) === yes;
    }
    case "pointer": {
      const shown = trace.steps[c.fromStep]?.pointers;
      const bind = c.binds[k];
      if (!shown || shown[bind] === undefined || step.pointers[bind] === undefined) return undefined;
      return shown[bind] !== step.pointers[bind];
    }
    case "lookup": {
      if (step.map?.lookup?.key !== c.key || yes === undefined) return undefined;
      // Was the key there before this step looked it up?
      const earlier = before(trace, check.step)?.map?.entries ?? [];
      return earlier.some((e) => e.key === c.key) === yes;
    }
    case "cell": {
      const value = step.table?.cells[c.cell[0]]?.[c.cell[1]];
      const current = step.table?.current;
      if (typeof value !== "number" || !current || current.join() !== c.cell.join()) return undefined;
      return Number(option) === value;
    }
    case "heap-pop": {
      const heap = step.heaps?.[c.heap];
      if (!heap?.popped) return undefined;
      // The popped item is the heap's extreme over everything it held this step.
      const all = [...heap.items, heap.popped];
      const top =
        heap.kind === "min" ? Math.min(...all.map((x) => x.key)) : Math.max(...all.map((x) => x.key));
      if (heap.popped.key !== top) throw new Error("the popped item isn't the heap's top");
      if (option === heap.popped.label) return true;
      return heap.items.some((x) => x.label === option) ? false : undefined;
    }
    case "stack-pop": {
      const pile = step.pile;
      if (!pile) return undefined;
      const count =
        (before(trace, check.step)?.pile?.items.length ?? 0) + (pile.pushed ?? 0) - pile.items.length;
      if (count !== (pile.popped?.length ?? 0)) throw new Error("the stack's sizes don't add up");
      return Number(option) === count;
    }
    case "queue": {
      const queued = before(trace, check.step)?.queue?.items;
      if (!queued?.length || !step.queue?.dequeued) return undefined;
      // First in, first out: the front leaves.
      if (queued[0].label !== step.queue.dequeued.label) throw new Error("the queue's front isn't what left");
      if (option === queued[0].label) return true;
      return queued.some((x) => x.label === option) ? false : undefined;
    }
    case "choice": {
      if (!step.choice) return undefined;
      if (option === step.choice.chosen) return true;
      return option === step.choice.rejected ? false : undefined;
    }
    case "returns": {
      const result = step.tree?.results?.find((r) => r.node === c.node);
      const returned = step.tree?.returned;
      const nodes = trace.tree?.nodes;
      if (!result || !returned || !nodes || nodes[returned.to]?.[returned.side] !== c.node) return undefined;
      return option === result.value;
    }
    case "same-group": {
      if (yes === undefined || !step.forest) return undefined;
      // Roots in the forest as it stood before this step.
      const parents = before(trace, check.step)?.forest?.parents ?? step.forest.labels.map((_, i) => i);
      const root = (x: number) => {
        let at = x;
        for (let n = 0; n <= parents.length && parents[at] !== at; n++) at = parents[at];
        return at;
      };
      return (root(c.a) === root(c.b)) === yes;
    }
    case "meet": {
      const moves = step.race?.moves ?? [];
      const slow = moves.find((m) => m.pointer === c.slow);
      const fast = moves.find((m) => m.pointer === c.fast);
      if (!slow || !fast || yes === undefined || slow.blocked !== undefined || fast.blocked !== undefined)
        return undefined;
      return (slow.to !== null && slow.to === fast.to) === yes;
    }
    case "trie-new": {
      if (!step.trie) return undefined;
      const added = step.trie.nodes.length - (before(trace, check.step)?.trie?.nodes.length ?? 1);
      return Number(option) === added;
    }
    case "output": {
      const call = trace.ops?.[c.call];
      if (!call || step.op?.current !== c.call || !step.op.returned) return undefined;
      return option === call.output;
    }
    case "decision": {
      const d = step.sim?.decision;
      if (!d || d.actor !== c.actor) return undefined;
      const meaning = Object.entries(DECISION_OPTIONS[c.actor]).find(([, words]) => words === option)?.[0];
      if (meaning === undefined) return undefined;
      return meaning === d.choice;
    }
  }
}
