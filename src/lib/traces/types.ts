import type { z } from "zod";

import type { VerdictTone } from "@/lib/storyboard/elements";

/**
 * A trace is the exact sequence of decisions an algorithm makes on one input, with a state snapshot at every
 * step. Storyboards bind scenes to steps (`scene.traceStep`), and `validateStoryboard` checks every pointer,
 * equation, and highlight against them. Traces are app code: the video needs them at render time.
 */

export type TraceValue = number | string;
export type TraceComparisonOp = "<" | "=" | ">";
export type TraceOperator = "+" | "-" | "×";

export type TraceEquation = {
  terms: number[];
  operator: TraceOperator;
  result: number;
  /** How `result` compares with `target` (e.g. sum vs target, area vs best so far). */
  comparison?: { op: TraceComparisonOp; target: number };
  /**
   * How this step's outcome reads, when the sign alone would mislead (a "new best" is `>` but good news). Bound
   * equations inherit it as `verdictTone`. Omit it to keep the sign-based colors.
   */
  tone?: VerdictTone;
};

export type TraceStep = {
  /** Machine-readable decision, e.g. "compare", "move-left", "skip", "found", "done". */
  kind: string;
  /** Key decisions must be shown by some scene. Others may happen off-screen. */
  key: boolean;
  /** Named pointer positions at this step, e.g. `{ left: 0, right: 6 }`. */
  pointers: Record<string, number>;
  /** One sentence describing the decision and why. Shown to the model and in validation errors. */
  note: string;
  equation?: TraceEquation;
  /** Items being examined now. */
  active?: number[];
  /** Items ruled out so far. */
  rejected?: number[];
  /** Items that form the answer (or the current hit, e.g. a found triplet). */
  found?: number[];
  /** Container between two bars, filled to `level` (bar-row only). */
  /** `cover`: shade the bars from..to whole (a rectangle) rather than between their centers; `label` names it. */
  fill?: { from: number; to: number; level: number; cover?: boolean; label?: string };
  /** Water standing on each bar so far (bar-row only). */
  water?: number[];
  /**
   * The array as it stands after this step, for algorithms that rearrange it (sorting). Omit when the array never
   * changes; rows then show `trace.row.values`.
   */
  values?: TraceValue[];
  /** Bars that moved into new slots during this step (a swap is two moves, a shift is one). */
  moves?: { from: number; to: number }[];
  /** Slots drawn as empty outlines: the gap left by a held value, or output not written yet. */
  empty?: number[];
  /** Positions already in their final place (inclusive range), e.g. the sorted tail in bubble sort. */
  sorted?: { from: number; to: number };
  /**
   * Positions already in their final place when they don't form one range (quick sort places pivots anywhere).
   * Takes precedence over `sorted`.
   */
  final?: number[];
  /** A value lifted out of the array (insertion sort's key), waiting above slot `index`. */
  held?: { value: number; index: number };
  /** A tally per value (counting sort): `counts[i]` is how many times `keys[i]` has been seen. */
  counts?: { keys: number[]; counts: number[]; active?: number };
  /** Divide and conquer: the subarray this step works on (inclusive). */
  range?: { from: number; to: number };
  /** Recursion depth of `range` (0 = the whole array). */
  depth?: number;
  /** How the array is currently split into groups (inclusive ranges covering every position, in order). */
  segments?: { from: number; to: number }[];
  /**
   * Every level of the recursion at once, for an overview: `splitTree[level]` lists the groups' values at that
   * depth, from the whole array down to single values.
   */
  splitTree?: number[][][];
  /** A merge in progress: the output written so far (`null` = not yet), lined up under positions `from`…. */
  buffer?: { from: number; values: (number | null)[]; taken?: number };
  /** Quick sort: the pivot's position and the partition line (positions in `range` before it are < the pivot). */
  pivot?: number;
  boundary?: number;
  /** Heap sort: positions 0…heapSize-1 are the heap (the rest are sorted), and the pair compared in a sift-down. */
  heapSize?: number;
  compare?: [number, number];
  /** A running total (e.g. inversions found so far) and how much this step added. */
  counter?: { value: number; delta?: number };
  /**
   * Sliding window: the positions it covers (inclusive; `to = from - 1` when it's empty) and the value it's labeled
   * with (its sum, its length…).
   */
  window?: { from: number; to: number; value?: number | string };
  /**
   * Character counts in the window (sliding-window string problems). `need` is how many the target requires
   * (Minimum Window Substring); `active` is the key that just changed.
   */
  freq?: { entries: { key: string; count: number; need?: number }[]; active?: string };
  /**
   * Monotonic deque of positions, front first (Sliding Window Maximum), what this step removed from each end, and
   * the answer written so far.
   */
  deque?: { indices: number[]; poppedBack?: number[]; poppedFront?: number[]; output: number[] };
  /**
   * Binary search over the row: the positions still in play (inclusive; `to = from - 1` once it's empty, which marks
   * the gap before `from`), the position just checked, and (rotated arrays) the half known to be sorted.
   */
  search?: { from: number; to: number; mid?: number; sorted?: { from: number; to: number } };
  /**
   * Binary search on the answer: candidates `min`…`max`. Everything below `low` is ruled out, everything from `high`
   * up is known to work, and `mid` is the candidate just tested.
   */
  answers?: { min: number; max: number; low: number; high: number; mid?: number };
  /** Two-list partition (Median of Two Sorted Arrays): how many values sit left of the cut in each list. */
  cuts?: { first: number; second: number };
  /**
   * Linked lists: every node after this step (its `next`, and where it's drawn), plus the links this step rewired.
   * Pointers, highlights, and `trace.row.values` refer to nodes by id (see `TraceLinks`).
   */
  links?: TraceLinks;
  /** A min-heap's array after this step (Merge K Sorted Lists' heads), drawn by a heap-tree. */
  heap?: number[];
  /** A binary tree's walk after this step (the tree's shape is `trace.tree`). See `TraceTreeWalk`. */
  tree?: TraceTreeWalk;
  /** The recursion's open calls, bottom (the first call) to top (the running one). */
  stack?: TraceFrame[];
  /** A grid's contents after this step, when the search changes them (a paint fill, oranges rotting). */
  cells?: TraceValue[][];
  /** A breadth-first search over `trace.grid` or `trace.graph` after this step. See `TraceBfs`. */
  bfs?: TraceBfs;
  /** The BFS queue after this step, front first, with what this step took off the front and added at the back. */
  queue?: TraceQueue;
  /** Priority queues after this step (one, or two for a two-heap design), each with this step's push or pop. */
  heaps?: TraceHeap[];
  /** A DP table after this step (its shape and headers are `trace.dp`). See `TraceTable`. */
  table?: TraceTable;
  /** Climbing Stairs' staircase: where the climber stands and the hops that land on that step. */
  climb?: { at: number; hops?: { from: number; to: number }[] };
  /** House Robber's street: the house being decided, and the best plan so far (houses taken and skipped). */
  houses?: { current?: number; taken: number[]; skipped: number[] };
  /**
   * A stack after this step (named `pile` so it doesn't clash with a recursion's call stack, `stack`). See
   * `TracePile`.
   */
  pile?: TracePile;
  /** A backtracking search over `trace.searchTree` after this step. See `TraceExplore`. */
  explore?: TraceExplore;
  /** The answer being built and the answers found so far. See `TracePartial`. */
  partial?: TracePartial;
  /** A hash map or set after this step, with this step's lookup and change. See `TraceMap`. */
  map?: TraceMap;
  /** Fast and slow pointers over a linked list: this step's moves, the meeting node, the loop. See `TraceRace`. */
  race?: TraceRace;
  /** Greedy: the option this step took and the one it turned down. See `TraceChoice`. */
  choice?: TraceChoice;
  /** Greedy: the stretch of the row covered so far (reach, the current piece), this step's jump, closed pieces. */
  reach?: TraceReach;
  /** Prefix sums (or products) as they're built, one row per running total. See `TracePrefixRow`. */
  prefix?: TracePrefixRow[];
  /** A 2D prefix grid over `trace.matrix` as it's built, with this step's rectangles. See `TracePrefixGrid`. */
  prefixGrid?: TracePrefixGrid;
  /** Intervals on a timeline after this step. See `TraceTimelineStep`. */
  timeline?: TraceTimelineStep;
  /** Numbers as rows of bits with this step's operation. See `TraceBits`. */
  bits?: TraceBits;
  /** A trie after this step, with the walk through it. See `TraceTrie`. */
  trie?: TraceTrie;
  /** A directed (often weighted) graph after this step: node and edge states, in-degree badges. See `TraceNetwork`. */
  network?: TraceNetwork;
  /** Union-find after this step: every element's parent, this step's finds, compression, and union. See `TraceForest`. */
  forest?: TraceForest;
};

