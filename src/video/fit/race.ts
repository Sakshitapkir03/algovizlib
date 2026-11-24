import type { Element, LinkedListElement, RaceElement } from "@/lib/storyboard";
import { captionBottom, layoutScene } from "@/video/layout";
import { type LabelBox, layoutRace, overlaps } from "@/video/race-layout";
import type { TextMetrics } from "@/video/text";

/**
 * Fit problems for a scene's race: hop labels stay in the hop strip (under the caption, over the pointers) and on the
 * stage, the two moves' labels don't collide, marker tags fit their node's slot and stay above the bottom stack, and
 * the loop's label never sits on a marker.
 */
export function raceProblems(elements: readonly Element[], t: TextMetrics): string[] {
  const race = elements.find((el): el is RaceElement => el.type === "race");
  const listEl = elements.find((el): el is LinkedListElement => el.type === "linked-list");
  if (!race) return [];
  if (!listEl) return ["a race needs a linked-list"];
  const { list, bottomTop } = layoutScene(elements, t);
  if (!list?.race) return ["the list has no room for a race"];
  const shape = layoutRace(race, listEl, list, t);
  if (!shape) return ["the race has no layout"];
  const problems: string[] = [];
  const onStage = (box: LabelBox, what: string) => {
    if (box.x < 4 || box.x + box.w > 1280 - 4) problems.push(`${what} "${box.text}" runs off the stage`);
  };
  const labels = shape.moves.flatMap((m) => [
    ...(m.label ? [m.label] : []),
    ...(m.refused ? [m.refused] : []),
  ]);
  for (const box of labels) {
    onStage(box, "hop label");
    if (box.y < captionBottom(t)) problems.push(`hop label "${box.text}" runs into the caption`);
    const lane = listEl.nodes[0].lane;
    if (box.y + box.h > list.race.hopBase[lane] + 2)
      problems.push(`hop label "${box.text}" runs into the pointers`);
  }
  for (let a = 0; a < labels.length; a++)
    for (let b = a + 1; b < labels.length; b++)
      if (overlaps(labels[a], labels[b]))
        problems.push(`hop labels "${labels[a].text}" and "${labels[b].text}" overlap`);
  const pitch = list.slotLeft(0, 1) - list.slotLeft(0, 0);
  for (const m of shape.markers) {
    if (!m.tag) continue;
    onStage(m.tag, "marker");
    if (m.tag.w > 2 * pitch) problems.push(`marker "${m.tag.text}" is wider than two slots`);
    for (const o of shape.markers)
      if (o !== m && o.tag && overlaps(o.tag, m.tag))
        problems.push(`markers "${m.tag.text}" and "${o.tag.text}" overlap`);
    if (m.tag.y + m.tag.h > bottomTop) problems.push(`marker "${m.tag.text}" runs into the bottom stack`);
  }
  if (shape.loop?.label && shape.markers.some((m) => m.tag && overlaps(m.tag, shape.loop!.label!)))
    problems.push("the loop label sits on a marker");
  return problems;
}
