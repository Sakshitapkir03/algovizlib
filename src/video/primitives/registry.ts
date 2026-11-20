import type { ComponentType } from "react";

import type { ElementOf, ElementType } from "@/lib/storyboard";

import { BarRow } from "./BarRow";
import { Callout } from "./Callout";
import { CountArray } from "./CountArray";
import { Counter } from "./Counter";
import { Deque } from "./Deque";
import { Equation } from "./Equation";
import { FreqTable } from "./FreqTable";
import { HeapTree } from "./HeapTree";
import { HeldValue } from "./HeldValue";
import { Highlight } from "./Highlight";
import { ItemRow } from "./ItemRow";
import { MergeBuffer } from "./MergeBuffer";
import { Partition } from "./Partition";
import { Pointer } from "./Pointer";
import { Result } from "./Result";
import { Segments } from "./Segments";
import { SortedRegion } from "./SortedRegion";
import { SplitTree } from "./SplitTree";
import { Window } from "./Window";

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
  // Drawn behind the bars it marks.
  "sorted-region": { component: SortedRegion, slot: "canvas", layer: -1 },
  "count-array": { component: CountArray, slot: "canvas", layer: 0 },
  "held-value": { component: HeldValue, slot: "canvas", layer: 2 },
  // Behind the bars: the active group's band; the brackets sit under the baseline.
  segments: { component: Segments, slot: "canvas", layer: -1 },
  "merge-buffer": { component: MergeBuffer, slot: "canvas", layer: 0 },
  // Over the bars, so it can dim the ones outside the range; under highlights and pointers.
  partition: { component: Partition, slot: "canvas", layer: 0.5 },
  "heap-tree": { component: HeapTree, slot: "canvas", layer: 0 },
  "split-tree": { component: SplitTree, slot: "bottom", layer: 0 },
  counter: { component: Counter, slot: "bottom", layer: 0 },
  // Its band sits behind the cards; the bracket and label above them.
  window: { component: Window, slot: "canvas", layer: -1 },
  "freq-table": { component: FreqTable, slot: "bottom", layer: 0 },
  deque: { component: Deque, slot: "bottom", layer: 0 },
  highlight: { component: Highlight, slot: "canvas", layer: 1 },
  pointer: { component: Pointer, slot: "canvas", layer: 2 },
  callout: { component: Callout, slot: "canvas", layer: 3 },
  equation: { component: Equation, slot: "bottom", layer: 0 },
  result: { component: Result, slot: "bottom", layer: 0 },
};
