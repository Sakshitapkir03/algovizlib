import type { DigraphElement, Element, UnionFindElement } from "@/lib/storyboard";
import type { Box } from "@/video/greedy-layout";
import { captionBottom, layoutScene, POP_OUT } from "@/video/layout";
import { primitiveRegistry } from "@/video/primitives/registry";
import { TEXT, type TextMetrics } from "@/video/text";

const overlaps = (a: Box, b: Box, pad = 0) =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
const square = (c: { x: number; y: number }, size: number): Box => ({
  x: c.x - size / 2,
  y: c.y - size / 2,
  w: size,
  h: size,
});

/**
 * Fit problems for a scene's digraph: nodes on the stage, under the caption and above the bottom stack (and left of
 * a heap), never touching; each label fits its node; badges and weight labels stay on the stage and off other nodes
 * (a badge may overlap its own node's rim); weight labels don't cover each other.
 */
export function networkProblems(elements: readonly Element[], t: TextMetrics): string[] {
  const el = elements.find((e): e is DigraphElement => e.type === "digraph");
  if (!el) return [];
  const layout = layoutScene(elements, t);
  const shape = layout.network;
  if (!shape) return ["the digraph has no layout"];
  const problems: string[] = [];
  const size = shape.nodeSize;
  const boxes = el.nodes.map((n) => ({ n, box: square(shape.center(n.id)!, size) }));
  const heapLeft = Math.min(...(layout.heapPanels ?? []).map((p) => p.left));
  for (const { n, box } of boxes) {
    if (t.width(n.label, t.size(TEXT.networkLabel), "mono") > size - 8)
      problems.push(`node ${n.label}'s label is wider than its node`);
    if (box.x < 4 || box.x + box.w > 1280 - 4) problems.push(`node ${n.label} runs off the stage`);
    if (box.y < captionBottom(t)) problems.push(`node ${n.label} runs into the caption`);
    if (box.y + box.h > layout.bottomTop + 2) problems.push(`node ${n.label} runs into the bottom stack`);
    if (box.x + box.w > heapLeft) problems.push(`node ${n.label} runs into the heap`);
    for (const o of boxes)
      if (o.n.id < n.id && overlaps(o.box, box, 4)) problems.push(`nodes ${o.n.label} and ${n.label} touch`);
  }
  // A heap beside the graph: its popped root steps out to the right and must stay on the stage.
  const heapEl = elements.find((e) => e.type === "heap");
  const panel = layout.heapPanels?.[0];
  if (heapEl?.type === "heap" && heapEl.heaps[0]?.popped && panel) {
    const right = panel.node(0).x + POP_OUT * panel.nodeWidth;
    if (right > 1280 - 4) problems.push(`the popped heap item runs off the stage (${Math.round(right)}px)`);
  }
  const labels: { name: string; box: Box; own?: number }[] = [];
  for (const n of el.nodes) {
    const b = shape.badge(n.id);
    if (b) labels.push({ name: `badge "${b.text}" on ${n.label}`, box: b, own: n.id });
  }
  for (const e of el.edges) {
    const w = shape.weight(e);
    if (w) labels.push({ name: `weight ${w.text} on ${e.from}→${e.to}`, box: w });
  }
  for (const l of labels) {
    if (l.box.x < 4 || l.box.x + l.box.w > 1280 - 4 || l.box.y < captionBottom(t) - 4)
      problems.push(`${l.name} runs off the stage`);
    if (l.box.y + l.box.h > layout.bottomTop + 2) problems.push(`${l.name} runs into the bottom stack`);
    if (l.box.x + l.box.w > heapLeft) problems.push(`${l.name} runs into the heap`);
    for (const { n, box } of boxes)
      if (n.id !== l.own && overlaps(l.box, box)) problems.push(`${l.name} covers node ${n.label}`);
  }
  labels.forEach((a, i) =>
    labels.slice(0, i).forEach((b) => {
      if (overlaps(a.box, b.box)) problems.push(`${b.name} and ${a.name} overlap`);
    }),
  );
  return problems;
}

/**
 * Fit problems for a scene's union-find: in both layouts (before and after the scene's work) every element is on the
 * stage, under the caption and above the bottom stack, never touching another; labels fit; root notes stay on the
 * stage and clear of each other and of other nodes.
 */
export function forestProblems(elements: readonly Element[], t: TextMetrics): string[] {
  const el = elements.find((e): e is UnionFindElement => e.type === "union-find");
  if (!el) return [];
  const layout = layoutScene(elements, t);
  const shape = layout.forest;
  if (!shape) return ["the union-find has no layout"];
  const problems: string[] = [];
  const size = shape.nodeSize;
  // With nothing in the bottom stack, the trees may use the stage down to its bottom margin.
  const bottomSlot = elements.some((e) => primitiveRegistry[e.type].slot === "bottom");
  const limit = bottomSlot ? layout.bottomTop : 720 - 24;
  if (Math.max(...el.labels.map((l) => t.width(l, t.size(TEXT.forestLabel), "mono"))) > size - 8)
    problems.push("a label is wider than its node");
  for (const [when, at] of [
    ["before", shape.before],
    ["after", shape.after],
  ] as const) {
    const boxes = el.labels.map((label, i) => ({ label, box: square(at(i), size) }));
    for (const [i, { label, box }] of boxes.entries()) {
      if (box.x < 4 || box.x + box.w > 1280 - 4) problems.push(`${label} runs off the stage (${when})`);
      if (box.y < captionBottom(t)) problems.push(`${label} runs into the caption (${when})`);
      if (box.y + box.h > limit + 2) problems.push(`${label} runs into the bottom stack (${when})`);
      for (const o of boxes.slice(0, i))
        if (overlaps(o.box, box, 4)) problems.push(`${o.label} and ${label} touch (${when})`);
    }
    for (const row of Object.values(layout.rows))
      for (const { label, box } of boxes)
        if (box.y < row.top + row.cardHeight + 2) problems.push(`${label} runs into the row above (${when})`);
  }
  const notes = el.labels.flatMap((_, i) => {
    const n = shape.note(i);
    return n ? [{ i, n }] : [];
  });
  const after = el.labels.map((_, i) => square(shape.after(i), size));
  for (const { i, n } of notes) {
    if (n.x < 4 || n.x + n.w > 1280 - 4) problems.push(`note "${n.text}" runs off the stage`);
    for (const [j, box] of after.entries())
      if (j !== i && overlaps(n, box)) problems.push(`note "${n.text}" covers ${el.labels[j]}`);
    for (const o of notes)
      if (o.i < i && overlaps(o.n, n))
        problems.push(`notes over ${el.labels[o.i]} and ${el.labels[i]} overlap`);
  }
  return problems;
}
