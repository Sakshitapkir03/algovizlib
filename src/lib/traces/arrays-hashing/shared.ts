import type { TraceMap } from "../types";

/** A hash map the traces read and write exactly like the reference solutions, snapshotting it for each step. */
export class RecordedMap {
  private readonly entries = new Map<string, string | undefined>();
  private lookup: TraceMap["lookup"];
  private inserted: string | undefined;
  private updated: TraceMap["updated"];

  constructor(
    private readonly kind: "map" | "set",
    private readonly display: "rows" | "cells",
  ) {}

  /** Look a key up (recorded as this step's lookup). */
  has(key: string | number): boolean {
    const found = this.entries.has(String(key));
    this.lookup = { key: String(key), found };
    return found;
  }

  get(key: string | number): string | undefined {
    this.has(key);
    return this.entries.get(String(key));
  }

  /** Add or change an entry (recorded as inserted or updated). */
  set(key: string | number, value?: string | number) {
    const k = String(key);
    const v = value === undefined ? undefined : String(value);
    if (this.entries.has(k)) {
      const from = this.entries.get(k);
      if (from !== v) this.updated = { key: k, from: from ?? "" };
    } else this.inserted = k;
    this.entries.set(k, v);
  }

  size(): number {
    return this.entries.size;
  }

  snapshot(): TraceMap {
    const map: TraceMap = {
      kind: this.kind,
      display: this.display,
      entries: [...this.entries].map(([key, value]) => ({ key, ...(value !== undefined ? { value } : {}) })),
      ...(this.lookup ? { lookup: this.lookup } : {}),
      ...(this.inserted !== undefined ? { inserted: this.inserted } : {}),
      ...(this.updated ? { updated: this.updated } : {}),
    };
    this.lookup = undefined;
    this.inserted = undefined;
    this.updated = undefined;
    return map;
  }
}
