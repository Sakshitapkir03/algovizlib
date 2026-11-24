import type { Element } from "@/lib/storyboard";
import { layoutScene } from "@/video/layout";
import { OPLOG } from "@/video/oplog-layout";
import { TEXT, type TextMetrics } from "@/video/text";

/**
 * Everything that can go wrong drawing a scene's op log at this player size: a column wider than its share of the
 * stage, a call and its output not fitting their row, rows running into the bottom stack, too few rows to follow the
 * sequence, the running call out of view, and the structures beside it (rows, list nodes, stacks) running into it.
 */
export function opLogProblems(elements: readonly Element[], t: TextMetrics): string[] {
  const el = elements.find((e) => e.type === "op-log");
  if (el?.type !== "op-log") return [];
  const { opLog, rows, list, piles, bottomTop } = layoutScene(elements, t);
  if (!opLog) return ["op log has no layout"];
  const problems: string[] = [];
  const size = t.size(TEXT.opCall);
  const width = opLog.right - opLog.left;
  if (width > 1280 * OPLOG.maxShare + 1) problems.push(`the op log is too wide (${Math.round(width)}px)`);
  for (let k = opLog.first; k < opLog.first + opLog.count; k++) {
    const need = t.width(opLog.labels[k], size, "mono") + t.width(opLog.outputs[k], size, "mono") + OPLOG.gap;
    if (need > width - 2 * OPLOG.padX + 1)
      problems.push(`call ${opLog.labels[k]} and its output don't fit their row`);
  }
  if (opLog.rowHeight < size + 8) problems.push("op log rows are too short for their text");
  const lastBottom = opLog.top + opLog.count * (opLog.rowHeight + OPLOG.rowGap) - OPLOG.rowGap;
  if (lastBottom > bottomTop - 4) problems.push("the op log runs into the bottom stack");
  if (opLog.count < Math.min(3, el.calls.length))
    problems.push(`only ${opLog.count} calls fit in the op log`);
  if (el.current !== undefined && (el.current < opLog.first || el.current >= opLog.first + opLog.count))
    problems.push(`the running call (${el.current}) is out of view`);
  // Nothing beside it reaches into the column.
  const clear = opLog.right + 8;
  for (const row of Object.values(rows))
    if (row.lefts.some((x) => x !== undefined && x < clear))
      problems.push(`row "${row.rowId}" runs into the op log`);
  const listEl = elements.find((e) => e.type === "linked-list");
  if (list && listEl?.type === "linked-list")
    for (const node of listEl.nodes)
      if (list.slotLeft(node.lane, node.slot) < clear)
        problems.push(`list node ${node.value} runs into the op log`);
  for (const [id, pile] of Object.entries(piles ?? {}))
    if (pile.left - 20 < clear) problems.push(`stack "${id}" (or its title) runs into the op log`);
  return problems;
}
