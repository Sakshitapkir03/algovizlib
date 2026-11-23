import type { TraceCall, TraceLinks, TraceListNode, TraceOp, TraceStep, TraceValue } from "../types";

type Json = number | string | boolean | null;

/** A value as the op log shows it: strings quoted, `null` (a void method or the constructor) as "—". */
export function showValue(value: Json): string {
  if (value === null) return "—";
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

/** A call as the op log shows it: `put(1, 10)`, `get("color", 4)`, `MyQueue()`. */
export function callLabel(op: string, args: readonly Json[]): string {
  return `${op}(${args.map(showValue).join(", ")})`;
}

/**
 * A design problem's call sequence: `run(k)` marks call `k` as the one running, `returns(value)` records its output.
 * `ops()` is the whole log (`trace.ops`) and `op()` the step's position in it.
 */
export class Calls {
  private readonly outputs: Json[] = [];
  private current = -1;
  private returned = false;

  constructor(
    private readonly operations: readonly string[],
    private readonly args: readonly (readonly Json[])[],
  ) {}

  run(k: number) {
    this.current = k;
    this.returned = false;
  }

  returns(value: Json) {
    this.outputs[this.current] = value;
    this.returned = true;
  }

  op(): TraceOp {
    return { current: this.current, returned: this.returned };
  }

  /** The reference solution's return value: every call's output. */
  answer(): Json[] {
    return this.operations.map((_, k) => this.outputs[k] ?? null);
  }

  ops(): TraceCall[] {
    return this.operations.map((op, k) => ({
      call: callLabel(op, this.args[k] ?? []),
      output: showValue(this.outputs[k] ?? null),
    }));
  }

  answerDisplay(): string {
    return this.answer()
      .map((v) => (v === null ? "null" : typeof v === "string" ? JSON.stringify(v) : String(v)))
      .join(", ");
  }
}

/** A step with the call log's position taken now. */
export function opStep(calls: Calls, step: Omit<TraceStep, "pointers" | "op">): TraceStep {
  return { ...step, pointers: {}, op: calls.op() };
}

type DNode = { id: number; value: TraceValue; prev: number | null; next: number | null; lane: number };

/**
 * Doubly linked lists, one per lane, mutated with real `prev`/`next` assignments exactly like the reference
 * solutions (without their sentinel nodes: a lane's `head` and `tail` stand in for them). Node ids are given out in
 * creation order and a removed node's id is never reused, so a node keeps its id (and slides) as it moves. Each
 * `next` assignment is recorded as a rewire for the next snapshot.
 */
export class DoublyList {
  private readonly nodes = new Map<number, DNode>();
  private readonly heads = new Map<number, number | null>();
  private readonly tails = new Map<number, number | null>();
  private rewired: NonNullable<TraceLinks["rewired"]> = [];
  private nextId = 0;

  get size(): number {
    return this.nodes.size;
  }

  /** A new node, not in any lane yet. */
  create(value: TraceValue): number {
    const id = this.nextId++;
    this.nodes.set(id, { id, value, prev: null, next: null, lane: -1 });
    return id;
  }

  setValue(id: number, value: TraceValue) {
    this.nodes.get(id)!.value = value;
  }

  value(id: number): TraceValue {
    return this.nodes.get(id)!.value;
  }

  head(lane: number): number | null {
    return this.heads.get(lane) ?? null;
  }

  tail(lane: number): number | null {
    return this.tails.get(lane) ?? null;
  }

  laneOf(id: number): number {
    return this.nodes.get(id)!.lane;
  }

  private setNext(id: number | null, to: number | null, lane: number) {
    if (id === null) {
      this.heads.set(lane, to);
      return;
    }
    const node = this.nodes.get(id)!;
    if (node.next !== to) this.rewired.push({ node: id, from: node.next, to });
    node.next = to;
  }

  private setPrev(id: number | null, to: number | null, lane: number) {
    if (id === null) this.tails.set(lane, to);
    else this.nodes.get(id)!.prev = to;
  }

  /** Take a node out of its lane: `prev.next = node.next; next.prev = node.prev`. */
  unlink(id: number) {
    const node = this.nodes.get(id)!;
    this.setNext(node.prev, node.next, node.lane);
    this.setPrev(node.next, node.prev, node.lane);
    node.prev = null;
    this.setNext(id, null, node.lane);
    node.lane = -1;
  }

  /** Put a node at the front of `lane` (the most recent end of an LRU list). */
  pushFront(id: number, lane: number) {
    const node = this.nodes.get(id)!;
    const first = this.head(lane);
    node.lane = lane;
    node.prev = null;
    this.setNext(id, first, lane);
    this.setPrev(first, id, lane);
    this.heads.set(lane, id);
  }

  /** Put a node at the back of `lane` (the newest end of an LFU bucket, oldest first). */
  pushBack(id: number, lane: number) {
    const node = this.nodes.get(id)!;
    const last = this.tail(lane);
    node.lane = lane;
    node.prev = last;
    this.setNext(id, null, lane);
    this.setNext(last, id, lane);
    this.tails.set(lane, id);
  }

  /** Unlink a node and forget it (an eviction). */
  remove(id: number) {
    this.unlink(id);
    this.nodes.delete(id);
  }

  /** Every node in lanes, slots counted from each lane's head, and the step's rewires (then cleared). */
  snapshot(): TraceLinks {
    const out: TraceListNode[] = [];
    for (const [lane, head] of this.heads) {
      let slot = 0;
      for (let id = head; id !== null; id = this.nodes.get(id)!.next) {
        const n = this.nodes.get(id)!;
        out.push({ id, value: n.value, next: n.next, prev: n.prev, lane, slot: slot++ });
      }
    }
    out.sort((a, b) => a.id - b.id);
    const links: TraceLinks = { nodes: out };
    // Only links between nodes still on screen (an evicted node's own links went with it).
    // A node rewired twice in one step (unlinked, then linked in elsewhere) reports one change: first `from`, last `to`.
    const live = new Set(out.map((n) => n.id));
    const merged = new Map<number, { node: number; from: number | null; to: number | null }>();
    for (const r of this.rewired) {
      const seen = merged.get(r.node);
      merged.set(r.node, { node: r.node, from: seen ? seen.from : r.from, to: r.to });
    }
    const rewired = [...merged.values()].filter(
      (r) =>
        r.from !== r.to &&
        live.has(r.node) &&
        (r.to === null || live.has(r.to)) &&
        (r.from === null || live.has(r.from)),
    );
    if (rewired.length) links.rewired = rewired;
    this.rewired = [];
    return links;
  }
}

/** The list's values by node id, in id order: what pointers and highlights on it index (`step.values`). */
export const listValues = (links: TraceLinks): TraceValue[] =>
  [...links.nodes].sort((a, b) => a.id - b.id).map((n) => n.value);
