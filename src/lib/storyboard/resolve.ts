import { finalPositions, runTrace, type Trace, type TraceStep } from "@/lib/traces";

import type { Element, ElementSource } from "./elements";
import { zodIssues, type ValidationIssue } from "./issues";
import { storyboardSchema, type Storyboard, type StoryboardSource } from "./schema";

export type ResolveResult = { storyboard?: Storyboard; trace?: Trace; issues: ValidationIssue[] };

const OPERATORS = {
  "+": (a: number, b: number) => a + b,
  "-": (a: number, b: number) => a - b,
  "×": (a: number, b: number) => a * b,
  "÷": (a: number, b: number) => a / b,
} as const;

/** For traces whose steps carry their own arrays: the largest number the array ever holds, so bars keep one scale. */
function traceMaxValue(trace: Trace): number | undefined {
  if (!trace.steps.some((step) => step.values)) return undefined;
  const all = [trace.row.values, ...trace.steps.map((step) => step.values ?? [])].flat();
  const max = Math.max(...all.filter((v): v is number => typeof v === "number"));
  return max > 0 ? max : undefined;
}

/**
 * How many bottom frames of `before` are still open in `after`: the same calls, up to the first one that returned in
 * `before` (it popped, so a matching frame after it is a new call).
 */
export function keptFrames(before: readonly StackFrameLike[], after: readonly StackFrameLike[]): number {
  let k = 0;
  while (
    k < before.length &&
    k < after.length &&
    before[k].returns === undefined &&
    before[k].label === after[k].label &&
    before[k].node === after[k].node
  )
    k++;
  return k;
}
type StackFrameLike = { label: string; node: number | null; returns?: string };

export function applyOperator(operator: keyof typeof OPERATORS, terms: readonly number[]): number {
  return terms.slice(1).reduce(OPERATORS[operator], terms[0]);
}

