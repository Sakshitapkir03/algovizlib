import type { Element, TimelineBar, TimelineElement } from "@/lib/storyboard";
import { VIDEO_WIDTH } from "@/lib/storyboard";

import type { Box, LabelBox } from "./greedy-layout";
import { captionBottom } from "./layout";
import { TEXT, type TextMetrics } from "./text";

const SIDE = 40;
/** With a heap, the timeline takes the stage left of this x and the heap the rest. */
export const TIMELINE_SPLIT = 700;
const MAX_LANE = 64;
/** Smallest bar width, so a one-point range ([6, 6]) is still a bar. */
const MIN_BAR = 16;

export type TimelineShape = {
  /** x of an axis value. */
  x: (v: number) => number;
  /** Top of lane `lane`'s bar. */
  laneY: (lane: number) => number;
  barHeight: number;
  /** A bar's box at its own extent and lane (or any extent and lane, for animation). */
  barBox: (bar: Pick<TimelineBar, "start" | "end" | "lane">) => Box;
  /** The bar's "[4, 7]" label: inside the bar, else just right of it, else none. */
  barLabel: (bar: Pick<TimelineBar, "start" | "end" | "lane"> & { text: string }) => LabelBox | undefined;
  /** Lane names (none on a phone-sized player, or without room). */
  laneLabels: LabelBox[];
  /** The axis line, its ticks, and their labels. */
  axisY: number;
  ticks: { v: number; x: number; label?: LabelBox }[];
  /** Where the sweep marker's label sits, and the lanes' vertical span. */
  sweepLabelY: number;
  lanesTop: number;
  lanesBottom: number;
  /** The whole timeline's bottom (under the tick labels). */
  bottom: number;
  /** How much taller it needs to be than the room it got (the bottom stack moves down by this much). */
  overflow: number;
};

/**
 * The timeline's geometry: under the caption, a strip for the sweep marker's label, the lanes (as tall as the room
 * allows, up to a cap; with a heap, left of `TIMELINE_SPLIT`, the heap on the right), and the axis with tick labels. Ticks thin
 * out (every 1, 2, 5, 10) until their labels fit. On a phone-sized player bars are slim and unlabeled. Pure, so
 * tests check the same boxes the component draws.
 */
export function layoutTimeline(
  el: TimelineElement,
  elements: readonly Element[],
  t: TextMetrics,
  bottomTop: number,
): TimelineShape {
  const labelSize = t.size(TEXT.timelineLabel);
  const tickSize = t.size(TEXT.timelineTick);
  const sweepSize = t.size(TEXT.windowLabel);
  const laneSize = t.size(TEXT.laneLabel);
  const withHeap = elements.some((e) => e.type === "heap");
  const top = captionBottom(t) + 6;
  const sweepLabelY = top;
  const lanesTop = top + sweepSize + 14 + 8;
  const axisRoom = tickSize + 22;
  // On a phone-sized player bars are slim and unlabeled: the axis, the equation, and the caption carry the numbers.
  const barHeight = t.compact ? 30 : labelSize + 14;
  const minLane = barHeight + 6;
  const room = bottomTop - 10 - axisRoom - lanesTop;
  const laneHeight = Math.max(minLane, Math.min(MAX_LANE, room / el.lanes));
  const lanesBottom = lanesTop + el.lanes * laneHeight;
  const axisY = lanesBottom + 4;
  const bottom = axisY + axisRoom;
  const overflow = Math.max(0, bottom - (bottomTop - 10));

  const labels = !t.compact && el.laneLabels.length > 0;
  const labelRoom = labels ? Math.max(...el.laneLabels.map((l) => t.width(l, laneSize))) + 16 : 0;
  const left = SIDE + labelRoom + MIN_BAR / 2;
  const right = (withHeap ? TIMELINE_SPLIT : VIDEO_WIDTH - SIDE) - MIN_BAR / 2;
  const x = (v: number) => left + ((v - el.min) / (el.max - el.min)) * (right - left);
  const laneY = (lane: number) => lanesTop + lane * laneHeight + (laneHeight - barHeight) / 2;
  const barBox = (bar: Pick<TimelineBar, "start" | "end" | "lane">): Box => {
    const x0 = x(bar.start);
    const x1 = x(bar.end);
    const w = Math.max(MIN_BAR, x1 - x0);
    return { x: (x0 + x1) / 2 - w / 2, y: laneY(bar.lane), w, h: barHeight };
  };
  // Inside the bar; else beside it (right, then left) where no other bar on its lane is; else none.
  const barLabel = (
    bar: Pick<TimelineBar, "start" | "end" | "lane"> & { text: string },
  ): LabelBox | undefined => {
    if (t.compact) return undefined;
    const box = barBox(bar);
    const w = t.width(bar.text, labelSize, "mono") + 10;
    if (w <= box.w - 4) return { text: bar.text, x: box.x + (box.w - w) / 2, y: box.y, w, h: box.h };
    const free = (x0: number) =>
      x0 >= 6 &&
      x0 + w <= (withHeap ? TIMELINE_SPLIT + 16 : VIDEO_WIDTH - 6) &&
      !el.bars.some((o) => {
        if (o.lane !== bar.lane || (o.start === bar.start && o.end === bar.end)) return false;
        const ob = barBox(o);
        return x0 < ob.x + ob.w + 4 && ob.x - 4 < x0 + w;
      });
    for (const x0 of [box.x + box.w + 6, box.x - 6 - w])
      if (free(x0)) return { text: bar.text, x: x0, y: box.y, w, h: box.h };
    return undefined;
  };
  const laneLabels: LabelBox[] = labels
    ? el.laneLabels.slice(0, el.lanes).map((text, lane) => ({
        text,
        x: SIDE,
        y: laneY(lane) + (barHeight - laneSize - 6) / 2,
        w: labelRoom - 12,
        h: laneSize + 6,
      }))
    : [];

  const widest = t.width(String(el.max), tickSize, "mono");
  const pitch = x(el.min + 1) - x(el.min);
  const every = [1, 2, 5, 10, 20].find((k) => k * pitch >= widest + 10) ?? 50;
  const ticks = [];
  for (let v = el.min; v <= el.max; v++) {
    const tx = x(v);
    const text = String(v);
    const w = t.width(text, tickSize, "mono");
    ticks.push({
      v,
      x: tx,
      ...(v % every === 0 ? { label: { text, x: tx - w / 2, y: axisY + 10, w, h: tickSize + 4 } } : {}),
    });
  }
  return {
    x,
    laneY,
    barHeight,
    barBox,
    barLabel,
    laneLabels,
    axisY,
    ticks,
    sweepLabelY,
    lanesTop,
    lanesBottom,
    bottom,
    overflow,
  };
}

/** The label a bar shows: its range, with a glyph for a removed (✕) or answer (✓) bar. */
export const barText = (bar: TimelineBar) =>
  `${bar.state === "removed" ? "✕ " : bar.state === "result" ? "✓ " : ""}[${bar.start}, ${bar.end}]`;