/**
 * How a graph node reads at a step: `idle`, `ready` (waiting in the queue or heap), `current` (being processed),
 * `done` (taken, or settled for good), `stuck` (can never be taken: it sits on a cycle).
 */
export type NetworkNodeState = "idle" | "ready" | "current" | "done" | "stuck";

/**
 * How an edge reads at a step: `idle`; `new` (found this step: Alien Dictionary's comparisons); `used` (removed by
 * Kahn's algorithm once its source is taken); `better` (a relaxation that improved the target's distance); `worse`
 * (a relaxation that didn't).
 */
export type NetworkEdgeState = "idle" | "new" | "used" | "better" | "worse";

/**
 * A graph node at a fixed spot on a small grid (`x` columns, `y` rows, fractions allowed; the trace picks them so the
 * picture never moves), with an optional `badge` ("in 2").
 */
export type TraceNetworkNode = {
  id: number;
  label: string;
  x: number;
  y: number;
  badge?: string;
  state: NetworkNodeState;
};
export type TraceNetworkEdge = { from: number; to: number; weight?: number; state: NetworkEdgeState };

/** A directed graph (arrows `from` → `to`) or an undirected one, as it stands after a step. */
export type TraceNetwork = { directed: boolean; nodes: TraceNetworkNode[]; edges: TraceNetworkEdge[] };

