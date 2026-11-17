import type { Element, ItemRowElement } from "@/lib/storyboard";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "@/lib/storyboard";

/** Pixel geometry of an item-row on the 1280×720 canvas. */
export type RowLayout = {
  rowId: string;
  top: number;
  cardWidth: number;
  cardHeight: number;
  /** Left x of each card. */
  lefts: number[];
  /** Center x of each card. */
  centers: number[];
};

const SIDE_MARGIN = 64;
const GAP = 16;
const MAX_CARD_WIDTH = 140;
const CARD_HEIGHT = 124;
/** Vertical band the rows share (between the caption and the bottom stack). */
const BAND_TOP = 270;
const BAND_BOTTOM = 470;

export function layoutRows(elements: readonly Element[]): Record<string, RowLayout> {
  const rows = elements.filter((el): el is ItemRowElement => el.type === "item-row");
  const layouts: Record<string, RowLayout> = {};
  const slot = (BAND_BOTTOM - BAND_TOP) / rows.length;

  rows.forEach((row, r) => {
    const n = row.items.length;
    const cardWidth = Math.min(MAX_CARD_WIDTH, (VIDEO_WIDTH - 2 * SIDE_MARGIN - GAP * (n - 1)) / n);
    const total = n * cardWidth + GAP * (n - 1);
    const start = (VIDEO_WIDTH - total) / 2;
    const lefts = row.items.map((_, i) => start + i * (cardWidth + GAP));
    const cardHeight = rows.length > 1 ? Math.min(CARD_HEIGHT, slot - 70) : CARD_HEIGHT;
    const top = BAND_TOP + r * slot + (slot - cardHeight) / 2 - (rows.length > 1 ? 0 : 20);
    layouts[row.id] = {
      rowId: row.id,
      top,
      cardWidth,
      cardHeight,
      lefts,
      centers: lefts.map((l) => l + cardWidth / 2),
    };
  });
  return layouts;
}

export const CANVAS = { width: VIDEO_WIDTH, height: VIDEO_HEIGHT };
