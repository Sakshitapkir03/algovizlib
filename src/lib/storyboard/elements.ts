import { z } from "zod";

/**
 * Visual primitives. Each element is one variant of a discriminated union on `type`, in two forms:
 *
 * - **Source** (`elementSourceSchema`): what storyboard files and the model write. When the storyboard is bound to
 *   a trace, state-carrying fields (pointer `index`, equation `terms`/`result`, highlight `indices`, row values…)
 *   may be omitted and are filled in from the scene's trace step by `resolveStoryboard`.
 * - **Resolved** (`elementSchema`): every value present. Renderers and the validator only see this form.
 *
 * To add a primitive: add both schemas here and append them to `elementSchemas` / `elementSourceSchemas`, describe
 * it in `primitive-catalog.ts` (the model reads that), then add a component to `src/video/primitives/registry.ts`.
 * The registry and the catalog are typed so a missing entry is a compile error.
 *
 * Planned (not built yet): "coin-set", "box-arrow".
 * Sorting adds "sorted-region", "held-value", "count-array", and bar-row `moves`/`empty`; divide and conquer adds
 * "segments", "split-tree", "merge-buffer", "partition", "heap-tree", and "counter"; sliding window adds "window",
 * "freq-table", and "deque"; binary search adds "search-range", "number-line", "cut", and item-row `traceRow`;
 * linked lists add "linked-list" (and heap-tree values from a step's `heap`); trees add "binary-tree" and
 * "call-stack"; breadth-first search adds "grid", "graph", and "queue"; dynamic programming adds "dp-table", "staircase", and
 * "house-row"; stacks add "stack" (apart from "call-stack"); backtracking adds
 * "search-tree" and "partial"; priority queues add "heap" (built
 * apart from "heap-tree", which stays exactly as heap sort uses it).
 */

const nonEmpty = z.string().trim().min(1);
const index = z.number().int().nonnegative();

/** Fields every element shares. */
const baseElement = {
  id: nonEmpty,
  /**
   * When the element appears, as a fraction (0–1) of the scene's duration.
   * Fractions (not frames) so timing survives the switch to audio-driven
   * scene lengths.
   */
  enterAt: z.number().min(0).max(1).default(0),
};

export const itemSchema = z.object({
  label: nonEmpty,
  /** A number, or a short string such as a single character. */
  value: z.union([z.number().finite(), z.string().max(12)]),
  /** Optional secondary line, e.g. an emoji-free descriptor or array index. */
  sublabel: z.string().optional(),
});

const itemRowShape = {
  ...baseElement,
  type: z.literal("item-row"),
  items: z.array(itemSchema).min(1),
  /** Prefix used when rendering values, e.g. "$". */
  unit: z.string().default(""),
  /** Which trace list this row shows when the trace has two (Median of Two Sorted Arrays). Default: the first. */
  traceRow: z.enum(["first", "second"]).optional(),
};
export const itemRowElementSchema = z.object(itemRowShape);
export const itemRowSourceSchema = z.object({
  ...itemRowShape,
  /** Omit to take values from the trace's row; then `labels` names each item (default `[i]`). */
  items: itemRowShape.items.optional(),
  labels: z.array(nonEmpty).optional(),
});

export const barSchema = z.object({
  label: z.string().optional(),
  value: z.number().finite().nonnegative(),
});

const moveSchema = z.object({ from: index, to: index });

const fillSchema = z.object({
  from: index,
  to: index,
  level: z.number().finite().nonnegative(),
  /** Cover the bars from..to whole (a rectangle over them) instead of the gap between their centers (a container). */
  cover: z.boolean().optional(),
  /** The fill's word (default "water"). */
  label: z.string().max(10).optional(),
});

const barRowShape = {
  ...baseElement,
  type: z.literal("bar-row"),
  /** Vertical bars, e.g. wall heights or terrain. Bottom-aligned on a shared baseline. */
  bars: z.array(barSchema).min(1),
  unit: z.string().default(""),
  /** A container between two bars, shaded up to `level` (e.g. water held between two walls). */
  fill: fillSchema.optional(),
  /** Water standing on top of each bar (same length as `bars`). */
  water: z.array(z.number().finite().nonnegative()).optional(),
  /**
   * Bars that just moved into their slots: each slides from `from` to `to` as the scene starts. A swap is two
   * moves (the bars arc past each other), a shift is one.
   */
  moves: z.array(moveSchema).optional(),
  /** Slots drawn as empty dashed outlines: a lifted value's gap, or output not written yet. */
  empty: z.array(index).optional(),
  /**
   * The value that reaches full height. Defaults to the tallest bar in this scene; a trace that rearranges its array
   * sets it to the largest value it ever holds, so bar heights stay comparable from scene to scene.
   */
  maxValue: z.number().finite().positive().optional(),
};
export const barRowElementSchema = z.object(barRowShape);
export const barRowSourceSchema = z.object({
  ...barRowShape,
  /**
   * Omit to take heights from the trace: the bound step's array (`values`) when the algorithm rearranges it,
   * otherwise the trace's row. `fill`/`water`/`moves`/`empty` default to the bound step's.
   */
  bars: barRowShape.bars.optional(),
  labels: z.array(z.string()).optional(),
});