/**
 * Union-find over elements 0…n-1 (shown as `labels`): `parents[i]` is i's parent (a root is its own parent), `sizes`
 * each root's group size when the algorithm unions by size. This step's `finds` each walk a parent chain from an
 * element to its root (`path`, as the chain stood before the step's compression); `compressed` are the parent links
 * path halving rewired (`node` pointed at `from`, now at `to`); `union` is the root that now points at another root;
 * `same` is the root two elements already shared (nothing to join).
 */
export type TraceForest = {
  labels: string[];
  parents: number[];
  sizes?: number[];
  finds?: { path: number[] }[];
  compressed?: { node: number; from: number; to: number }[];
  union?: { child: number; parent: number };
  same?: number;
};

/** A trie node: id 0 is the root (letter ""); `end` marks a word ending here; `note` is data it holds ("re", "cat"). */
export type TraceTrieNode = {
  id: number;
  parent: number | null;
  letter: string;
  end: boolean;
  note?: string;
};

/**
 * A trie as it stands after a step (nodes in creation order; ids never change), and the walk: `path` from the root to
 * the current node, nodes `created` this step, a child that was looked for and isn't there (`missing`), other nodes a
 * wildcard is trying at the same depth (`branches`), nodes that ended a word this step (`hits`), and nodes removed this
 * step (`pruned`, drawn fading out; no longer in `nodes`).
 */
export type TraceTrie = {
  nodes: TraceTrieNode[];
  path: number[];
  created?: number[];
  missing?: { parent: number; letter: string };
  branches?: number[];
  hits?: number[];
  pruned?: TraceTrieNode[];
};

/**
 * A row of bits: `name` ("acc", "x", "carry"), the number (`value`, shown in decimal and as its low `width` bits),
 * the operation that produced it, written before it (`op`: "^", "& ~twos", ">> 1"), `rule` for a line above it (a
 * result), the bit positions this step changed (`changed`, 0 = the lowest bit), and `from`: the value whose bits slide
 * `shift` places into this one (+1 left, −1 right).
 */
export type TraceBitRow = {
  name: string;
  value: number;
  op?: string;
  rule?: boolean;
  changed?: number[];
  from?: { value: number; shift: number };
};

/** Numbers in binary at a fixed `width`, columns aligned; `bitLabels` (most significant first) name what each bit means. */
export type TraceBits = { width: number; rows: TraceBitRow[]; bitLabels?: string[] };

