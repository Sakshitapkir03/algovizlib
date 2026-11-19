import type { BarRowElement, Element, ItemRowElement } from "@/lib/storyboard";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "@/lib/storyboard";

/**
 * Pixel geometry of an item-row or bar-row on the 1280×720 canvas. For a bar-row, `top`/`cardHeight` is the full
 * column each bar can grow in (bars are bottom-aligned at `top + cardHeight`), so pointers, highlights, and anchored
 * callouts work on either kind of row unchanged.
 */
export type RowLayout = {
  rowId: string;
  top: number;
  cardWidth: number;
  cardHeight: number;
  /** Left x of each card. */
  lefts: number[];
  /** Center x of each card. */
  centers: number[];
  /** Top of everything drawn for this row, including a held value above it; anchored callouts sit above this. */
  reservedTop: number;
};

const SIDE_MARGIN = 64;
const GAP = 16;
const MAX_CARD_WIDTH = 140;
const CARD_HEIGHT = 124;
/** Vertical band the rows share (between the caption and the bottom stack). */
const BAND_TOP = 270;
const BAND_BOTTOM = 470;
/** A single bar-row gets a taller band: from under the floating callouts down to just above the pointers. */
const BAR_TOP = 232;
const BAR_HEIGHT = 200;
const MAX_BAR_WIDTH = 96;
/** With a held value, the bars drop to leave a strip above them for the lifted value. */
const HELD_STRIP = 68;
/** With a count-array, the bars get shorter so the tally panel fits under the pointers. */
const BAR_HEIGHT_WITH_COUNTS = 120;
/** Top of the count-array panel (its key labels); the cells sit just below. */
export const COUNT_PANEL_TOP = 416;

type Row = ItemRowElement | BarRowElement;
const lengthOf = (row: Row) => (row.type === "item-row" ? row.items.length : row.bars.length);

export function layoutRows(elements: readonly Element[]): Record<string, RowLayout> {
  const rows = elements.filter((el): el is Row => el.type === "item-row" || el.type === "bar-row");
  const layouts: Record<string, RowLayout> = {};
  const slot = (BAND_BOTTOM - BAND_TOP) / rows.length;
  const hasCounts = elements.some((el) => el.type === "count-array");
  const heldRows = new Set(elements.flatMap((el) => (el.type === "held-value" ? [el.rowId] : [])));

  rows.forEach((row, r) => {
    const n = lengthOf(row);
    const soloBars = row.type === "bar-row" && rows.length === 1;
    const maxWidth = soloBars ? MAX_BAR_WIDTH : MAX_CARD_WIDTH;
    const cardWidth = Math.min(maxWidth, (VIDEO_WIDTH - 2 * SIDE_MARGIN - GAP * (n - 1)) / n);
    const total = n * cardWidth + GAP * (n - 1);
    const start = (VIDEO_WIDTH - total) / 2;
    const lefts = Array.from({ length: n }, (_, i) => start + i * (cardWidth + GAP));
    const held = soloBars && heldRows.has(row.id) ? HELD_STRIP : 0;
    const cardHeight = soloBars
      ? (hasCounts ? BAR_HEIGHT_WITH_COUNTS : BAR_HEIGHT) - held
      : rows.length > 1
        ? Math.min(CARD_HEIGHT, slot - 70)
        : CARD_HEIGHT;
    const top = soloBars
      ? BAR_TOP + held
      : BAND_TOP + r * slot + (slot - cardHeight) / 2 - (rows.length > 1 ? 0 : 20);
    layouts[row.id] = {
      rowId: row.id,
      top,
      cardWidth,
      cardHeight,
      lefts,
      centers: lefts.map((l) => l + cardWidth / 2),
      reservedTop: top - held,
    };
  });
  return layouts;
}

export const CANVAS = { width: VIDEO_WIDTH, height: VIDEO_HEIGHT };