const sortedRegionShape = {
  ...baseElement,
  type: z.literal("sorted-region"),
  rowId: nonEmpty,
  /** Positions already in their final order (any set: a sorted prefix, a suffix, or placed pivots). */
  indices: z.array(index).min(1),
  label: nonEmpty.max(16).default("sorted"),
};
export const sortedRegionElementSchema = z.object(sortedRegionShape);
export const sortedRegionSourceSchema = z.object({
  ...sortedRegionShape,
  /** Omit to take the bound step's final positions. */
  indices: sortedRegionShape.indices.optional(),
  /** Shorthand for a contiguous range (inclusive); becomes `indices`. */
  from: index.optional(),
  to: index.optional(),
});

const heldValueShape = {
  ...baseElement,
  type: z.literal("held-value"),
  rowId: nonEmpty,
  /** The value lifted out of the row, drawn above slot `index` (its gap). */
  value: z.number().finite().nonnegative(),
  index,
  label: nonEmpty.max(16).default("holding"),
};
export const heldValueElementSchema = z.object(heldValueShape);
export const heldValueSourceSchema = z.object({
  ...heldValueShape,
  /** Omit both to take the bound step's held value. */
  value: heldValueShape.value.optional(),
  index: index.optional(),
});

const countArrayShape = {
  ...baseElement,
  type: z.literal("count-array"),
  /** The value each cell counts, e.g. [0, 1, 2, 3, 4]. */
  keys: z.array(z.number().finite()).min(1).max(10),
  /** How many times each key has been seen (same length as `keys`). */
  counts: z.array(z.number().int().nonnegative()).min(1).max(10),
  /** The cell that just changed. */
  active: index.optional(),
  label: nonEmpty.max(16).default("count"),
};
export const countArrayElementSchema = z.object(countArrayShape);
export const countArraySourceSchema = z.object({
  ...countArrayShape,
  /** Omit keys/counts (and active) to take the bound step's tally. */
  keys: countArrayShape.keys.optional(),
  counts: countArrayShape.counts.optional(),
});

const rangeSchema = z.object({ from: index, to: index });

const segmentsShape = {
  ...baseElement,
  type: z.literal("segments"),
  rowId: nonEmpty,
  /** How the row is split right now: inclusive ranges covering every position, left to right. */
  groups: z.array(rangeSchema).min(1),
  /** The group being worked on, drawn emphasized. */
  active: rangeSchema.optional(),
  /** Recursion depth of the active group (0 = the whole array), shown as "level d". */
  depth: z.number().int().nonnegative().optional(),
};
export const segmentsElementSchema = z.object(segmentsShape);
export const segmentsSourceSchema = z.object({
  ...segmentsShape,
  /** Omit groups (and active/depth) to take the bound step's split. */
  groups: segmentsShape.groups.optional(),
});

const splitTreeShape = {
  ...baseElement,
  type: z.literal("split-tree"),
  /** Every recursion level at once: `levels[d]` lists the groups' values at depth d, whole array first. */
  levels: z
    .array(z.array(z.array(z.number().finite()).min(1)).min(1))
    .min(1)
    .max(5),
  label: nonEmpty.max(16).default("split"),
};
export const splitTreeElementSchema = z.object(splitTreeShape);
export const splitTreeSourceSchema = z.object({
  ...splitTreeShape,
  /** Omit to take the bound step's split tree. */
  levels: splitTreeShape.levels.optional(),
});

const mergeBufferShape = {
  ...baseElement,
  type: z.literal("merge-buffer"),
  rowId: nonEmpty,
  /** First row position the buffer lines up under; it covers `values.length` positions. */
  from: index,
  /** The merged output so far; `null` slots are not written yet. */
  values: z.array(z.number().finite().nullable()).min(1),
  /** The slot written by this step. */
  taken: index.optional(),
  label: nonEmpty.max(16).default("merged"),
};
export const mergeBufferElementSchema = z.object(mergeBufferShape);
export const mergeBufferSourceSchema = z.object({
  ...mergeBufferShape,
  /** Omit from/values (and taken) to take the bound step's buffer. */
  from: index.optional(),
  values: mergeBufferShape.values.optional(),
});

const partitionShape = {
  ...baseElement,
  type: z.literal("partition"),
  rowId: nonEmpty,
  /** The pivot's position. */
  pivot: index,
  /** The partition line sits just before this position (positions `from`…boundary-1 are smaller than the pivot). */
  boundary: index,
  /** The range being partitioned (inclusive); bars outside it are dimmed. */
  from: index,
  to: index,
  label: nonEmpty.max(16).default("pivot"),
};
export const partitionElementSchema = z.object(partitionShape);
export const partitionSourceSchema = z.object({
  ...partitionShape,
  /** Omit pivot/boundary/from/to to take them from the bound step. */
  pivot: index.optional(),
  boundary: index.optional(),
  from: index.optional(),
  to: index.optional(),
});

const heapTreeShape = {
  ...baseElement,
  type: z.literal("heap-tree"),
  /** The array drawn as a binary tree (children of i at 2i + 1 and 2i + 2): the same values as the bar-row. */
  values: z.array(z.number().finite()).min(1).max(7),
  /** Positions 0…heapSize-1 are in the heap; the rest are faded (already sorted). */
  heapSize: z.number().int().nonnegative(),
  /** The parent and child being compared, in that order. */
  compare: z.tuple([index, index]).optional(),
  /** Nodes that just traded places (same moves as the bars). */
  moves: z.array(moveSchema).optional(),
};
export const heapTreeElementSchema = z.object(heapTreeShape);
export const heapTreeSourceSchema = z.object({
  ...heapTreeShape,
  /** Omit values/heapSize (and compare/moves) to take them from the bound step, or the trace's row if unbound. */
  values: heapTreeShape.values.optional(),
  heapSize: heapTreeShape.heapSize.optional(),
});

