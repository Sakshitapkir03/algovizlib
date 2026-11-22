import type { TraceExplore, TracePartial, TraceSearchNode, TraceStep } from "../types";

type StepInput = Omit<TraceStep, "pointers" | "explore" | "partial">;

/**
 * A backtracking search the traces drive exactly like the reference solutions: `choose` adds a child node (a choice)
 * and walks into it, `undo` steps back to the parent, `prune` adds a branch that's cut without exploring it. Nodes are
 * created in the order the search reaches them, so the finished list is the whole decision tree. Every `record` takes
 * a snapshot: what's been reached, the path, how each finished branch ended, the answer being built, and the answers
 * found so far.
 */
export class Search {
  readonly nodes: TraceSearchNode[] = [];
  readonly steps: TraceStep[] = [];
  readonly items: string[] = [];
  readonly found: string[] = [];
  private readonly reached: number[] = [];
  private readonly path: number[] = [];
  private readonly dead = new Set<number>();
  private readonly solutions = new Set<number>();
  private readonly collapsed = new Set<number>();
  private added: string | undefined;
  private removed: string | undefined;
  private undone: number | undefined;

  constructor(rootLabel: string) {
    this.add(null, rootLabel);
    this.path.push(0);
  }

  private add(parent: number | null, label: string, edge?: string, pruned?: string): number {
    const id = this.nodes.length;
    this.nodes.push({
      id,
      parent,
      label,
      ...(edge !== undefined ? { edge } : {}),
      ...(pruned ? { pruned } : {}),
    });
    this.reached.push(id);
    return id;
  }

  get current(): number {
    return this.path.at(-1)!;
  }

  /** Make a choice: a child of the current node, and the item it adds to the answer being built. */
  choose(label: string, edge: string, item?: string): number {
    const id = this.add(this.current, label, edge);
    this.path.push(id);
    if (item !== undefined) {
      this.items.push(item);
      this.added = item;
    }
    return id;
  }

  /** A branch cut without exploring it (a child of the current node), with the reason. */
  prune(edge: string, reason: string): number {
    return this.add(this.current, "✕", edge, reason);
  }

  /** The current node is a complete answer. */
  solve(answer: string) {
    this.solutions.add(this.current);
    this.found.push(answer);
  }

  /** Step back to the parent, taking back the last item if this choice added one. */
  undo(hadItem = true) {
    const id = this.path.pop()!;
    this.undone = id;
    if (hadItem) this.removed = this.items.pop();
    // A finished branch with no answer below is a dead end; a big one folds into its root.
    if (!this.hasSolutionBelow(id)) {
      this.dead.add(id);
      if (this.below(id).length >= 2) this.collapsed.add(id);
    }
  }

  private below(id: number): number[] {
    return this.nodes.filter((n) => n.parent === id).flatMap((n) => [n.id, ...this.below(n.id)]);
  }

  private hasSolutionBelow(id: number): boolean {
    return this.solutions.has(id) || this.below(id).some((n) => this.solutions.has(n));
  }

  record(step: StepInput) {
    const sorted = (set: Iterable<number>) => [...set].sort((a, b) => a - b);
    const explore: TraceExplore = {
      reached: sorted(this.reached),
      path: [...this.path],
      current: this.current,
      dead: sorted(this.dead),
      solutions: sorted(this.solutions),
      ...(this.undone !== undefined ? { undone: this.undone } : {}),
      ...(this.collapsed.size ? { collapsed: sorted(this.collapsed) } : {}),
    };
    const partial: TracePartial = {
      items: [...this.items],
      ...(this.added !== undefined ? { added: this.added } : {}),
      ...(this.removed !== undefined ? { removed: this.removed } : {}),
      found: [...this.found],
    };
    this.steps.push({ ...step, pointers: {}, explore, partial });
    this.added = undefined;
    this.removed = undefined;
    this.undone = undefined;
  }
}

export const listText = (items: readonly (string | number)[]) => `[${items.join(", ")}]`;
