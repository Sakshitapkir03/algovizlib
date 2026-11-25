import type {
  DataTableElement,
  LoadChartElement,
  MetricsElement,
  SequenceElement,
  SequenceRow,
  SystemDiagramElement,
} from "@/lib/storyboard";

import type { Box } from "./greedy-layout";
import { TEXT, type TextMetrics } from "./text";

/**
 * Geometry for the system design primitives, built apart from everything else (no DSA layout changes): the system
 * diagram and the sequence view each take the stage between the caption and the bottom stack; data tables and metrics
 * sit in the bottom stack. Pure, so the components, the layout's room math, and the phone-width fit checks all use the
 * same numbers.
 */

const MARGIN = 64;
export type Point = { x: number; y: number };

// --- System diagram ----------------------------------------------------------------------------------------------

export type SystemShape = {
  box: (id: string) => (Box & { cx: number; cy: number }) | undefined;
  /** The straight segment between two boxes' borders, from `from` toward `to`. */
  edge: (from: string, to: string) => { a: Point; b: Point } | undefined;
  /** The note under a box ("charging"); none on a phone-sized player. */
  badge: (id: string) => (Box & { text: string }) | undefined;
  boxHeight: number;
  /** How much more height the diagram needs than it got (the bottom stack moves down by this much). */
  overflow: number;
};

const SYSTEM = { maxBox: 260, gap: 56, idealRowGap: 90 };

export const systemBadgeRoom = (t: TextMetrics) => (t.compact ? 0 : t.size(TEXT.systemBadge) + 18);

export function layoutSystem(el: SystemDiagramElement, t: TextMetrics, region: Box): SystemShape {
  const cols = Math.max(...el.nodes.map((n) => n.x)) + 1;
  const rows = Math.max(...el.nodes.map((n) => n.y)) + 1;
  const labelSize = t.size(TEXT.systemLabel);
  const colPitch = region.w / cols;
  const boxW = Math.min(SYSTEM.maxBox, colPitch - SYSTEM.gap);
  const boxH = Math.ceil(labelSize * 1.25) + 34;
  const badge = systemBadgeRoom(t);
  const rowSpan = boxH + badge;
  const need = rows * rowSpan + (rows - 1) * 40;
  const rowGap =
    rows > 1 ? Math.min(SYSTEM.idealRowGap, Math.max(40, (region.h - rows * rowSpan) / (rows - 1))) : 0;
  const total = rows * rowSpan + (rows - 1) * rowGap;
  const top = region.y + Math.max(0, (region.h - total) / 2);
  const boxes = new Map(
    el.nodes.map((n) => {
      const cx = region.x + (n.x + 0.5) * colPitch;
      const y = top + n.y * (rowSpan + rowGap);
      return [n.id, { x: cx - boxW / 2, y, w: boxW, h: boxH, cx, cy: y + boxH / 2 }];
    }),
  );
  const badgeSize = t.size(TEXT.systemBadge);
  return {
    box: (id) => boxes.get(id),
    edge: (from, to) => {
      const a = boxes.get(from);
      const b = boxes.get(to);
      if (!a || !b) return undefined;
      return { a: borderPoint(a, b), b: borderPoint(b, a) };
    },
    badge: (id) => {
      const node = el.nodes.find((n) => n.id === id);
      const b = boxes.get(id);
      if (!node?.badge || !b || t.compact) return undefined;
      const w = t.width(node.badge, badgeSize, "mono") + 20;
      return { x: b.cx - w / 2, y: b.y + b.h + 6, w, h: badgeSize + 10, text: node.badge };
    },
    boxHeight: boxH,
    overflow: Math.max(0, need - region.h),
  };
}

/** Where the line from box `from`'s center toward box `to`'s center leaves `from`'s border. */
function borderPoint(from: Box & { cx: number; cy: number }, to: { cx: number; cy: number }): Point {
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  const sx = dx === 0 ? Infinity : from.w / 2 / Math.abs(dx);
  const sy = dy === 0 ? Infinity : from.h / 2 / Math.abs(dy);
  const s = Math.min(sx, sy);
  return { x: from.cx + dx * s, y: from.cy + dy * s };
}

