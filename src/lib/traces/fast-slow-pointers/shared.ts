import type { TraceEquation, TraceRace, TraceRaceMove, TraceStep, TraceValue } from "../types";
import { ListState, listStep } from "../linked-list/shared";

type RaceStep = Omit<TraceStep, "links" | "pointers" | "race" | "moves"> & {
  /** The pointers' moves this step (not `moves`, which is a bar-row's). */
  moved?: TraceRaceMove[];
  meet?: number;
  entry?: number;
  loop?: { from: number; to: number };
};

/**
 * Two pointers walking one linked list (a real list, or an array read as one: index `i` points to its next index).
 * `move` follows real `next` links hop by hop, so every recorded move is a path through the list; `record` snapshots
 * the pointers, the list, and the race. Traces drive it exactly like the reference solutions.
 */
export class Race {
  readonly list = new ListState();
  readonly steps: TraceStep[] = [];
  readonly pointers: Record<string, number | null> = {};
  phase: 1 | 2 = 1;

  /** One node per value, in slots 0, 1, 2… of lane 0; `next` links are set with `link`. */
  addNodes(values: readonly TraceValue[]): number[] {
    return values.map((value, slot) => this.list.add(value, 0, slot));
  }

  /** `node.next = to` while building the input (not reported as a rewire). */
  link(id: number, to: number | null) {
    this.list.nodes[id].next = to;
  }

  next(id: number): number | null {
    return this.list.next(id);
  }

  /**
   * Move pointer `name` up to `hops` links forward. `allowed(from, to)` may refuse a hop (the pointer stops before
   * it, and the move records the node as `blocked`). A pointer that runs off the end is null.
   */
  move(
    name: string,
    hops: number,
    allowed: (from: number, to: number) => boolean = () => true,
  ): TraceRaceMove {
    const from = this.pointers[name];
    if (from === null || from === undefined) throw new Error(`${name} isn't on the list`);
    const path: number[] = [];
    let at: number | null = from;
    let done = 0;
    let blocked: number | undefined;
    while (done < hops && at !== null) {
      const to: number | null = this.next(at);
      if (to !== null && !allowed(at, to)) {
        blocked = to;
        break;
      }
      if (done > 0) path.push(at);
      at = to;
      done++;
    }
    this.pointers[name] = at;
    return { pointer: name, from, to: at, path, hops: done, ...(blocked !== undefined ? { blocked } : {}) };
  }

  /** Hops from `from` forward to `to`, or null when `to` is never reached. */
  distance(from: number, to: number): number | null {
    let at: number | null = from;
    for (let d = 0; d <= this.list.nodes.length; d++) {
      if (at === to) return d;
      if (at === null) return null;
      at = this.next(at);
    }
    return null;
  }

  record({ moved: moves = [], meet, entry, loop, ...step }: RaceStep) {
    const race: TraceRace = {
      phase: this.phase,
      moves,
      ...(meet !== undefined ? { meet } : {}),
      ...(entry !== undefined ? { entry } : {}),
      ...(loop ? { loop } : {}),
    };
    this.steps.push({ ...listStep(this.list, { ...step, pointers: { ...this.pointers } }), race });
  }
}

/** "The gap closes by one": fast's distance to slow before and after a round. */
export function gapEquation(before: number, after: number): TraceEquation {
  return {
    terms: [before, before - after],
    operator: "-",
    result: after,
    tone: after === 0 ? "positive" : "neutral",
  };
}

/**
 * Phase 2's restart: the head is `toEntry` steps from the loop's start, the meeting point `fromMeet`. They're equal
 * when fast lapped slow once; otherwise the head is farther by whole laps of the loop, which the meeting side walks
 * too. Either way one step each brings both to the start together. The equation shows exactly that, and `laps`
 * says how many extra laps (0 when equal).
 */
export function restartEquation(
  toEntry: number,
  fromMeet: number,
  loopLength: number,
): { equation: TraceEquation; laps: number } {
  if (toEntry === fromMeet)
    return {
      equation: {
        terms: [toEntry],
        operator: "+",
        result: toEntry,
        comparison: { op: "=", target: fromMeet },
        tone: "positive",
      },
      laps: 0,
    };
  return {
    equation: { terms: [fromMeet, toEntry - fromMeet], operator: "+", result: toEntry, tone: "positive" },
    laps: (toEntry - fromMeet) / loopLength,
  };
}
