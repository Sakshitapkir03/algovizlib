import type { BarRowElement, Element, ItemRowElement } from "@/lib/storyboard";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "@/lib/storyboard";

import { TEXT, textMetrics, type TextMetrics } from "./text";

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
  /** Top of a panel under the pointers (merge buffer, tally). */
  panelTop: number;
  /** Labels beside the row (e.g. "✓ sorted") must end before this x. */
  rightLimit: number;
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
/** On a phone-sized player callouts are hidden, so the bars can start right under a two-line caption. */
const COMPACT_BAR_TOP = 200;
const BAR_HEIGHT = 200;
const MAX_BAR_WIDTH = 96;
/** Segment brackets sit under the baseline; groups are drawn this much further apart. */
export const BRACKET_SPACE = 20;
const GROUP_GAP = 28;
const ARROW = 14;
/** The bottom stack (equations, results, counters) normally starts here, and ends this far above the bottom. */
const BOTTOM_TOP = 500;
const BOTTOM_MARGIN = 24;
const BOTTOM_GAP = 16;
/**
 * With a heap-tree the stage splits: the bars take a narrow column on the left and the tree gets the rest, so
 * the tree stays readable when the whole video is scaled down to phone width.
 */
const HEAP_BARS = { left: 32, right: 440, top: 300, height: 160 };
const HEAP_TREE = { left: 570, right: 1250, top: 188 };

export type Region = { left: number; right: number; top: number; bottom: number };

/** Everything a scene's primitives position against. */
export type SceneLayout = {
  rows: Record<string, RowLayout>;
  /** Top of the bottom stack; raised when its contents (e.g. a split-tree at phone size) need more room. */
  bottomTop: number;
  /** Where a heap-tree draws: under a two-line caption, beside the bars, down to the bottom stack. */
  heapRegion: Region;
};

/** Heights the layout reserves, from the same font sizes the primitives use. */
export const sizes = {
  pointer: (t: TextMetrics) => ARROW + t.size(TEXT.pointer) + 18,
  barLabel: (t: TextMetrics) => t.size(TEXT.barValue) + 10,
  heldCard: (t: TextMetrics) => t.size(TEXT.heldValue) + 14 + (t.compact ? 0 : t.size(TEXT.heldLabel) + 2),
  pivotTag: (t: TextMetrics) => t.size(TEXT.pivotTag) + 14,
  countKeys: (t: TextMetrics) => t.size(TEXT.countKey) + 6,
  cell: (t: TextMetrics) => t.size(TEXT.countCell) + 20,
  marker: (t: TextMetrics) => (t.compact ? 0 : t.size(TEXT.marker) + 4),
  splitRow: (t: TextMetrics) => t.size(TEXT.splitValue) + 12,
  splitCell: (t: TextMetrics) => Math.max(46, t.width("88", t.size(TEXT.splitValue), "mono") + 12),
};
export const SPLIT_ROW_GAP = 6;

/** Estimated height of a bottom-slot element, so the stack can rise to make room. */
function bottomHeight(el: Element, t: TextMetrics): number {
  switch (el.type) {
    case "equation":
      return Math.ceil(t.size(TEXT.equation) * 1.25) + 8;
    case "result":
      return (
        Math.max(
          t.size(TEXT.resultIcon) + 18,
          Math.ceil(
            (t.size(TEXT.resultTitle) +
              t.size(TEXT.resultValue) +
              (el.detail && !t.compact ? t.size(TEXT.resultDetail) : 0)) *
              1.25,
          ),
        ) + 32
      );
    case "counter":
      return Math.ceil(t.size(TEXT.counterValue) * 1.25) + 20;
    case "split-tree":
      return el.levels.length * (sizes.splitRow(t) + SPLIT_ROW_GAP) - SPLIT_ROW_GAP;
    default:
      return 0;
  }
}

type Row = ItemRowElement | BarRowElement;
const lengthOf = (row: Row) => (row.type === "item-row" ? row.items.length : row.bars.length);

