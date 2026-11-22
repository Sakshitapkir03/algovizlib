/** Geometry shared by the linked-list view and what's drawn over it (a race's loop). */

export type Box = { x: number; y: number; w: number; h: number };
type Place = { lane: number; slot: number };

const HEAD = 11;

/**
 * The path of a link from box `a` to box `b`, and where its head points (`[x, y, angle]`). Neighbors in a lane get
 * straight arrows (back to the left neighbor on a lower track); links that skip nodes or point back curve `dip` under
 * the lane; links to another lane are S-curves.
 */
export function listLinkPath(a: Box, aNode: Place, b: Box, bNode: Place, dip: number) {
  const sameLane = aNode.lane === bNode.lane;
  if (sameLane && bNode.slot === aNode.slot + 1) {
    const y = a.y + a.h / 2;
    return { d: `M ${a.x + a.w} ${y} L ${b.x - 2} ${y}`, end: [b.x - 2, y, 0] as const };
  }
  if (sameLane && bNode.slot === aNode.slot - 1) {
    // Back to the neighbor: a straight arrow on a lower track, so it never sits on a forward one.
    const y = a.y + a.h * 0.7;
    return { d: `M ${a.x} ${y} L ${b.x + b.w + 2} ${y}`, end: [b.x + b.w + 2, y, Math.PI] as const };
  }
  if (sameLane) {
    // Backward or skipping: dip under the lane, arriving at the target's bottom.
    const y0 = a.y + a.h;
    const y1 = b.y + b.h + 2;
    const sx = a.x + a.w * (bNode.slot < aNode.slot ? 0.3 : 0.7);
    const ex = b.x + b.w * (bNode.slot < aNode.slot ? 0.7 : 0.3);
    const low = Math.max(y0, y1) + dip;
    return {
      d: `M ${sx} ${y0} C ${sx} ${low}, ${ex} ${low}, ${ex} ${y1}`,
      end: [ex, y1, -Math.PI / 2] as const,
    };
  }
  // Another lane. Ahead of the node: an S-curve into the target's left edge. Behind it (a node just moved into
  // the merged lane still pointing at the rest of its old list): rise out of the right edge and come into the
  // target from below (or above), instead of looping back over itself.
  const [sx, sy] = [a.x + a.w, a.y + a.h / 2];
  if (b.x - 2 > sx + 16) {
    const [ex, ey] = [b.x - 2, b.y + b.h / 2];
    const reach = Math.max(48, Math.abs(ex - sx) / 2);
    return {
      d: `M ${sx} ${sy} C ${sx + reach} ${sy}, ${ex - reach} ${ey}, ${ex} ${ey}`,
      end: [ex, ey, 0] as const,
    };
  }
  const up = b.y < a.y;
  const ex = b.x + b.w * 0.62;
  const ey = up ? b.y + b.h + 2 : b.y - 2;
  const lift = Math.max(40, Math.abs(ey - sy) * 0.45);
  return {
    d: `M ${sx} ${sy} C ${sx + 56} ${sy}, ${ex} ${ey + (up ? lift : -lift)}, ${ex} ${ey}`,
    end: [ex, ey, up ? -Math.PI / 2 : Math.PI / 2] as const,
  };
}

/** A triangle pointing along `angle` (0 = right, -π/2 = up), its tip at (x, y), as SVG polygon points. */
export function arrowHeadPoints([x, y, angle]: readonly [number, number, number], size = HEAD): string {
  return [
    [0, 0],
    [-size, -size * 0.55],
    [-size, size * 0.55],
  ]
    .map(([px, py]) => [
      x + px * Math.cos(angle) - py * Math.sin(angle),
      y + px * Math.sin(angle) + py * Math.cos(angle),
    ])
    .map((pt) => pt.join(","))
    .join(" ");
}