const counterShape = {
  ...baseElement,
  type: z.literal("counter"),
  /** What is being counted, e.g. "inversions". */
  label: nonEmpty.max(24),
  value: z.number().int(),
  /** How much this step added, shown as "+3". */
  delta: z.number().int().optional(),
};
export const counterElementSchema = z.object(counterShape);
export const counterSourceSchema = z.object({
  ...counterShape,
  /** Omit value/delta to take the bound step's running total. */
  value: counterShape.value.optional(),
});

const windowRangeSchema = z.object({ from: index, to: z.number().int().min(-1) });

const windowShape = {
  ...baseElement,
  type: z.literal("window"),
  rowId: nonEmpty,
  /** First position inside the window. */
  from: index,
  /** Last position inside the window (inclusive); `from - 1` when the window is empty. */
  to: z.number().int().min(-1),
  /** Shown after the label, e.g. the window's sum or length. */
  value: z.union([z.number().finite(), z.string().max(12)]).optional(),
  /** What the value is, e.g. "sum" or "length" (rendered "sum 13"). */
  label: z.string().max(16).default(""),
  /** Where the window was in the previous bound scene: its edges slide from there. */
  fromRange: windowRangeSchema.optional(),
};
export const windowElementSchema = z.object(windowShape);
export const windowSourceSchema = z.object({
  ...windowShape,
  /** Omit from/to/value (and fromRange) to take the bound step's window. */
  from: index.optional(),
  to: windowShape.to.optional(),
});

const searchRangeShape = {
  ...baseElement,
  type: z.literal("search-range"),
  rowId: nonEmpty,
  /** First position still in play. */
  from: index,
  /** Last position still in play (inclusive); `from - 1` once nothing is left (it marks the gap before `from`). */
  to: z.number().int().min(-1),
  /** The position just checked. */
  mid: index.optional(),
  /** The half known to be in order (rotated arrays), shown with "✓ sorted". */
  sorted: rangeSchema.optional(),
  /** Shown above the bracket when there's no sorted half, e.g. "insert here" on an empty range. */
  label: z.string().max(16).default(""),
  /** The range in the previous bound scene: the bracket's edges slide from there. */
  fromRange: windowRangeSchema.optional(),
};
export const searchRangeElementSchema = z.object(searchRangeShape);
export const searchRangeSourceSchema = z.object({
  ...searchRangeShape,
  /** Omit from/to/mid/sorted (and fromRange) to take the bound step's range. */
  from: index.optional(),
  to: searchRangeShape.to.optional(),
});

const numberLineShape = {
  ...baseElement,
  type: z.literal("number-line"),
  /** The smallest and largest candidate answer (at most 16 candidates). */
  min: z.number().int(),
  max: z.number().int(),
  /** Candidates below `low` are ruled out; candidates from `high` up are known to work. */
  low: z.number().int(),
  high: z.number().int(),
  /** The candidate just tested. */
  mid: z.number().int().optional(),
  /** What the candidates are, e.g. "speed". */
  label: nonEmpty.max(16).default("answers"),
};
export const numberLineElementSchema = z.object(numberLineShape);
export const numberLineSourceSchema = z.object({
  ...numberLineShape,
  /** Omit min/max/low/high/mid to take the bound step's candidates. */
  min: numberLineShape.min.optional(),
  max: numberLineShape.max.optional(),
  low: numberLineShape.low.optional(),
  high: numberLineShape.high.optional(),
});

const cutShape = {
  ...baseElement,
  type: z.literal("cut"),
  rowId: nonEmpty,
  /** How many values sit left of the cut (0 = before the first card, the row's length = after the last). */
  at: index,
  /** Where the cut was in the previous bound scene: it slides from there. */
  fromAt: index.optional(),
};
export const cutElementSchema = z.object(cutShape);
export const cutSourceSchema = z.object({
  ...cutShape,
  /** Omit at/fromAt to take the bound step's cut for this row's list. */
  at: index.optional(),
});

export const listNodeSchema = z.object({
  /** Node ids are 0…n-1; pointers and highlights refer to nodes by id (`rowId` = this element's id). */
  id: index,
  /** A number, or a short word (the dummy node's "dummy"). */
  value: z.union([z.number().finite(), z.string().max(8)]),
  /** The node it links to, or null (the end of a list). */
  next: index.nullable(),
  /** Which horizontal list on screen (0 = top), and the position in it (0 = left). */
  lane: z.number().int().min(0).max(3),
  slot: z.number().int().min(0).max(9),
  /** The dummy-node trick's placeholder, drawn dashed. */
  dummy: z.boolean().optional(),
});

const listPlaceSchema = z.object({
  id: index,
  lane: listNodeSchema.shape.lane,
  slot: listNodeSchema.shape.slot,
});

const linkedListShape = {
  ...baseElement,
  type: z.literal("linked-list"),
  /** Every node, with its link and where it's drawn. */
  nodes: z.array(listNodeSchema).min(1).max(16),
  /** Links changed in this scene: the old arrow ghosts away while the new one draws in. */
  rewired: z.array(z.object({ node: index, from: index.nullable(), to: index.nullable() })).optional(),
  /** Where nodes that moved were in the previous bound scene: they slide from there. */
  fromPlaces: z.array(listPlaceSchema).optional(),
  /** A short name at the left of each lane, e.g. ["list A", "list B", "merged"]. */
  laneLabels: z.array(z.string().max(16)).max(4).optional(),
};
export const linkedListElementSchema = z.object(linkedListShape);
export const linkedListSourceSchema = z.object({
  ...linkedListShape,
  /** Omit to take the bound step's list (or, in an unbound scene, the list as the trace starts); rewired and
   * fromPlaces follow. */
  nodes: linkedListShape.nodes.optional(),
});

