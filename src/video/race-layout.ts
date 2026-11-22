import type { LinkedListElement, RaceElement } from "@/lib/storyboard";

import { firstFitting } from "./labels";
import type { ListLayout } from "./layout";
import { listLinkPath } from "./list-links";
import { TEXT, type TextMetrics } from "./text";

export type LabelBox = { text: string; x: number; y: number; w: number; h: number };

/** One hop of a move: a curve from one node's top to the next one's, rising to its level. */
export type HopArc = { d: string; end: readonly [number, number, number]; blocked: boolean };

export type RaceMoveShape = {
  pointer: string;
  /** 0 for the first move (slow's, in the accent), 1 for the second (fast's, neutral). */
  order: number;
  arcs: HopArc[];
  /** "+2" over the last hop; "✕" over a refused one (neither on a phone, where the humps show the hops). */
  label?: LabelBox;
  refused?: LabelBox;
  /** The middle of each hop, left to right in hop order. */
  hopXs: number[];
};

export type RaceMarker = {
  kind: "meet" | "entry";
  node: number;
  /** The ring around the node box. */
  ring: { x: number; y: number; w: number; h: number };
  /** Under the lane; none on a phone, where the ring's border carries it (dashed: meet, solid: loop start). */
  tag?: LabelBox;
};

export type RaceShape = {
  moves: RaceMoveShape[];
  markers: RaceMarker[];
  loop?: { d: string; end: readonly [number, number, number]; label?: LabelBox };
};

const RING = 7;

/**
 * Where a race draws over its linked list: hop arcs above the pointers (slow's at the first level, fast's at the
 * second), a "+N" label at the top of each move's last hop, rings and tags for the meeting node and the loop's start
 * (tags in the marker row under the lane), and the loop's closing link, traced over the list's own arrow (labeled
 * "↺ loop" at its lowest point when there's room). Pure, so tests check the same boxes the component draws.
 */
