import { z } from "zod";

import type { TraceLinks, TraceListNode, TraceStep, TraceValue } from "../types";

/**
 * A linked list the traces mutate exactly like the reference solutions do, recording snapshots for the video. Each
 * `link()` is a real `node.next = …` assignment and is reported as a rewire in the next snapshot.
 */
export class ListState {
  readonly nodes: TraceListNode[] = [];
  private rewired: NonNullable<TraceLinks["rewired"]> = [];

  /** Add the nodes of one input list (linked in order) to `lane`, from `slot`. Returns their ids. */
  addList(values: readonly number[], lane: number, slot = 0): number[] {
    const ids = values.map((value, i) => this.add(value, lane, slot + i));
    ids.forEach((id, i) => (this.nodes[id].next = ids[i + 1] ?? null));
    return ids;
  }

  add(value: TraceValue, lane: number, slot: number, dummy = false): number {
    const id = this.nodes.length;
    this.nodes.push({ id, value, next: null, lane, slot, ...(dummy ? { dummy: true } : {}) });
    return id;
  }

  next(id: number): number | null {
    return this.nodes[id].next;
  }

  /** `node.next = to`, recorded as a rewire. */
  link(id: number, to: number | null) {
    const from = this.nodes[id].next;
    if (from === to) return;
    this.nodes[id].next = to;
    this.rewired.push({ node: id, from, to });
  }

  /** Draw node `id` at a new place (it slides there). */
  place(id: number, lane: number, slot: number) {
    this.nodes[id].lane = lane;
    this.nodes[id].slot = slot;
  }

  /** The state for a step, and clear the rewires it reported. */
  snapshot(): TraceLinks {
    const links: TraceLinks = { nodes: this.nodes.map((n) => ({ ...n })) };
    if (this.rewired.length > 0) links.rewired = this.rewired;
    this.rewired = [];
    return links;
  }

  /** Values from `head`, following `next` (what the reference solution returns). */
  walk(head: number | null): number[] {
    const out: number[] = [];
    const seen = new Set<number>();
    for (let id = head; id !== null && !seen.has(id); id = this.nodes[id].next) {
      seen.add(id);
      out.push(this.nodes[id].value as number);
    }
    return out;
  }

  /** `trace.row.values`: every node's value by id. */
  values(): TraceValue[] {
    return this.nodes.map((n) => n.value);
  }
}

/** Only pointers that sit on a node (a null pointer isn't drawn). */
export function onNodes(pointers: Record<string, number | null>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(pointers).filter((entry): entry is [string, number] => entry[1] !== null),
  );
}

/** A step with the list's state taken now. */
export function listStep(
  state: ListState,
  step: Omit<TraceStep, "links" | "pointers"> & { pointers: Record<string, number | null> },
): TraceStep {
  return { ...step, pointers: onNodes(step.pointers), links: state.snapshot() };
}

export const listDisplay = (values: readonly number[]) => `[${values.join(", ")}]`;

/** Whole numbers that fit in a node box. */
export const nodeValues = (max: number) => z.array(z.number().int().min(-99).max(99)).max(max);
