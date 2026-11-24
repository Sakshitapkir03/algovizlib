import type { ElementSource } from "@/lib/storyboard";
import type { Trace, TraceStep } from "@/lib/traces/types";

/** A scene as a draft writes it: no duration yet (it comes from the narration). */
export type TraceScene = {
  id: string;
  caption: string;
  narration: string;
  traceStep?: number;
  elements: ElementSource[];
};

/** The words a builder chooses; everything else (which primitives, bound to which steps) follows from the trace. */
export type SceneLook = {
  /** Labels under the input row's cards (and the second row's). */
  itemLabels: (count: number, row: "first" | "second") => string[];
  /** A panel's text field (`label`, `outputLabel`, …): the `nth` element of that type, else `fallback`. */
  text: (type: ElementSource["type"], field: string, fallback: string, nth?: number) => string;
  caption: (step: TraceStep, index: number) => string;
  verdict: (step: TraceStep) => string;
  /** A callout under the step, if any. */
  callout?: (step: TraceStep) => string | undefined;
  choiceReason?: string;
  /**
   * How much to leave out of a step's scene so it fits (0, the default, leaves nothing out): 1 drops the equation
   * and the answer card (the answer moves to a closing scene), 2 also the pointers and callouts, 3 also the side
   * panels (counts, maps, choices, answers being built), 4 also the input row and everything drawn on it.
   */
  level?: (index: number) => number;
};

/** What each level of `SceneLook.level` leaves out, cumulatively. */
const LEVEL_DROPS: readonly (readonly ElementSource["type"][])[] = [
  [],
  ["equation", "result"],
  ["pointer", "callout"],
  ["counter", "freq-table", "choice", "hash-map", "partial", "deque", "number-line", "split-tree", "queue"],
];

/** A step's elements at a level: what `SceneLook.level` describes. */
export function simplify(elements: ElementSource[], level: number): ElementSource[] {
  if (level <= 0) return elements;
  const dropped = new Set(LEVEL_DROPS.slice(0, level + 1).flat());
  const onRow = (el: ElementSource) =>
    el.id === "row" || el.id === "row2" || ("rowId" in el && (el.rowId === "row" || el.rowId === "row2"));
  const kept = elements.filter((el) => !dropped.has(el.type) && !(level >= 4 && onRow(el)));
  // Leaving out the input row only helps when a structure is left to show (a trie, a heap, a graph): never empty a
  // scene, so an input that can't be drawn is refused instead.
  return level >= 4 && kept.length === 0 ? simplify(elements, 3) : kept;
}

/**
 * The scenes any trace can be shown with: the input rows (for intro scenes), one scene per key step (binding values
 * omitted so they come from the trace) with the answer on the last one, and, when the stage is too full for an answer
 * card beside the last step (a 2D table, a deep search tree, a trie, a graph), `wideTable` and the card to show in a
 * closing scene. Shared by the test fixture (which mutates copies) and "Try your own input" (which builds a
 * walkthrough of the learner's own input in the browser): both get the layout every committed video is checked with.
 */
