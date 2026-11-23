import type { Element, TrieElement } from "@/lib/storyboard";
import { captionBottom, layoutScene } from "@/video/layout";
import { TEXT, type TextMetrics } from "@/video/text";
import { MISSING } from "@/video/trie-layout";

/**
 * Fit problems for a scene's trie: nodes on the stage, under the caption and above the bottom stack, never touching
 * a neighbor, each letter fitting its node.
 */
export function trieProblems(elements: readonly Element[], t: TextMetrics): string[] {
  const el = elements.find((e): e is TrieElement => e.type === "trie");
  if (!el) return [];
  const { trie: shape, bottomTop } = layoutScene(elements, t);
  if (!shape) return ["the trie has no layout"];
  const problems: string[] = [];
  const half = shape.nodeSize / 2;
  const ids = [...el.nodes, ...(el.pruned ?? [])].map((n) => n.id).concat(el.missing ? [MISSING] : []);
  const centers = ids.flatMap((id) => {
    const c = shape.center(id);
    return c ? [{ id, ...c }] : [];
  });
  if (t.width("m", t.size(TEXT.trieLetter), "mono") > shape.nodeSize - 8)
    problems.push("a letter is wider than its node");
  for (const c of centers) {
    if (c.x - half < 4 || c.x + half > 1280 - 4) problems.push(`trie node ${c.id} runs off the stage`);
    if (c.y - half < captionBottom(t)) problems.push(`trie node ${c.id} runs into the caption`);
    if (c.y + half > bottomTop + 2) problems.push(`trie node ${c.id} runs into the bottom stack`);
    for (const o of centers)
      if (o.id < c.id && Math.abs(o.y - c.y) < 1 && Math.abs(o.x - c.x) < shape.nodeSize + 4)
        problems.push(`trie nodes ${o.id} and ${c.id} touch`);
  }
  for (const n of el.nodes) {
    const note = shape.note(n.id);
    if (note && note.x + note.w > 1280 - 4) problems.push(`note "${note.text}" runs off the stage`);
  }
  return problems;
}
