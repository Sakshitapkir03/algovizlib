import { VIDEO_WIDTH as CANVAS_WIDTH, type PointerElement } from "@/lib/storyboard";

import type { RowLayout } from "./layout";
import { TEXT, type TextMetrics } from "./text";

/** Horizontal padding inside a pill label (both sides). */
export const PILL_PADDING = 32;

/** The space a label centered on one card can use without reaching the next card's label. */
export function cardRoom(layout: RowLayout): number {
  return layout.centers.length > 1 ? layout.centers[1] - layout.centers[0] - 8 : 320;
}

/**
 * A pointer's label at its readable size: the authored label if it clears the other pointers on the same side of the
 * row (and the stage edges), else the trace pointer it binds ("i", "left"), else its first letter. `others` are the
 * scene's other pointers; only ones on the same row and side compete for room.
 */
export function pointerLabel(
  element: PointerElement,
  layout: RowLayout,
  text: TextMetrics,
  others: readonly PointerElement[] = [],
): string {
  const size = text.size(TEXT.pointer);
  const x = layout.centers[element.index];
  // Room is symmetric around the pointer: half the distance to each neighbor, and inside the stage.
  const half = Math.min(
    x - 8,
    CANVAS_WIDTH - 8 - x,
    ...others
      // Pointers on the same position stack vertically, so they don't compete for width.
      .filter(
        (o) =>
          o !== element &&
          o.rowId === element.rowId &&
          o.placement === element.placement &&
          o.index !== element.index &&
          // On another lane of a linked list, a pointer is at another height: no competition.
          (layout.tops?.[o.index] ?? 0) === (layout.tops?.[element.index] ?? 0),
      )
      .map((o) => Math.abs(layout.centers[o.index] - x) / 2 - 4),
  );
  const room = 2 * half - PILL_PADDING;
  const candidates = [element.label, element.binds, element.label.slice(0, 1).toUpperCase()];
  return candidates.find((c): c is string => !!c && text.fits(c, size, room)) ?? candidates[2]!;
}

/** First of `candidates` that fits in `room` at `size`, or undefined (the label is dropped). */
export function firstFitting(
  candidates: readonly string[],
  size: number,
  room: number,
  text: TextMetrics,
  font?: "sans" | "mono",
): string | undefined {
  return candidates.find((c) => text.fits(c, size, room, font));
}