const treeSideSchema = z.enum(["left", "right"]);

export const treeNodeSchema = z.object({
  /** Node ids are level-order positions of the real nodes (0 = the root); highlights and callouts use them. */
  id: index,
  value: z.number().finite(),
  left: index.nullable(),
  right: index.nullable(),
});

const binaryTreeShape = {
  ...baseElement,
  type: z.literal("binary-tree"),
  /** The tree's shape: every node with its children (null = missing). */
  nodes: z.array(treeNodeSchema).min(1).max(15),
  /** The node whose call is running (ringed). */
  current: index.optional(),
  /** A call on a missing child, drawn as a "null" stub under `parent`. */
  nullVisit: z.object({ parent: index, side: treeSideSchema }).optional(),
  /** Nodes with an open call, root first: the active path, drawn in the accent color. */
  path: z.array(index).default([]),
  /** Nodes whose call has returned (marked ✓). */
  done: z.array(index).default([]),
  /** Nodes never visited because the answer came early (dashed and faded). */
  skipped: z.array(index).optional(),
  /** A value handed up this scene: it travels up the edge from the child on `side` of `to`. */
  returned: z.object({ to: index, side: treeSideSchema, value: z.string().max(8) }).optional(),
  /** What each finished call returned, beside its node. */
  results: z.array(z.object({ node: index, value: z.string().max(8) })).optional(),
  /** Running state carried down to a node ("sum 9", "(5, 10)"). */
  badges: z.array(z.object({ node: index, text: z.string().max(12) })).optional(),
  /** Calls that repeat earlier work (a recursion's overlapping subproblems): a dotted accent border. */
  repeats: z.array(index).optional(),
};
export const binaryTreeElementSchema = z.object(binaryTreeShape);
export const binaryTreeSourceSchema = z.object({
  ...binaryTreeShape,
  /** Omit nodes and the walk (current, path, done, …) to take them from the bound step (the bare tree when unbound). */
  nodes: binaryTreeShape.nodes.optional(),
  path: binaryTreeShape.path.removeDefault().optional(),
  done: binaryTreeShape.done.removeDefault().optional(),
});

export const stackFrameSchema = z.object({
  /** The call, e.g. "depth(5)"; "depth(∅)" for a missing child. */
  label: z.string().trim().min(1).max(14),
  node: index.nullable(),
  /** The child this call is waiting on. */
  waiting: treeSideSchema.optional(),
  /** Set when the call returns in this scene. */
  returns: z.string().max(8).optional(),
});

const callStackShape = {
  ...baseElement,
  type: z.literal("call-stack"),
  /** Open calls, bottom (the first call) to top (the running one). */
  frames: z.array(stackFrameSchema).max(8),
  /** How many bottom frames were already there in the previous bound scene; the rest are pushed in. */
  kept: z.number().int().nonnegative().optional(),
  label: nonEmpty.max(16).default("call stack"),
};
export const callStackElementSchema = z.object(callStackShape);
export const callStackSourceSchema = z.object({
  ...callStackShape,
  /** Omit frames (and kept) to take the bound step's stack. */
  frames: callStackShape.frames.optional(),
});

const cellValueSchema = z.union([z.number().finite(), z.string().max(4)]);

export const cellKindSchema = z.object({
  value: cellValueSchema,
  /** Drawn in the cell ("≈", "■", a pixel's color number); "" for nothing. */
  glyph: z.string().max(3),
  /** Names the content ("water", "wall"); a skipped neighbor check shows it as the reason. */
  word: z.string().max(10),
  tone: z.enum(["plain", "fill", "wall", "mark"]),
});

export const bfsCheckSchema = z.object({
  from: index,
  to: index.optional(),
  /** [row step, column step] on a grid (the only way to point off the grid). */
  dir: z.tuple([z.number().int().min(-1).max(1), z.number().int().min(-1).max(1)]).optional(),
  result: z.enum(["added", "visited", "blocked", "out"]),
});

/** A breadth-first search drawn on a grid or graph (ids are cells, row * cols + col, or nodes). */
const bfsShape = {
  /** The item being processed (ringed). */
  current: index.optional(),
  /** Everything seen so far. */
  visited: z.array(index).default([]),
  /** What's in the queue (dashed accent outline). */
  frontier: z.array(index).default([]),
  /** Each seen item's level (distance), shown on it. */
  levels: z.array(z.object({ id: index, level: z.number().int().min(0).max(99) })).optional(),
  /** This scene's neighbor checks: an arrow each, added or skipped (with the reason). */
  checks: z.array(bfsCheckSchema).max(8).optional(),
};
const bfsSource = {
  ...bfsShape,
  visited: bfsShape.visited.removeDefault().optional(),
  frontier: bfsShape.frontier.removeDefault().optional(),
};