/**
 * Turn an authored (or model-written) storyboard into the fully specified form the renderer and validator use.
 * Values the author omitted are taken from the trace: rows from the bound step's `values` (else `trace.row`), and
 * pointers, equations, highlights, fills, water, moves, empty slots, sorted regions, held values, tallies, groups,
 * split trees, merge buffers, partitions, heaps, counters, windows, character counts, deques, search ranges,
 * candidate answers, cuts, lists, tree walks, call stacks, grids, graphs, and queues from the scene's bound step (an item-row with `traceRow: "second"` shows the trace's
 * second list). Values the author did write are kept as written; the validator
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
          const values = el.traceRow === "second" ? trace.secondRow?.values : trace.row.values;
          if (!values) {
            issues.push({
              sceneId: scene.id,
              elementId: el.id,
              field: "traceRow",
              message: "This trace has only one list; remove traceRow",
            });
            return el;
          }
          return {
            ...rest,
            items: values.map((value, i) => ({ label: labels?.[i] ?? `[${i}]`, value })),
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
          // A list trace's heap (Merge K's heads) is its own array; sorting draws the array being sorted.
          if (!el.values && step?.heap) {
            if (step.heap.length === 0) return (noState(el, "values", "heap (it's empty)"), el);
            return { ...el, values: step.heap, heapSize: el.heapSize ?? step.heap.length };
          }
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
        case "window": {
          if (el.from !== undefined && el.to !== undefined) return el;
          if (!step?.window) return (noState(el, "from", "window"), el);
          const before = previousStep && previousStep !== step ? previousStep.window : undefined;
          const moved = before && (before.from !== step.window.from || before.to !== step.window.to);
          return {
            ...el,
            from: step.window.from,
            to: step.window.to,
            value: el.value ?? step.window.value,
            fromRange: el.fromRange ?? (moved ? { from: before.from, to: before.to } : undefined),
          };
        }
        case "search-range": {
          if (el.from !== undefined && el.to !== undefined) return el;
          if (!step?.search) return (noState(el, "from", "search range"), el);
          const before = previousStep && previousStep !== step ? previousStep.search : undefined;
          const moved = before && (before.from !== step.search.from || before.to !== step.search.to);
          return {
            ...el,
            from: step.search.from,
            to: step.search.to,
            mid: el.mid ?? step.search.mid,
            sorted: el.sorted ?? step.search.sorted,
            fromRange: el.fromRange ?? (moved ? { from: before.from, to: before.to } : undefined),
          };
        }
        case "number-line": {
          if (el.min !== undefined && el.max !== undefined && el.low !== undefined && el.high !== undefined)
            return el;
          if (!step?.answers) return (noState(el, "low", "candidate answers"), el);
          const { min, max, low, high, mid } = step.answers;
          return { ...el, min, max, low, high, mid: el.mid ?? mid };
        }
        case "cut": {
          if (el.at !== undefined) return el;
          if (!step?.cuts) return (noState(el, "at", "cut"), el);
          const row = scene.elements.find((r) => r.id === el.rowId);
          const which = row?.type === "item-row" && row.traceRow === "second" ? "second" : "first";
          const before = previousStep && previousStep !== step ? previousStep.cuts?.[which] : undefined;
          const at = step.cuts[which];
          return {
            ...el,
            at,
            fromAt: el.fromAt ?? (before !== undefined && before !== at ? before : undefined),
          };
        }
        case "freq-table": {
          if (el.entries) return el;
          if (!step?.freq) return (noState(el, "entries", "character counts"), el);
          return { ...el, entries: step.freq.entries, active: el.active ?? step.freq.active };
        }
        case "linked-list": {
          if (el.nodes) return el;
          // An unbound scene (the intro) shows the list as the trace starts.
          const links = step ? step.links : trace?.steps.find((s) => s.links)?.links;
          if (!links) return (noState(el, "nodes", "linked list"), el);
          const before = previousStep && previousStep !== step ? previousStep.links : undefined;
          const was = new Map(before?.nodes.map((node) => [node.id, node]));
          const moved = links.nodes.flatMap((node) => {
            const old = was.get(node.id);
            return old && (old.lane !== node.lane || old.slot !== node.slot)
              ? [{ id: node.id, lane: old.lane, slot: old.slot }]
              : [];
          });
          return {
            ...el,
            nodes: links.nodes,
            rewired: el.rewired ?? (step ? links.rewired : undefined),
            fromPlaces: el.fromPlaces ?? (moved.length > 0 ? moved : undefined),
          };
        }
        case "binary-tree": {
          const nodes = el.nodes ?? trace?.tree?.nodes;
          if (!nodes || nodes.length === 0) return (missing(el, "nodes"), el);
          // An unbound scene (the intro, a recap) shows the bare tree; a bound one the step's walk.
          if (step && !step.tree) return (noState(el, "path", "tree walk"), el);
          const walk = step?.tree;
          return {
            ...el,
            nodes,
            current: el.current ?? walk?.current,
            nullVisit: el.nullVisit ?? walk?.nullVisit,
            path: el.path ?? walk?.path ?? [],
            done: el.done ?? walk?.done ?? [],
            skipped: el.skipped ?? walk?.skipped,
            returned: el.returned ?? walk?.returned,
            results: el.results ?? walk?.results,
            badges: el.badges ?? walk?.badges,
            repeats: el.repeats ?? walk?.repeats,
          };
        }
        case "call-stack": {
          if (el.frames) return el;
          if (!step?.stack) return (noState(el, "frames", "call stack"), el);
          const before = previousStep && previousStep !== step ? previousStep.stack : undefined;
          return {
            ...el,
            frames: step.stack,
            kept: el.kept ?? (before ? keptFrames(before, step.stack) : undefined),
          };
        }
        case "grid":
        case "graph": {
          const shape = el.type === "grid" ? trace?.grid : trace?.graph;
          if (!shape && (el.type === "grid" ? !el.cells : !el.nodes))
            return (missing(el, el.type === "grid" ? "cells" : "nodes"), el);
          if (step && !step.bfs) return (noState(el, "visited", "search"), el);
          const bfs = step?.bfs;
          const search = {
            current: el.current ?? bfs?.current,
            visited: el.visited ?? bfs?.visited ?? [],
            frontier: el.frontier ?? bfs?.frontier ?? [],
            levels: el.levels ?? bfs?.levels,
            checks: el.checks ?? bfs?.checks,
          };
          if (el.type === "grid") {
            const grid = trace?.grid;
            return {
              ...el,
              ...search,
              rows: el.rows ?? grid?.rows,
              cols: el.cols ?? grid?.cols,
              // A step that changes the grid (paint, rot) carries its own contents.
              cells: el.cells ?? step?.cells ?? grid?.cells,
              legend: el.legend ?? grid?.legend,
            } as ElementSource;
          }
          return {
            ...el,
            ...search,
            nodes: el.nodes ?? trace?.graph?.nodes,
            edges: el.edges ?? trace?.graph?.edges,
          } as ElementSource;
        }
        case "heap": {
          // An unbound scene (a recap) shows the heaps as the trace ends, with no push or pop.
          const final = trace?.steps.at(-1)?.heaps?.map(({ kind, items, capacity }) => ({
            kind,
            items,
            ...(capacity !== undefined ? { capacity } : {}),
          }));
          const heaps = el.heaps ?? (step ? step.heaps : final);
          if (!heaps) return (noState(el, "heaps", "heap"), el);
          // Each heap's largest size anywhere in the trace (counting a popped root), so its tree never changes shape.
          const slots =
            el.slots ??
            heaps.map((_, h) =>
              Math.max(
                1,
                ...(trace?.steps ?? []).map((s) => {
                  const heap = s.heaps?.[h];
                  return heap ? heap.items.length + (heap.popped ? 1 : 0) : 0;
                }),
              ),
            );
          return { ...el, heaps, slots };
        }
        case "race": {
          if (el.phase !== undefined && el.moves) return { ...el, phase: el.phase, moves: el.moves };
          if (step && !step.race) return (noState(el, "moves", "race"), el);
          const r = step?.race;
          // An unbound scene (the intro) shows no moves, with the loop as the trace starts.
          const first = trace?.steps.find((s) => s.race)?.race;
          if (!r && !first) return (missing(el, "moves"), el);
          return {
            ...el,
            phase: el.phase ?? r?.phase ?? 1,
            moves: el.moves ?? r?.moves ?? [],
            meet: el.meet ?? r?.meet,
            entry: el.entry ?? r?.entry,
            loop: el.loop ?? (r ? r.loop : first?.loop),
          };
        }
        case "choice": {
          if (el.chosen) return { ...el, chosen: el.chosen };
          if (!step?.choice) return (noState(el, "chosen", "greedy choice"), el);
          return { ...el, chosen: step.choice.chosen, rejected: el.rejected ?? step.choice.rejected };
        }
        case "reach": {
          if (el.from !== undefined && el.to !== undefined)
            return { ...el, from: el.from, to: el.to, pieces: el.pieces ?? [] };
          if (!step?.reach) return (noState(el, "from", "reach"), el);
          const r = step.reach;
          return {
            ...el,
            from: el.from ?? r.from,
            to: el.to ?? r.to,
            value: el.value ?? r.value,
            jump: el.jump ?? r.jump,
            pieces: el.pieces ?? r.pieces ?? [],
          };
        }
        case "prefix-row": {
          const pick = (st?: TraceStep) => st?.prefix?.find((r) => r.name === (el.name ?? "prefix"));
          if (el.op && el.direction && el.values)
            return { ...el, op: el.op, direction: el.direction, values: el.values };
          if (step && !pick(step)) return (noState(el, "values", `prefix row "${el.name ?? "prefix"}"`), el);
          const r = pick(step);
          // An unbound scene (the intro) shows the row empty, shaped like the trace's.
          const shape = r ?? trace?.steps.map(pick).find(Boolean);
          if (!shape) return (missing(el, "values"), el);
          return {
            ...el,
            op: el.op ?? shape.op,
            direction: el.direction ?? shape.direction,
            values: el.values ?? (r ? r.values : shape.values.map(() => null)),
            current: el.current ?? r?.current,
            reads: el.reads ?? r?.reads,
            spans: el.spans ?? r?.spans,
          };
        }
        case "prefix-grid": {
          const matrix = el.matrix ?? trace?.matrix;
          if (!matrix) return (missing(el, "matrix"), el);
          if (step && !step.prefixGrid) return (noState(el, "prefix", "prefix grid"), el);
          const g = step?.prefixGrid;
          // An unbound scene shows the grid before it's built: the 0 row and column.
          const empty = Array.from({ length: matrix.length + 1 }, (_, i) =>
            Array.from({ length: matrix[0].length + 1 }, (_, j) => (i === 0 || j === 0 ? 0 : null)),
          );
          return {
            ...el,
            matrix,
            prefix: el.prefix ?? g?.prefix ?? empty,
            current: el.current ?? g?.current,
            rects: el.rects ?? g?.rects ?? [],
            marks: el.marks ?? g?.marks ?? [],
            found: el.found ?? g?.found,
          };
        }
        case "timeline": {
          const shape = trace?.timeline;
          if (el.min !== undefined && el.max !== undefined && el.lanes !== undefined && el.bars)
            return { ...el, min: el.min, max: el.max, lanes: el.lanes, bars: el.bars };
          if (!shape) return (missing(el, "bars"), el);
          if (step && !step.timeline) return (noState(el, "bars", "timeline"), el);
          const tl = step?.timeline;
          // An unbound scene (the intro) shows the intervals as given.
          return {
            ...el,
            min: el.min ?? shape.min,
            max: el.max ?? shape.max,
            lanes: el.lanes ?? shape.lanes,
            bars: el.bars ?? tl?.bars ?? shape.input,
            overlap: el.overlap ?? tl?.overlap,
            grow: el.grow ?? tl?.grow,
            sweep: el.sweep ?? tl?.sweep,
          };
        }
        case "bits": {
          if (el.width !== undefined && el.rows) return { ...el, width: el.width, rows: el.rows };
          if (!step?.bits) return (noState(el, "rows", "bits"), el);
          return {
            ...el,
            width: el.width ?? step.bits.width,
            rows: el.rows ?? step.bits.rows,
            bitLabels: el.bitLabels ?? step.bits.bitLabels,
          };
        }
        case "trie": {
          if (el.nodes && el.path) return { ...el, nodes: el.nodes, path: el.path };
          if (step && !step.trie) return (noState(el, "nodes", "trie"), el);
          const tr = step?.trie;
          // An unbound scene (the intro) shows the empty trie: the root alone.
          return {
            ...el,
            nodes: el.nodes ?? tr?.nodes ?? [{ id: 0, parent: null, letter: "", end: false }],
            path: el.path ?? tr?.path ?? [0],
            created: el.created ?? tr?.created,
            missing: el.missing ?? tr?.missing,
            branches: el.branches ?? tr?.branches,
            hits: el.hits ?? tr?.hits,
            pruned: el.pruned ?? tr?.pruned,
          };
        }
        case "digraph": {
          if (el.nodes && el.edges && el.directed !== undefined)
            return { ...el, nodes: el.nodes, edges: el.edges, directed: el.directed };
          if (step && !step.network) return (noState(el, "nodes", "network"), el);
          // An unbound scene (the intro) shows the graph as given.
          const g = step?.network ?? trace?.network;
          if (!g) return (noState(el, "nodes", "network"), el);
          return {
            ...el,
            directed: el.directed ?? g.directed,
            nodes: el.nodes ?? g.nodes,
            edges: el.edges ?? g.edges,
          };
        }
        case "union-find": {
          if (el.labels && el.parents) return { ...el, labels: el.labels, parents: el.parents };
          if (step && !step.forest) return (noState(el, "parents", "union-find"), el);
          const f = step?.forest;
          const start = trace?.steps.find((s) => s.forest)?.forest;
          if (!f && !start) return (noState(el, "parents", "union-find"), el);
          // An unbound scene (the intro) shows every element alone.
          const labels = el.labels ?? (f ?? start)!.labels;
          return {
            ...el,
            labels,
            parents: el.parents ?? f?.parents ?? labels.map((_, i) => i),
            sizes: el.sizes ?? f?.sizes ?? (start?.sizes ? labels.map(() => 1) : undefined),
            finds: el.finds ?? f?.finds,
            compressed: el.compressed ?? f?.compressed,
            union: el.union ?? f?.union,
            same: el.same ?? f?.same,
          };
        }
        case "hash-map": {
          if (el.entries && el.kind && el.display) return el;
          if (step && !step.map) return (noState(el, "entries", "map"), el);
          const m = step?.map;
          // An unbound scene (the intro) shows the map empty, shaped like the trace's.
          const shape = m ?? trace?.steps.find((s) => s.map)?.map;
          if (!shape) return (missing(el, "entries"), el);
          return {
            ...el,
            kind: el.kind ?? shape.kind,
            display: el.display ?? shape.display,
            entries: el.entries ?? m?.entries ?? [],
            lookup: el.lookup ?? m?.lookup,
            inserted: el.inserted ?? m?.inserted,
            updated: el.updated ?? m?.updated,
          };
        }
        case "search-tree": {
          const nodes = el.nodes ?? trace?.searchTree?.nodes;
          if (!nodes) return (missing(el, "nodes"), el);
          if (step && !step.explore) return (noState(el, "reached", "search"), el);
          const x = step?.explore;
          // An unbound scene (the intro) shows only the root.
          return {
            ...el,
            nodes,
            reached: el.reached ?? x?.reached ?? [0],
            path: el.path ?? x?.path ?? [0],
            current: el.current ?? x?.current,
            dead: el.dead ?? x?.dead ?? [],
            solutions: el.solutions ?? x?.solutions ?? [],
            undone: el.undone ?? x?.undone,
            collapsed: el.collapsed ?? x?.collapsed,
          };
        }
        case "partial": {
          if (el.items) return { ...el, found: el.found ?? [] };
          if (step && !step.partial) return (noState(el, "items", "answer being built"), el);
          const p = step?.partial;
          return {
            ...el,
            items: p?.items ?? [],
            added: el.added ?? p?.added,
            removed: el.removed ?? p?.removed,
            found: el.found ?? p?.found ?? [],
          };
        }
        case "stack": {
          if (el.items) return el;
          const second = el.traceStack === "second";
          const pile = second ? step?.secondPile : step?.pile;
          if (step && !pile) return (noState(el, "items", second ? "second stack" : "stack"), el);
          // An unbound scene (the intro) shows the stack empty.
          if (!pile) return { ...el, items: [] };
          return {
            ...el,
            items: pile.items,
            order: el.order ?? pile.order,
            pushed: pile.pushed,
            popped: pile.popped,
            links: pile.links,
            answers: pile.answers,
            text: pile.text,
          };
        }
        case "op-log": {
          const calls = el.calls ?? trace?.ops;
          if (!calls) return (missing(el, "calls"), el);
          if (step && !step.op) return (noState(el, "current", "operation log"), el);
          // An unbound scene shows the calls before any of them runs (or, if written, all their outputs).
          const op = step?.op;
          return {
            ...el,
            calls,
            current: el.current ?? op?.current,
            shown: el.shown ?? (op ? op.current + (op.returned ? 1 : 0) : 0),
          };
        }
        case "dp-table": {
          const dp = trace?.dp;
          const rows = el.rows ?? dp?.rows;
          const cols = el.cols ?? dp?.cols;
          if (rows === undefined || cols === undefined) return (missing(el, "cells"), el);
          if (step && !step.table) return (noState(el, "cells", "table"), el);
          const t = step?.table;
          // An unbound scene (the intro) shows the table empty.
          const empty = Array.from({ length: rows }, () => new Array<null>(cols).fill(null));
          return {
            ...el,
            rows,
            cols,
            cells: el.cells ?? t?.cells ?? empty,
            rowHeaders: el.rowHeaders ?? dp?.rowHeaders,
            colHeaders: el.colHeaders ?? dp?.colHeaders,
            current: el.current ?? t?.current,
            reads: el.reads ?? t?.reads,
            chosen: el.chosen ?? t?.chosen,
            choice: el.choice ?? t?.choice,
            answer: el.answer ?? t?.answer,
          };
        }
        case "staircase": {
          const steps = el.steps ?? trace?.row.values.length;
          if (steps === undefined) return (missing(el, "steps"), el);
          return { ...el, steps, at: el.at ?? step?.climb?.at, hops: el.hops ?? step?.climb?.hops };
        }
        case "house-row": {
          const money = el.money ?? (trace?.row.values as number[] | undefined);
          if (!money) return (missing(el, "money"), el);
          const h = step?.houses;
          return {
            ...el,
            money,
            current: el.current ?? h?.current,
            taken: el.taken ?? h?.taken ?? [],
            skipped: el.skipped ?? h?.skipped ?? [],
          };
        }
        case "queue": {
          if (el.items) return el;
          if (!step?.queue) return (noState(el, "items", "queue"), el);
          return {
            ...el,
            items: step.queue.items,
            dequeued: el.dequeued ?? step.queue.dequeued,
            enqueued: el.enqueued ?? step.queue.enqueued,
          };
        }
        case "deque": {
          if (el.indices && el.output) return el;
          if (!step?.deque) return (noState(el, "indices", "deque"), el);
          return {
            ...el,
            indices: el.indices ?? step.deque.indices,
            output: el.output ?? step.deque.output,
            poppedBack: el.poppedBack ?? step.deque.poppedBack,
            poppedFront: el.poppedFront ?? step.deque.poppedFront,
          };
        }
        case "system-diagram": {
          // A growth story's bound step shows its own components; an unbound scene the start or the grown system.
          const system =
            step?.sim?.topology ??
            (el.stage === "grown" || scene.traceStep !== undefined
              ? trace?.system
              : (trace?.systemStart ?? trace?.system));
          if (!el.nodes && !system) return (missing(el, "nodes"), el);
          if (step && !step.sim) return (noState(el, "tokens", "simulation state"), el);
          // An unbound diagram (the intro, the idea, the closing) shows the components at rest.
          const states = new Map(step?.sim?.nodes.map((n) => [n.id, n]));
          return {
            ...el,
            nodes:
              el.nodes ??
              system!.nodes.map((n) => {
                const s = states.get(n.id);
                return { ...n, state: s?.state ?? "idle", ...(s?.badge && { badge: s.badge }) };
              }),
            edges: el.edges ?? system!.edges,
            tokens: el.tokens ?? step?.sim?.tokens ?? [],
          };
        }
        case "sequence": {
          const sim = step?.sim;
          if (!sim) return (noState(el, "rows", "simulation state"), el);
          const lanes =
            el.lanes ??
            trace?.system?.nodes.filter((n) => n.kind !== "store").map((n) => ({ id: n.id, label: n.label }));
          if (!lanes) return (missing(el, "lanes"), el);
          return { ...el, lanes, rows: el.rows ?? sim.rows, current: el.current ?? sim.current };
        }
        case "data-table": {
          if (el.tables) return el;
          const sim = step?.sim;
          if (!sim) return (noState(el, "tables", "simulation state"), el);
          const tables = el.show.map((id) => sim.tables.find((t) => t.id === id));
          const unknown = el.show.filter((_, k) => !tables[k]);
          if (unknown.length) {
            issues.push({
              sceneId: scene.id,
              elementId: el.id,
              field: "show",
              message: `Trace step ${scene.traceStep} has no table ${unknown.map((u) => `"${u}"`).join(", ")} (it has: ${sim.tables.map((t) => t.id).join(", ")})`,
            });
            return el;
          }
          return { ...el, tables: tables as NonNullable<(typeof tables)[number]>[] };
        }
        case "load-chart": {
          const load = step?.sim?.load;
          if (!load) return (noState(el, "windows", "measured load"), el);
          return {
            ...el,
            windows:
              el.windows ??
              load.windows.map((w) => ({
                label: w.label,
                group: w.group,
                offered: w.offered,
                served: w.served,
                p99: w.p99,
                errors: w.errors,
                saturated: w.saturated.length > 0,
              })),
            current: el.current ?? load.current,
          };
        }
        case "metrics": {
          if (el.items) return el;
          const sim = step?.sim;
          if (!sim) return (noState(el, "items", "simulation state"), el);
          const items = el.show.map((id) => sim.metrics.find((m) => m.id === id));
          const unknown = el.show.filter((_, k) => !items[k]);
          if (unknown.length) {
            issues.push({
              sceneId: scene.id,
              elementId: el.id,
              field: "show",
              message: `Trace step ${scene.traceStep} has no metric ${unknown.map((u) => `"${u}"`).join(", ")} (it has: ${sim.metrics.map((m) => m.id).join(", ")})`,
            });
            return el;
          }
          return { ...el, items: items as NonNullable<(typeof items)[number]>[] };
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
