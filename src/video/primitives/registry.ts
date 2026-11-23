import type { ComponentType } from "react";

import type { ElementOf, ElementType } from "@/lib/storyboard";

import { BarRow } from "./BarRow";
import { Bits } from "./Bits";
import { BinaryTree } from "./BinaryTree";
import { Callout } from "./Callout";
import { Choice } from "./Choice";
import { CallStack } from "./CallStack";
import { CountArray } from "./CountArray";
import { Counter } from "./Counter";
import { Cut } from "./Cut";
import { Deque } from "./Deque";
import { DpTable } from "./DpTable";
import { Equation } from "./Equation";
import { FreqTable } from "./FreqTable";
import { Graph } from "./Graph";
import { Grid } from "./Grid";
import { HashMap } from "./HashMap";
import { Heap } from "./Heap";
import { HeapTree } from "./HeapTree";
import { HeldValue } from "./HeldValue";
import { HouseRow } from "./HouseRow";
import { Highlight } from "./Highlight";
import { ItemRow } from "./ItemRow";
import { LinkedList } from "./LinkedList";
import { MergeBuffer } from "./MergeBuffer";
import { NumberLine } from "./NumberLine";
import { Partial } from "./Partial";
import { Partition } from "./Partition";
import { Race } from "./Race";
import { Reach } from "./Reach";
import { Pointer } from "./Pointer";
import { PrefixGrid } from "./PrefixGrid";
import { PrefixRow } from "./PrefixRow";
import { Queue } from "./Queue";
import { Result } from "./Result";
import { SearchRange } from "./SearchRange";
import { SearchTree } from "./SearchTree";
import { Segments } from "./Segments";
import { SortedRegion } from "./SortedRegion";
import { SplitTree } from "./SplitTree";
import { Stack } from "./Stack";
import { Staircase } from "./Staircase";
import { Timeline } from "./Timeline";
import { Trie } from "./Trie";
import { Digraph } from "./Digraph";
import { UnionFind } from "./UnionFind";
import { OpLog } from "./OpLog";
import { Window } from "./Window";

export type PrimitiveDefinition<K extends ElementType> = {
  component: ComponentType<{ element: ElementOf<K> }>;
  /**
   * "canvas": absolutely positioned on the 1280×720 stage (uses row layout).
   * "bottom": stacked in the bottom panel, in storyboard order.
   */
  slot: "canvas" | "bottom";
  /** Paint order within the canvas slot (higher draws on top). */
  layer: number;
};

/**
 * Element type → component. The mapped type makes a missing entry a compile
 * error, so a new primitive can't be added to the schema without a renderer.
 */
