import type { BitsElement, Element } from "@/lib/storyboard";
import { headerAt, layoutBits } from "@/video/bits-layout";
import { captionBottom, layoutScene } from "@/video/layout";
import { TEXT, type TextMetrics } from "@/video/text";

/**
 * Fit problems for a scene's bits panel: it's no wider than the stage, every digit and header fits its column, and the
 * bottom stack it sits in stays under the caption.
 */
export function bitsProblems(elements: readonly Element[], t: TextMetrics): string[] {
  const el = elements.find((e): e is BitsElement => e.type === "bits");
  if (!el) return [];
  const problems: string[] = [];
  const shape = layoutBits(el, t);
  if (shape.width > 1280 - 24)
    problems.push(`the bits panel is wider than the stage (${Math.round(shape.width)}px)`);
  if (t.width("1", t.size(TEXT.bitValue), "mono") > shape.cellWidth - 6)
    problems.push("a bit is wider than its cell");
  for (let k = 0; k < el.width; k++)
    if (t.width(headerAt(el, k), t.size(TEXT.bitHeader), "mono") > shape.cellWidth)
      problems.push(`header "${headerAt(el, k)}" is wider than its column`);
  const { bottomTop } = layoutScene(elements, t);
  if (bottomTop < captionBottom(t) + 4) problems.push("the bottom stack climbs into the caption");
  return problems;
}
