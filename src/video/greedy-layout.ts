import { VIDEO_WIDTH } from "@/lib/storyboard";
import type { ChoiceElement, ReachElement } from "@/lib/storyboard";

import type { RowLayout } from "./layout";
import { TEXT, type TextMetrics } from "./text";

export type Box = { x: number; y: number; w: number; h: number };
export type LabelBox = Box & { text: string };

/** The choice panel's widest line may use the stage minus this on each side. */
const CHOICE_MARGIN = 40;
const PILL_GAP = 14;

export type ChoiceShape = {
  /** The heading ("greedy choice"); dropped when the options need the whole width. */
  showLabel: boolean;
  /** The options on two lines (✓ over ✕) when they don't fit side by side. */
  stacked: boolean;
  /** The reason line (never on a phone-sized player). */
  showReason: boolean;
  pillHeight: number;
  chosen: string;
  rejected?: string;
  /** Widths of the widest line, the options, and the reason, for fit checks. */
  width: number;
  pillWidths: number[];
  reasonWidth: number;
  height: number;
};

/** How a choice panel lays out at this size: the same math the component and the bottom stack use. */
export function layoutChoice(el: ChoiceElement, t: TextMetrics): ChoiceShape {
  const item = t.size(TEXT.choiceItem);
  const label = t.size(TEXT.panelLabel);
  const reason = t.size(TEXT.choiceReason);
  const chosen = `✓ ${el.chosen}`;
  const rejected = el.rejected ? `✕ ${el.rejected}` : undefined;
  const pill = (s: string) => t.width(s, item, "mono") + 28;
  const pillWidths = [chosen, ...(rejected ? [rejected] : [])].map(pill);
  const max = VIDEO_WIDTH - 2 * CHOICE_MARGIN;
  const side = pillWidths.reduce((a, b) => a + b, 0) + PILL_GAP * (pillWidths.length - 1);
  const labelWidth = t.width(el.label, label) + PILL_GAP;
  const stacked = side > max;
  const options = stacked ? Math.max(...pillWidths) : side;
  const showLabel = !t.compact && labelWidth + options <= max;
  const showReason = el.reason !== undefined && !t.compact;
  const reasonWidth = showReason ? t.width(el.reason!, reason) : 0;
  const pillHeight = item + 18;
  const rows = stacked ? 2 * pillHeight + 8 : pillHeight;
  return {
    showLabel,
    stacked,
    showReason,
    pillHeight,
    chosen,
    rejected,
    width: Math.max((showLabel ? labelWidth : 0) + options, reasonWidth),
    pillWidths,
    reasonWidth,
    height: rows + (showReason ? 8 + Math.ceil(reason * 1.25) : 0),
  };
}

/** Room a reach needs above its cards (the jump arc and its label, over the highlight tags). */
export const reachAbove = (t: TextMetrics) =>
  (t.compact ? 0 : t.size(TEXT.tag) + 12) + ARC_RISE + 6 + (t.compact ? 0 : t.size(TEXT.jumpLabel) + 10);
/** Room a reach needs under its cards (the band and the closed pieces), before the pointers. */
export const reachBelow = (t: TextMetrics) => BAND_GAP + t.size(TEXT.reachLabel) + 12 + 6;

const ARC_RISE = 26;
const BAND_GAP = 6;
const PAD = 6;

export type ReachShape = {
  /** The band under the cards from `from` to `to`, with its label inside or beside it. */
  band?: Box;
  label?: LabelBox;
  /** Closed pieces: a bracket each with its length, and a cut line after it. */
  pieces: { box: Box; label?: LabelBox; cutX: number }[];
  /** The jump: a curve from the current card's top to the target's, rising over the tags. */
  jump?: { d: string; end: readonly [number, number, number]; label?: LabelBox };
  /** Cards past the band, drawn dashed (out of reach). */
  beyond: Box[];
  cutTop: number;
  cutBottom: number;
};

/** Where a reach draws on its row. Pure, so tests check the same boxes the component draws. */
export function layoutReach(el: ReachElement, row: RowLayout, t: TextMetrics): ReachShape {
  const n = row.lefts.length;
  const size = t.size(TEXT.reachLabel);
  const bandTop = row.top + row.cardHeight + BAND_GAP;
  const bandHeight = size + 12;
  const span = (from: number, to: number): Box => ({
    x: row.lefts[from] - PAD,
    y: bandTop,
    w: row.lefts[to] + row.cardWidth + PAD - (row.lefts[from] - PAD),
    h: bandHeight,
  });
  const label = (text: string, cx: number, cy: number, s: number): LabelBox => {
    const w = t.width(text, s, "mono") + 12;
    const h = s + 6;
    return { text, x: cx - w / 2, y: cy - h / 2, w, h };
  };

  let band: Box | undefined;
  let bandLabel: LabelBox | undefined;
  if (el.to >= el.from) {
    band = span(el.from, el.to);
    const words =
      el.value === undefined
        ? []
        : [[el.label, String(el.value)].filter(Boolean).join(" "), String(el.value)];
    const cy = bandTop + bandHeight / 2;
    for (const text of words) {
      const inside = label(text, band.x + band.w / 2, cy, size);
      if (inside.w <= band.w - 8) {
        bandLabel = inside;
        break;
      }
      // Beside the band, on the right, when the stage has room.
      const w = inside.w;
      const beside = { ...inside, x: band.x + band.w + 6 };
      if (beside.x + w <= VIDEO_WIDTH - 8) {
        bandLabel = beside;
        break;
      }
    }
  }

  const pieces = el.pieces.map((p) => {
    const box = span(p.from, p.to);
    const text = String(p.to - p.from + 1);
    const l = label(text, box.x + box.w / 2, bandTop + bandHeight / 2, size);
    const next = p.to + 1 < n ? row.lefts[p.to + 1] : row.lefts[p.to] + row.cardWidth + 2 * PAD;
    return {
      box,
      label: l.w <= box.w - 6 ? l : undefined,
      cutX: (row.lefts[p.to] + row.cardWidth + next) / 2,
    };
  });

  let jump: ReachShape["jump"];
  if (el.jump && el.jump.to !== el.jump.from) {
    const base = row.top - (t.compact ? 0 : t.size(TEXT.tag) + 12) - 4;
    const x0 = row.centers[el.jump.from];
    const x1 = row.centers[el.jump.to];
    const apex = base - ARC_RISE;
    const control = 2 * apex - base;
    const angle = Math.atan2(base - control, x1 - (x0 + x1) / 2);
    const js = t.size(TEXT.jumpLabel);
    jump = {
      d: `M ${x0} ${base} Q ${(x0 + x1) / 2} ${control}, ${x1} ${base}`,
      end: [x1, base, angle],
      label: t.compact ? undefined : label(el.jump.label, (x0 + x1) / 2, apex - 6 - (js + 6) / 2, js),
    };
  }

  const beyond: Box[] = [];
  if (el.dimBeyond)
    for (let i = Math.max(el.to + 1, 0); i < n; i++)
      beyond.push({ x: row.lefts[i], y: row.top, w: row.cardWidth, h: row.cardHeight });

  return {
    band,
    label: bandLabel,
    pieces,
    jump,
    beyond,
    cutTop: row.top - 10,
    cutBottom: bandTop + bandHeight + 4,
  };
}

export const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