export function traceScenes(
  trace: Trace,
  look: SceneLook,
): { rows: () => ElementSource[]; stepScenes: TraceScene[]; wideTable: boolean; answerCard: ElementSource } {
  const rowType =
    trace.row.display === "bars"
      ? "bar-row"
      : trace.row.display === "list"
        ? "linked-list"
        : trace.row.display === "tree"
          ? "binary-tree"
          : trace.row.display === "grid"
            ? "grid"
            : trace.row.display === "graph"
              ? "graph"
              : trace.row.display === "stairs"
                ? "staircase"
                : trace.row.display === "houses"
                  ? "house-row"
                  : "item-row";
  const row = (): ElementSource =>
    rowType === "linked-list"
      ? { id: "row", type: "linked-list", enterAt: 0 }
      : rowType === "binary-tree" ||
          rowType === "grid" ||
          rowType === "graph" ||
          rowType === "staircase" ||
          rowType === "house-row"
        ? ({ id: "row", type: rowType, enterAt: 0 } as ElementSource)
        : rowType === "bar-row"
          ? { id: "row", type: "bar-row", unit: "", enterAt: 0 }
          : {
              id: "row",
              type: "item-row",
              unit: "",
              enterAt: 0,
              labels: look.itemLabels(trace.row.values.length, "first"),
            };

  const second = (): ElementSource[] =>
    trace.secondRow
      ? [
          {
            id: "row2",
            type: "item-row",
            unit: "",
            enterAt: 0,
            traceRow: "second",
            labels: look.itemLabels(trace.secondRow.values.length, "second"),
          },
        ]
      : [];

  // A trace without a row (a stream of operations) shows no item-row.
  // A DP trace's table joins every data scene (empty when unbound).
  const table = (): ElementSource[] =>
    trace.dp ? [{ id: "table", type: "dp-table", enterAt: 0 } as ElementSource] : [];
  // A graph trace's digraph, or a union-find's trees, joins every data scene too (as given when unbound).
  const forestTrace = trace.steps.some((st) => st.forest);
  const graphs = (): ElementSource[] => [
    ...(trace.network ? [{ id: "graph", type: "digraph", enterAt: 0 } as ElementSource] : []),
    ...(forestTrace ? [{ id: "forest", type: "union-find", enterAt: 0 } as ElementSource] : []),
  ];
  // A design trace's op log leads every scene (unbound: the calls before any runs).
  const log = (): ElementSource[] =>
    trace.ops ? [{ id: "log", type: "op-log", enterAt: 0 } as ElementSource] : [];
  const rows = (): ElementSource[] => [
    ...log(),
    ...(trace.row.values.length === 0 ? [] : [row()]),
    ...table(),
    ...graphs(),
  ];
  // A 2D table, or a search tree five levels deep, fills the stage: the answer card goes in the closing scene.
  const depthOf = (id: number): number => {
    const parent = trace.searchTree?.nodes[id].parent;
    return parent === null || parent === undefined ? 1 : 1 + depthOf(parent);
  };
  const deepTree = (trace.searchTree?.nodes ?? []).some((n) => depthOf(n.id) >= 5);
  // A trie (five levels on a phone) leaves no room for a card under it either.
  // So does a graph or a union-find: their bottom stacks are full, or the trees need the height.
  const wideTable =
    (trace.dp?.rows ?? 1) > 1 ||
    deepTree ||
    trace.steps.some((st) => st.trie) ||
    trace.network !== undefined ||
    forestTrace;
  const answerCard: ElementSource = {
    id: "result",
    type: "result",
    title: "Answer",
    showsAnswer: true,
    enterAt: 0.5,
    tone: "success",
  };
  const stepScenes = trace.steps.flatMap((step, index): TraceScene[] => {
    if (!step.key) return [];
    const last = index === trace.steps.length - 1;
    // Heap scenes mark the input with a highlight (no pointer), and the answer scene leaves the input out.
    // (Beside a graph, the heap leaves the graph in place.)
    const heapScene = step.heaps !== undefined && !step.network;
    // Stack scenes mark the input with a highlight too: pointers would sit where the resolve arcs go.
    // Trie scenes too: a pointer under the input row costs the height a deep trie needs on a phone.
    const pileScene = step.pile !== undefined || step.trie !== undefined;
    // Search scenes show the tree and the answer being built; only a board (a grid) stays beside the tree.
    const searchScene = step.explore !== undefined && rowType !== "grid";
    // A recursion-tree step (Climbing Stairs' plain recursion) shows only the tree.
    const recursion = step.tree !== undefined && trace.row.display !== "tree";
    const elements: ElementSource[] = recursion
      ? [{ id: "calls", type: "binary-tree", enterAt: 0 } as ElementSource]
      : (heapScene && (last || !step.active)) || searchScene
        ? []
        : [...rows(), ...second()];
    // A design trace's linked list (a cache's recency list or buckets) isn't the row: highlights on it use its id.
    const designList = step.links !== undefined && rowType !== "linked-list";
    if (designList) {
      elements.push({ id: "list", type: "linked-list", enterAt: 0 } as ElementSource);
      for (const state of ["active", "rejected", "found"] as const)
        if (step[state])
          elements.push({ id: `list-${state}`, type: "highlight", rowId: "list", state, enterAt: 0 });
    }
    for (const name of heapScene || pileScene ? [] : Object.keys(step.pointers)) {
      elements.push({
        id: `p-${name}`,
        type: "pointer",
        rowId: "row",
        label: name,
        binds: name,
        enterAt: 0,
        placement: rowType === "linked-list" ? "above" : "below",
        tone: "primary",
      });
    }
    if (step.active && !(heapScene && last) && rowType === "item-row" && !designList)
      elements.push({ id: "active", type: "highlight", rowId: "row", state: "active", enterAt: 0 });
    if (step.found && !designList)
      elements.push({ id: "found", type: "highlight", rowId: "row", state: "found", enterAt: 0 });
    if (step.sorted)
      elements.push({
        id: "sorted",
        type: "sorted-region",
        rowId: "row",
        label: look.text("sorted-region", "label", "sorted"),
        enterAt: 0,
      });
    if (step.held)
      elements.push({
        id: "held",
        type: "held-value",
        rowId: "row",
        label: look.text("held-value", "label", "holding"),
        enterAt: 0,
      });
    if (step.counts)
      elements.push({
        id: "tally",
        type: "count-array",
        label: look.text("count-array", "label", "count"),
        enterAt: 0,
      });
    if (step.segments) elements.push({ id: "groups", type: "segments", rowId: "row", enterAt: 0 });
    if (step.splitTree)
      elements.push({
        id: "overview",
        type: "split-tree",
        label: look.text("split-tree", "label", "split"),
        enterAt: 0,
      });
    if (step.buffer)
      elements.push({
        id: "buffer",
        type: "merge-buffer",
        rowId: "row",
        label: look.text("merge-buffer", "label", "merged"),
        enterAt: 0,
      });
    if (step.pivot !== undefined)
      elements.push({
        id: "partition",
        type: "partition",
        rowId: "row",
        label: look.text("partition", "label", "pivot"),
        enterAt: 0,
      });
    if (step.heapSize !== undefined || (step.heap && step.heap.length > 0))
      elements.push({ id: "heap", type: "heap-tree", enterAt: 0 });
    if (step.rejected && (rowType === "linked-list" || step.forest))
      elements.push({ id: "rejected", type: "highlight", rowId: "row", state: "rejected", enterAt: 0 });
    // Beside a map the bottom stack keeps to the map plus one more (the equation), and a timeline's to two of an
    // equation, a choice, and a counter, as the prompt asks.
    if (step.counter && !step.map && !(step.timeline && step.choice))
      elements.push({
        id: "count",
        type: "counter",
        label: look.text("counter", "label", "inversions"),
        enterAt: 0,
      });
    if (step.window)
      elements.push({
        id: "window",
        type: "window",
        rowId: "row",
        label: look.text("window", "label", "sum"),
        enterAt: 0,
      });
    if (step.freq && !(heapScene && last))
      elements.push({
        id: "freq",
        type: "freq-table",
        label: look.text("freq-table", "label", "in window"),
        enterAt: 0,
      });
    if (step.deque)
      elements.push({
        id: "deque",
        type: "deque",
        rowId: "row",
        label: look.text("deque", "label", "deque"),
        outputLabel: look.text("deque", "outputLabel", "maxima"),
        enterAt: 0,
      });
    if (step.search)
      elements.push({ id: "search", type: "search-range", rowId: "row", label: "", enterAt: 0 });
    if (step.answers)
      elements.push({
        id: "answers",
        type: "number-line",
        label: look.text("number-line", "label", "speed"),
        enterAt: 0,
      });
    if (step.cuts) {
      elements.push({ id: "cut", type: "cut", rowId: "row", enterAt: 0 });
      elements.push({ id: "cut2", type: "cut", rowId: "row2", enterAt: 0 });
    }
    if (step.stack)
      elements.push({
        id: "stack",
        type: "call-stack",
        label: look.text("call-stack", "label", "call stack"),
        enterAt: 0,
      });
    if (step.heaps) elements.push({ id: "heaps", type: "heap", enterAt: 0 });
    if (step.race) elements.push({ id: "race", type: "race", rowId: "row", enterAt: 0 } as ElementSource);
    for (const row of step.prefix ?? [])
      elements.push({
        id: `prefix-${row.name}`,
        type: "prefix-row",
        rowId: "row",
        name: row.name,
        label: row.name,
        enterAt: 0,
      } as ElementSource);
    if (step.trie) elements.push({ id: "trie", type: "trie", enterAt: 0 } as ElementSource);
    if (step.bits) elements.push({ id: "bits", type: "bits", enterAt: 0 } as ElementSource);
    if (step.timeline) elements.push({ id: "timeline", type: "timeline", enterAt: 0 } as ElementSource);
    if (step.prefixGrid) elements.push({ id: "grid", type: "prefix-grid", enterAt: 0 } as ElementSource);
    if (step.reach)
      elements.push({
        id: "reach",
        type: "reach",
        rowId: "row",
        dimBeyond: true,
        enterAt: 0,
      } as ElementSource);
    if (step.choice)
      elements.push({
        id: "choice",
        type: "choice",
        ...(look.choiceReason ? { reason: look.choiceReason } : {}),
        enterAt: 0.2,
      } as ElementSource);
    // A prefix row's answer scene keeps to the input, the row, and the result: the map would crowd it.
    if (step.map && !(last && step.prefix))
      elements.push({
        id: "map",
        type: "hash-map",
        label: look.text("hash-map", "label", "map"),
        enterAt: 0,
      } as ElementSource);
    if (step.explore) {
      elements.push({ id: "search", type: "search-tree", enterAt: 0 } as ElementSource);
      // The answer scene keeps to the tree and the result.
      if (!last)
        elements.push({
          id: "partial",
          type: "partial",
          label: look.text("partial", "label", "building"),
          foundLabel: look.text("partial", "foundLabel", "found"),
          enterAt: 0,
        } as ElementSource);
    }
    if (step.pile)
      elements.push({
        id: "stack",
        type: "stack",
        ...(trace.row.values.length ? { rowId: "row" } : {}),
        label: look.text("stack", "label", "stack"),
        enterAt: 0,
      } as ElementSource);
    if (step.secondPile)
      elements.push({
        id: "stack2",
        type: "stack",
        traceStack: "second",
        label: look.text("stack", "label", "out", 1),
        enterAt: 0,
      } as ElementSource);
    if (step.queue)
      elements.push({
        id: "queue",
        type: "queue",
        label: look.text("queue", "label", "queue"),
        levelLabel: look.text("queue", "levelLabel", "level"),
        enterAt: 0,
      });
    // A topological order being built (no "found" row: the order is the whole answer).
    if (step.partial && step.network)
      elements.push({
        id: "order",
        type: "partial",
        label: look.text("partial", "label", "order"),
        foundLabel: look.text("partial", "foundLabel", "found"),
        showFound: false,
        enterAt: 0,
      } as ElementSource);
    // A tree's last scene keeps its bottom stack short (the answer, and at most a count).
    if (
      step.equation &&
      !(
        (rowType === "binary-tree" ||
          step.queue ||
          step.heaps ||
          step.table ||
          step.pile ||
          step.explore ||
          step.race ||
          step.prefixGrid ||
          step.timeline ||
          (step.map && step.prefix)) &&
        last
      )
    )
      elements.push({ id: "eq", type: "equation", unit: "", verdict: look.verdict(step), enterAt: 0.1 });
    const callout = look.callout?.(step);
    if (callout) elements.push({ id: "why", type: "callout", text: callout, enterAt: 0.3 });
    // The last step is where the answer is known: state it there (a real story does the same). A 2D table fills
    // the stage, so its answer card goes in the closing scene instead.
    if (index === trace.steps.length - 1 && !wideTable) {
      elements.push({
        id: "result",
        type: "result",
        title: "Answer",
        showsAnswer: true,
        enterAt: 0.5,
        tone: "success",
      });
    }
    return [
      {
        id: `step-${index}`,
        caption: look.caption(step, index),
        narration: step.note,
        traceStep: index,
        elements: simplify(elements, look.level?.(index) ?? 0),
      },
    ];
  });

  // A simplified last step leaves its answer card out: it goes in the closing scene.
  const closing = wideTable || (look.level?.(trace.steps.length - 1) ?? 0) >= 1;
  return { rows, stepScenes, wideTable: closing, answerCard };
}
