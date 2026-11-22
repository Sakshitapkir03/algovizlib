import type { TimelineBarState, TraceTimelineBar, TraceTimelineStep } from "../types";

/** Intervals on a timeline that the traces move, merge, and mark as they go, snapshotting them for each step. */
export class Timeline {
  private readonly bars = new Map<number, TraceTimelineBar>();

  add(id: number, start: number, end: number, lane: number, state: TimelineBarState = "waiting") {
    this.bars.set(id, { id, start, end, lane, state });
  }

  get(id: number): TraceTimelineBar {
    return this.bars.get(id)!;
  }

  set(id: number, change: Partial<Omit<TraceTimelineBar, "id">>) {
    this.bars.set(id, { ...this.get(id), ...change });
  }

  /** Every bar now (by id), with this step's overlap, growth, and marker. `fromLane` is cleared after each step. */
  snapshot(extra: Omit<TraceTimelineStep, "bars"> = {}): TraceTimelineStep {
    const bars = [...this.bars.values()].sort((a, b) => a.id - b.id).map((bar) => ({ ...bar }));
    for (const bar of this.bars.values()) delete bar.fromLane;
    return { bars, ...extra };
  }

  list(): TraceTimelineBar[] {
    return [...this.bars.values()].sort((a, b) => a.id - b.id).map((bar) => ({ ...bar }));
  }
}

/** Axis bounds for a set of ranges, with a unit of room at each end. */
export const axis = (ranges: readonly number[][]) => ({
  min: Math.min(...ranges.map((r) => r[0])) - 1,
  max: Math.max(...ranges.map((r) => r[1])) + 1,
});

export const show = (r: readonly number[]) => `[${r[0]}, ${r[1]}]`;