/** A token's pill: its label on a large player, a dot on a phone-sized one. */
export function tokenSize(label: string, t: TextMetrics): { w: number; h: number; text: string } {
  const size = t.size(TEXT.systemToken);
  if (t.compact) return { w: size + 8, h: size + 8, text: "" };
  return { w: t.width(label, size, "mono") + 20, h: size + 12, text: label };
}

// --- Sequence -----------------------------------------------------------------------------------------------------

export type SequenceShape = {
  lanes: { id: string; label: string; x: number }[];
  /** The lane headers' row. */
  header: { y: number; h: number };
  /** The rows in view, top to bottom. */
  visible: { row: SequenceRow; y: number }[];
  /** Rows scrolled out of view above. */
  hidden: number;
  pitch: number;
  /** Whether a message row shows its label (always the current one; on a phone-sized player only it). */
  showsLabel: (row: SequenceRow) => boolean;
  /** A note's pill, centered on its lane and kept on the stage. */
  notePill: (row: Extract<SequenceRow, { kind: "note" }>, y: number) => Box;
  /** How much more height the sequence needs to show its last rows than it got. */
  overflow: number;
  region: Box;
};

/** At least this many rows (or all of them) must be in view. */
export const MIN_SEQUENCE_ROWS = 4;
/** The layout asks the bottom stack to move down until this many rows fit (as far as it can). */
const IDEAL_SEQUENCE_ROWS = 8;

export const sequencePitch = (t: TextMetrics) =>
  Math.ceil(Math.max(t.size(TEXT.seqLabel), t.size(TEXT.seqNote)) * 1.25) + (t.compact ? 12 : 18);

export function layoutSequence(el: SequenceElement, t: TextMetrics, region: Box): SequenceShape {
  const laneSize = t.size(TEXT.seqLane);
  const headerH = Math.ceil(laneSize * 1.25) + 18;
  const lanePitch = region.w / el.lanes.length;
  const lanes = el.lanes.map((l, i) => ({ ...l, x: region.x + (i + 0.5) * lanePitch }));
  const laneX = new Map(lanes.map((l) => [l.id, l.x]));
  const pitch = sequencePitch(t);
  const rowsTop = region.y + headerH + 10;
  const room = Math.max(0, Math.floor((region.y + region.h - rowsTop) / pitch));
  const want = Math.min(el.rows.length, IDEAL_SEQUENCE_ROWS);
  const overflow = Math.max(0, (want - room) * pitch);
  const cap = Math.max(1, room);
  let end = el.rows.length;
  let start = Math.max(0, end - cap);
  const current = el.rows.findIndex((r) => r.id === el.current);
  if (current >= 0 && current < start) {
    start = current;
    end = Math.min(el.rows.length, start + cap);
  }
  const visible = el.rows.slice(start, end).map((row, k) => ({ row, y: rowsTop + k * pitch + pitch / 2 }));
  const noteSize = t.size(TEXT.seqNote);
  return {
    lanes,
    header: { y: region.y, h: headerH },
    visible,
    hidden: start,
    pitch,
    showsLabel: (row) => row.kind === "message" && (!t.compact || row.id === el.current),
    notePill: (row, y) => {
      const w = t.width(row.text, noteSize) + 28;
      const h = noteSize + 14;
      const cx = laneX.get(row.lane) ?? region.x + region.w / 2;
      const x = Math.min(Math.max(cx - w / 2, region.x - MARGIN / 2), region.x + region.w + MARGIN / 2 - w);
      return { x, y: y - h / 2, w, h };
    },
    overflow,
    region,
  };
}

/** How far along its arrow a message is drawn: a lost one stops at 60%, one still in flight at 50%. */
export const messageReach = (row: Extract<SequenceRow, { kind: "message" }>) =>
  row.status === "lost" ? 0.6 : row.status === "in-flight" ? 0.5 : 1;

