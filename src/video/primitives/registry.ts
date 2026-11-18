import type { ComponentType } from "react";

import type { ElementOf, ElementType } from "@/lib/storyboard";

import { BarRow } from "./BarRow";
import { Callout } from "./Callout";
import { Equation } from "./Equation";
import { Highlight } from "./Highlight";
import { ItemRow } from "./ItemRow";
import { Pointer } from "./Pointer";
import { Result } from "./Result";

export type PrimitiveDefinition<K extends ElementType> = {
  component: ComponentType<{ element: ElementOf<K> }>;
  /**
   * "canvas": absolutely positioned on the 1280×720 stage (uses row layout).
   * "bottom": stacked in the bottom panel, in storyboard order.
   */
  slot: "canvas" | "bottom";
  /** Paint order within the canvas slot (higher draws on top). */
  layer: number;
};

/**
 * Element type → component. The mapped type makes a missing entry a compile
 * error, so a new primitive can't be added to the schema without a renderer.
 */
export const primitiveRegistry: { [K in ElementType]: PrimitiveDefinition<K> } = {
  "item-row": { component: ItemRow, slot: "canvas", layer: 0 },
  "bar-row": { component: BarRow, slot: "canvas", layer: 0 },
  highlight: { component: Highlight, slot: "canvas", layer: 1 },
  pointer: { component: Pointer, slot: "canvas", layer: 2 },
  callout: { component: Callout, slot: "canvas", layer: 3 },
  equation: { component: Equation, slot: "bottom", layer: 0 },
  result: { component: Result, slot: "bottom", layer: 0 },
};