/**
 * How an interval reads at a step: `waiting` (not reached yet), `active` (in play: the previous meeting, the last kept
 * range, an interval in the heap), `current` (this step's), `done` (finished with), `absorbed` (merged into another),
 * `removed` (dropped: cancelled, or ended before the query), `result` (part of the answer).
 */
export type TimelineBarState = "waiting" | "active" | "current" | "done" | "absorbed" | "removed" | "result";

/** An interval drawn as a bar from `start` to `end` on lane `lane`; `fromLane` is where it slides from (a sort). */
export type TraceTimelineBar = {
  id: number;
  start: number;
  end: number;
  lane: number;
  state: TimelineBarState;
  fromLane?: number;
};

/**
 * Intervals after a step: every bar, the stretch where this step's two intervals overlap (`overlap`), a bar that grew
 * this step and the extent it grew from (`grow`, a merge), and a vertical marker (`sweep`: the query point, where the
 * last kept interval ends).
 */
export type TraceTimelineStep = {
  bars: TraceTimelineBar[];
  overlap?: { start: number; end: number };
  grow?: { id: number; start: number; end: number };
  sweep?: { at: number; label: string };
};

/**
 * A running total over the row, one cell per boundary: `values[i]` combines the items before position i (`values[0]`
 * is the empty total, 0 for sums or 1 for products; `values[n]` covers every item), or, for a `suffix` row, the items
 * from position i on (`values[n]` is the empty total), `null` until it's built. A row's
 * `name` is what an element binds to ("prefix", "left", "right"). `current` is the cell this step built, `reads` cells
 * this step uses, and each span is a stretch of items `from`…`to − 1` answered by the cells at boundaries `from` and
 * `to`, with its `value` (for sums, `values[to] − values[from]`; `from = to` is an empty stretch).
 */
export type TracePrefixRow = {
  name: string;
  op: "+" | "×";
  direction: "prefix" | "suffix";
  values: (number | null)[];
  current?: number;
  reads?: number[];
  spans?: { from: number; to: number; value: number }[];
};

/** A rectangle of matrix cells, rows r1…r2 and columns c1…c2 (inclusive). */
export type TraceRect = { r1: number; c1: number; r2: number; c2: number };

/**
 * A 2D prefix grid: `prefix[i][j]` is the sum of matrix rows 0…i − 1 and columns 0…j − 1 (row 0 and column 0 are the
 * empty 0s), `null` until built. `current` is the prefix cell this step built or read last; `rects` are matrix
 * rectangles this step adds (+) or subtracts (−), and `marks` the prefix cells standing for them; `found` is a
 * rectangle that hit the target.
 */
export type TracePrefixGrid = {
  prefix: (number | null)[][];
  current?: [number, number];
  rects: (TraceRect & { sign: "+" | "−" })[];
  marks: { at: [number, number]; sign: "+" | "−" }[];
  found?: TraceRect;
};

/**
 * A greedy decision: the option taken (`chosen`, e.g. "$10 + $5") and the one turned down (`rejected`, e.g. "3 × $5"),
 * in the problem's own terms. Why the choice is safe is the storyboard's to say (the choice panel's `reason`).
 */
export type TraceChoice = { chosen: string; rejected?: string };

/**
 * A stretch of the row the greedy scan has committed to: Jump Game's reachable prefix (`from` 0 to the farthest
 * index, `value` the farthest index even past the end) or Partition Labels' open piece (`from` its start, `to` the
 * last occurrence it must reach; `to = from - 1` once it's closed). `jump` is this step's arc from the current item to
 * the position it reaches (clamped to the row) with a short label ("+3", "last e"); `pieces` are closed pieces.
 */
export type TraceReach = {
  from: number;
  to: number;
  value?: number | string;
  jump?: { from: number; to: number; label: string };
  pieces?: { from: number; to: number }[];
};

/**
 * One pointer's move in a fast-and-slow race: from node `from` to node `to` (null: it ran off the end), through the
 * nodes in `path` (fast passes one on its way), `hops` links in all. `blocked` is a node it refused to step onto
 * (Circular Array Loop: a jump the other way), after its last hop.
 */
export type TraceRaceMove = {
  pointer: string;
  from: number;
  to: number | null;
  path: number[];
  hops: number;
  blocked?: number;
};