const gridShape = {
  ...baseElement,
  type: z.literal("grid"),
  rows: z.number().int().min(1).max(6),
  cols: z.number().int().min(1).max(6),
  /** Each cell's content, row by row. */
  cells: z.array(z.array(cellValueSchema).min(1).max(6)).min(1).max(6),
  /** How each value is drawn. */
  legend: z.array(cellKindSchema).min(1).max(6),
  ...bfsShape,
};
export const gridElementSchema = z.object(gridShape);
export const gridSourceSchema = z.object({
  ...gridShape,
  /** Omit the shape and contents (rows, cols, cells, legend) and the search to take them from the trace. */
  rows: gridShape.rows.optional(),
  cols: gridShape.cols.optional(),
  cells: gridShape.cells.optional(),
  legend: gridShape.legend.optional(),
  ...bfsSource,
});

const graphShape = {
  ...baseElement,
  type: z.literal("graph"),
  nodes: z
    .array(z.object({ id: index, label: z.string().trim().min(1).max(8) }))
    .min(1)
    .max(10),
  /** Undirected edges between node ids. */
  edges: z.array(z.tuple([index, index])).max(20),
  ...bfsShape,
};
export const graphElementSchema = z.object(graphShape);
export const graphSourceSchema = z.object({
  ...graphShape,
  /** Omit nodes/edges and the search to take them from the trace. */
  nodes: graphShape.nodes.optional(),
  edges: graphShape.edges.optional(),
  ...bfsSource,
});

const queueItemSchema = z.object({
  id: index,
  label: z.string().trim().min(1).max(8),
  level: z.number().int().min(0).max(99),
});

const queueShape = {
  ...baseElement,
  type: z.literal("queue"),
  /** Front first; a divider marks where one level's items end and the next level's begin. */
  items: z.array(queueItemSchema).max(10),
  /** Taken off the front in this scene (drawn leaving). */
  dequeued: queueItemSchema.optional(),
  /** Ids added at the back in this scene (they slide in). */
  enqueued: z.array(index).optional(),
  label: nonEmpty.max(16).default("queue"),
  /** The word on each level marker: "level" shows "level 2"; "minute" shows "minute 2". */
  levelLabel: nonEmpty.max(10).default("level"),
};
export const queueElementSchema = z.object(queueShape);
export const queueSourceSchema = z.object({
  ...queueShape,
  /** Omit items/dequeued/enqueued to take the bound step's queue. */
  items: queueShape.items.optional(),
});

export const heapItemSchema = z.object({
  /** What the heap orders by. */
  key: z.number().finite(),
  /** What the node and the array cell show ("9", "(-1,1)", "4 ×3"). */
  label: z.string().trim().min(1).max(8),
});

export const heapStateSchema = z.object({
  kind: z.enum(["min", "max"]),
  /** The backing array; the tree is the same list (children of i at 2i + 1 and 2i + 2). */
  items: z.array(heapItemSchema).max(15),
  /** The most items it keeps (shown as "size 2/2"). */
  capacity: z.number().int().positive().optional(),
  /** This scene's sift swaps, in order (positions in the array). */
  swaps: z
    .array(z.tuple([index, index]))
    .max(6)
    .optional(),
  /** Pushed this scene: it starts at the next free slot and sifts up. */
  pushed: heapItemSchema.optional(),
  /** Popped this scene: the root leaves, the last item moves to the root and sifts down. */
  popped: heapItemSchema.optional(),
});

const heapShape = {
  ...baseElement,
  type: z.literal("heap"),
  /** One heap, or two side by side (a two-heap design). */
  heaps: z.array(heapStateSchema).min(1).max(2),
  /** A name over each heap ("lower half (max)"); default "min-heap" / "max-heap". */
  labels: z.array(z.string().trim().min(1).max(22)).max(2).optional(),
  /** The most items each heap ever holds in the trace, so the tree keeps one shape across scenes. */
  slots: z.array(z.number().int().min(1).max(15)).max(2).optional(),
};
export const heapElementSchema = z.object(heapShape);
export const heapSourceSchema = z.object({
  ...heapShape,
  /** Omit heaps (and slots) to take the bound step's heaps (the final heaps in an unbound scene). */
  heaps: heapShape.heaps.optional(),
});

const tableCellSchema = z.tuple([index, index]);

const dpTableShape = {
  ...baseElement,
  type: z.literal("dp-table"),
  rows: z.number().int().min(1).max(7),
  cols: z.number().int().min(1).max(10),
  /** Each cell's value, row by row; null = not filled yet (drawn empty). */
  cells: z.array(z.array(z.union([z.number().finite(), z.string().max(3)]).nullable()).max(10)).max(7),
  /** Labels for the rows (a name like "ways", or one string's characters) and the columns (indices, amounts, characters). */
  rowHeaders: z.array(z.string().max(6)).optional(),
  colHeaders: z.array(z.string().max(6)).optional(),
  /** The cell being computed (ringed). */
  current: tableCellSchema.optional(),
  /** The cells it reads, each named for its option ("skip", "coin 4", "delete"): an arrow each. */
  reads: z
    .array(z.object({ at: tableCellSchema, label: z.string().trim().min(1).max(10) }))
    .max(4)
    .optional(),
  /** Which reads the winning option used (solid accent arrows; the rest dashed). */
  chosen: z.array(index).optional(),
  /** The winning option's name. */
  choice: z.string().max(10).optional(),
  /** The cell holding the final answer (✓, double border). */
  answer: tableCellSchema.optional(),
};
export const dpTableElementSchema = z.object(dpTableShape);
export const dpTableSourceSchema = z.object({
  ...dpTableShape,
  /** Omit everything but id/type to take the shape from the trace and the cells, reads, and choice from the step. */
  rows: dpTableShape.rows.optional(),
  cols: dpTableShape.cols.optional(),
  cells: dpTableShape.cells.optional(),
});

