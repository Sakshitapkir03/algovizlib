import type { DigraphElement, NetworkEdge } from "@/lib/storyboard";

import type { Box, LabelBox } from "./greedy-layout";
import { TEXT, type TextMetrics } from "./text";

type Point = { x: number; y: number };

/** One edge's drawing: a quadratic curve (straight when the control point is the midpoint), trimmed to the circles. */
export type EdgeShape = {
  start: Point;
  control: Point;
  end: Point;
  /** The curve's middle, where the weight label sits. */
  mid: Point;
  /** The arrowhead's tip direction (unit vector at `end`). */
  dir: Point;
};

export type NetworkShape = {
  nodeSize: number;
  center: (id: number) => Point | undefined;
  edge: (e: Pick<NetworkEdge, "from" | "to">) => EdgeShape | undefined;
  /** A node's badge ("in 2"), up and right of it; abbreviated to its number on a phone-sized player. */
  badge: (id: number) => LabelBox | undefined;
  /** An edge's weight label (with its state's glyph), centered on the curve. */
  weight: (e: NetworkEdge) => LabelBox | undefined;
  /** How much more height the graph needs than it got (the bottom stack moves down by this much). */
  overflow: number;
  region: Box;
};

/** The arrowhead's length; edges end this far before the circle. */
export const ARROW_HEAD = 14;
const MAX_PITCH = 300;

/** What a weight label says: the weight, plus ✓ / ✕ for a relaxation that improved or didn't. */
export const weightText = (e: NetworkEdge) =>
  e.weight === undefined ? "" : `${e.weight}${e.state === "better" ? " ✓" : e.state === "worse" ? " ✕" : ""}`;

/** A badge's text: in full, or just its last word ("in 2" → "2") on a phone-sized player. */
export const badgeText = (badge: string, t: TextMetrics) =>
  t.compact ? (badge.split(" ").at(-1) ?? badge) : badge;

/**
 * A directed graph laid out on the trace's own grid (`x` columns, `y` rows), scaled into `region` and centered.
 * Nodes are circles as large as their labels need; each row of nodes leaves room above it for a badge. Edges run
 * straight between the circles, except: a pair of opposite arrows bows apart; an arrow pointing left (against the
 * columns) arches away from the graph's middle; an arrow that would pass over another node bows around it. Pure, so
 * tests check the same boxes the component draws.
 */
