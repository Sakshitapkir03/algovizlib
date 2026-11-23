import type { Draft } from "@/lib/generation/draft";
import { getProblem } from "@/lib/catalog/repository";
import type { ElementSource } from "@/lib/storyboard";
import { getTraceDefinition, runTrace, type Trace } from "@/lib/traces";

/** The trace a problem's generator would use. */
export function traceFor(problemKey: string): { trace: Trace; args: unknown[] } {
  const def = getTraceDefinition(problemKey)!;
  const [pattern, slug] = problemKey.split("/");
  const args = getProblem(pattern, slug)!.examples[def.exampleIndex].args;
  return { trace: runTrace(problemKey, args), args };
}

/**
 * A correct, model-shaped draft for any trace: intro scenes, one scene per key step (binding values omitted so
 * they come from the trace) with the answer on the last one, and a closing scene. Tests mutate copies of it.
 */
export function buildDraft(problemKey: string): Draft {
  const def = getTraceDefinition(problemKey)!;
  const { trace } = traceFor(problemKey);
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
              labels: trace.row.values.map((_, i) => `item ${i}`),
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
            labels: trace.secondRow.values.map((_, i) => `other ${i}`),
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
  const stepScenes = trace.steps.flatMap((step, index) => {
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
      elements.push({ id: "sorted", type: "sorted-region", rowId: "row", label: "sorted", enterAt: 0 });
    if (step.held)
      elements.push({ id: "held", type: "held-value", rowId: "row", label: "holding", enterAt: 0 });
    if (step.counts) elements.push({ id: "tally", type: "count-array", label: "count", enterAt: 0 });
    if (step.segments) elements.push({ id: "groups", type: "segments", rowId: "row", enterAt: 0 });
    if (step.splitTree) elements.push({ id: "overview", type: "split-tree", label: "split", enterAt: 0 });
    if (step.buffer)
      elements.push({ id: "buffer", type: "merge-buffer", rowId: "row", label: "merged", enterAt: 0 });
    if (step.pivot !== undefined)
      elements.push({ id: "partition", type: "partition", rowId: "row", label: "pivot", enterAt: 0 });
    if (step.heapSize !== undefined || (step.heap && step.heap.length > 0))
      elements.push({ id: "heap", type: "heap-tree", enterAt: 0 });
    if (step.rejected && (rowType === "linked-list" || step.forest))
      elements.push({ id: "rejected", type: "highlight", rowId: "row", state: "rejected", enterAt: 0 });
    // Beside a map the bottom stack keeps to the map plus one more (the equation), and a timeline's to two of an
    // equation, a choice, and a counter, as the prompt asks.
    if (step.counter && !step.map && !(step.timeline && step.choice))
      elements.push({ id: "count", type: "counter", label: "inversions", enterAt: 0 });
    if (step.window) elements.push({ id: "window", type: "window", rowId: "row", label: "sum", enterAt: 0 });
    if (step.freq && !(heapScene && last))
      elements.push({ id: "freq", type: "freq-table", label: "in window", enterAt: 0 });
    if (step.deque)
      elements.push({
        id: "deque",
        type: "deque",
        rowId: "row",
        label: "deque",
        outputLabel: "maxima",
        enterAt: 0,
      });
    if (step.search)
      elements.push({ id: "search", type: "search-range", rowId: "row", label: "", enterAt: 0 });
    if (step.answers) elements.push({ id: "answers", type: "number-line", label: "speed", enterAt: 0 });
    if (step.cuts) {
      elements.push({ id: "cut", type: "cut", rowId: "row", enterAt: 0 });
      elements.push({ id: "cut2", type: "cut", rowId: "row2", enterAt: 0 });
    }
    if (step.stack) elements.push({ id: "stack", type: "call-stack", label: "call stack", enterAt: 0 });
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
        reason: "A short line on why this is safe, in the story's words.",
        enterAt: 0.2,
      } as ElementSource);
    // A prefix row's answer scene keeps to the input, the row, and the result: the map would crowd it.
    if (step.map && !(last && step.prefix))
      elements.push({ id: "map", type: "hash-map", label: "map", enterAt: 0 } as ElementSource);
    if (step.explore) {
      elements.push({ id: "search", type: "search-tree", enterAt: 0 } as ElementSource);
      // The answer scene keeps to the tree and the result.
      if (!last)
        elements.push({
          id: "partial",
          type: "partial",
          label: "building",
          foundLabel: "found",
          enterAt: 0,
        } as ElementSource);
    }
    if (step.pile)
      elements.push({
        id: "stack",
        type: "stack",
        ...(trace.row.values.length ? { rowId: "row" } : {}),
        label: "stack",
        enterAt: 0,
      } as ElementSource);
    if (step.secondPile)
      elements.push({
        id: "stack2",
        type: "stack",
        traceStack: "second",
        label: "out",
        enterAt: 0,
      } as ElementSource);
    if (step.queue)
      elements.push({ id: "queue", type: "queue", label: "queue", levelLabel: "level", enterAt: 0 });
    // A topological order being built (no "found" row: the order is the whole answer).
    if (step.partial && step.network)
      elements.push({
        id: "order",
        type: "partial",
        label: "order",
        foundLabel: "found",
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
      elements.push({ id: "eq", type: "equation", unit: "", verdict: step.kind, enterAt: 0.1 });
    elements.push({ id: "why", type: "callout", text: step.note.slice(0, 120), enterAt: 0.3 });
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
        caption: `Step ${index}: ${step.kind}`,
        narration: step.note,
        traceStep: index,
        elements,
      },
    ];
  });

  return {
    title: `Test storyboard for ${problemKey}`,
    summary: "A storyboard built by the test fixture.",
    exampleSource: def.exampleSource,
    ...(def.exampleSource === "analogy"
      ? { analogy: { scenario: "A shelf of items.", mapping: [{ real: "item", abstract: "value" }] } }
      : {}),
    takeaway: {
      pattern: "Two Pointers",
      summary: "Walk inward.",
      timeComplexity: "O(n)",
      spaceComplexity: "O(1)",
      whenToUse: [],
    },
    scenes: [
      { id: "problem", caption: "The problem", narration: "Here is the problem.", elements: rows() },
      {
        id: "brute-force",
        caption: "Brute force is slow",
        narration: "Checking everything is slow.",
        elements: rows(),
      },
      ...stepScenes,
      {
        id: "pattern",
        caption: "The pattern",
        narration: "That's the two-pointer pattern.",
        elements: wideTable ? [answerCard] : rows(),
      },
    ],
  };
}
