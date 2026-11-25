/**
 * The discrete-event core: a virtual clock in whole milliseconds and a queue of events ordered by time, ties broken by
 * the order they were scheduled. There are no threads and no real clock: "two requests at once" means two events the
 * scenario scheduled close together, and the interleaving is always the same for the same scenario.
 */

type Scheduled = { t: number; seq: number; run: () => void };

export class EventLoop {
  /** The virtual time of the event being handled (ms). */
  now = 0;
  private heap: Scheduled[] = [];
  private seq = 0;
  private handled = 0;

  constructor(
    /** Events after this time are never run (a scenario that never settles still ends). */
    readonly horizon = 60_000,
    /** A guard against a model bug that schedules forever. */
    readonly maxEvents = 20_000,
  ) {}

  /** Run `fn` `delay` ms from now (0: after everything already due now). */
  after(delay: number, fn: () => void) {
    if (!Number.isInteger(delay) || delay < 0) throw new Error(`Bad delay ${delay}`);
    this.push({ t: this.now + delay, seq: this.seq++, run: fn });
  }

  /** Handle events in order until none are left (or the horizon passes). */
  run() {
    while (this.heap.length > 0) {
      const next = this.pop()!;
      if (next.t > this.horizon) break;
      if (++this.handled > this.maxEvents) throw new Error("The simulation ran too many events");
      this.now = next.t;
      next.run();
    }
  }

  private before(a: Scheduled, b: Scheduled) {
    return a.t < b.t || (a.t === b.t && a.seq < b.seq);
  }

  private push(item: Scheduled) {
    const h = this.heap;
    h.push(item);
    let i = h.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(h[i], h[parent])) break;
      [h[i], h[parent]] = [h[parent], h[i]];
      i = parent;
    }
  }

  private pop(): Scheduled | undefined {
    const h = this.heap;
    if (h.length === 0) return undefined;
    const top = h[0];
    const last = h.pop()!;
    if (h.length > 0) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let best = i;
        if (l < h.length && this.before(h[l], h[best])) best = l;
        if (r < h.length && this.before(h[r], h[best])) best = r;
        if (best === i) break;
        [h[i], h[best]] = [h[best], h[i]];
        i = best;
      }
    }
    return top;
  }
}