export function layoutNetwork(el: DigraphElement, t: TextMetrics, region: Box): NetworkShape {
  const labelSize = t.size(TEXT.networkLabel);
  const badgeSize = t.size(TEXT.networkBadge);
  const weightSize = t.size(TEXT.networkWeight);
  const widest = Math.max(...el.nodes.map((n) => t.width(n.label, labelSize, "mono")));
  const nodeSize = Math.max(labelSize + 40, widest + 30);
  const r = nodeSize / 2;
  const hasBadges = el.nodes.some((n) => n.badge);
  const badgeH = badgeSize + 8;
  const badgeRoom = hasBadges ? badgeH - r * 0.25 : 0;
  const cols = Math.max(...el.nodes.map((n) => n.x));
  const rows = Math.max(...el.nodes.map((n) => n.y));
  const badgeW = hasBadges
    ? Math.max(...el.nodes.map((n) => (n.badge ? t.width(badgeText(n.badge, t), badgeSize, "mono") + 12 : 0)))
    : 0;
  // Room right of the last column for a badge sticking out.
  const sideRoom = Math.max(0, badgeW - r * 0.5);
  const pitchX = cols > 0 ? Math.min(MAX_PITCH, (region.w - nodeSize - sideRoom) / cols) : 0;
  // Nodes one row apart in a column need room for a node, the badge above the lower one, and an edge's label (when
  // edges have weights).
  const weighted = el.edges.some((e) => e.weight !== undefined);
  const minPitchY = nodeSize + badgeRoom + (weighted ? weightSize + 12 : 16);
  const idealPitchY = Math.max(minPitchY, nodeSize * 2.4);
  const room = region.h - nodeSize - badgeRoom;
  const pitchY = rows > 0 ? Math.max(minPitchY, Math.min(idealPitchY, room / rows)) : 0;
  const overflow = Math.max(0, nodeSize + badgeRoom + rows * pitchY - region.h);
  const width = cols * pitchX + nodeSize + sideRoom;
  const height = rows * pitchY + nodeSize + badgeRoom;
  const left = region.x + (region.w - width) / 2 + r;
  const top = region.y + Math.max(0, (region.h - height) / 2) + badgeRoom + r;

  const centers = new Map(el.nodes.map((n) => [n.id, { x: left + n.x * pitchX, y: top + n.y * pitchY }]));
  const center = (id: number) => centers.get(id);
  const middle = { x: left + (cols * pitchX) / 2, y: top + (rows * pitchY) / 2 };
  const nodeOf = new Map(el.nodes.map((n) => [n.id, n]));

  const edge = (e: Pick<NetworkEdge, "from" | "to">): EdgeShape | undefined => {
    const a = center(e.from);
    const b = center(e.to);
    if (!a || !b) return undefined;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    // Unit normal, on the left of the direction of travel (y grows downward).
    const normal = { x: dy / len, y: -dx / len };
    let bow = 0;
    const reverse = el.directed && el.edges.some((o) => o.from === e.to && o.to === e.from);
    const backward = el.directed && nodeOf.get(e.to)!.x < nodeOf.get(e.from)!.x;
    if (reverse) bow = nodeSize * 0.9;
    else if (backward) {
      // Arch away from the graph's middle: up when the arrow runs above it (or level with it), down when below.
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const away = mid.y <= middle.y + 1 ? -1 : 1;
      bow = Math.max(nodeSize * 1.2, len * 0.35) * Math.sign(normal.y * away || 1);
    }
    // Bow around any other node the curve would cross (the bow is twice the curve's peak).
    for (const n of el.nodes) {
      if (n.id === e.from || n.id === e.to) continue;
      const c = centers.get(n.id)!;
      const along = ((c.x - a.x) * dx + (c.y - a.y) * dy) / (len * len);
      if (along <= 0.05 || along >= 0.95) continue;
      // Where the curve passes at that point: the line plus the bow's bulge there.
      const bulge = 2 * along * (1 - along) * bow;
      const side = (c.x - a.x) * normal.x + (c.y - a.y) * normal.y - bulge;
      const clear = r + 16;
      if (Math.abs(side) < clear) {
        const push = (clear - Math.abs(side) + 4) / (2 * along * (1 - along));
        bow += side >= 0 ? -push : push;
      }
    }
    const control = { x: (a.x + b.x) / 2 + normal.x * bow, y: (a.y + b.y) / 2 + normal.y * bow };
    const toward = (p: Point, q: Point) => {
      const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      return { x: (q.x - p.x) / d, y: (q.y - p.y) / d };
    };
    const da = toward(a, control);
    const db = toward(b, control);
    const tip = el.directed ? r + 3 : r;
    const start = { x: a.x + da.x * r, y: a.y + da.y * r };
    const end = { x: b.x + db.x * tip, y: b.y + db.y * tip };
    const mid = {
      x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x,
      y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y,
    };
    return { start, control, end, mid, dir: { x: -db.x, y: -db.y } };
  };

  const badge = (id: number): LabelBox | undefined => {
    const n = nodeOf.get(id);
    const c = center(id);
    if (!n?.badge || !c) return undefined;
    const text = badgeText(n.badge, t);
    const w = t.width(text, badgeSize, "mono") + 12;
    // Up and right of the node, touching its rim like a tag.
    return { text, x: c.x + r * 0.5, y: c.y - r * 0.25 - badgeH, w, h: badgeH };
  };

  const weight = (e: NetworkEdge): LabelBox | undefined => {
    const text = weightText(e);
    const shape = edge(e);
    if (!text || !shape) return undefined;
    const w = t.width(text, weightSize, "mono") + 14;
    const h = weightSize + 8;
    return { text, x: shape.mid.x - w / 2, y: shape.mid.y - h / 2, w, h };
  };

  return { nodeSize, center, edge, badge, weight, overflow, region };
}