/** A message label's center and room: over the part of the arrow that's drawn, minus a little padding. */
export function sequenceLabelSpot(
  shape: SequenceShape,
  row: Extract<SequenceRow, { kind: "message" }>,
): { x: number; room: number } {
  const from = shape.lanes.find((l) => l.id === row.from)?.x ?? 0;
  const to = shape.lanes.find((l) => l.id === row.to)?.x ?? 0;
  const end = from + (to - from) * messageReach(row);
  return { x: (from + end) / 2, room: Math.abs(end - from) - 24 };
}

/** The room a message's label has (see `sequenceLabelSpot`). */
export function sequenceLabelRoom(
  shape: SequenceShape,
  row: Extract<SequenceRow, { kind: "message" }>,
): number {
  return sequenceLabelSpot(shape, row).room;
}

// --- Data tables (bottom stack) ----------------------------------------------------------------------------------

export type DataTableShape = {
  width: number;
  height: number;
  titleH: number;
  headerH: number;
  rowH: number;
  tables: { x: number; w: number; cols: [number, number] }[];
};

const TABLE_GAP = 32;

export function layoutDataTable(el: DataTableElement, t: TextMetrics): DataTableShape {
  const cell = t.size(TEXT.tableCell);
  const title = t.size(TEXT.tableTitle);
  const titleH = Math.ceil(title * 1.25) + 6;
  const headerH = t.compact ? 0 : Math.ceil(t.size(TEXT.tableHeader) * 1.25) + 6;
  const rowH = Math.ceil(cell * 1.25) + 14;
  let x = 0;
  const tables = el.tables.map((table) => {
    const col = (k: 0 | 1) =>
      Math.max(
        t.compact ? 0 : t.width(table.columns[k], t.size(TEXT.tableHeader), "mono"),
        ...table.rows.map((r) => t.width(r.cells[k], cell, "mono")),
        k === 1 && table.rows.length === 0 ? t.width("empty", cell, "mono") : 0,
      ) + 28;
    const cols: [number, number] = [col(0), col(1)];
    const w = Math.max(cols[0] + cols[1], t.width(table.title, title) + 16);
    const placed = { x, w, cols };
    x += w + TABLE_GAP;
    return placed;
  });
  const rows = Math.max(1, ...el.tables.map((tb) => tb.rows.length));
  return { width: x - TABLE_GAP, height: titleH + headerH + rows * rowH, titleH, headerH, rowH, tables };
}

// --- Metrics (bottom stack) --------------------------------------------------------------------------------------

export type MetricsShape = { width: number; height: number; items: { x: number; w: number }[] };

const METRIC_GAP = 18;

export const metricDelta = (delta: number | undefined) =>
  delta === undefined || delta === 0 ? "" : delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;

export function layoutMetrics(el: MetricsElement, t: TextMetrics): MetricsShape {
  const label = t.size(TEXT.metricLabel);
  const value = t.size(TEXT.metricValue);
  let x = 0;
  const items = el.items.map((item) => {
    const delta = metricDelta(item.delta);
    const w =
      t.width(item.label, label) +
      12 +
      t.width(item.value, value, "mono") +
      (delta ? 10 + t.width(delta, label, "mono") : 0) +
      36;
    const placed = { x, w };
    x += w + METRIC_GAP;
    return placed;
  });
  return { width: x - METRIC_GAP, height: Math.ceil(value * 1.25) + 18, items };
}

export const SYSTEM_MARGIN = MARGIN;

// --- Load chart (canvas) -----------------------------------------------------------------------------------------