/**
 * A fast-and-slow race over a linked list (`links`): phase 1 runs slow (1 hop) and fast (2 hops) until they meet or
 * fast runs off the end; phase 2 (finding where a loop starts) moves a pointer restarted at the head and the one left
 * at the meeting node 1 hop each. `meet` is the node where they met, `entry` the loop's first node once it's known,
 * and `loop` the link that closes the loop (`from.next = to`), when the step names it.
 */
export type TraceRace = {
  phase: 1 | 2;
  moves: TraceRaceMove[];
  meet?: number;
  entry?: number;
  loop?: { from: number; to: number };
};

/**
 * A hash map (or set: entries without values) in insertion order, drawn as rows ("key → value", a bucket's list of
 * items) or compact cells ("l:1"). `lookup` is this step's question and its answer; `inserted` the key added and
 * `updated` the key whose value changed (and what it was).
 */
export type TraceMap = {
  kind: "map" | "set";
  display: "rows" | "cells";
  entries: { key: string; value?: string }[];
  lookup?: { key: string; found: boolean };
  inserted?: string;
  updated?: { key: string; from: string };
};

/**
 * A decision-tree node: a partial solution. `label` is its state ("4" left, the XOR so far, the column), `edge` the
 * choice that led to it ("+4", "skip"), and a `pruned` node is a branch cut without exploring it, with the reason.
 */
export type TraceSearchNode = {
  id: number;
  parent: number | null;
  label: string;
  edge?: string;
  pruned?: string;
};

/** Where a backtracking search is: what's been reached, the path from the root, and how each branch ended. */
export type TraceExplore = {
  /** Nodes drawn so far (reached, or pruned). */
  reached: number[];
  /** Root first, to the current node. */
  path: number[];
  current?: number;
  /** Explored, with no solution below. */
  dead: number[];
  /** Complete answers. */
  solutions: number[];
  /** The node this step stepped back from (the undo). */
  undone?: number;
  /** Fully explored subtrees without a solution, folded into their root. */
  collapsed?: number[];
};

/** The answer being built (with the choice just added or just removed), and every answer found so far. */
export type TracePartial = { items: string[]; added?: string; removed?: string; found: string[] };

/** A stack item: shown as `label`, from input position `ref` (if any), ordered by `key` in a monotonic stack. */
export type TracePileItem = { label: string; ref?: number; key?: number };

/**
 * A stack, bottom to top, after a step: what the step pushed (on top) and popped (in pop order), the answers those
 * pops resolved as links on the input row (`from` the popped item's position `to` the position that resolved it), every
 * answer resolved so far (under the input), and text built so far (Decode String's current string).
 */
export type TracePile = {
  items: TracePileItem[];
  order?: "increasing" | "decreasing";
  pushed?: number;
  popped?: TracePileItem[];
  links?: { from: number; to: number; label: string }[];
  answers?: { index: number; label: string }[];
  text?: { label: string; value: string };
};

/** A table cell, [row, column]. */
export type TraceCell = [number, number];

/**
 * A DP table as it stands after a step: every cell's value (`null` = not filled yet), the cell just computed, the
 * cells it read (each labeled with the option it stands for: "take", "coin 4", "delete"), which reads the winning
 * option used, and that option's name. `answer` marks the cell holding the final answer.
 */
export type TraceTable = {
  cells: (number | string | null)[][];
  current?: TraceCell;
  reads?: { at: TraceCell; label: string }[];
  chosen?: number[];
  choice?: string;
  answer?: TraceCell;
};

/** A heap item: ordered by `key`, shown as `label` ("9", "(-1,1)", "4 ×3"). */
export type TraceHeapItem = { key: number; label: string };

/**
 * A binary heap as its array (children of i at 2i + 1 and 2i + 2) after this step. A push starts at the next free slot
 * and sifts up; a pop takes the root, moves the last item to the root, and sifts down. `swaps` are the sift's swaps in
 * order, so the start of the step is `items` with them undone.
 */
export type TraceHeap = {
  kind: "min" | "max";
  items: TraceHeapItem[];
  /** The most items it keeps (a top-k heap). */
  capacity?: number;
  swaps?: [number, number][];
  pushed?: TraceHeapItem;
  popped?: TraceHeapItem;
};

