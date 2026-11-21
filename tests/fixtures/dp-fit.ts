import type { Element } from "@/lib/storyboard";
import { layoutScene } from "@/video/layout";
import { TEXT, type TextMetrics } from "@/video/text";

/**
 * Everything that can go wrong drawing a DP scene at this player size: values or headers wider than their cells,
 * the table off the stage, under the caption (or the input strip), or in the bottom stack, a staircase or street too
 * short to read, and a house's cash wider than the house.
 */
export function dpProblems(elements: readonly Element[], t: TextMetrics): string[] {
  const el = elements.find((e) => e.type === "dp-table");
  if (el?.type !== "dp-table") return [];
  const { dp, rows, bottomTop } = layoutScene(elements, t);
  if (!dp) return ["table has no layout"];
  const problems: string[] = [];
  const captionBottom = 70 + 2 * Math.ceil(t.size(TEXT.caption) * 1.25);
  const above = Math.max(captionBottom, ...Object.values(rows).map((r) => r.top + r.cardHeight));
  for (const v of el.cells.flat())
    if (v !== null && !t.fits(String(v), t.size(TEXT.dpValue), dp.cellWidth - 10, "mono"))
      problems.push(`value ${v} is wider than its cell (${Math.round(dp.cellWidth)}px)`);
  for (const h of el.colHeaders ?? [])
    if (!t.fits(h, t.size(TEXT.dpHeader), dp.pitch - 4, "mono"))
      problems.push(`column header ${h} is too wide`);
  if (dp.colX(0) - 4 < 0 || dp.colX(el.cols - 1) + dp.cellWidth > 1280)
    problems.push("the table runs off the stage");
  const first = el.rows === 1 ? dp.arcTop : dp.colHeaderTop;
  if (first < above) problems.push("the table runs into what's above it");
  const last =
    el.rows === 1 ? dp.colHeaderTop + t.size(TEXT.dpHeader) * 1.2 : dp.rowY(el.rows - 1) + dp.cellHeight;
  if (last > bottomTop + 2) problems.push("the table runs into the bottom stack");
  if (dp.cellHeight < t.size(TEXT.dpValue) + 8) problems.push("cells are too short");
  const story = elements.find((e) => e.type === "staircase" || e.type === "house-row");
  if (story) {
    if (!dp.story) problems.push("the story has no room");
    else if (dp.story.bottom - dp.story.top < 120)
      problems.push(`the story is too short (${Math.round(dp.story.bottom - dp.story.top)}px)`);
    else if (dp.story.top < above) problems.push("the story runs into the caption");
    if (story.type === "house-row")
      for (const cash of story.money)
        if (!t.fits(`${story.unit}${cash}`, t.size(TEXT.houseCash), Math.min(dp.cellWidth, 120) - 10, "mono"))
          problems.push(`house cash ${cash} is wider than its house`);
  }
  return problems;
}
