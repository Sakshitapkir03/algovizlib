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
  /** Where "below" pointers start (under the baseline, and under segment brackets when there are any). */
  pointerTop: number;
  /** Top of a panel under the pointers (merge buffer). */
  panelTop: number;
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
/** With a partition, the bars drop to leave a strip above them for the pivot tag and the boundary label. */
const PIVOT_STRIP = 48;
/** With a count-array, the bars get shorter so the tally panel fits under the pointers. */
const BAR_HEIGHT_WITH_COUNTS = 120;
/** With a merge buffer (and its brackets), the bars get shorter still. */
const BAR_HEIGHT_WITH_BUFFER = 104;
/** Top of the count-array panel (its key labels); the cells sit just below. */
export const COUNT_PANEL_TOP = 416;
/** Segment brackets sit under the baseline; groups are drawn this much further apart. */
export const BRACKET_SPACE = 20;
const GROUP_GAP = 28;
/** Pointer arrow + label height, so a panel can sit under them. */
const POINTER_SPACE = 58;
/**
 * With a heap-tree the stage splits: the bars take a narrow column on the left and the tree gets the rest, so
 * the tree stays readable when the whole video is scaled down to phone width.
 */
const HEAP_BARS = { left: 32, right: 440, top: 300, height: 160 };
/** Starts under a two-line caption and ends where the bottom stack (the equation) begins. */
export const HEAP_TREE_REGION = { left: 570, right: 1250, top: 188, bottom: 505 };

type Row = ItemRowElement | BarRowElement;
const lengthOf = (row: Row) => (row.type === "item-row" ? row.items.length : row.bars.length);

export function layoutRows(elements: readonly Element[]): Record<string, RowLayout> {
  const rows = elements.filter((el): el is Row => el.type === "item-row" || el.type === "bar-row");
  const layouts: Record<string, RowLayout> = {};
  const slot = (BAND_BOTTOM - BAND_TOP) / rows.length;
  const hasCounts = elements.some((el) => el.type === "count-array");
  const hasHeap = elements.some((el) => el.type === "heap-tree");
  const heldRows = new Set(elements.flatMap((el) => (el.type === "held-value" ? [el.rowId] : [])));
  const pivotRows = new Set(elements.flatMap((el) => (el.type === "partition" ? [el.rowId] : [])));
  const bufferRows = new Set(elements.flatMap((el) => (el.type === "merge-buffer" ? [el.rowId] : [])));
  const groupsOf = new Map(
    elements.flatMap((el) => (el.type === "segments" ? [[el.rowId, el.groups] as const] : [])),
  );

  rows.forEach((row, r) => {
    const n = lengthOf(row);
    const soloBars = row.type === "bar-row" && rows.length === 1;
    const heap = soloBars && hasHeap;
    const maxWidth = soloBars ? MAX_BAR_WIDTH : MAX_CARD_WIDTH;
    // A gap before the first position of every group after the first.
    const groupStarts = new Set((groupsOf.get(row.id) ?? []).slice(1).map((g) => g.from));
    const extra = groupStarts.size * GROUP_GAP;
    const [regionLeft, regionRight] = heap
      ? [HEAP_BARS.left, HEAP_BARS.right]
      : [SIDE_MARGIN, VIDEO_WIDTH - SIDE_MARGIN];
    const cardWidth = Math.min(maxWidth, (regionRight - regionLeft - GAP * (n - 1) - extra) / n);
    const total = n * cardWidth + GAP * (n - 1) + extra;
    const lefts: number[] = [];
    let x = (regionLeft + regionRight - total) / 2;
    for (let i = 0; i < n; i++) {
      if (groupStarts.has(i)) x += GROUP_GAP;
      lefts.push(x);
      x += cardWidth + GAP;
    }
    const strip = !soloBars ? 0 : heldRows.has(row.id) ? HELD_STRIP : pivotRows.has(row.id) ? PIVOT_STRIP : 0;
    const barHeight = heap
      ? HEAP_BARS.height
      : bufferRows.has(row.id)
        ? BAR_HEIGHT_WITH_BUFFER
        : hasCounts
          ? BAR_HEIGHT_WITH_COUNTS
          : BAR_HEIGHT;
    const cardHeight = soloBars
      ? barHeight - strip
      : rows.length > 1
        ? Math.min(CARD_HEIGHT, slot - 70)
        : CARD_HEIGHT;
    const top = heap
      ? HEAP_BARS.top
      : soloBars
        ? BAR_TOP + strip
        : BAND_TOP + r * slot + (slot - cardHeight) / 2 - (rows.length > 1 ? 0 : 20);
    const pointerTop = top + cardHeight + 8 + (groupsOf.has(row.id) ? BRACKET_SPACE : 0);
    layouts[row.id] = {
      rowId: row.id,
      top,
      cardWidth,
      cardHeight,
      lefts,
      centers: lefts.map((l) => l + cardWidth / 2),
      reservedTop: top - strip,
      pointerTop,
      panelTop: pointerTop + POINTER_SPACE,
    };
  });
  return layouts;
}

export const CANVAS = { width: VIDEO_WIDTH, height: VIDEO_HEIGHT };