/**
 * A grid's cells. A cell's id is `row * cols + col`; `legend` says how each value is drawn (a glyph and a word, so
 * no state depends on color: "≈ water", "■ wall") and its tone.
 */
export type TraceGrid = { rows: number; cols: number; cells: TraceValue[][]; legend: TraceCellKind[] };
export type TraceCellKind = {
  value: TraceValue;
  /** Drawn in the cell ("≈", "■", or the value itself for pixel colors); "" for nothing. */
  glyph: string;
  word: string;
  /** plain: open space; fill: solid ground (land, a fresh orange); wall: blocked; mark: changed by the search. */
  tone: "plain" | "fill" | "wall" | "mark";
};

/** A graph's nodes (ids 0…n-1, laid out by BFS level from node 0) and undirected edges. */
export type TraceGraph = { nodes: { id: number; label: string }[]; edges: [number, number][] };

/**
 * One neighbor check: from the item being processed to `to` (a cell or node id), or, off the grid, in direction
 * `dir` ([dRow, dCol]). `added` joins the queue; `visited` was already seen; `blocked` can't be entered (water, a wall,
 * another color); `out` is off the grid.
 */
export type BfsCheck = {
  from: number;
  to?: number;
  dir?: [number, number];
  result: "added" | "visited" | "blocked" | "out";
};

export type TraceBfs = {
  /** The item being processed (just taken off the queue), or the cell a scan just found. */
  current?: number;
  /** Everything seen so far (marked when it joins the queue). */
  visited: number[];
  /** What's in the queue: the frontier. */
  frontier: number[];
  /** Each seen item's level (distance from the start), when the search counts them. */
  levels?: { id: number; level: number }[];
  /** This step's neighbor checks, in the order they ran. */
  checks?: BfsCheck[];
};

export type TraceQueueItem = { id: number; label: string; level: number };
export type TraceQueue = {
  items: TraceQueueItem[];
  /** Taken off the front this step. */
  dequeued?: TraceQueueItem;
  /** Ids added at the back this step. */
  enqueued?: number[];
};

/**
 * A binary tree's node. Ids are positions in level order counting only real nodes (0 = the root), never change,
 * and `trace.row.values[id]` is the node's value; pointers and highlights refer to nodes by id.
 */
export type TraceTreeNode = { id: number; value: number; left: number | null; right: number | null };

export type TreeSide = "left" | "right";

/** Where a recursive walk is: which call runs, which calls are open, finished, or never made. */
export type TraceTreeWalk = {
  /** The node whose call is running (it may be returning in this step). */
  current?: number;
  /** A call on a missing child (the base case): the child of `parent` on `side`, drawn as a "null" stub. */
  nullVisit?: { parent: number; side: TreeSide };
  /** Nodes with an open call, root first (the path from the root to the running call). */
  path: number[];
  /** Nodes whose call has returned. */
  done: number[];
  /** Nodes never visited because an answer came early (an early exit skips their whole subtree). */
  skipped?: number[];
  /** A value handed up this step: from the child of `to` on `side` (a node or a missing child) to `to`. */
  returned?: { to: number; side: TreeSide; value: string };
  /** What each finished call returned, shown beside its node. */
  results?: { node: number; value: string }[];
  /** Running state carried down to a node (the sum so far, the bounds, the best on the path). */
  badges?: { node: number; text: string }[];
  /** Calls that repeat an earlier call's work (plain recursion's overlapping subproblems). */
  repeats?: number[];
};

/** One open call: `label` reads like the call ("depth(5)", "depth(∅)"), `waiting` names the child it's waiting on. */
export type TraceFrame = {
  label: string;
  node: number | null;
  waiting?: TreeSide;
  /** Set in the step where the call returns (the frame pops after it). */
  returns?: string;
};

/**
 * Linked-list state. Node ids are 0…n-1 and never change; `trace.row.values[id]` is node `id`'s value. A node sits
 * in a lane (one horizontal list on screen: an input list, the merged list…) at a slot (left to right); nodes slide
 * when their lane or slot changes between bound steps.
 */
export type TraceListNode = {
  id: number;
  value: TraceValue;
  /** The node this one links to, or null (the end of a list). */
  next: number | null;
  lane: number;
  slot: number;
  /** A placeholder node in front of the real list (the dummy-node trick). */
  dummy?: boolean;
};

