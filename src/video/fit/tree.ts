import type { Element } from "@/lib/storyboard";
import { layoutScene } from "@/video/layout";
import { TEXT, type TextMetrics } from "@/video/text";

/**
 * Everything that can go wrong drawing a scene's binary-tree and call-stack at this player size: values wider than
 * their nodes, levels too close for their edges, nodes overlapping or off the stage, the tree or the stack running
 * into the bottom stack or under the caption, and frames too narrow for their calls.
 */
export function treeProblems(elements: readonly Element[], t: TextMetrics, bottomTop: number): string[] {
  const problems: string[] = [];
  const el = elements.find((e) => e.type === "binary-tree");
  if (el?.type !== "binary-tree") return problems;
  const { tree, stack } = layoutScene(elements, t);
  if (!tree) return ["tree has no layout"];
  const s = tree.nodeSize;
  const valueSize = t.size(TEXT.treeValue);
  for (const node of el.nodes)
    if (!t.fits(String(node.value), valueSize, s - 8, "mono"))
      problems.push(`node value ${node.value} is wider than its node (${Math.round(s)}px)`);
  const levels = new Set(el.nodes.map((n) => tree.depthOf(n.id))).size;
  if (levels > 1 && tree.levelGap < s + 16)
    problems.push(`levels are too close for their edges (${tree.levelGap}px)`);
  const captionBottom = 70 + 2 * Math.ceil(t.size(TEXT.caption) * 1.25);
  for (const node of el.nodes) {
    const c = tree.center(node.id);
    if (c.x - s / 2 < 0 || c.x + s / 2 > 1280) problems.push(`node ${node.value} runs off the stage`);
    if (stack && c.x + s / 2 > stack.left - 8) problems.push(`node ${node.value} runs into the call stack`);
    if (c.y - s / 2 < captionBottom) problems.push(`node ${node.value} starts under the caption`);
    if (c.y + s / 2 > bottomTop + 2) problems.push(`node ${node.value} runs into the bottom stack`);
    for (const other of el.nodes)
      if (
        other.id > node.id &&
        tree.depthOf(other.id) === tree.depthOf(node.id) &&
        Math.abs(tree.center(other.id).x - c.x) < s + 4
      )
        problems.push(`nodes ${node.value} and ${other.value} overlap`);
  }
  const frames = elements.find((e) => e.type === "call-stack");
  if (frames?.type === "call-stack") {
    if (!stack) return [...problems, "call stack has no layout"];
    for (const f of frames.frames)
      if (t.width(f.label, t.size(TEXT.stackLabel), "mono") + 24 > stack.width)
        problems.push(`frame "${f.label}" is wider than the stack`);
    const top = stack.bottom - frames.frames.length * (stack.frameHeight + stack.gap);
    if (top < captionBottom)
      problems.push(`the call stack (${frames.frames.length} frames) runs under the caption`);
    if (stack.bottom > bottomTop + 2) problems.push("the call stack runs into the bottom stack");
  }
  return problems;
}
