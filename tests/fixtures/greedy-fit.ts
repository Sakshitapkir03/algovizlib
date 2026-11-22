import type { ChoiceElement, Element, ReachElement } from "@/lib/storyboard";
import { type Box, layoutChoice, layoutReach } from "@/video/greedy-layout";
import { captionBottom, layoutScene } from "@/video/layout";
import type { TextMetrics } from "@/video/text";

/**
 * Fit problems for a scene's greedy primitives: the choice panel's options and reason fit the stage; a reach's jump
 * label stays under the caption and on the stage, its band label on the stage, and its band (with the closed pieces)
 * ends above the pointers and the bottom stack.
 */
export function greedyProblems(elements: readonly Element[], t: TextMetrics): string[] {
  const problems: string[] = [];
  const onStage = (box: Box & { text: string }, what: string) => {
    if (box.x < 4 || box.x + box.w > 1280 - 4) problems.push(`${what} "${box.text}" runs off the stage`);
  };
  const choice = elements.find((el): el is ChoiceElement => el.type === "choice");
  if (choice) {
    const shape = layoutChoice(choice, t);
    if (shape.width > 1280 - 24) problems.push(`the choice "${choice.chosen}" is wider than the stage`);
  }
  const reach = elements.find((el): el is ReachElement => el.type === "reach");
  if (reach) {
    const { rows, bottomTop } = layoutScene(elements, t);
    const row = rows[reach.rowId];
    if (!row) return [...problems, "the reach has no row"];
    const shape = layoutReach(reach, row, t);
    if (shape.jump?.label) {
      onStage(shape.jump.label, "jump label");
      if (shape.jump.label.y < captionBottom(t)) problems.push("the jump label runs into the caption");
    }
    if (row.reservedTop < captionBottom(t)) problems.push("the jump arc runs into the caption");
    if (shape.label) onStage(shape.label, "reach label");
    if (shape.band && !shape.label && reach.value !== undefined)
      problems.push(`the reach label "${reach.value}" has no room`);
    if (shape.cutBottom > row.pointerTop + 2) problems.push("the reach band runs into the pointers");
    if (shape.cutBottom > bottomTop + 2) problems.push("the reach band runs into the bottom stack");
  }
  return problems;
}
