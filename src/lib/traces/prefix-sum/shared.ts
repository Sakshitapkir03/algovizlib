import type { TracePrefixRow } from "../types";

/** A running total over n items, one cell per boundary (see `TracePrefixRow`), built cell by cell. */
export class PrefixRow {
  readonly values: (number | null)[];

  constructor(
    readonly name: string,
    readonly op: "+" | "×",
    readonly direction: "prefix" | "suffix",
    n: number,
  ) {
    this.values = new Array<number | null>(n + 1).fill(null);
  }

  get(i: number): number {
    return this.values[i] as number;
  }

  set(i: number, value: number) {
    this.values[i] = value;
  }

  /** The row now, with this step's cell, reads, and spans. */
  snapshot(extra: Pick<TracePrefixRow, "current" | "reads" | "spans"> = {}): TracePrefixRow {
    return { name: this.name, op: this.op, direction: this.direction, values: [...this.values], ...extra };
  }
}

/** A span of items `from`…`to − 1` answered by a prefix row's cells at `from` and `to`: their difference. */
export const sumSpan = (row: PrefixRow, from: number, to: number) => ({
  from,
  to,
  value: row.get(to) - row.get(from),
});
