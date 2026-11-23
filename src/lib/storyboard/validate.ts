import { finalPositions, isHeap, keepsOrder, runTrace, type Trace, type TraceStep } from "@/lib/traces";

import type {
  TraceHeap,
  TracePile,
  TraceExplore,
  TracePartial,
  TraceSearchNode,
  TraceMap,
  TraceRace,
  TraceReach,
  TracePrefixRow,
  TraceTimelineStep,
  TraceBits,
  TraceTrie,
  TraceNetwork,
  TraceForest,
  TracePrefixGrid,
  TraceBfs,
  TraceLinks,
  TraceQueueItem,
  TraceTreeNode,
  TraceTreeWalk,
} from "@/lib/traces";

import type {
  BinaryTreeElement,
  ComparisonOp,
  Element,
  EquationElement,
  DpTableElement,
  GraphElement,
  GridElement,
  LinkedListElement,
} from "./elements";
import type { ValidationIssue, ValidationResult } from "./issues";
import { applyOperator, keptFrames } from "./resolve";
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

/** Engine-independent checks: every equation's arithmetic must be true, and every drawn heap must be a heap. */
function validateArithmetic(scene: Scene, issues: ValidationIssue[]) {
  for (const el of scene.elements) {
    if (el.type === "stack" && el.order && !keepsOrder(el.order, el.items))
      issues.push({
        sceneId: scene.id,
        elementId: el.id,
        field: "items",
        message: `The stack is labeled ${el.order} but its items aren't (bottom to top)`,
        actual: el.items.map((i) => i.key ?? i.label).join(", "),
      });
    if (el.type === "heap")
      el.heaps.forEach((heap, h) => {
        if (!isHeap(heap.kind, heap.items))
          issues.push({
            sceneId: scene.id,
            elementId: el.id,
            field: `heaps.${h}.items`,
            message: `Heap ${h + 1} breaks the ${heap.kind}-heap property: a parent must be ${heap.kind === "min" ? "no larger" : "no smaller"} than its children`,
            actual: heap.items.map((i) => i.key).join(", "),
          });
      });
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
  // Pointers and highlights on a list refer to nodes by id, so the "row" is the values in id order.
  if (el.type === "linked-list") return [...el.nodes].sort((a, b) => a.id - b.id).map((n) => n.value);
  // Same for a tree's nodes.
  if (el.type === "binary-tree") return [...el.nodes].sort((a, b) => a.id - b.id).map((n) => n.value);
  return undefined;
}

/** A search's state field by field, in a canonical text form (empty and missing read the same). */
function bfsFields(bfs: Partial<TraceBfs> | GridElement | GraphElement): Record<string, string> {
  const ids = (list: readonly number[] | undefined) =>
    JSON.stringify([...(list ?? [])].sort((a, b) => a - b));
  return {
    current: JSON.stringify(bfs.current ?? null),
    visited: ids(bfs.visited),
    // Front first: order matters.
    frontier: JSON.stringify(bfs.frontier ?? []),
    levels: JSON.stringify(
      [...(bfs.levels ?? [])].sort((a, b) => a.id - b.id).map((l) => ({ id: l.id, level: l.level })),
    ),
    checks: JSON.stringify(
      (bfs.checks ?? []).map((ch) => ({
        from: ch.from,
        to: ch.to ?? null,
        dir: ch.dir ?? null,
        result: ch.result,
      })),
    ),
  };
}

/** A DP table's state field by field, in a canonical text form (empty and missing read the same). */
function tableFields(t: Partial<Omit<DpTableElement, "type" | "id" | "enterAt">>): Record<string, string> {
  return {
    cells: JSON.stringify(t.cells ?? []),
    current: JSON.stringify(t.current ?? null),
    reads: JSON.stringify((t.reads ?? []).map((r) => ({ at: r.at, label: r.label }))),
    chosen: JSON.stringify([...(t.chosen ?? [])].sort((a, b) => a - b)),
    choice: JSON.stringify(t.choice ?? null),
    answer: JSON.stringify(t.answer ?? null),
  };
}

/** A stack's state field by field, in a canonical text form (empty and missing read the same). */
function pileFields(p: Partial<TracePile>): Record<string, string> {
  const items = (list?: readonly { label: string; ref?: number; key?: number }[]) =>
    JSON.stringify((list ?? []).map((i) => ({ label: i.label, ref: i.ref ?? null, key: i.key ?? null })));
  return {
    items: items(p.items),
    order: JSON.stringify(p.order ?? null),
    pushed: JSON.stringify(p.pushed ?? 0),
    popped: items(p.popped),
    links: JSON.stringify((p.links ?? []).map((l) => ({ from: l.from, to: l.to, label: l.label }))),
    answers: JSON.stringify((p.answers ?? []).map((a) => ({ index: a.index, label: a.label }))),
    text: JSON.stringify(p.text ? { label: p.text.label, value: p.text.value } : null),
  };
}

/** A search's state field by field, in a canonical text form (empty and missing read the same). */
function exploreFields(x: Partial<TraceExplore>): Record<string, string> {
  const ids = (list?: readonly number[]) => JSON.stringify([...(list ?? [])].sort((a, b) => a - b));
  return {
    reached: ids(x.reached),
    path: JSON.stringify(x.path ?? []),
    current: JSON.stringify(x.current ?? null),
    dead: ids(x.dead),
    solutions: ids(x.solutions),
    undone: JSON.stringify(x.undone ?? null),
    collapsed: ids(x.collapsed),
  };
}

function partialFields(p: Partial<TracePartial>): Record<string, string> {
  return {
    items: JSON.stringify(p.items ?? []),
    added: JSON.stringify(p.added ?? null),
    removed: JSON.stringify(p.removed ?? null),
    found: JSON.stringify(p.found ?? []),
  };
}

const canonSearchNodes = (nodes: readonly TraceSearchNode[]) =>
  JSON.stringify(
    nodes.map((n) => ({
      id: n.id,
      parent: n.parent,
      label: n.label,
      edge: n.edge ?? null,
      pruned: n.pruned ?? null,
    })),
  );

/** A fast-and-slow race field by field, in a canonical text form. */
function raceFields(r: Partial<TraceRace>): Record<string, string> {
  return {
    phase: JSON.stringify(r.phase ?? 1),
    moves: JSON.stringify(
      (r.moves ?? []).map((m) => ({
        pointer: m.pointer,
        from: m.from,
        to: m.to,
        path: m.path,
        hops: m.hops,
        blocked: m.blocked ?? null,
      })),
    ),
    meet: JSON.stringify(r.meet ?? null),
    entry: JSON.stringify(r.entry ?? null),
    loop: JSON.stringify(r.loop ? { from: r.loop.from, to: r.loop.to } : null),
  };
}

/** A trie field by field, in a canonical text form. */
function trieFields(t: Partial<TraceTrie>): Record<string, string> {
  const node = (n: { id: number; parent: number | null; letter: string; end: boolean; note?: string }) => [
    n.id,
    n.parent,
    n.letter,
    n.end,
    n.note ?? null,
  ];
  const ids = (list?: readonly number[]) => [...(list ?? [])].sort((a, b) => a - b);
  return {
    nodes: JSON.stringify((t.nodes ?? []).map(node)),
    path: JSON.stringify(t.path ?? []),
    created: JSON.stringify(ids(t.created)),
    missing: JSON.stringify(t.missing ? [t.missing.parent, t.missing.letter] : null),
    branches: JSON.stringify(ids(t.branches)),
    hits: JSON.stringify(ids(t.hits)),
    pruned: JSON.stringify((t.pruned ?? []).map(node)),
  };
}

/** A directed graph field by field, in a canonical text form (nodes by id, edges by their ends). */
function networkFields(g: Partial<TraceNetwork>): Record<string, string> {
  const nodes = [...(g.nodes ?? [])]
    .sort((a, b) => a.id - b.id)
    .map((n) => [n.id, n.label, n.x, n.y, n.badge ?? null, n.state]);
  const edges = [...(g.edges ?? [])]
    .map((e) => [e.from, e.to, e.weight ?? null, e.state] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return {
    directed: JSON.stringify(g.directed ?? null),
    nodes: JSON.stringify(nodes),
    edges: JSON.stringify(edges),
  };
}

/** A union-find field by field, in a canonical text form. */
function forestFields(f: Partial<TraceForest>): Record<string, string> {
  return {
    labels: JSON.stringify(f.labels ?? []),
    parents: JSON.stringify(f.parents ?? []),
    sizes: JSON.stringify(f.sizes ?? null),
    finds: JSON.stringify((f.finds ?? []).map((x) => x.path)),
    compressed: JSON.stringify((f.compressed ?? []).map((c) => [c.node, c.from, c.to])),
    union: JSON.stringify(f.union ? [f.union.child, f.union.parent] : null),
    same: JSON.stringify(f.same ?? null),
  };
}

/** A bits panel field by field, in a canonical text form (row names as the trace has them). */
function bitsFields(b: Partial<TraceBits>): Record<string, string> {
  return {
    width: JSON.stringify(b.width ?? null),
    rows: JSON.stringify(
      (b.rows ?? []).map((r) => [
        r.name,
        r.value,
        r.op ?? null,
        r.rule ?? false,
        [...(r.changed ?? [])].sort((x, y) => x - y),
        r.from ? [r.from.value, r.from.shift] : null,
      ]),
    ),
  };
}

/** A timeline field by field, in a canonical text form. */
function timelineFields(t: Partial<TraceTimelineStep>): Record<string, string> {
  return {
    bars: JSON.stringify(
      [...(t.bars ?? [])]
        .sort((a, b) => a.id - b.id)
        .map((b) => [b.id, b.start, b.end, b.lane, b.state, b.fromLane ?? null]),
    ),
    overlap: JSON.stringify(t.overlap ? [t.overlap.start, t.overlap.end] : null),
    grow: JSON.stringify(t.grow ? [t.grow.id, t.grow.start, t.grow.end] : null),
    sweep: JSON.stringify(t.sweep ? [t.sweep.at, t.sweep.label] : null),
  };
}

/** A prefix row field by field, in a canonical text form. */
function prefixRowFields(r: Partial<TracePrefixRow>): Record<string, string> {
  return {
    op: JSON.stringify(r.op ?? null),
    direction: JSON.stringify(r.direction ?? null),
    values: JSON.stringify(r.values ?? []),
    current: JSON.stringify(r.current ?? null),
    reads: JSON.stringify([...(r.reads ?? [])].sort((a, b) => a - b)),
    spans: JSON.stringify((r.spans ?? []).map((sp) => ({ from: sp.from, to: sp.to, value: sp.value }))),
  };
}

/** A prefix grid field by field, in a canonical text form. */
function prefixGridFields(g: Partial<TracePrefixGrid>): Record<string, string> {
  const rect = (r: { r1: number; c1: number; r2: number; c2: number }) => [r.r1, r.c1, r.r2, r.c2];
  return {
    prefix: JSON.stringify(g.prefix ?? []),
    current: JSON.stringify(g.current ?? null),
    rects: JSON.stringify((g.rects ?? []).map((r) => [...rect(r), r.sign])),
    marks: JSON.stringify((g.marks ?? []).map((m) => [...m.at, m.sign])),
    found: JSON.stringify(g.found ? rect(g.found) : null),
  };
}

/** A reach field by field, in a canonical text form. */
function reachFields(r: Partial<TraceReach>): Record<string, string> {
  const empty = r.to !== undefined && r.from !== undefined && r.to < r.from;
  return {
    range: JSON.stringify(empty ? { empty: true, from: r.from } : { from: r.from, to: r.to }),
    value: JSON.stringify(r.value === undefined ? null : String(r.value)),
    jump: JSON.stringify(r.jump ? { from: r.jump.from, to: r.jump.to, label: r.jump.label } : null),
    pieces: JSON.stringify((r.pieces ?? []).map((p) => ({ from: p.from, to: p.to }))),
  };
}

/** A hash map's state field by field, in a canonical text form. */
function mapFields(m: Partial<TraceMap>): Record<string, string> {
  return {
    kind: JSON.stringify(m.kind ?? null),
    display: JSON.stringify(m.display ?? null),
    entries: JSON.stringify((m.entries ?? []).map((e) => ({ key: e.key, value: e.value ?? null }))),
    lookup: JSON.stringify(m.lookup ? { key: m.lookup.key, found: m.lookup.found } : null),
    inserted: JSON.stringify(m.inserted ?? null),
    updated: JSON.stringify(m.updated ? { key: m.updated.key, from: m.updated.from } : null),
  };
}

/** A heap in a canonical form (every field present), for comparing with a trace step. */
const canonHeap = (heap: Partial<TraceHeap>) =>
  JSON.stringify({
    kind: heap.kind,
    items: (heap.items ?? []).map((i) => ({ key: i.key, label: i.label })),
    capacity: heap.capacity ?? null,
    swaps: heap.swaps ?? [],
    pushed: heap.pushed ? { key: heap.pushed.key, label: heap.pushed.label } : null,
    popped: heap.popped ? { key: heap.popped.key, label: heap.popped.label } : null,
  });
const showHeap = (heap: Partial<TraceHeap>) =>
  `${heap.kind}-heap [${(heap.items ?? []).map((i) => i.label).join(", ")}]${heap.capacity !== undefined ? ` cap ${heap.capacity}` : ""}${heap.swaps?.length ? ` swaps ${JSON.stringify(heap.swaps)}` : ""}${heap.pushed ? ` +${heap.pushed.label}` : ""}${heap.popped ? ` -${heap.popped.label}` : ""}`;

const showQueue = (items: readonly TraceQueueItem[]) =>
  items.map((item) => `${item.label} (level ${item.level})`).join(", ") || "empty";
const canonQueue = (items: readonly TraceQueueItem[]) =>
  JSON.stringify(items.map((item) => ({ id: item.id, label: item.label, level: item.level })));

/** "#0 5 (L #1, R #2), …", for readable issues. */
const showTree = (nodes: readonly TraceTreeNode[]) =>
  [...nodes]
    .sort((a, b) => a.id - b.id)
    .map(
      (n) =>
        `#${n.id} ${n.value} (L ${n.left === null ? "null" : `#${n.left}`}, R ${n.right === null ? "null" : `#${n.right}`})`,
    )
    .join(", ");

/** A tree walk field by field, in a canonical text form (empty and missing read the same). */
function walkFields(walk: Partial<TraceTreeWalk> | BinaryTreeElement): Record<string, string> {
  const ids = (list: readonly number[] | undefined) =>
    JSON.stringify([...(list ?? [])].sort((a, b) => a - b));
  const byNode = <T extends { node: number }>(list: readonly T[] | undefined) =>
    JSON.stringify([...(list ?? [])].sort((a, b) => a.node - b.node));
  return {
    current: JSON.stringify(walk.current ?? null),
    nullVisit: JSON.stringify(
      walk.nullVisit ? { parent: walk.nullVisit.parent, side: walk.nullVisit.side } : null,
    ),
    // Root first: order matters.
    path: JSON.stringify(walk.path ?? []),
    done: ids(walk.done),
    skipped: ids(walk.skipped),
    returned: JSON.stringify(
      walk.returned ? { to: walk.returned.to, side: walk.returned.side, value: walk.returned.value } : null,
    ),
    results: byNode(walk.results?.map((r) => ({ node: r.node, value: r.value }))),
    badges: byNode(walk.badges?.map((b) => ({ node: b.node, text: b.text }))),
    repeats: ids(walk.repeats),
  };
}

/** A list's nodes in a canonical form (id order, every field present), for comparing with a trace step. */
const canonicalNodes = (nodes: LinkedListElement["nodes"] | TraceLinks["nodes"]) =>
  [...nodes]
    .sort((a, b) => a.id - b.id)
    .map((n) => ({
      id: n.id,
      value: n.value,
      next: n.next,
      lane: n.lane,
      slot: n.slot,
      dummy: n.dummy === true,
    }));

/** "10→20 20→∅ … (lane:slot)", for readable issues. */
const showNodes = (nodes: LinkedListElement["nodes"] | TraceLinks["nodes"]) =>
  canonicalNodes(nodes)
    .map((n) => `#${n.id} ${n.value}→${n.next === null ? "null" : `#${n.next}`} @${n.lane}:${n.slot}`)
    .join(", ");

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

    const checkTree = (el: BinaryTreeElement) => {
      const expected = trace.tree?.nodes;
      if (!expected) {
        push("This trace isn't a tree; remove the binary-tree", el.id, "nodes");
        return;
      }
      const canon = (nodes: readonly TraceTreeNode[]) =>
        JSON.stringify(
          [...nodes]
            .sort((a, b) => a.id - b.id)
            .map((n) => ({ id: n.id, value: n.value, left: n.left, right: n.right })),
        );
      if (canon(el.nodes) !== canon(expected))
        push("The tree's nodes don't match the trace; omit nodes to take them from it", el.id, "nodes", {
          expected: showTree(expected),
          actual: showTree(el.nodes),
        });
    };

    /** A DP table's shape and headers against the trace. */
    const checkDpShape = (el: DpTableElement) => {
      const dp = trace.dp;
      if (!dp) return push("This trace has no table; remove the dp-table", el.id, "cells");
      if (el.rows !== dp.rows || el.cols !== dp.cols)
        push("The table's size doesn't match the trace", el.id, "rows", {
          expected: `${dp.rows}×${dp.cols}`,
          actual: `${el.rows}×${el.cols}`,
        });
      if (
        !sameJson(el.rowHeaders ?? null, dp.rowHeaders ?? null) ||
        !sameJson(el.colHeaders ?? null, dp.colHeaders ?? null)
      )
        push("The table's headers don't match the trace; omit them", el.id, "colHeaders");
    };

    /** A grid's or graph's shape against the trace, and the grid's contents against `cells`. */
    const checkShape = (el: GridElement | GraphElement, cells: unknown) => {
      if (el.type === "grid") {
        const grid = trace.grid;
        if (!grid) return push("This trace isn't a grid; remove the grid", el.id, "cells");
        if (el.rows !== grid.rows || el.cols !== grid.cols)
          push("The grid's size doesn't match the trace", el.id, "rows", {
            expected: `${grid.rows}×${grid.cols}`,
            actual: `${el.rows}×${el.cols}`,
          });
        if (!sameJson(el.legend, grid.legend))
          push("The grid's legend doesn't match the trace; omit it", el.id, "legend");
        if (!sameJson(el.cells, cells))
          push(
            scene.traceStep === undefined
              ? "Without a traceStep, the grid is drawn as it starts (or ends); omit cells"
              : `The grid's cells don't match trace step ${scene.traceStep}`,
            el.id,
            "cells",
            { expected: JSON.stringify(cells), actual: JSON.stringify(el.cells) },
          );
        return;
      }
      const graph = trace.graph;
      if (!graph) return push("This trace isn't a graph; remove the graph", el.id, "nodes");
      if (
        !sameJson(
          el.nodes.map((n) => ({ id: n.id, label: n.label })),
          graph.nodes,
        )
      )
        push("The graph's nodes don't match the trace; omit nodes", el.id, "nodes", {
          expected: graph.nodes.map((n) => n.label).join(", "),
          actual: el.nodes.map((n) => n.label).join(", "),
        });
      const edges = (list: readonly (readonly [number, number])[]) =>
        JSON.stringify(
          list.map(([a, b]) => (a < b ? [a, b] : [b, a])).sort((x, y) => x[0] - y[0] || x[1] - y[1]),
        );
      if (edges(el.edges) !== edges(graph.edges))
        push("The graph's edges don't match the trace; omit edges", el.id, "edges", {
          expected: edges(graph.edges),
          actual: edges(el.edges),
        });
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
        // An unbound list is the list as the trace starts or as it ends (the intro, or a recap).
        if (el.type === "linked-list") {
          const withLinks = trace.steps.filter((s) => s.links);
          const first = withLinks[0]?.links;
          const last = withLinks.at(-1)?.links;
          const drawn = JSON.stringify(canonicalNodes(el.nodes));
          const ok = [first, last].some(
            (links) => links && JSON.stringify(canonicalNodes(links.nodes)) === drawn,
          );
          if (!ok)
            push(
              "Without a traceStep, the list must be drawn as the trace starts (or ends); omit nodes to take it from the trace",
              el.id,
              "nodes",
              { expected: first ? showNodes(first.nodes) : "none", actual: showNodes(el.nodes) },
            );
          if (el.rewired?.length)
            push("Links only rewire in a scene bound to a trace step", el.id, "rewired");
        }
        if (el.type === "binary-tree") {
          checkTree(el);
          // An unbound tree is bare (the intro), or the walk as it ends (a recap).
          const drawn = walkFields(el);
          const bare = walkFields({});
          const last = trace.steps.at(-1)?.tree;
          const same = (fields: Record<string, string>) =>
            Object.keys(drawn).every((k) => drawn[k] === fields[k]);
          if (!same(bare) && !(last && same(walkFields(last))))
            push(
              "Without a traceStep, the tree is drawn bare (or as the walk ends); omit current/path/done/… to take them from the trace",
              el.id,
              "path",
            );
        }
        if (el.type === "call-stack")
          push(
            "A call-stack needs the scene to set traceStep (its frames come from the step)",
            el.id,
            "frames",
          );
        if (el.type === "trie") {
          // Unbound: the empty trie (the root alone), or the trie as it ends, with no walk.
          const last = trace.steps.at(-1)?.trie;
          const drawn = trieFields(el);
          const empty = trieFields({ nodes: [{ id: 0, parent: null, letter: "", end: false }], path: [0] });
          const end = last && trieFields({ nodes: last.nodes, path: [0] });
          const same = (f?: Record<string, string>) =>
            f && Object.keys(drawn).every((k) => drawn[k] === f[k]);
          if (!same(empty) && !same(end))
            push(
              "Without a traceStep, the trie is empty (or as it ends, with no walk); omit nodes and the walk",
              el.id,
              "nodes",
            );
        }
        if (el.type === "digraph") {
          // Unbound: the graph as given, or as it ends.
          const drawn = networkFields(el);
          const options = [trace.network, trace.steps.at(-1)?.network]
            .filter(Boolean)
            .map((g) => networkFields(g!));
          if (!options.some((f) => Object.keys(drawn).every((k) => drawn[k] === f[k])))
            push(
              "Without a traceStep, the digraph is the graph as given (or as it ends); omit directed, nodes, and edges",
              el.id,
              "nodes",
            );
        }
        if (el.type === "union-find") {
          // Unbound: every element alone, or the forest as it ends, with no work shown.
          const last = trace.steps.at(-1)?.forest;
          const start = trace.steps.find((st) => st.forest)?.forest;
          const drawn = forestFields(el);
          const alone =
            start &&
            forestFields({
              labels: start.labels,
              parents: start.labels.map((_, i) => i),
              sizes: start.sizes && start.labels.map(() => 1),
            });
          const end = last && forestFields({ labels: last.labels, parents: last.parents, sizes: last.sizes });
          const same = (f?: Record<string, string>) =>
            f && Object.keys(drawn).every((k) => drawn[k] === f[k]);
          if (!same(alone) && !same(end))
            push(
              "Without a traceStep, the union-find shows every element alone (or the forest as it ends, with no finds or union); omit labels and parents",
              el.id,
              "parents",
            );
        }
        if (el.type === "bits")
          push("A bits panel needs the scene to set traceStep (its rows come from the step)", el.id, "rows");
        if (el.type === "timeline") {
          const shape = trace.timeline;
          if (!shape) push("This trace has no timeline; remove it", el.id, "bars");
          else {
            if (el.min !== shape.min || el.max !== shape.max || el.lanes !== shape.lanes)
              push("The timeline's axis or lanes don't match the trace; omit min/max/lanes", el.id, "min");
            // Unbound: the intervals as given, or as the trace ends (with no overlap, growth, or marker).
            const last = trace.steps.at(-1)?.timeline;
            const drawn = timelineFields(el);
            const start = timelineFields({ bars: shape.input });
            const end = last && timelineFields({ bars: last.bars.map(({ fromLane: _f, ...b }) => b) });
            const same = (f?: Record<string, string>) =>
              f && Object.keys(drawn).every((k) => drawn[k] === f[k]);
            if (!same(start) && !same(end))
              push(
                "Without a traceStep, the timeline shows the intervals as given (or as they end); omit bars/overlap/grow/sweep",
                el.id,
                "bars",
              );
          }
        }
        if (el.type === "prefix-row") {
          // Unbound: empty (the intro) or the final row, with nothing built, read, or spanned this scene.
          const finals = trace.steps.flatMap((s) => s.prefix ?? []).filter((r) => r.name === el.name);
          const last = finals.at(-1);
          const drawn = prefixRowFields(el);
          const empty = prefixRowFields({
            op: el.op,
            direction: el.direction,
            values: el.values.map(() => null),
          });
          const end =
            last && prefixRowFields({ op: last.op, direction: last.direction, values: last.values });
          const same = (f?: Record<string, string>) =>
            f && Object.keys(drawn).every((k) => drawn[k] === f[k]);
          if (!finals.length) push(`This trace has no prefix row "${el.name}"`, el.id, "name");
          else if (!same(empty) && !same(end))
            push(
              "Without a traceStep, the prefix row is empty (or as it ends); omit values/current/reads/spans to take it from the trace",
              el.id,
              "values",
            );
        }
        if (el.type === "prefix-grid") {
          if (!trace.matrix || JSON.stringify(el.matrix) !== JSON.stringify(trace.matrix))
            push("The matrix doesn't match the trace; omit matrix", el.id, "matrix");
          const last = trace.steps.at(-1)?.prefixGrid;
          const drawn = prefixGridFields(el);
          const empty = prefixGridFields({
            prefix: el.prefix.map((row, i) => row.map((_, j) => (i === 0 || j === 0 ? 0 : null))),
          });
          const end = last && prefixGridFields({ prefix: last.prefix });
          const same = (f?: Record<string, string>) =>
            f && Object.keys(drawn).every((k) => drawn[k] === f[k]);
          if (!same(empty) && !same(end))
            push(
              "Without a traceStep, the prefix grid is unbuilt (or complete), with no rectangles; omit prefix/current/rects/marks/found",
              el.id,
              "prefix",
            );
        }
        if (el.type === "reach")
          push("A reach needs the scene to set traceStep (its stretch comes from the step)", el.id, "from");
        if (el.type === "queue")
          push("A queue needs the scene to set traceStep (its items come from the step)", el.id, "items");
        if (el.type === "dp-table") {
          checkDpShape(el);
          // An unbound table is empty (the intro) or the final table (a recap), with nothing being computed.
          const last = trace.steps.at(-1)?.table;
          const drawn = tableFields(el);
          const empty = tableFields({ cells: el.cells.map((row) => row.map(() => null)) });
          const final = last ? tableFields({ cells: last.cells, answer: last.answer }) : undefined;
          const same = (f?: Record<string, string>) =>
            f && Object.keys(drawn).every((k) => drawn[k] === f[k]);
          if (!same(empty) && !same(final))
            push(
              "Without a traceStep, the table is empty (or the final table); omit cells/current/reads/chosen to take them from the trace",
              el.id,
              "cells",
            );
        }
        if (el.type === "race") {
          const drawn = raceFields(el);
          const first = trace.steps.find((s) => s.race)?.race;
          const start = raceFields({ loop: first?.loop });
          const startBare = raceFields({});
          const last = trace.steps.at(-1)?.race;
          const end = last && raceFields({ ...last, moves: [] });
          const same = (f?: Record<string, string>) =>
            f && Object.keys(drawn).every((k) => drawn[k] === f[k]);
          if (!same(start) && !same(startBare) && !same(end))
            push(
              "Without a traceStep, the race shows no moves (as it starts, or as it ends); omit moves to take it from the trace",
              el.id,
              "moves",
            );
        }
        if (el.type === "hash-map") {
          const shape = trace.steps.find((s) => s.map)?.map;
          const drawn = mapFields(el);
          const empty = mapFields({ kind: shape?.kind, display: shape?.display });
          const lastMap = trace.steps.at(-1)?.map;
          const end =
            lastMap && mapFields({ kind: lastMap.kind, display: lastMap.display, entries: lastMap.entries });
          const same = (f?: Record<string, string>) =>
            f && Object.keys(drawn).every((k) => drawn[k] === f[k]);
          if (!same(empty) && !same(end))
            push(
              "Without a traceStep, the map is empty (or as it ends); omit entries to take it from the trace",
              el.id,
              "entries",
            );
        }
        if (el.type === "search-tree" || el.type === "partial") {
          if (
            el.type === "search-tree" &&
            trace.searchTree &&
            canonSearchNodes(el.nodes) !== canonSearchNodes(trace.searchTree.nodes)
          )
            push("The decision tree doesn't match the trace; omit nodes", el.id, "nodes");
          // Unbound: nothing explored yet (the root alone, an empty answer), or the search as it ends.
          const last = trace.steps.at(-1);
          const [drawn, start, end] =
            el.type === "search-tree"
              ? [
                  exploreFields(el),
                  exploreFields({ reached: [0], path: [0] }),
                  last?.explore && exploreFields(last.explore),
                ]
              : [partialFields(el), partialFields({}), last?.partial && partialFields(last.partial)];
          const same = (f?: Record<string, string>) =>
            f && Object.keys(drawn).every((k) => drawn[k] === f[k]);
          if (!same(start) && !same(end))
            push(
              `Without a traceStep, the ${el.type} shows the start (or the end); omit its state to take it from the trace`,
              el.id,
              el.type === "search-tree" ? "reached" : "items",
            );
        }
        if (el.type === "stack") {
          const drawn = pileFields(el);
          const empty = pileFields({ order: el.order });
          if (Object.keys(drawn).some((k) => drawn[k] !== empty[k]))
            push(
              "Without a traceStep, the stack is empty; omit items to take it from the trace",
              el.id,
              "items",
            );
        }
        if (el.type === "staircase" && (el.at !== undefined || el.hops?.length))
          push("Without a traceStep, the staircase has no climber or hops; omit at/hops", el.id, "at");
        if (el.type === "house-row" && (el.current !== undefined || el.taken.length || el.skipped.length))
          push("Without a traceStep, the street has no plan yet; omit current/taken/skipped", el.id, "taken");
        if (el.type === "staircase" && el.steps !== trace.row.values.length)
          push(`The staircase has ${trace.row.values.length} steps in this trace`, el.id, "steps");
        if (el.type === "house-row" && !sameList(el.money, trace.row.values))
          push("The houses' cash doesn't match the trace", el.id, "money");
        if (el.type === "heap") {
          const final = trace.steps.at(-1)?.heaps ?? [];
          const expected = final.map(({ kind, items, capacity }) => canonHeap({ kind, items, capacity }));
          if (JSON.stringify(el.heaps.map(canonHeap)) !== JSON.stringify(expected))
            push(
              "Without a traceStep, a heap shows the final heaps with no push or pop; omit heaps",
              el.id,
              "heaps",
              { expected: final.map(showHeap).join(" | "), actual: el.heaps.map(showHeap).join(" | ") },
            );
        }
        if (el.type === "grid" || el.type === "graph") {
          // An unbound grid or graph is the starting one (no search yet), or the search as it ends (a recap).
          const last = trace.steps.at(-1);
          const ending = el.type === "grid" && last?.cells && sameJson(el.cells, last.cells);
          checkShape(el, ending ? last.cells : trace.grid?.cells);
          const drawn = bfsFields(el);
          const same = (fields: Record<string, string>) =>
            Object.keys(drawn).every((k) => drawn[k] === fields[k]);
          if (!same(bfsFields({})) && !(last?.bfs && same(bfsFields(last.bfs))))
            push(
              `Without a traceStep, the ${el.type} shows no search (or the search as it ends); omit current/visited/frontier/levels/checks`,
              el.id,
              "visited",
            );
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
          if (step.heap) {
            // A list trace's heap (Merge K's current heads).
            if (!sameList(el.values, step.heap))
              push(`The heap doesn't match trace step ${stepIndex}`, el.id, "values", {
                expected: list(step.heap),
                actual: list(el.values),
              });
            if (el.heapSize !== step.heap.length)
              push(`Heap size doesn't match trace step ${stepIndex}`, el.id, "heapSize", {
                expected: String(step.heap.length),
                actual: String(el.heapSize),
              });
            if (el.compare || el.moves?.length)
              push(
                `Trace step ${stepIndex} doesn't compare or move heap nodes; omit compare/moves`,
                el.id,
                "compare",
              );
            break;
          }
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
        case "binary-tree": {
          checkTree(el);
          if (!step.tree) {
            push(`Trace step ${stepIndex} has no tree walk`, el.id, "path");
            break;
          }
          const expected = walkFields(step.tree);
          const drawn = walkFields(el);
          for (const field of Object.keys(expected))
            if (drawn[field] !== expected[field])
              push(`The tree's ${field} doesn't match trace step ${stepIndex}`, el.id, field, {
                expected: expected[field],
                actual: drawn[field],
              });
          break;
        }
        case "call-stack": {
          if (!step.stack) {
            push(`Trace step ${stepIndex} has no call stack`, el.id, "frames");
            break;
          }
          const show = (frames: readonly { label: string; waiting?: string; returns?: string }[]) =>
            frames
              .map(
                (f) =>
                  `${f.label}${f.waiting ? ` waiting for ${f.waiting}` : ""}${f.returns !== undefined ? ` returns ${f.returns}` : ""}`,
              )
              .join(" | ") || "empty";
          const canon = (
            frames: readonly { label: string; node: number | null; waiting?: string; returns?: string }[],
          ) =>
            JSON.stringify(
              frames.map((f) => ({
                label: f.label,
                node: f.node,
                waiting: f.waiting ?? null,
                returns: f.returns ?? null,
              })),
            );
          if (canon(el.frames) !== canon(step.stack))
            push(`The call stack doesn't match trace step ${stepIndex}`, el.id, "frames", {
              expected: show(step.stack),
              actual: show(el.frames),
            });
          if (el.kept !== undefined) {
            const expectedKept = previous?.stack ? keptFrames(previous.stack, step.stack) : undefined;
            if (expectedKept === undefined)
              push("Frames can't be kept from nowhere (no earlier bound call stack)", el.id, "kept");
            else if (el.kept !== expectedKept)
              push("kept must count the frames still open since the previous bound scene", el.id, "kept", {
                expected: String(expectedKept),
                actual: String(el.kept),
              });
          }
          break;
        }
        case "grid":
        case "graph": {
          checkShape(el, step.cells ?? trace.grid?.cells);
          if (!step.bfs) {
            push(`Trace step ${stepIndex} has no search`, el.id, "visited");
            break;
          }
          const expected = bfsFields(step.bfs);
          const drawn = bfsFields(el);
          for (const field of Object.keys(expected))
            if (drawn[field] !== expected[field])
              push(`The ${el.type}'s ${field} doesn't match trace step ${stepIndex}`, el.id, field, {
                expected: expected[field],
                actual: drawn[field],
              });
          break;
        }
        case "race": {
          if (!step.race) {
            push(`Trace step ${stepIndex} has no race`, el.id, "moves");
            break;
          }
          const expected = raceFields(step.race);
          const drawn = raceFields(el);
          for (const field of Object.keys(expected))
            if (drawn[field] !== expected[field])
              push(`The race's ${field} doesn't match trace step ${stepIndex}`, el.id, field, {
                expected: expected[field],
                actual: drawn[field],
              });
          break;
        }
        case "trie": {
          if (!step.trie) {
            push(`Trace step ${stepIndex} has no trie`, el.id, "nodes");
            break;
          }
          const want = trieFields(step.trie);
          const drawn = trieFields(el);
          for (const field of Object.keys(want))
            if (drawn[field] !== want[field])
              push(`The trie's ${field} doesn't match trace step ${stepIndex}`, el.id, field, {
                expected: want[field],
                actual: drawn[field],
              });
          break;
        }
        case "digraph": {
          if (!step.network) {
            push(`Trace step ${stepIndex} has no network`, el.id, "nodes");
            break;
          }
          const want = networkFields(step.network);
          const drawn = networkFields(el);
          for (const field of Object.keys(want))
            if (drawn[field] !== want[field])
              push(`The digraph's ${field} doesn't match trace step ${stepIndex}`, el.id, field, {
                expected: want[field],
                actual: drawn[field],
              });
          break;
        }
        case "union-find": {
          if (!step.forest) {
            push(`Trace step ${stepIndex} has no union-find`, el.id, "parents");
            break;
          }
          const want = forestFields(step.forest);
          const drawn = forestFields(el);
          for (const field of Object.keys(want))
            if (drawn[field] !== want[field])
              push(`The union-find's ${field} doesn't match trace step ${stepIndex}`, el.id, field, {
                expected: want[field],
                actual: drawn[field],
              });
          break;
        }
        case "bits": {
          if (!step.bits) {
            push(`Trace step ${stepIndex} has no bits`, el.id, "rows");
            break;
          }
          const want = bitsFields(step.bits);
          const drawn = bitsFields(el);
          for (const field of Object.keys(want))
            if (drawn[field] !== want[field])
              push(`The bits' ${field} don't match trace step ${stepIndex}`, el.id, field, {
                expected: want[field],
                actual: drawn[field],
              });
          break;
        }
        case "timeline": {
          const shape = trace.timeline;
          if (!shape || !step.timeline) {
            push(`Trace step ${stepIndex} has no timeline`, el.id, "bars");
            break;
          }
          if (el.min !== shape.min || el.max !== shape.max || el.lanes !== shape.lanes)
            push("The timeline's axis or lanes don't match the trace; omit min/max/lanes", el.id, "min", {
              expected: `${shape.min}–${shape.max}, ${shape.lanes} lanes`,
              actual: `${el.min}–${el.max}, ${el.lanes} lanes`,
            });
          const want = timelineFields(step.timeline);
          const drawn = timelineFields(el);
          for (const field of Object.keys(want))
            if (drawn[field] !== want[field])
              push(`The timeline's ${field} doesn't match trace step ${stepIndex}`, el.id, field, {
                expected: want[field],
                actual: drawn[field],
              });
          break;
        }
        case "prefix-row": {
          checkRow(el.rowId);
          const expected = step.prefix?.find((r) => r.name === el.name);
          if (!expected) {
            push(`Trace step ${stepIndex} has no prefix row "${el.name}"`, el.id, "name");
            break;
          }
          const want = prefixRowFields(expected);
          const drawn = prefixRowFields(el);
          for (const field of Object.keys(want))
            if (drawn[field] !== want[field])
              push(`The prefix row's ${field} doesn't match trace step ${stepIndex}`, el.id, field, {
                expected: want[field],
                actual: drawn[field],
              });
          break;
        }
        case "prefix-grid": {
          if (!trace.matrix || JSON.stringify(el.matrix) !== JSON.stringify(trace.matrix))
            push("The matrix doesn't match the trace; omit matrix", el.id, "matrix");
          if (!step.prefixGrid) {
            push(`Trace step ${stepIndex} has no prefix grid`, el.id, "prefix");
            break;
          }
          const want = prefixGridFields(step.prefixGrid);
          const drawn = prefixGridFields(el);
          for (const field of Object.keys(want))
            if (drawn[field] !== want[field])
              push(`The prefix grid's ${field} doesn't match trace step ${stepIndex}`, el.id, field, {
                expected: want[field],
                actual: drawn[field],
              });
          break;
        }
        case "choice": {
          if (!step.choice) {
            push(`Trace step ${stepIndex} makes no greedy choice`, el.id, "chosen");
            break;
          }
          for (const field of ["chosen", "rejected"] as const)
            if ((el[field] ?? null) !== (step.choice[field] ?? null))
              push(`The choice's ${field} option doesn't match trace step ${stepIndex}`, el.id, field, {
                expected: step.choice[field] ?? "none",
                actual: el[field] ?? "none",
              });
          break;
        }
        case "reach": {
          checkRow(el.rowId);
          if (!step.reach) {
            push(`Trace step ${stepIndex} has no reach`, el.id, "from");
            break;
          }
          const expected = reachFields(step.reach);
          const drawn = reachFields(el);
          for (const field of Object.keys(expected))
            if (drawn[field] !== expected[field])
              push(`The reach's ${field} doesn't match trace step ${stepIndex}`, el.id, field, {
                expected: expected[field],
                actual: drawn[field],
              });
          break;
        }
        case "hash-map": {
          if (!step.map) {
            push(`Trace step ${stepIndex} has no map`, el.id, "entries");
            break;
          }
          const expected = mapFields(step.map);
          const drawn = mapFields(el);
          for (const field of Object.keys(expected))
            if (drawn[field] !== expected[field])
              push(`The map's ${field} doesn't match trace step ${stepIndex}`, el.id, field, {
                expected: expected[field],
                actual: drawn[field],
              });
          break;
        }
        case "search-tree": {
          if (trace.searchTree && canonSearchNodes(el.nodes) !== canonSearchNodes(trace.searchTree.nodes))
            push("The decision tree doesn't match the trace; omit nodes", el.id, "nodes");
          if (!step.explore) {
            push(`Trace step ${stepIndex} has no search`, el.id, "reached");
            break;
          }
          const expected = exploreFields(step.explore);
          const drawn = exploreFields(el);
          for (const field of Object.keys(expected))
            if (drawn[field] !== expected[field])
              push(`The search's ${field} doesn't match trace step ${stepIndex}`, el.id, field, {
                expected: expected[field],
                actual: drawn[field],
              });
          break;
        }
        case "partial": {
          if (!step.partial) {
            push(`Trace step ${stepIndex} has no answer being built`, el.id, "items");
            break;
          }
          const expected = partialFields(step.partial);
          const drawn = partialFields(el);
          for (const field of Object.keys(expected))
            if (drawn[field] !== expected[field])
              push(`The answer's ${field} doesn't match trace step ${stepIndex}`, el.id, field, {
                expected: expected[field],
                actual: drawn[field],
              });
          break;
        }
        case "stack": {
          if (!step.pile) {
            push(`Trace step ${stepIndex} has no stack`, el.id, "items");
            break;
          }
          if (el.rowId) checkRow(el.rowId);
          const expected = pileFields(step.pile);
          const drawn = pileFields(el);
          for (const field of Object.keys(expected))
            if (drawn[field] !== expected[field])
              push(`The stack's ${field} doesn't match trace step ${stepIndex}`, el.id, field, {
                expected: expected[field],
                actual: drawn[field],
              });
          break;
        }
        case "dp-table": {
          checkDpShape(el);
          if (!step.table) {
            push(`Trace step ${stepIndex} has no table`, el.id, "cells");
            break;
          }
          const expected = tableFields(step.table);
          const drawn = tableFields(el);
          for (const field of Object.keys(expected))
            if (drawn[field] !== expected[field])
              push(`The table's ${field} doesn't match trace step ${stepIndex}`, el.id, field, {
                expected: expected[field],
                actual: drawn[field],
              });
          break;
        }
        case "staircase": {
          if (el.steps !== trace.row.values.length)
            push(`The staircase has ${trace.row.values.length} steps in this trace`, el.id, "steps");
          const climb = step.climb;
          if (!climb) {
            if (el.at !== undefined || el.hops?.length)
              push(`Trace step ${stepIndex} has no climber; omit at/hops`, el.id, "at");
            break;
          }
          if (el.at !== climb.at || !sameJson(el.hops ?? [], climb.hops ?? []))
            push(`The climber or hops don't match trace step ${stepIndex}`, el.id, "at", {
              expected: `at ${climb.at}${climb.hops ? `, hops ${climb.hops.map((h) => `${h.from}→${h.to}`).join(" ")}` : ""}`,
              actual: `at ${el.at}${el.hops ? `, hops ${el.hops.map((h) => `${h.from}→${h.to}`).join(" ")}` : ""}`,
            });
          break;
        }
        case "house-row": {
          if (!sameList(el.money, trace.row.values))
            push("The houses' cash doesn't match the trace", el.id, "money");
          const h = step.houses;
          if (!h) {
            if (el.current !== undefined || el.taken.length || el.skipped.length)
              push(`Trace step ${stepIndex} has no plan for the street`, el.id, "taken");
            break;
          }
          if (el.current !== h.current || !sameSet(el.taken, h.taken) || !sameSet(el.skipped, h.skipped))
            push(`The street's plan doesn't match trace step ${stepIndex}`, el.id, "taken", {
              expected: `current ${h.current ?? "none"}, take ${list(h.taken)}, skip ${list(h.skipped)}`,
              actual: `current ${el.current ?? "none"}, take ${list(el.taken)}, skip ${list(el.skipped)}`,
            });
          break;
        }
        case "heap": {
          const expected = step.heaps;
          if (!expected) {
            push(`Trace step ${stepIndex} has no heap`, el.id, "heaps");
            break;
          }
          // The tree and the array are the same list, so checking the list checks both.
          if (el.heaps.length !== expected.length)
            push(
              `Trace step ${stepIndex} has ${expected.length} heap(s), not ${el.heaps.length}`,
              el.id,
              "heaps",
            );
          el.heaps.forEach((heap, h) => {
            if (expected[h] && canonHeap(heap) !== canonHeap(expected[h]))
              push(`Heap ${h + 1} doesn't match trace step ${stepIndex}`, el.id, `heaps.${h}`, {
                expected: showHeap(expected[h]),
                actual: showHeap(heap),
              });
          });
          break;
        }
        case "queue": {
          const expected = step.queue;
          if (!expected) {
            push(`Trace step ${stepIndex} has no queue`, el.id, "items");
            break;
          }
          // Items carry their level, so the level markers between them are checked too.
          if (canonQueue(el.items) !== canonQueue(expected.items))
            push(`The queue doesn't match trace step ${stepIndex} (items and their levels)`, el.id, "items", {
              expected: showQueue(expected.items),
              actual: showQueue(el.items),
            });
          const out = (item?: TraceQueueItem) => (item ? canonQueue([item]) : "none");
          if (out(el.dequeued) !== out(expected.dequeued))
            push(`The item taken off the front doesn't match trace step ${stepIndex}`, el.id, "dequeued", {
              expected: expected.dequeued ? showQueue([expected.dequeued]) : "none",
              actual: el.dequeued ? showQueue([el.dequeued]) : "none",
            });
          if (JSON.stringify(el.enqueued ?? []) !== JSON.stringify(expected.enqueued ?? []))
            push(`The items added at the back don't match trace step ${stepIndex}`, el.id, "enqueued", {
              expected: JSON.stringify(expected.enqueued ?? []),
              actual: JSON.stringify(el.enqueued ?? []),
            });
          break;
        }
        case "linked-list": {
          const expected = step.links;
          if (!expected) {
            push(`Trace step ${stepIndex} has no linked list`, el.id, "nodes");
            break;
          }
          if (JSON.stringify(canonicalNodes(el.nodes)) !== JSON.stringify(canonicalNodes(expected.nodes)))
            push(`The list's nodes and links don't match trace step ${stepIndex}`, el.id, "nodes", {
              expected: showNodes(expected.nodes),
              actual: showNodes(el.nodes),
            });
          if (el.rewired && !sameJson(el.rewired, expected.rewired ?? []))
            push(`Rewired links don't match trace step ${stepIndex}`, el.id, "rewired", {
              expected: JSON.stringify(expected.rewired ?? []),
              actual: JSON.stringify(el.rewired),
            });
          if (el.fromPlaces) {
            const before = new Map(previous?.links?.nodes.map((n) => [n.id, n]));
            for (const place of el.fromPlaces) {
              const old = before.get(place.id);
              if (!old || old.lane !== place.lane || old.slot !== place.slot)
                push(
                  `Node #${place.id} should slide from where the previous scene left it`,
                  el.id,
                  "fromPlaces",
                  {
                    expected: old ? `${old.lane}:${old.slot}` : "no earlier bound list",
                    actual: `${place.lane}:${place.slot}`,
                  },
                );
            }
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
 * candidate answers, cuts, linked lists, tree walks, and call stacks match their step (a `traceRow: "second"` row holds the trace's second list), and the answer is revealed correctly. Hand-written and generated storyboards both pass
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