const staircaseShape = {
  ...baseElement,
  type: z.literal("staircase"),
  /** Steps 0…steps-1 (0 is the ground). */
  steps: z.number().int().min(2).max(10),
  /** The step the climber stands on. */
  at: index.optional(),
  /** Hops landing on the climber's step: arcs from `from` to `to`. */
  hops: z
    .array(z.object({ from: index, to: index }))
    .max(2)
    .optional(),
};
export const staircaseElementSchema = z.object(staircaseShape);
export const staircaseSourceSchema = z.object({
  ...staircaseShape,
  /** Omit steps/at/hops to take them from the trace and the bound step. */
  steps: staircaseShape.steps.optional(),
});

const houseRowShape = {
  ...baseElement,
  type: z.literal("house-row"),
  /** The cash in each house, left to right. */
  money: z.array(z.number().finite().nonnegative()).min(1).max(8),
  /** The house being decided (ringed). */
  current: index.optional(),
  /** The best plan so far: houses taken (✓) and skipped (✕). */
  taken: z.array(index).default([]),
  skipped: z.array(index).default([]),
  unit: z.string().max(2).default("$"),
};
export const houseRowElementSchema = z.object(houseRowShape);
export const houseRowSourceSchema = z.object({
  ...houseRowShape,
  /** Omit money/current/taken/skipped to take them from the trace and the bound step. */
  money: houseRowShape.money.optional(),
  taken: houseRowShape.taken.removeDefault().optional(),
  skipped: houseRowShape.skipped.removeDefault().optional(),
});

const pileItemSchema = z.object({
  label: z.string().trim().min(1).max(8),
  /** The input position it came from. */
  ref: index.optional(),
  /** What a monotonic stack orders by. */
  key: z.number().finite().optional(),
});

const stackShape = {
  ...baseElement,
  type: z.literal("stack"),
  /** The input row (item-row or bar-row) that links, answers, and refs point into. */
  rowId: nonEmpty.optional(),
  /** Bottom to top. */
  items: z.array(pileItemSchema).max(10),
  /** A monotonic stack's order (labeled, and checked). */
  order: z.enum(["increasing", "decreasing"]).optional(),
  /** How many items at the top were pushed in this scene (they drop in). */
  pushed: z.number().int().nonnegative().optional(),
  /** Popped in this scene, in pop order (they lift out). */
  popped: z.array(pileItemSchema).optional(),
  /** Answers these pops resolved: arcs on the input row from the popped item's position to the one that resolved it. */
  links: z.array(z.object({ from: index, to: index, label: z.string().trim().min(1).max(8) })).optional(),
  /** Every answer resolved so far, under the input. */
  answers: z.array(z.object({ index, label: z.string().trim().min(1).max(6) })).optional(),
  /** Text built so far, in a strip under the input ("building: xyzyz"). */
  text: z.object({ label: z.string().trim().min(1).max(10), value: z.string().max(20) }).optional(),
  label: nonEmpty.max(16).default("stack"),
};
export const stackElementSchema = z.object(stackShape);
export const stackSourceSchema = z.object({
  ...stackShape,
  /** Omit items (and everything with them) to take the bound step's stack; an unbound scene shows it empty. */
  items: stackShape.items.optional(),
});

export const searchNodeSchema = z.object({
  id: index,
  parent: index.nullable(),
  /** The partial solution's state ("4" left, the XOR so far, "c2"). */
  label: z.string().max(6),
  /** The choice that led here ("+4", "skip"). */
  edge: z.string().max(8).optional(),
  /** A branch cut without exploring it, and why ("6 > 4", "3 attacked"). */
  pruned: z.string().max(14).optional(),
});

const searchTreeShape = {
  ...baseElement,
  type: z.literal("search-tree"),
  /** The whole decision tree; only reached nodes are drawn. */
  nodes: z.array(searchNodeSchema).min(1).max(40),
  reached: z.array(index).default([]),
  /** Root first, to the current node (drawn in the accent). */
  path: z.array(index).default([]),
  current: index.optional(),
  /** Explored, with no solution below (faded). */
  dead: z.array(index).default([]),
  /** Complete answers (✓). */
  solutions: z.array(index).default([]),
  /** The node this scene stepped back from. */
  undone: index.optional(),
  /** Finished subtrees without a solution, folded into their root. */
  collapsed: z.array(index).optional(),
};
export const searchTreeElementSchema = z.object(searchTreeShape);
export const searchTreeSourceSchema = z.object({
  ...searchTreeShape,
  /** Omit everything to take the tree from the trace and the search from the step (an unbound scene shows the root). */
  nodes: searchTreeShape.nodes.optional(),
  reached: searchTreeShape.reached.removeDefault().optional(),
  path: searchTreeShape.path.removeDefault().optional(),
  dead: searchTreeShape.dead.removeDefault().optional(),
  solutions: searchTreeShape.solutions.removeDefault().optional(),
});

const partialShape = {
  ...baseElement,
  type: z.literal("partial"),
  /** The answer being built, in order. */
  items: z.array(z.string().trim().min(1).max(8)).max(8),
  /** The choice just added (the last item), or just taken back off. */
  added: z.string().max(8).optional(),
  removed: z.string().max(8).optional(),
  /** Every answer found so far. */
  found: z.array(z.string().trim().min(1).max(18)).max(10),
  label: nonEmpty.max(14).default("building"),
  foundLabel: nonEmpty.max(14).default("found"),
};
export const partialElementSchema = z.object(partialShape);
export const partialSourceSchema = z.object({
  ...partialShape,
  /** Omit items/added/removed/found to take them from the bound step (empty when unbound). */
  items: partialShape.items.optional(),
  found: partialShape.found.optional(),
});

