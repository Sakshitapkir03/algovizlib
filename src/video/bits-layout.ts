import type { BitsElement } from "@/lib/storyboard";

import { TEXT, type TextMetrics } from "./text";

const GAP = 4;
const COLUMN_GAP = 12;
const ROW_GAP = 6;
/** Room for a result row's rule line. */
const RULE = 8;

export type BitsShape = {
  cellWidth: number;
  cellHeight: number;
  /** Widths of the name, operator, and decimal columns. */
  nameWidth: number;
  opWidth: number;
  decimalWidth: number;
  /** Left of bit column k (k = 0 is the most significant), from the panel's left. */
  cellLeft: (k: number) => number;
  /** Where the decimal column starts. */
  decimalLeft: number;
  headerHeight: number;
  /** Top of each row from the panel's top (after the header and any rule line). */
  rowTops: number[];
  width: number;
  height: number;
};

/** The row name shown: the storyboard's label for it, else the trace's name. */
export const rowName = (el: BitsElement, k: number) => el.rowLabels?.[k] || el.rows[k].name;

/** A value's bit at column k (0 = most significant) within `width` bits (two's complement for negatives). */
export const bitAt = (value: number, width: number, k: number) => (value >> (width - 1 - k)) & 1;

/** The header over column k: the bit's label, else its place value. */
export const headerAt = (el: BitsElement, k: number) => el.bitLabels?.[k] ?? String(2 ** (el.width - 1 - k));

/**
 * A bits panel's geometry: a header row (place values or bit labels), then one row per number: name, operator, the
 * bit cells in aligned columns (each as wide as the widest header), and "= decimal". Pure: the bottom stack and the
 * fit checks use the same numbers.
 */
export function layoutBits(el: BitsElement, t: TextMetrics): BitsShape {
  const bit = t.size(TEXT.bitValue);
  const header = t.size(TEXT.bitHeader);
  const name = t.size(TEXT.bitName);
  const cellHeight = bit + 14;
  const cellWidth = Math.max(
    cellHeight,
    ...Array.from({ length: el.width }, (_, k) => t.width(headerAt(el, k), header, "mono") + 10),
  );
  const nameWidth = Math.max(...el.rows.map((_, k) => t.width(rowName(el, k), name))) + 4;
  const opWidth =
    Math.max(0, ...el.rows.map((r) => (r.op ? t.width(r.op, name, "mono") : 0))) +
    (el.rows.some((r) => r.op) ? 4 : 0);
  const decimalWidth = Math.max(...el.rows.map((r) => t.width(`= ${r.value}`, name + 4, "mono"))) + 4;
  const cellsLeft = nameWidth + COLUMN_GAP + opWidth + (opWidth ? COLUMN_GAP : 0);
  const cellLeft = (k: number) => cellsLeft + k * (cellWidth + GAP);
  const decimalLeft = cellLeft(el.width) - GAP + COLUMN_GAP + 4;
  const headerHeight = header + 8;
  const rowTops: number[] = [];
  let y = headerHeight + 4;
  for (const row of el.rows) {
    if (row.rule) y += RULE;
    rowTops.push(y);
    y += cellHeight + ROW_GAP;
  }
  return {
    cellWidth,
    cellHeight,
    nameWidth,
    opWidth,
    decimalWidth,
    cellLeft,
    decimalLeft,
    headerHeight,
    rowTops,
    width: decimalLeft + decimalWidth,
    height: y - ROW_GAP,
  };
}