export const primitiveRegistry: { [K in ElementType]: PrimitiveDefinition<K> } = {
  "item-row": { component: ItemRow, slot: "canvas", layer: 0 },
  "bar-row": { component: BarRow, slot: "canvas", layer: 0 },
  // Nodes and arrows; highlights ring the nodes and pointers sit above them.
  "linked-list": { component: LinkedList, slot: "canvas", layer: 0 },
  // Fast and slow pointers: hop arcs, the meeting node, and the loop, over the list and under its pointers.
  race: { component: Race, slot: "canvas", layer: 1 },
  // Nodes, edges, and notes; highlights ring the nodes. The call stack is a column beside it.
  "binary-tree": { component: BinaryTree, slot: "canvas", layer: 0 },
  "call-stack": { component: CallStack, slot: "canvas", layer: 0 },
  // A breadth-first search's grid or graph (cells or nodes, then the check arrows over them); the queue sits below.
  grid: { component: Grid, slot: "canvas", layer: 0 },
  graph: { component: Graph, slot: "canvas", layer: 0 },
  queue: { component: Queue, slot: "bottom", layer: 0 },
  // Priority queues: tree plus backing array (one or two heaps), under an optional input strip.
  heap: { component: Heap, slot: "canvas", layer: 0 },
  // Dynamic programming: the table, and above a 1D one the story it's lined up with (steps, houses).
  "dp-table": { component: DpTable, slot: "canvas", layer: 0 },
  staircase: { component: Staircase, slot: "canvas", layer: -1 },
  "house-row": { component: HouseRow, slot: "canvas", layer: 0 },
  // A stack's column on the right, plus its resolve arcs, answers, and text strip under the input row.
  stack: { component: Stack, slot: "canvas", layer: 1.5 },
  // Backtracking: the decision tree (beside a board when there is one) and the answer being built, below.
  "search-tree": { component: SearchTree, slot: "canvas", layer: 0 },
  partial: { component: Partial, slot: "bottom", layer: 0 },
  // Hashing: the map or set under the input.
  "hash-map": { component: HashMap, slot: "bottom", layer: 0 },
  // Greedy: the stretch committed to (band under the cards, jump arc over them, dashing cards out of reach), under
  // highlights and pointers; the choice panel sits below.
  reach: { component: Reach, slot: "canvas", layer: 0.5 },
  choice: { component: Choice, slot: "bottom", layer: 0 },
  // Prefix sums: running totals under the input (their span brackets above it), or a matrix beside its prefix grid.
  "prefix-row": { component: PrefixRow, slot: "canvas", layer: 0.5 },
  "prefix-grid": { component: PrefixGrid, slot: "canvas", layer: 0 },
  // Intervals: bars on lanes over a number line (a heap, when there is one, sits under it).
  timeline: { component: Timeline, slot: "canvas", layer: 0 },
  // Bit manipulation: numbers as aligned rows of bits, in the bottom stack.
  bits: { component: Bits, slot: "bottom", layer: 0 },
  // Tries: letter nodes by depth (right of a board when there is one).
  trie: { component: Trie, slot: "canvas", layer: 0 },
  // Advanced graphs: a directed, weighted graph (left of a heap when there is one), and union-find's trees.
  digraph: { component: Digraph, slot: "canvas", layer: 0 },
  "union-find": { component: UnionFind, slot: "canvas", layer: 0 },
  // Data structure design: the calls and their outputs, a column left of the structures.
  "op-log": { component: OpLog, slot: "canvas", layer: 0 },
  // Drawn behind the bars it marks.
  "sorted-region": { component: SortedRegion, slot: "canvas", layer: -1 },
  "count-array": { component: CountArray, slot: "canvas", layer: 0 },
  "held-value": { component: HeldValue, slot: "canvas", layer: 2 },
  // Behind the bars: the active group's band; the brackets sit under the baseline.
  segments: { component: Segments, slot: "canvas", layer: -1 },
  "merge-buffer": { component: MergeBuffer, slot: "canvas", layer: 0 },
  // Over the bars, so it can dim the ones outside the range; under highlights and pointers.
  partition: { component: Partition, slot: "canvas", layer: 0.5 },
  "heap-tree": { component: HeapTree, slot: "canvas", layer: 0 },
  "split-tree": { component: SplitTree, slot: "bottom", layer: 0 },
  counter: { component: Counter, slot: "bottom", layer: 0 },
  // Its band sits behind the cards; the bracket and label above them.
  window: { component: Window, slot: "canvas", layer: -1 },
  "freq-table": { component: FreqTable, slot: "bottom", layer: 0 },
  deque: { component: Deque, slot: "bottom", layer: 0 },
  // Over the cards, so it can dim the dropped ones; under highlights and pointers.
  "search-range": { component: SearchRange, slot: "canvas", layer: 0.5 },
  "number-line": { component: NumberLine, slot: "bottom", layer: 0 },
  // Over the cards: its shading tints the left side.
  cut: { component: Cut, slot: "canvas", layer: 0.5 },
  highlight: { component: Highlight, slot: "canvas", layer: 1 },
  pointer: { component: Pointer, slot: "canvas", layer: 2 },
  callout: { component: Callout, slot: "canvas", layer: 3 },
  equation: { component: Equation, slot: "bottom", layer: 0 },
  result: { component: Result, slot: "bottom", layer: 0 },
};