const freqEntrySchema = z.object({
  key: nonEmpty.max(3),
  count: z.number().int().nonnegative(),
  /** How many the target needs (shown as "count/need"). */
  need: z.number().int().positive().optional(),
});

const freqTableShape = {
  ...baseElement,
  type: z.literal("freq-table"),
  /** One cell per character, e.g. A 2, B 1 (or A 1/1 with a need). */
  entries: z.array(freqEntrySchema).min(1).max(8),
  /** The key that just changed. */
  active: z.string().optional(),
  label: nonEmpty.max(16).default("counts"),
};
export const freqTableElementSchema = z.object(freqTableShape);
export const freqTableSourceSchema = z.object({
  ...freqTableShape,
  /** Omit entries (and active) to take the bound step's counts. */
  entries: freqTableShape.entries.optional(),
});

const dequeShape = {
  ...baseElement,
  type: z.literal("deque"),
  /** The row the positions refer to (values are read from it). */
  rowId: nonEmpty,
  /** Positions in the deque, front first. */
  indices: z.array(index).max(10),
  /** Positions this step removed from the back / the front. */
  poppedBack: z.array(index).optional(),
  poppedFront: z.array(index).optional(),
  /** The answer written so far (one value per full window). */
  output: z.array(z.number().finite()),
  label: nonEmpty.max(16).default("deque"),
  outputLabel: nonEmpty.max(16).default("maxima"),
};
export const dequeElementSchema = z.object(dequeShape);
export const dequeSourceSchema = z.object({
  ...dequeShape,
  /** Omit indices/output (and the popped lists) to take the bound step's deque. */
  indices: dequeShape.indices.optional(),
  output: dequeShape.output.optional(),
});

const pointerShape = {
  ...baseElement,
  type: z.literal("pointer"),
  /** The item-row or bar-row this pointer sits under. */
  rowId: nonEmpty,
  label: nonEmpty,
  index,
  /** If set, the pointer slides from this index to `index` as it enters. */
  fromIndex: index.optional(),
  placement: z.enum(["above", "below"]).default("below"),
  tone: z.enum(["primary", "secondary"]).default("primary"),
  /**
   * Which trace pointer this visualizes (e.g. "left" / "right"). Bound pointers are checked against the scene's
   * trace step; unbound pointers are decorative and not validated.
   */
  binds: z.string().optional(),
};
export const pointerElementSchema = z.object(pointerShape);
export const pointerSourceSchema = z.object({
  ...pointerShape,
  /** Omit when `binds` is set: the position comes from the trace step (and `fromIndex` from the previous one). */
  index: index.optional(),
});

export const highlightStateSchema = z.enum(["active", "rejected", "found"]);

const highlightShape = {
  ...baseElement,
  type: z.literal("highlight"),
  rowId: nonEmpty,
  indices: z.array(index).min(1),
  state: highlightStateSchema,
};
export const highlightElementSchema = z.object(highlightShape);
export const highlightSourceSchema = z.object({
  ...highlightShape,
  /** Omit to use the trace step's items for this state (or the answer, for "found"). */
  indices: highlightShape.indices.optional(),
});

export const calloutElementSchema = z.object({
  ...baseElement,
  type: z.literal("callout"),
  text: nonEmpty,
  /** Anchor to an item. Without an anchor the callout floats at the top. */
  anchor: z.object({ rowId: nonEmpty, index }).optional(),
  speaker: z.string().optional(),
});

export const comparisonOpSchema = z.enum(["<", "=", ">"]);
export const operatorSchema = z.enum(["+", "-", "×"]);
/** How the verdict reads: good news, bad news, or just information. */
export const verdictToneSchema = z.enum(["positive", "negative", "neutral"]);

const equationShape = {
  ...baseElement,
  type: z.literal("equation"),
  terms: z.array(z.number().finite()).min(1),
  /** How the terms combine, left to right. */
  operator: operatorSchema.default("+"),
  result: z.number().finite(),
  comparison: z.object({ op: comparisonOpSchema, target: z.number().finite() }).optional(),
  unit: z.string().default(""),
  /** Short verdict rendered after the equation, e.g. "too high". */
  verdict: z.string().optional(),
  /**
   * Colors the verdict. Bound equations take it from the trace step when the step sets one. Without a tone the
   * comparison sign decides (`<` info, `>` danger, `=` success), which suits "too low / too high / found".
   */
  verdictTone: verdictToneSchema.optional(),
};
export const equationElementSchema = z.object(equationShape);
export const equationSourceSchema = z.object({
  ...equationShape,
  /** Omit terms/result/operator/comparison to take the whole equation from the trace step. */
  terms: equationShape.terms.optional(),
  operator: operatorSchema.optional(),
  result: equationShape.result.optional(),
});

const resultShape = {
  ...baseElement,
  type: z.literal("result"),
  title: nonEmpty,
  value: nonEmpty,
  detail: z.string().optional(),
  /** Item indices that form the answer, checked against the trace. */
  indices: z.array(index).optional(),
  /** This card states the final answer; its `value` must equal the trace's answer display. */
  showsAnswer: z.boolean().default(false),
  tone: z.enum(["success", "info"]).default("success"),
};
export const resultElementSchema = z.object(resultShape);
export const resultSourceSchema = z.object({
  ...resultShape,
  /** Omit with `showsAnswer: true` to display the trace's answer. */
  value: resultShape.value.optional(),
});

