import type { Element, TimelineElement } from "@/lib/storyboard";
import { overlaps } from "@/video/greedy-layout";
import { captionBottom, layoutScene } from "@/video/layout";
import type { TextMetrics } from "@/video/text";
import { barText, layoutTimeline } from "@/video/timeline-layout";

/**
 * Fit problems for a scene's timeline: it ends above the bottom stack, its sweep label sits under the caption and on
 * the stage, tick labels don't collide, bar labels stay on the stage and off other bars, and bars on one lane don't
 * overlap (lanes would be unreadable).
 */
export function timelineProblems(elements: readonly Element[], t: TextMetrics): string[] {
  const el = elements.find((e): e is TimelineElement => e.type === "timeline");
  if (!el) return [];
  const problems: string[] = [];
  const { bottomTop } = layoutScene(elements, t);
  const shape = layoutTimeline(el, elements, t, bottomTop);
  if (shape.bottom > bottomTop + 2)
    problems.push(`the timeline runs into the bottom stack (${Math.round(shape.bottom - bottomTop)}px)`);
  if (shape.sweepLabelY < captionBottom(t)) problems.push("the sweep label runs into the caption");
  if (el.sweep) {
    const w = t.width(el.sweep.label, t.size(18), "mono") + 28;
    const x = shape.x(el.sweep.at);
    if (x - w / 2 < 4 || x + w / 2 > 1280 - 4)
      problems.push(`sweep label "${el.sweep.label}" runs off the stage`);
  }
  const ticks = shape.ticks.flatMap((tick) => (tick.label ? [tick.label] : []));
  ticks.forEach((a, k) => {
    const b = ticks[k + 1];
    if (b && a.x + a.w + 4 > b.x) problems.push(`tick labels ${a.text} and ${b.text} collide`);
  });
  for (const bar of el.bars) {
    const box = shape.barBox(bar);
    const label = shape.barLabel({ ...bar, text: barText(bar) });
    if (label && (label.x < 4 || label.x + label.w > 1280 - 4))
      problems.push(`bar label "${label.text}" runs off the stage`);
    for (const other of el.bars) {
      if (other === bar || other.lane !== bar.lane) continue;
      const ob = shape.barBox(other);
      if (overlaps(box, ob)) problems.push(`bars ${bar.id} and ${other.id} overlap on lane ${bar.lane}`);
      if (label && label.x >= box.x + box.w && overlaps(label, ob))
        problems.push(`bar ${bar.id}'s label runs onto bar ${other.id}`);
    }
  }
  return problems;
}