export type TraceLinks = {
  nodes: TraceListNode[];
  /** Links this step changed: `node` used to point at `from` and now points at `to`. */
  rewired?: { node: number; from: number | null; to: number | null }[];
};

export type Trace = {
  /** "pattern/slug" of the catalog problem. */
  problem: string;
  /** The values the video animates, in display order. */
  row: {
    values: TraceValue[];
    /** "stairs" and "houses" are drawn by the staircase and house-row primitives (Climbing Stairs, House Robber). */
    display: "cards" | "bars" | "list" | "tree" | "grid" | "graph" | "network" | "stairs" | "houses";
  };
  /** A binary tree's shape (display "tree"); it never changes, steps record the walk over it. */
  tree?: { nodes: TraceTreeNode[] };
  /** A grid (display "grid"): its starting contents; steps record changes (`cells`) and the search (`bfs`). */
  grid?: TraceGrid;
  /** A graph (display "graph"): nodes and edges; steps record the search (`bfs`). */
  graph?: TraceGraph;
  /** A backtracking search's whole decision tree (steps reveal it as they go). */
  searchTree?: { nodes: TraceSearchNode[] };
  /** A DP table's shape and headers (row 0 / column 0 are often the empty prefix). */
  dp?: { rows: number; cols: number; rowHeaders?: string[]; colHeaders?: string[] };
  /** A timeline's axis and lane count, and the intervals as given (in input order, before any sort). */
  timeline?: { min: number; max: number; lanes: number; input: TraceTimelineBar[] };
  /** A directed graph as given (every node and edge idle): what an unbound digraph shows. */
  network?: TraceNetwork;
  /** A matrix (rows of numbers) that a prefix grid is built over (Number of Submatrices That Sum to Target). */
  matrix?: number[][];
  /** A second list shown under the first (an item-row with `traceRow: "second"`), e.g. Median's `nums2`. */
  secondRow?: { values: TraceValue[] };
  pointerNames: string[];
  steps: TraceStep[];
  /** Same shape the reference solution returns. */
  answer: unknown;
  /** How the answer is shown on screen; a `result` with `showsAnswer` must display exactly this. */
  answerDisplay: string;
  /** When the answer is a set of positions in `row`, e.g. the pair of indices. */
  answerIndices?: number[];
};

export type TraceDefinition<A extends unknown[] = unknown[]> = {
  problem: string;
  /** Which of the problem's examples the video uses. */
  exampleIndex: number;
  /**
   * Where the video's real-world example comes from (see "Choosing the example" in CLAUDE.md): "problem-native"
   * when the statement already tells a real-world story the video must keep, "analogy" when it's abstract.
   */
  exampleSource: "problem-native" | "analogy";
  /** Validates the example's positional `args`. */
  args: z.ZodType<A>;
  run: (...args: A) => Trace;
};

export function compare(a: number, b: number): TraceComparisonOp {
  return a < b ? "<" : a > b ? ">" : "=";
}

/** The positions a step marks as final: its `final` set, else its `sorted` range. */
export function finalPositions(step: TraceStep): number[] | undefined {
  if (step.final) return step.final;
  if (!step.sorted) return undefined;
  return Array.from({ length: step.sorted.to - step.sorted.from + 1 }, (_, k) => step.sorted!.from + k);
}

/** Numbers in this list, ascending (for set-like index lists). */
export const sortedIndices = (indices: Iterable<number>) => [...indices].sort((a, b) => a - b);

/** Whether `items` keep the heap property for `kind`: every parent at least as close to the root as its children. */
export function isHeap(kind: "min" | "max", items: readonly { key: number }[]): boolean {
  return items.every((item, i) => {
    if (i === 0) return true;
    const parent = items[(i - 1) >> 1];
    return kind === "min" ? parent.key <= item.key : parent.key >= item.key;
  });
}

/** Whether a stack's items keep `order` by key, bottom to top (equal keys allowed). */
export function keepsOrder(order: "increasing" | "decreasing", items: readonly { key?: number }[]): boolean {
  return items.every((item, k) => {
    const below = items[k - 1]?.key;
    if (k === 0 || item.key === undefined || below === undefined) return true;
    return order === "increasing" ? item.key >= below : item.key <= below;
  });
}