export function layoutRace(
  race: RaceElement,
  listEl: LinkedListElement,
  list: ListLayout,
  t: TextMetrics,
): RaceShape | undefined {
  const geo = list.race;
  if (!geo) return undefined;
  const byId = new Map(listEl.nodes.map((n) => [n.id, n]));
  const box = (id: number) => {
    const n = byId.get(id)!;
    return {
      x: list.slotLeft(n.lane, n.slot),
      y: list.laneTops[n.lane],
      w: list.nodeWidth,
      h: list.nodeHeight,
    };
  };
  const center = (id: number) => box(id).x + list.nodeWidth / 2;
  const pitch = list.slotLeft(0, 1) - list.slotLeft(0, 0);
  const hopSize = t.size(TEXT.hopLabel);
  const markerSize = t.size(TEXT.raceMarker);

  const label = (
    text: string,
    x: number,
    y: number,
    size: number,
    font: "sans" | "mono" = "mono",
  ): LabelBox => {
    const w = t.width(text, size, font) + 10;
    const h = size + 6;
    return { text, x: x - w / 2, y: y - h / 2, w, h };
  };

  const moves = race.moves.map((move, order): RaceMoveShape => {
    const n = byId.get(move.from)!;
    const base = geo.hopBase[n.lane];
    const level = Math.min(order, 1) + 1;
    // A quadratic's apex is halfway to its control point: put the apex at the middle of this level's band.
    const apex = base - (level - 0.5) * geo.hopLevel - 3;
    const control = 2 * apex - base;
    const xOf = (id: number | null, prev: number) => (id === null ? center(prev) + pitch : center(id));
    const stops = [move.from, ...move.path];
    const arcs: HopArc[] = [];
    const xs: number[] = [];
    for (let k = 0; k < move.hops; k++) {
      const a = stops[k];
      const b = k + 1 < stops.length ? stops[k + 1] : move.to;
      const x0 = center(a);
      const x1 = xOf(b, a);
      xs.push((x0 + x1) / 2);
      const angle = Math.atan2(base - control, x1 - (x0 + x1) / 2);
      arcs.push({
        d: `M ${x0} ${base} Q ${(x0 + x1) / 2} ${control}, ${x1} ${base}`,
        end: [x1, base, angle],
        blocked: false,
      });
    }
    let refused: LabelBox | undefined;
    if (move.blocked !== undefined && move.to !== null) {
      const x0 = center(move.to);
      const x1 = center(move.blocked);
      const angle = Math.atan2(base - control, x1 - (x0 + x1) / 2);
      arcs.push({
        d: `M ${x0} ${base} Q ${(x0 + x1) / 2} ${control}, ${x1} ${base}`,
        end: [x1, base, angle],
        blocked: true,
      });
      if (!t.compact) refused = label("✕", (x0 + x1) / 2, apex, hopSize);
    }
    const lastX = xs.at(-1) ?? center(move.from);
    return {
      pointer: move.pointer,
      order,
      arcs,
      label: t.compact ? undefined : label(`+${move.hops}`, lastX, apex, hopSize),
      refused,
      hopXs: xs,
    };
  });
  // When both moves end on the same hop (fast catching slow), their labels would stack: fast's goes over its first
  // hop instead.
  const [first, second] = moves;
  if (first?.label && second?.label && second.hopXs.length > 1) {
    const pad = {
      ...first.label,
      x: first.label.x - 6,
      w: first.label.w + 12,
      y: first.label.y - 6,
      h: first.label.h + 12,
    };
    if (overlaps(pad, second.label))
      second.label = { ...second.label, x: second.hopXs[0] - second.label.w / 2 };
  }

  const markers: RaceMarker[] = [];
  const marker = (kind: "meet" | "entry", node: number, word: string, glyph: string) => {
    const b = box(node);
    const lane = byId.get(node)!.lane;
    // A tag may spread past its slot (the slots beside it hold no tags), but never toward another marked node
    // farther than halfway: centered tags then can't overlap.
    const others = [race.meet, race.entry].filter((id) => id !== undefined && id !== node) as number[];
    const room = Math.min(2 * pitch - 16, ...others.map((id) => Math.abs(center(id) - center(node)) - 12));
    const text = firstFitting([`${glyph} ${word}`, glyph], markerSize, room - 10, t, "sans") ?? glyph;
    const tag = t.compact
      ? undefined
      : label(text, b.x + b.w / 2, geo.markerTop[lane] + geo.markerHeight / 2, markerSize, "sans");
    markers.push({
      kind,
      node,
      ring: { x: b.x - RING, y: b.y - RING, w: b.w + 2 * RING, h: b.h + 2 * RING },
      tag,
    });
  };
  if (race.meet !== undefined) marker("meet", race.meet, race.meetLabel, "◎");
  if (race.entry !== undefined) marker("entry", race.entry, race.entryLabel, "✓");
  // Two markers on one node share its tag slot: the loop's start (the answer) wins.
  const shown = markers.filter(
    (m) => !(m.kind === "meet" && markers.some((o) => o.kind === "entry" && o.node === m.node)),
  );

  let loop: RaceShape["loop"];
  if (race.loop) {
    const from = byId.get(race.loop.from)!;
    const to = byId.get(race.loop.to)!;
    const path = listLinkPath(box(from.id), from, box(to.id), to, list.dip);
    // A curve under the lane gets "↺ loop" at its lowest point (the curve reaches 3/4 of its dip there).
    const curved = from.lane === to.lane && Math.abs(from.slot - to.slot) > 1;
    let tag: LabelBox | undefined;
    if (curved && !t.compact) {
      const a = box(from.id);
      const b = box(to.id);
      const sx = a.x + a.w * (to.slot < from.slot ? 0.3 : 0.7);
      const ex = b.x + b.w * (to.slot < from.slot ? 0.7 : 0.3);
      const y = Math.max(a.y + a.h, b.y + b.h + 2) + list.dip * 0.75;
      const candidate = label("↺ loop", (sx + ex) / 2, y, t.size(TEXT.hopLabel) * 0.85, "sans");
      // Never over a marker tag.
      if (!shown.some((m) => m.tag && overlaps(m.tag, candidate))) tag = candidate;
    }
    loop = { d: path.d, end: path.end, label: tag };
  }
  return { moves, markers: shown, loop };
}

export const overlaps = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
