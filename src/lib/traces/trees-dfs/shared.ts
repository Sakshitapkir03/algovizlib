import { z } from "zod";

import type { TraceFrame, TraceStep, TraceTreeNode, TraceTreeWalk, TreeSide } from "../types";

/** The deepest tree a video draws (root = level 1). */
export const MAX_TREE_LEVELS = 4;
export const MAX_TREE_NODES = 8;

/** Build a tree from level order (`null` for a missing child); ids count real nodes in level order. */
export function buildTree(levelOrder: readonly (number | null)[]): TraceTreeNode[] {
  const nodes: TraceTreeNode[] = [];
  if (levelOrder.length === 0 || levelOrder[0] === null) return nodes;
  nodes.push({ id: 0, value: levelOrder[0], left: null, right: null });
  let i = 1;
  for (let head = 0; head < nodes.length && i < levelOrder.length; head++) {
    for (const side of ["left", "right"] as const) {
      const value = levelOrder[i++];
      if (value === null || value === undefined) continue;
      const id = nodes.length;
      nodes.push({ id, value, left: null, right: null });
      nodes[head][side] = id;
    }
  }
  return nodes;
}

/** Levels in the tree (0 when empty). */
export function treeLevels(nodes: readonly TraceTreeNode[]): number {
  const depth = (id: number | null): number =>
    id === null ? 0 : 1 + Math.max(depth(nodes[id].left), depth(nodes[id].right));
  return nodes.length === 0 ? 0 : depth(0);
}

/** Small trees that fit on screen: whole numbers of up to two digits, at most 8 nodes over 4 levels. */
export const treeArgs = z
  .array(z.number().int().min(-99).max(99).nullable())
  .max(15)
  .refine((values) => buildTree(values).length <= MAX_TREE_NODES, `at most ${MAX_TREE_NODES} nodes`)
  .refine((values) => treeLevels(buildTree(values)) <= MAX_TREE_LEVELS, `at most ${MAX_TREE_LEVELS} levels`);

type StepInput = Omit<TraceStep, "pointers" | "tree" | "stack">;

/**
 * A depth-first walk the traces drive exactly like the recursive reference solutions: `enter` is a call on a child,
 * `base` a call on a missing child that returns at once, `leave` a return. Each records the step it describes,
 * with the tree's state (the running call, the open path, finished calls and their results) and the call stack.
 */
export class TreeWalk {
  readonly nodes: TraceTreeNode[];
  readonly steps: TraceStep[] = [];
  private readonly frames: TraceFrame[] = [];
  private readonly path: number[] = [];
  private readonly done: number[] = [];
  private skipped: number[] = [];
  private readonly results = new Map<number, string>();
  private readonly badges = new Map<number, string>();

  /** `fn` names the recursive function in the stack ("depth" → "depth(5)"). */
  constructor(
    levelOrder: readonly (number | null)[],
    private readonly fn: string,
  ) {
    this.nodes = buildTree(levelOrder);
  }

  value(id: number): number {
    return this.nodes[id].value;
  }

  child(id: number, side: TreeSide): number | null {
    return this.nodes[id][side];
  }

  isLeaf(id: number): boolean {
    return this.nodes[id].left === null && this.nodes[id].right === null;
  }

  /** The parent of `id` and which side `id` hangs on. */
  parentOf(id: number): { parent: number; side: TreeSide } | undefined {
    for (const node of this.nodes) {
      if (node.left === id) return { parent: node.id, side: "left" };
      if (node.right === id) return { parent: node.id, side: "right" };
    }
    return undefined;
  }

  /** `id` and everything under it. */
  subtree(id: number | null): number[] {
    if (id === null) return [];
    return [id, ...this.subtree(this.nodes[id].left), ...this.subtree(this.nodes[id].right)];
  }

  /** Call on `id` (the caller's frame now waits on that side). Doesn't record a step. */
  enter(id: number) {
    const from = this.parentOf(id);
    const caller = this.frames.at(-1);
    if (caller && from) caller.waiting = from.side;
    this.frames.push({ label: `${this.fn}(${this.value(id)})`, node: id });
    this.path.push(id);
  }

  /** Running state shown at a node (it stays until changed). */
  badge(id: number, text: string) {
    this.badges.set(id, text);
  }

  /** Nodes an early answer means we never visit. */
  skip(ids: readonly number[]) {
    this.skipped = [...new Set([...this.skipped, ...ids])].sort((a, b) => a - b);
  }

  /** Record a step for the running call. */
  record(step: StepInput) {
    this.push(step, {});
  }

  /** The call on `parent`'s missing `side` child: it returns `value` at once (the base case). */
  base(parent: number, side: TreeSide, value: string, step: StepInput) {
    const caller = this.frames.at(-1);
    if (caller) caller.waiting = side;
    this.frames.push({ label: `${this.fn}(∅)`, node: null, returns: value });
    this.push(step, { nullVisit: { parent, side }, returned: { to: parent, side, value } });
    this.frames.pop();
  }

  /** The running call returns `value`: it's handed to the caller, and the frame pops. */
  leave(value: string, step: StepInput) {
    const id = this.path.pop()!;
    const frame = this.frames.at(-1)!;
    frame.returns = value;
    delete frame.waiting;
    this.done.push(id);
    this.results.set(id, value);
    const from = this.parentOf(id);
    this.push(
      step,
      { current: id, ...(from ? { returned: { to: from.parent, side: from.side, value } } : {}) },
      id,
    );
    this.frames.pop();
  }

  private push(step: StepInput, extra: Partial<TraceTreeWalk>, current = this.path.at(-1)) {
    const sorted = <T>(map: Map<number, T>) => [...map.entries()].sort(([a], [b]) => a - b);
    const tree: TraceTreeWalk = {
      ...(current !== undefined && !extra.nullVisit ? { current } : {}),
      ...(extra.nullVisit ? { nullVisit: extra.nullVisit } : {}),
      path: [...this.path],
      done: [...this.done].sort((a, b) => a - b),
      ...(this.skipped.length > 0 ? { skipped: [...this.skipped] } : {}),
      ...(extra.returned ? { returned: extra.returned } : {}),
      ...(this.results.size > 0
        ? { results: sorted(this.results).map(([node, value]) => ({ node, value })) }
        : {}),
      ...(this.badges.size > 0
        ? { badges: sorted(this.badges).map(([node, text]) => ({ node, text })) }
        : {}),
    };
    // The top frame is the running call: it isn't waiting on anything.
    const stack = this.frames.map((frame, k) => {
      if (k < this.frames.length - 1 || frame.waiting === undefined) return { ...frame };
      const { waiting: _, ...rest } = frame;
      return rest;
    });
    this.steps.push({ ...step, pointers: {}, tree, stack });
  }

  /** `trace.row.values`: every node's value by id. */
  values(): number[] {
    return this.nodes.map((node) => node.value);
  }
}