export type LoadChartShape = {
  columns: { x: number; w: number }[];
  /** The distance between two columns' centers (a chip may use all of it but a small gap). */
  pitch: number;
  groups: { from: number; to: number; x0: number; x1: number; label: string; limit?: number }[];
  /** Top of the group names, the served values, the bars' area, the p99 chips, and the offered labels. */
  groupY: number;
  valueY: number;
  barTop: number;
  barBottom: number;
  chipY: number;
  labelY: number;
  rowH: { group: number; value: number; chip: number; label: number };
  /** The y of a throughput (requests per second) on the bars' scale. */
  y: (rps: number) => number;
  /** Whether a column shows its served value and p99 (all on a large player; on a phone only the current one). */
  shows: (k: number) => boolean;
  /**
   * A column's p99 chip: the column's width on a large player; on a phone (where only the current column shows one)
   * as wide as its text needs, kept on the stage.
   */
  chip: (k: number, text: string) => Box;
  overflow: number;
};

/** `minBars`: below it the chart doesn't fit; `idealBars`: the layout asks the bottom stack to move down until it gets this. */
const CHART = { groupGap: 36, minBars: 90, idealBars: 240, maxBar: 72 };

/** "1.9 s" or "138 ms". */
export const chartMs = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

/** A group's measured limit: the most it served in a saturated window. */
export function groupLimit(
  windows: LoadChartElement["windows"],
  from: number,
  to: number,
): number | undefined {
  const sat = windows.slice(from, to + 1).filter((w) => w.saturated);
  return sat.length ? Math.max(...sat.map((w) => w.served)) : undefined;
}

export function layoutLoadChart(el: LoadChartElement, t: TextMetrics, region: Box): LoadChartShape {
  const groupsRaw: { from: number; to: number; label: string }[] = [];
  el.windows.forEach((w, k) => {
    const last = groupsRaw.at(-1);
    if (last && last.label === w.group) last.to = k;
    else groupsRaw.push({ from: k, to: k, label: w.group });
  });
  const n = el.windows.length;
  const colW = (region.w - (groupsRaw.length - 1) * CHART.groupGap) / n;
  const columns: { x: number; w: number }[] = [];
  const groups: LoadChartShape["groups"] = [];
  let x = region.x;
  for (const g of groupsRaw) {
    const x0 = x;
    for (let k = g.from; k <= g.to; k++) {
      columns.push({ x: x + colW / 2, w: Math.min(CHART.maxBar, colW * 0.55) });
      x += colW;
    }
    groups.push({
      ...g,
      x0,
      x1: x,
      limit: el.limitLine === false ? undefined : groupLimit(el.windows, g.from, g.to),
    });
    x += CHART.groupGap;
  }
  const rowH = {
    group: Math.ceil(t.size(TEXT.chartGroup) * 1.25) + 8,
    value: Math.ceil(t.size(TEXT.chartValue) * 1.25) + 4,
    chip: Math.ceil(t.size(TEXT.chartChip) * 1.25) + 14,
    label: Math.ceil(t.size(TEXT.chartLabel) * 1.25) + 6,
  };
  const groupY = region.y;
  const valueY = groupY + rowH.group;
  const barTop = valueY + rowH.value;
  const fixedBelow = rowH.chip + rowH.label + 8;
  const barBottom = Math.max(barTop + CHART.minBars, region.y + region.h - fixedBelow);
  const overflow = Math.max(0, barTop + CHART.idealBars + fixedBelow - (region.y + region.h));
  const max = Math.max(1, ...el.windows.map((w) => Math.max(w.offered, w.served))) * 1.08;
  return {
    columns,
    pitch: colW,
    groups,
    groupY,
    valueY,
    barTop,
    barBottom,
    chipY: barBottom + 6,
    labelY: barBottom + 6 + rowH.chip + 2,
    rowH,
    y: (v) => barBottom - (v / max) * (barBottom - barTop),
    shows: (k) => !t.compact || k === el.current,
    chip: (k, text) => {
      const need = t.width(text, t.size(TEXT.chartChip), "mono") + 28;
      const w = t.compact ? need : Math.min(colW - 8, need + 40);
      const x = Math.min(Math.max(columns[k].x - w / 2, 8), region.x + region.w + 56 - w);
      return { x, y: barBottom + 6, w, h: rowH.chip - 4 };
    },
    overflow,
  };
}
