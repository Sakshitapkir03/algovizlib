import type { Element } from "@/lib/storyboard";
import { layoutScene } from "@/video/layout";
import {
  chartMs,
  layoutDataTable,
  layoutMetrics,
  MIN_SEQUENCE_ROWS,
  sequenceLabelRoom,
  SYSTEM_MARGIN,
  tokenSize,
} from "@/video/system-layout";
import { TEXT, type TextMetrics } from "@/video/text";

const STAGE = 1280;

/**
 * Everything that can go wrong drawing a system design scene at this player size: a component's label wider than
 * its box, boxes or notes running into each other or the bottom stack, a token wider than its link, too few sequence
 * rows to follow the replay, the current row out of view or its label not fitting its arrow, a note running off the
 * stage, and tables or metrics wider than the stage.
 */
export function systemProblems(
  elements: readonly Element[],
  t: TextMetrics,
  type: Element["type"],
): string[] {
  const { system, sequence, load, bottomTop } = layoutScene(elements, t);
  const problems: string[] = [];
  const fail = (what: string) => problems.push(what);
  for (const el of elements) {
    if (el.type !== type) continue;
    switch (el.type) {
      case "system-diagram": {
        if (!system) return ["system diagram has no layout"];
        const labelSize = t.size(TEXT.systemLabel);
        for (const n of el.nodes) {
          const box = system.box(n.id)!;
          if (!t.fits(n.label, labelSize, box.w - 20)) fail(`component "${n.label}" is wider than its box`);
          if (box.x < 0 || box.x + box.w > STAGE) fail(`component "${n.label}" runs off the stage`);
          const badge = system.badge(n.id);
          const bottom = badge ? badge.y + badge.h : box.y + box.h;
          if (bottom > bottomTop - 4) fail(`component "${n.label}" runs into the bottom stack`);
          if (badge && (badge.x < 0 || badge.x + badge.w > STAGE))
            fail(`note "${badge.text}" runs off the stage`);
          if (badge && badge.w > box.w + 120) fail(`note "${badge.text}" is much wider than its box`);
        }
        for (const tok of el.tokens) {
          const seg = system.edge(tok.from, tok.to)!;
          const len = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
          const pill = tokenSize(tok.status === "lost" ? `✕ ${tok.label}` : tok.label, t);
          // Horizontal links carry the pill along them; vertical ones only need its height.
          const along = Math.abs(seg.b.x - seg.a.x) > Math.abs(seg.b.y - seg.a.y) ? pill.w : pill.h;
          if (along > len + 40) fail(`message "${tok.label}" is wider than its link`);
        }
        break;
      }
      case "sequence": {
        if (!sequence) return ["sequence has no layout"];
        const laneSize = t.size(TEXT.seqLane);
        const pitch = sequence.region.w / el.lanes.length;
        for (const lane of el.lanes)
          if (!t.fits(lane.label, laneSize, pitch - 28))
            fail(`lane "${lane.label}" is wider than its column`);
        if (sequence.visible.length < Math.min(MIN_SEQUENCE_ROWS, el.rows.length))
          fail(`only ${sequence.visible.length} sequence rows fit`);
        const last = sequence.visible.at(-1);
        if (last && last.y + sequence.pitch / 2 > bottomTop + 2)
          fail("the sequence runs into the bottom stack");
        if (el.current && !sequence.visible.some((v) => v.row.id === el.current))
          fail(`the current row (${el.current}) is out of view`);
        for (const { row, y } of sequence.visible) {
          if (row.kind === "message") {
            // On a phone-sized player a label that doesn't fit is hidden (the caption names the message).
            if (
              !t.compact &&
              row.id === el.current &&
              !t.fits(row.label, t.size(TEXT.seqLabel), sequenceLabelRoom(sequence, row), "mono")
            )
              fail(`message "${row.label}" doesn't fit its arrow`);
          } else {
            const pill = sequence.notePill(row, y);
            if (pill.x < 4 || pill.x + pill.w > STAGE - 4) fail(`note "${row.text}" runs off the stage`);
          }
        }
        break;
      }
      case "load-chart": {
        if (!load) return ["load chart has no layout"];
        if (load.barBottom - load.barTop < 80) fail("the load chart's bars have no room to grow");
        if (load.labelY + load.rowH.label > bottomTop + 2) fail("the load chart runs into the bottom stack");
        for (const g of load.groups)
          if (!t.fits(g.label, t.size(TEXT.chartGroup), g.x1 - g.x0 - 8))
            fail(`group "${g.label}" is wider than its columns`);
        el.windows.forEach((w, k) => {
          const label = `${w.label}${el.labelUnit ?? "/s"}`;
          if (!t.fits(label, t.size(TEXT.chartLabel), load.pitch - 6, "mono"))
            fail(`load label "${label}" is wider than its column`);
          if (!load.shows(k) || el.chips === false) return;
          const chip = load.chip(k, `▲ ${chartMs(w.p99)}`);
          if (!t.fits(`▲ ${chartMs(w.p99)}`, t.size(TEXT.chartChip), chip.w - 16, "mono"))
            fail(`p99 "${chartMs(w.p99)}" is wider than its column`);
          if (chip.x < 4 || chip.x + chip.w > STAGE - 4) fail(`p99 "${chartMs(w.p99)}" runs off the stage`);
        });
        break;
      }
      case "data-table": {
        const shape = layoutDataTable(el, t);
        if (shape.width > STAGE - SYSTEM_MARGIN)
          fail(`the tables are wider than the stage (${Math.round(shape.width)}px)`);
        break;
      }
      case "metrics": {
        const shape = layoutMetrics(el, t);
        if (shape.width > STAGE - SYSTEM_MARGIN)
          fail(`the metrics are wider than the stage (${Math.round(shape.width)}px)`);
        break;
      }
      default:
        break;
    }
  }
  return problems;
}
