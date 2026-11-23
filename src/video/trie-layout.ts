import type { TrieElement, TrieNode } from "@/lib/storyboard";

import type { Box, LabelBox } from "./greedy-layout";
import { TEXT, type TextMetrics } from "./text";

/** The id a missing child's stub takes in the layout (it's never a real node). */
export const MISSING = -1;

export type TrieShape = {
  nodeSize: number;
  /** Center of a node (live, pruned, or the missing stub, `MISSING`). */
  center: (id: number) => { x: number; y: number } | undefined;
  /** A node's note ("re"), right of it; none on a phone-sized player or without room. */
  note: (id: number) => LabelBox | undefined;
  /** How much more height the trie needs than it got (the bottom stack moves down by this much). */
  overflow: number;
  /** The narrowest gap between neighbors on one level (for fit checks). */
  pitch: number;
  region: Box;
};

/**
 * A trie laid out top-down: the root at the top, one level per letter, children in creation order. Leaves (counting
 * pruned nodes and the missing stub, so nothing moves when they appear) are spread evenly across the region and each
 * parent is centered over its children. Nodes are as large as their letters need, levels as far apart as the room
 * allows up to a cap. Pure, so tests check the same boxes the component draws.
 */
export function layoutTrie(el: TrieElement, t: TextMetrics, region: Box): TrieShape {
  const letter = t.size(TEXT.trieLetter);
  const noteSize = t.size(TEXT.trieNote);
  const nodeSize = letter + 22;
  const all: TrieNode[] = [
    ...el.nodes,
    ...(el.pruned ?? []).filter((p) => !el.nodes.some((n) => n.id === p.id)),
  ];
  if (el.missing) all.push({ id: MISSING, parent: el.missing.parent, letter: el.missing.letter, end: false });
  const kids = new Map<number, TrieNode[]>();
  for (const n of all) if (n.parent !== null) kids.set(n.parent, [...(kids.get(n.parent) ?? []), n]);
  // Children in creation order (ids grow as nodes are created); the stub last.
  for (const list of kids.values())
    list.sort((a, b) => (a.id === MISSING ? 1 : b.id === MISSING ? -1 : a.id - b.id));

  const depth = new Map<number, number>([[0, 0]]);
  const leaves: number[] = [];
  const walk = (id: number) => {
    const children = kids.get(id) ?? [];
    if (children.length === 0) leaves.push(id);
    for (const c of children) {
      depth.set(c.id, depth.get(id)! + 1);
      walk(c.id);
    }
  };
  walk(0);
  const maxDepth = Math.max(...depth.values());
  // Leaves no farther apart than a few nodes' widths, the tree centered: a small trie stays compact.
  const pitch = Math.min(region.w / Math.max(1, leaves.length), nodeSize * 2.6);
  const left = region.x + (region.w - pitch * leaves.length) / 2;
  const x = new Map<number, number>();
  leaves.forEach((id, k) => x.set(id, left + (k + 0.5) * pitch));
  const place = (id: number): number => {
    const children = kids.get(id) ?? [];
    if (children.length === 0) return x.get(id)!;
    const xs = children.map((c) => place(c.id));
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    x.set(id, mid);
    return mid;
  };
  place(0);
  // Edges stay visible even when levels pack tight on a phone.
  const minGap = nodeSize + (t.compact ? 4 : 8);
  const idealGap = nodeSize * 1.7;
  const levelGap =
    maxDepth === 0 ? 0 : Math.max(minGap, Math.min(idealGap, (region.h - nodeSize) / maxDepth));
  // Measured against the ideal spacing, so the bottom stack moves down when it can and levels breathe.
  const overflow = Math.max(0, nodeSize + maxDepth * Math.max(levelGap, idealGap) - region.h);
  const center = (id: number) =>
    x.has(id) ? { x: x.get(id)!, y: region.y + nodeSize / 2 + depth.get(id)! * levelGap } : undefined;
  const note = (id: number): LabelBox | undefined => {
    const n = el.nodes.find((m) => m.id === id);
    const c = center(id);
    if (!n?.note || !c || t.compact) return undefined;
    const w = t.width(n.note, noteSize, "mono") + 8;
    const left = c.x + nodeSize / 2 + 6;
    // Only when it stays clear of the next node on the right at that depth.
    const rightNeighbor = [...x.entries()]
      .filter(([other]) => other !== id && depth.get(other) === depth.get(id) && x.get(other)! > c.x)
      .map(([, ox]) => ox)
      .sort((a, b) => a - b)[0];
    if (rightNeighbor !== undefined && left + w > rightNeighbor - nodeSize / 2 - 4) return undefined;
    if (left + w > region.x + region.w + 40) return undefined;
    return { text: n.note, x: left, y: c.y - (noteSize + 6) / 2, w, h: noteSize + 6 };
  };
  return { nodeSize, center, note, overflow, pitch, region };
}
