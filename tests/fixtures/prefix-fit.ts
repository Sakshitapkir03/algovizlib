import type { Element, PrefixGridElement, PrefixRowElement } from "@/lib/storyboard";
import { overlaps } from "@/video/greedy-layout";
import { captionBottom, layoutScene } from "@/video/layout";
import { layoutPrefixGrid, layoutPrefixRow } from "@/video/prefix-layout";
import { TEXT, type TextMetrics } from "@/video/text";

/**
 * Fit problems for a scene's prefix rows and prefix grid: every value fits its cell, cells stay on the stage and above
 * the bottom stack, cells of a row don't touch, span labels stay under the caption, on the stage, and apart; a grid's
 * labels stay under the caption and its cells above the bottom stack.
 */
export function prefixProblems(elements: readonly Element[], t: TextMetrics): string[] {
  const problems: string[] = [];
  const { rows, bottomTop } = layoutScene(elements, t);
  const size = t.size(TEXT.prefixValue);
  const prefixRows = elements.filter((el): el is PrefixRowElement => el.type === "prefix-row");
  const labels: { text: string; x: number; y: number; w: number; h: number }[] = [];
  for (const el of prefixRows) {
    const row = rows[el.rowId];
    if (!row) {
      problems.push(`prefix row "${el.id}" has no row`);
      continue;
    }
    const k = prefixRows.filter((r) => r.rowId === el.rowId).indexOf(el);
    const shape = layoutPrefixRow(el, row, k, t);
    shape.cells.forEach((cell, i) => {
      const v = el.values[i];
      if (v !== null && t.width(String(v), size, "mono") > cell.w - 8)
        problems.push(`prefix value ${v} is wider than its cell (${Math.round(cell.w)}px)`);
      if (cell.x < 4 || cell.x + cell.w > 1280 - 4) problems.push(`prefix cell ${i} runs off the stage`);
      if (cell.y + cell.h > bottomTop + 2)
        problems.push(`prefix row "${el.name}" runs into the bottom stack`);
      const next = shape.cells[i + 1];
      if (next && next.x < cell.x + cell.w + 4) problems.push(`prefix cells ${i} and ${i + 1} touch`);
    });
    for (const sp of shape.spans)
      if (sp.label) {
        labels.push(sp.label);
        if (sp.label.y < captionBottom(t))
          problems.push(`span label "${sp.label.text}" runs into the caption`);
        if (sp.label.x < 4 || sp.label.x + sp.label.w > 1280 - 4)
          problems.push(`span label "${sp.label.text}" runs off the stage`);
      }
  }
  for (let a = 0; a < labels.length; a++)
    for (let b = a + 1; b < labels.length; b++)
      if (overlaps(labels[a], labels[b]))
        problems.push(`span labels "${labels[a].text}" and "${labels[b].text}" overlap`);

  const grid = elements.find((el): el is PrefixGridElement => el.type === "prefix-grid");
  if (grid) {
    const shape = layoutPrefixGrid(grid, t, bottomTop);
    const R = grid.matrix.length;
    const C = grid.matrix[0].length;
    for (const v of [...grid.matrix.flat(), ...grid.prefix.flat()])
      if (v !== null && t.width(String(v), size, "mono") > shape.cell - 8)
        problems.push(`grid value ${v} is wider than its cell (${Math.round(shape.cell)}px)`);
    const last = shape.prefixCell(R, C);
    if (last.y + last.h > bottomTop + 2) problems.push("the prefix grid runs into the bottom stack");
    if (shape.matrixCell(0, 0).x < 4 || last.x + last.w > 1280 - 4)
      problems.push("the prefix grid runs off the stage");
    if (shape.prefixLabel.y < captionBottom(t)) problems.push("the grid labels run into the caption");
  }
  return problems;
}
