import type { UnionFindElement } from "@/lib/storyboard";

import type { Box, LabelBox } from "./greedy-layout";
import { TEXT, type TextMetrics } from "./text";

type Point = { x: number; y: number };

export type ForestShape = {
  nodeSize: number;
  /** Where each element sits before this scene's work (the union undone, compressed links pointed back). */
  before: (id: number) => Point;
  /** Where each element sits after it. */
  after: (id: number) => Point;
  /** The note over a root ("chief · 3", or "3" on a phone-sized player), in the layout after the work. */
  note: (id: number) => LabelBox | undefined;
  /** How much more height the trees need than they got (the bottom stack moves down by this much). */
  overflow: number;
  region: Box;
};

/** The parents before this scene's work: the union undone, then the compressed links pointed back. */
export function parentsBefore(el: UnionFindElement): number[] {
  const before = [...el.parents];
  if (el.union) before[el.union.child] = el.union.child;
  for (const c of [...(el.compressed ?? [])].reverse()) before[c.node] = c.from;
  return before;
}

/** What a root's note says. */
export const rootNote = (el: UnionFindElement, id: number, t: TextMetrics) => {
  const size = el.sizes?.[id];
  if (t.compact) return size !== undefined ? String(size) : undefined;
  return size !== undefined ? `${el.rootLabel} · ${size}` : el.rootLabel;
};

/**
 * Union-find drawn as trees, roots on top and children under their parent, laid out twice: before and after the
 * scene's work, at the same scale, so elements slide from one to the other. Trees go left to right by their smallest
 * element (so a lone element stays near its number), children in id order; leaves are spread evenly, each parent
 * centered over its children. Every root gets room above it for its note. Pure, so tests check the same boxes the
 * component draws.
 */
export function layoutForest(el: UnionFindElement, t: TextMetrics, region: Box): ForestShape {
  const labelSize = t.size(TEXT.forestLabel);
  const noteSize = t.size(TEXT.forestNote);
  const widest = Math.max(...el.labels.map((l) => t.width(l, labelSize, "mono")));
  const nodeSize = Math.max(labelSize + 36, widest + 28);
  const noteH = noteSize + 8;
  const n = el.labels.length;

  const shape = (parents: number[]) => {
    const rootOf = (i: number) => {
      let x = i;
      while (parents[x] !== x) x = parents[x];
      return x;
    };
    const kids = new Map<number, number[]>();
    for (let i = 0; i < n; i++)
      if (parents[i] !== i) kids.set(parents[i], [...(kids.get(parents[i]) ?? []), i]);
    const roots = [...new Set(Array.from({ length: n }, (_, i) => rootOf(i)))];
    const smallest = (root: number) =>
      Math.min(...Array.from({ length: n }, (_, i) => i).filter((i) => rootOf(i) === root));
    roots.sort((a, b) => smallest(a) - smallest(b));
    const depth = new Array<number>(n).fill(0);
    const leaves: number[] = [];
    const walk = (id: number) => {
      const children = kids.get(id) ?? [];
      if (children.length === 0) leaves.push(id);
      for (const c of children) {
        depth[c] = depth[id] + 1;
        walk(c);
      }
    };
    for (const root of roots) walk(root);
    return { kids, roots, depth, leaves };
  };

  const pre = shape(parentsBefore(el));
  const post = shape(el.parents);
  const levels = Math.max(...pre.depth, ...post.depth);
  const slots = Math.max(pre.leaves.length, post.leaves.length);
  const pitch = Math.min(region.w / Math.max(1, slots), nodeSize * 2.4);
  const minGap = nodeSize + 14;
  const idealGap = nodeSize * 1.9;
  const room = region.h - noteH - nodeSize;
  const levelGap = levels === 0 ? 0 : Math.max(minGap, Math.min(idealGap, room / levels));
  const overflow = Math.max(0, noteH + nodeSize + levels * Math.max(levelGap, idealGap) - region.h);

  // Centered in the region's height when there's room to spare.
  const spare = Math.max(0, room - levels * levelGap) / 2;
  const place = (s: ReturnType<typeof shape>) => {
    const x = new Map<number, number>();
    const start = region.x + (region.w - pitch * s.leaves.length) / 2;
    s.leaves.forEach((id, k) => x.set(id, start + (k + 0.5) * pitch));
    const center = (id: number): number => {
      const children = s.kids.get(id) ?? [];
      if (children.length === 0) return x.get(id)!;
      const xs = children.map(center);
      const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
      x.set(id, mid);
      return mid;
    };
    for (const root of s.roots) center(root);
    return (id: number) => ({
      x: x.get(id)!,
      y: region.y + spare + noteH + nodeSize / 2 + s.depth[id] * levelGap,
    });
  };
  const before = place(pre);
  const after = place(post);
  const note = (id: number): LabelBox | undefined => {
    if (el.parents[id] !== id) return undefined;
    const text = rootNote(el, id, t);
    if (!text) return undefined;
    const c = after(id);
    const w = t.width(text, noteSize, "sans") + 8;
    return { text, x: c.x - w / 2, y: c.y - nodeSize / 2 - noteH, w, h: noteH };
  };
  return { nodeSize, before, after, note, overflow, region };
}