export const elementSchemas = [
  itemRowElementSchema,
  barRowElementSchema,
  pointerElementSchema,
  highlightElementSchema,
  calloutElementSchema,
  equationElementSchema,
  resultElementSchema,
  sortedRegionElementSchema,
  heldValueElementSchema,
  countArrayElementSchema,
  segmentsElementSchema,
  splitTreeElementSchema,
  mergeBufferElementSchema,
  partitionElementSchema,
  heapTreeElementSchema,
  counterElementSchema,
  windowElementSchema,
  freqTableElementSchema,
  dequeElementSchema,
  searchRangeElementSchema,
  numberLineElementSchema,
  cutElementSchema,
  linkedListElementSchema,
  binaryTreeElementSchema,
  callStackElementSchema,
  gridElementSchema,
  graphElementSchema,
  queueElementSchema,
  heapElementSchema,
  dpTableElementSchema,
  staircaseElementSchema,
  houseRowElementSchema,
  stackElementSchema,
  searchTreeElementSchema,
  partialElementSchema,
] as const;

export const elementSourceSchemas = [
  itemRowSourceSchema,
  barRowSourceSchema,
  pointerSourceSchema,
  highlightSourceSchema,
  calloutElementSchema,
  equationSourceSchema,
  resultSourceSchema,
  sortedRegionSourceSchema,
  heldValueSourceSchema,
  countArraySourceSchema,
  segmentsSourceSchema,
  splitTreeSourceSchema,
  mergeBufferSourceSchema,
  partitionSourceSchema,
  heapTreeSourceSchema,
  counterSourceSchema,
  windowSourceSchema,
  freqTableSourceSchema,
  dequeSourceSchema,
  searchRangeSourceSchema,
  numberLineSourceSchema,
  cutSourceSchema,
  linkedListSourceSchema,
  binaryTreeSourceSchema,
  callStackSourceSchema,
  gridSourceSchema,
  graphSourceSchema,
  queueSourceSchema,
  heapSourceSchema,
  dpTableSourceSchema,
  staircaseSourceSchema,
  houseRowSourceSchema,
  stackSourceSchema,
  searchTreeSourceSchema,
  partialSourceSchema,
] as const;

export const elementSchema = z.discriminatedUnion("type", elementSchemas);
export const elementSourceSchema = z.discriminatedUnion("type", elementSourceSchemas);

export type Element = z.infer<typeof elementSchema>;
export type ElementSource = z.infer<typeof elementSourceSchema>;
export type ElementType = Element["type"];
export type ElementOf<T extends ElementType> = Extract<Element, { type: T }>;
export type ItemRowElement = ElementOf<"item-row">;
export type BarRowElement = ElementOf<"bar-row">;
export type PointerElement = ElementOf<"pointer">;
export type HighlightElement = ElementOf<"highlight">;
export type HighlightState = z.infer<typeof highlightStateSchema>;
export type CalloutElement = ElementOf<"callout">;
export type EquationElement = ElementOf<"equation">;
export type ResultElement = ElementOf<"result">;
export type SortedRegionElement = ElementOf<"sorted-region">;
export type HeldValueElement = ElementOf<"held-value">;
export type CountArrayElement = ElementOf<"count-array">;
export type SegmentsElement = ElementOf<"segments">;
export type SplitTreeElement = ElementOf<"split-tree">;
export type MergeBufferElement = ElementOf<"merge-buffer">;
export type PartitionElement = ElementOf<"partition">;
export type HeapTreeElement = ElementOf<"heap-tree">;
export type CounterElement = ElementOf<"counter">;
export type WindowElement = ElementOf<"window">;
export type FreqTableElement = ElementOf<"freq-table">;
export type DequeElement = ElementOf<"deque">;
export type SearchRangeElement = ElementOf<"search-range">;
export type NumberLineElement = ElementOf<"number-line">;
export type CutElement = ElementOf<"cut">;
export type LinkedListElement = ElementOf<"linked-list">;
export type ListNode = z.infer<typeof listNodeSchema>;
export type BinaryTreeElement = ElementOf<"binary-tree">;
export type TreeNode = z.infer<typeof treeNodeSchema>;
export type CallStackElement = ElementOf<"call-stack">;
export type StackFrame = z.infer<typeof stackFrameSchema>;
export type GridElement = ElementOf<"grid">;
export type GraphElement = ElementOf<"graph">;
export type QueueElement = ElementOf<"queue">;
export type HeapElement = ElementOf<"heap">;
export type HeapState = z.infer<typeof heapStateSchema>;
export type DpTableElement = ElementOf<"dp-table">;
export type StaircaseElement = ElementOf<"staircase">;
export type HouseRowElement = ElementOf<"house-row">;
export type StackElement = ElementOf<"stack">;
export type SearchTreeElement = ElementOf<"search-tree">;
export type SearchNode = z.infer<typeof searchNodeSchema>;
export type PartialElement = ElementOf<"partial">;
export type CellKind = z.infer<typeof cellKindSchema>;
export type BfsCheckElement = z.infer<typeof bfsCheckSchema>;
export type ComparisonOp = z.infer<typeof comparisonOpSchema>;
export type VerdictTone = z.infer<typeof verdictToneSchema>;
export type Operator = z.infer<typeof operatorSchema>;