export function layoutScene(elements: readonly Element[], text: TextMetrics = textMetrics()): SceneLayout {
  const t = text;
  const bottom = elements.filter((el) => bottomHeight(el, t) > 0);
  const stack =
    bottom.reduce((sum, el) => sum + bottomHeight(el, t), 0) + BOTTOM_GAP * Math.max(0, bottom.length - 1);
  const bottomTop = Math.min(BOTTOM_TOP, VIDEO_HEIGHT - BOTTOM_MARGIN - stack);
  const heapRegion = { ...HEAP_TREE, bottom: bottomTop + 5 };

  const rows = elements.filter((el): el is Row => el.type === "item-row" || el.type === "bar-row");
  const layouts: Record<string, RowLayout> = {};
  const slot = (BAND_BOTTOM - BAND_TOP) / rows.length;
  const hasCounts = elements.some((el) => el.type === "count-array");
  const hasHeap = elements.some((el) => el.type === "heap-tree");
  const rowsWith = (type: Element["type"]) =>
    new Set(elements.flatMap((el) => (el.type === type && "rowId" in el ? [el.rowId] : [])));
  const heldRows = rowsWith("held-value");
  const pivotRows = rowsWith("partition");
  const bufferRows = rowsWith("merge-buffer");
  const pointerRows = new Set(
    elements.flatMap((el) => (el.type === "pointer" && el.placement === "below" ? [el.rowId] : [])),
  );
  const groupsOf = new Map(
    elements.flatMap((el) => (el.type === "segments" ? [[el.rowId, el.groups] as const] : [])),
  );

  rows.forEach((row, r) => {
    const n = lengthOf(row);
    const single = rows.length === 1;
    const soloBars = row.type === "bar-row" && single;
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

    // Stack everything under the row upward from the bottom stack: brackets, pointers, then a panel.
    const bracket = groupsOf.has(row.id) ? BRACKET_SPACE : 0;
    const pointers = pointerRows.has(row.id) ? sizes.pointer(t) + 8 : 0;
    const panel = bufferRows.has(row.id)
      ? sizes.cell(t) + sizes.marker(t) + 8
      : hasCounts && soloBars
        ? sizes.countKeys(t) + sizes.cell(t) + sizes.marker(t) + 8
        : 0;
    const lowest = bottomTop - 6 - panel - pointers - bracket - 8;

    let top: number;
    let cardHeight: number;
    let strip = 0;
    if (heap) {
      top = HEAP_BARS.top;
      cardHeight = Math.min(HEAP_BARS.height, lowest - top);
    } else if (soloBars) {
      strip = heldRows.has(row.id)
        ? sizes.heldCard(t) + 10
        : pivotRows.has(row.id)
          ? sizes.pivotTag(t) + 14
          : 0;
      const bandTop = t.compact ? COMPACT_BAR_TOP : BAR_TOP;
      top = bandTop + strip;
      cardHeight = Math.min(bandTop + BAR_HEIGHT, lowest) - top;
    } else if (single) {
      cardHeight = CARD_HEIGHT;
      top = Math.min(BAND_TOP + (BAND_BOTTOM - BAND_TOP - CARD_HEIGHT) / 2 - 20, lowest - cardHeight);
    } else {
      cardHeight = Math.min(CARD_HEIGHT, slot - 70);
      top = BAND_TOP + r * slot + (slot - cardHeight) / 2;
    }
    const pointerTop = top + cardHeight + 8 + bracket;
    layouts[row.id] = {
      rowId: row.id,
      top,
      cardWidth,
      cardHeight,
      lefts,
      centers: lefts.map((l) => l + cardWidth / 2),
      reservedTop: top - strip,
      pointerTop,
      panelTop: pointerTop + pointers,
      rightLimit: heap ? heapRegion.left - 10 : VIDEO_WIDTH - 16,
    };
  });
  return { rows: layouts, bottomTop, heapRegion };
}

/** Row geometry only (see `layoutScene`). */
export function layoutRows(elements: readonly Element[], text?: TextMetrics): Record<string, RowLayout> {
  return layoutScene(elements, text).rows;
}

export const CANVAS = { width: VIDEO_WIDTH, height: VIDEO_HEIGHT };
