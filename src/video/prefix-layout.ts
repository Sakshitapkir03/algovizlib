import type { PrefixGridElement, PrefixRowElement, Rect } from "@/lib/storyboard";
import { VIDEO_WIDTH } from "@/lib/storyboard";

import type { Box, LabelBox } from "./greedy-layout";
import { captionBottom, type RowLayout, sizes } from "./layout";
import { TEXT, type TextMetrics } from "./text";

/** Height of one prefix row's cells, and the gap under each. */
const ROW_GAP = 10;
export const prefixCellHeight = (t: TextMetrics) => t.size(TEXT.prefixValue) + 18;
/** Room under the pointers for `count` prefix rows. */
export const prefixBand = (t: TextMetrics, count: number) => count * (prefixCellHeight(t) + ROW_GAP) + 4;

const TICK = 12;

export type PrefixRowShape = {
  /** One box per boundary, centered on it (cell 0 before the first item, cell n after the last). */
  cells: Box[];
  /** Shown left of cell 0 when there's room (never on a phone-sized player). */
  label?: LabelBox;
  /** Each span: its bracket over the items (edges on the two boundaries), its label, and a guide from each edge down
   * to its cell. Empty spans (from = to) draw nothing. */
  spans: { bracket: Box; label?: LabelBox; from: number; to: number }[];
  /** Where the bracket strip sits (the top of the bracket line). */
  bracketTop: number;
};

/** The x of boundary i of a row: halfway between items i − 1 and i, or half a gap outside the first or last item. */
export function boundaryX(row: RowLayout, i: number): number {
  const n = row.lefts.length;
  const gap = n > 1 ? row.lefts[1] - row.lefts[0] - row.cardWidth : 16;
  if (i === 0) return row.lefts[0] - gap / 2;
  return row.lefts[i - 1] + row.cardWidth + gap / 2;
}

/**
 * Where prefix row number `k` (of the item-row's prefix rows, in scene order) draws: its cells under the pointers,
 * centered on the boundaries, and its spans' brackets above the cards. Pure, so tests check the same boxes.
 */
export function layoutPrefixRow(
  el: PrefixRowElement,
  row: RowLayout,
  k: number,
  t: TextMetrics,
): PrefixRowShape {
  const n = row.lefts.length;
  const size = t.size(TEXT.prefixValue);
  const pitch = n > 1 ? row.lefts[1] - row.lefts[0] : row.cardWidth + 16;
  const widest = Math.max(...el.values.map((v) => (v === null ? 0 : t.width(String(v), size, "mono"))));
  const w = Math.min(pitch - 8, Math.max(48, widest + 18));
  const h = prefixCellHeight(t);
  const top = row.panelTop + k * (h + ROW_GAP);
  const cells = el.values.map((_, i) => ({ x: boundaryX(row, i) - w / 2, y: top, w, h }));
  const labelSize = t.size(TEXT.prefixLabel);
  let label: LabelBox | undefined;
  if (el.label && !t.compact) {
    const lw = t.width(el.label, labelSize) + 8;
    const x = cells[0].x - 10 - lw;
    if (x >= 6) label = { text: el.label, x, y: top + (h - labelSize - 6) / 2, w: lw, h: labelSize + 6 };
  }
  const bracketTop = row.top - sizes.tagRoom(t) - TICK - 4;
  const windowSize = t.size(TEXT.windowLabel);
  const spans = (el.spans ?? [])
    .filter((sp) => sp.to > sp.from)
    .map((sp) => {
      const x0 = boundaryX(row, sp.from);
      const x1 = boundaryX(row, sp.to);
      const text = [el.spanLabel, String(sp.value)].filter(Boolean).join(" ");
      const lw = t.width(text, windowSize, "mono") + 28;
      const lh = windowSize + 14;
      const cx = Math.min(VIDEO_WIDTH - 8 - lw / 2, Math.max(8 + lw / 2, (x0 + x1) / 2));
      return {
        bracket: { x: x0, y: bracketTop, w: x1 - x0, h: TICK },
        label: { text, x: cx - lw / 2, y: bracketTop - lh - 6, w: lw, h: lh },
        from: sp.from,
        to: sp.to,
      };
    });
  return { cells, label, spans, bracketTop };
}

export type PrefixGridShape = {
  cell: number;
  /** Top-left of matrix cell (r, c) and of prefix cell (i, j). */
  matrixCell: (r: number, c: number) => Box;
  prefixCell: (i: number, j: number) => Box;
  /** A matrix rectangle's box, inset so rectangles on the same cells stay apart. */
  rectBox: (r: Rect, inset: number) => Box;
  matrixLabel: LabelBox;
  prefixLabel: LabelBox;
};

const GRID_GAP = 6;

/**
 * A matrix and its prefix grid side by side, between the caption and the bottom stack, as large as the room allows
 * (cells never narrower than their values). Matrix row r lines up with prefix row r + 1, so the prefix grid's 0 row
 * sits above the matrix.
 */
export function layoutPrefixGrid(el: PrefixGridElement, t: TextMetrics, bottomTop: number): PrefixGridShape {
  const R = el.matrix.length;
  const C = el.matrix[0].length;
  const size = t.size(TEXT.prefixValue);
  const labelSize = t.size(TEXT.prefixLabel);
  const labelH = labelSize + 10;
  const top = captionBottom(t) + 8 + labelH;
  const bottom = bottomTop - 12;
  const between = 70;
  const widest = Math.max(
    ...el.matrix.flat().map((v) => t.width(String(v), size, "mono")),
    ...el.prefix.flat().map((v) => (v === null ? 0 : t.width(String(v), size, "mono"))),
  );
  const byHeight = (bottom - top - R * GRID_GAP) / (R + 1);
  const byWidth = (VIDEO_WIDTH - 2 * 40 - between - 2 * C * GRID_GAP) / (2 * C + 1);
  const cell = Math.max(widest + 14, Math.min(110, byHeight, byWidth));
  const pitch = cell + GRID_GAP;
  const width = (2 * C + 1) * pitch - 2 * GRID_GAP + between;
  const left = (VIDEO_WIDTH - width) / 2;
  const prefixLeft = left + C * pitch - GRID_GAP + between;
  const matrixCell = (r: number, c: number): Box => ({
    x: left + c * pitch,
    y: top + (r + 1) * pitch,
    w: cell,
    h: cell,
  });
  const prefixCell = (i: number, j: number): Box => ({
    x: prefixLeft + j * pitch,
    y: top + i * pitch,
    w: cell,
    h: cell,
  });
  const rectBox = (r: Rect, inset: number): Box => {
    const a = matrixCell(r.r1, r.c1);
    const b = matrixCell(r.r2, r.c2);
    return {
      x: a.x - 4 + inset,
      y: a.y - 4 + inset,
      w: b.x + cell - a.x + 8 - 2 * inset,
      h: b.y + cell - a.y + 8 - 2 * inset,
    };
  };
  const tag = (text: string, x: number, w: number): LabelBox => {
    const lw = t.width(text, labelSize) + 8;
    return { text, x: x + (w - lw) / 2, y: top + pitch - labelH - 2, w: lw, h: labelH - 4 };
  };
  return {
    cell,
    matrixCell,
    prefixCell,
    rectBox,
    matrixLabel: tag(el.matrixLabel, left, C * pitch - GRID_GAP),
    prefixLabel: { ...tag(el.prefixLabel, prefixLeft, (C + 1) * pitch - GRID_GAP), y: top - labelH },
  };
}
