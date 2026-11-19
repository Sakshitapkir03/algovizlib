import { z } from "zod";

/**
 * Visual primitives. Each element is one variant of a discriminated union on `type`, in two forms:
 *
 * - **Source** (`elementSourceSchema`): what storyboard files and the model write. When the storyboard is bound to
 *   a trace, state-carrying fields (pointer `index`, equation `terms`/`result`, highlight `indices`, row values…)
 *   may be omitted and are filled in from the scene's trace step by `resolveStoryboard`.
 * - **Resolved** (`elementSchema`): every value present. Renderers and the validator only see this form.
 *
 * To add a primitive: add both schemas here and append them to `elementSchemas` / `elementSourceSchemas`, describe
 * it in `primitive-catalog.ts` (the model reads that), then add a component to `src/video/primitives/registry.ts`.
 * The registry and the catalog are typed so a missing entry is a compile error.
 *
 * Planned (not built yet): "staircase", "house-row", "coin-set", "box-arrow".
 * Sorting adds "sorted-region", "held-value", "count-array", and bar-row `moves`/`empty`.
 */

const nonEmpty = z.string().trim().min(1);
const index = z.number().int().nonnegative();

/** Fields every element shares. */
const baseElement = {
  id: nonEmpty,
  /**
   * When the element appears, as a fraction (0–1) of the scene's duration.
   * Fractions (not frames) so timing survives the switch to audio-driven
   * scene lengths.
   */
  enterAt: z.number().min(0).max(1).default(0),
};

export const itemSchema = z.object({
  label: nonEmpty,
  /** A number, or a short string such as a single character. */
  value: z.union([z.number().finite(), z.string().max(12)]),
  /** Optional secondary line, e.g. an emoji-free descriptor or array index. */
  sublabel: z.string().optional(),
});

const itemRowShape = {
  ...baseElement,
  type: z.literal("item-row"),
  items: z.array(itemSchema).min(1),
  /** Prefix used when rendering values, e.g. "$". */
  unit: z.string().default(""),
};
export const itemRowElementSchema = z.object(itemRowShape);
export const itemRowSourceSchema = z.object({
  ...itemRowShape,
  /** Omit to take values from the trace's row; then `labels` names each item (default `[i]`). */
  items: itemRowShape.items.optional(),
  labels: z.array(nonEmpty).optional(),
});

export const barSchema = z.object({
  label: z.string().optional(),
  value: z.number().finite().nonnegative(),
});

const moveSchema = z.object({ from: index, to: index });

const fillSchema = z.object({ from: index, to: index, level: z.number().finite().nonnegative() });

const barRowShape = {
  ...baseElement,
  type: z.literal("bar-row"),
  /** Vertical bars, e.g. wall heights or terrain. Bottom-aligned on a shared baseline. */
  bars: z.array(barSchema).min(1),
  unit: z.string().default(""),
  /** A container between two bars, shaded up to `level` (e.g. water held between two walls). */
  fill: fillSchema.optional(),
  /** Water standing on top of each bar (same length as `bars`). */
  water: z.array(z.number().finite().nonnegative()).optional(),
  /**
   * Bars that just moved into their slots: each slides from `from` to `to` as the scene starts. A swap is two
   * moves (the bars arc past each other), a shift is one.
   */
  moves: z.array(moveSchema).optional(),
  /** Slots drawn as empty dashed outlines: a lifted value's gap, or output not written yet. */
  empty: z.array(index).optional(),
  /**
   * The value that reaches full height. Defaults to the tallest bar in this scene; a trace that rearranges its array
   * sets it to the largest value it ever holds, so bar heights stay comparable from scene to scene.
   */
  maxValue: z.number().finite().positive().optional(),
};
export const barRowElementSchema = z.object(barRowShape);
export const barRowSourceSchema = z.object({
  ...barRowShape,
  /**
   * Omit to take heights from the trace: the bound step's array (`values`) when the algorithm rearranges it,
   * otherwise the trace's row. `fill`/`water`/`moves`/`empty` default to the bound step's.
   */
  bars: barRowShape.bars.optional(),
  labels: z.array(z.string()).optional(),
});

const sortedRegionShape = {
  ...baseElement,
  type: z.literal("sorted-region"),
  rowId: nonEmpty,
  /** First and last position already in final order (inclusive). */
  from: index,
  to: index,
  label: nonEmpty.max(16).default("sorted"),
};
export const sortedRegionElementSchema = z.object(sortedRegionShape);
export const sortedRegionSourceSchema = z.object({
  ...sortedRegionShape,
  /** Omit both to take the bound step's sorted range. */
  from: index.optional(),
  to: index.optional(),
});

const heldValueShape = {
  ...baseElement,
  type: z.literal("held-value"),
  rowId: nonEmpty,
  /** The value lifted out of the row, drawn above slot `index` (its gap). */
  value: z.number().finite().nonnegative(),
  index,
  label: nonEmpty.max(16).default("holding"),
};
export const heldValueElementSchema = z.object(heldValueShape);
export const heldValueSourceSchema = z.object({
  ...heldValueShape,
  /** Omit both to take the bound step's held value. */
  value: heldValueShape.value.optional(),
  index: index.optional(),
});

const countArrayShape = {
  ...baseElement,
  type: z.literal("count-array"),
  /** The value each cell counts, e.g. [0, 1, 2, 3, 4]. */
  keys: z.array(z.number().finite()).min(1).max(10),
  /** How many times each key has been seen (same length as `keys`). */
  counts: z.array(z.number().int().nonnegative()).min(1).max(10),
  /** The cell that just changed. */
  active: index.optional(),
  label: nonEmpty.max(16).default("count"),
};
export const countArrayElementSchema = z.object(countArrayShape);
export const countArraySourceSchema = z.object({
  ...countArrayShape,
  /** Omit keys/counts (and active) to take the bound step's tally. */
  keys: countArrayShape.keys.optional(),
  counts: countArrayShape.counts.optional(),
});

const pointerShape = {
  ...baseElement,
  type: z.literal("pointer"),
  /** The item-row or bar-row this pointer sits under. */
  rowId: nonEmpty,
  label: nonEmpty,
  index,
  /** If set, the pointer slides from this index to `index` as it enters. */
  fromIndex: index.optional(),
  placement: z.enum(["above", "below"]).default("below"),
  tone: z.enum(["primary", "secondary"]).default("primary"),
  /**
   * Which trace pointer this visualizes (e.g. "left" / "right"). Bound pointers are checked against the scene's
   * trace step; unbound pointers are decorative and not validated.
   */
  binds: z.string().optional(),
};
export const pointerElementSchema = z.object(pointerShape);
export const pointerSourceSchema = z.object({
  ...pointerShape,
  /** Omit when `binds` is set: the position comes from the trace step (and `fromIndex` from the previous one). */
  index: index.optional(),
});

export const highlightStateSchema = z.enum(["active", "rejected", "found"]);

const highlightShape = {
  ...baseElement,
  type: z.literal("highlight"),
  rowId: nonEmpty,
  indices: z.array(index).min(1),
  state: highlightStateSchema,
};
export const highlightElementSchema = z.object(highlightShape);
export const highlightSourceSchema = z.object({
  ...highlightShape,
  /** Omit to use the trace step's items for this state (or the answer, for "found"). */
  indices: highlightShape.indices.optional(),
});

export const calloutElementSchema = z.object({
  ...baseElement,
  type: z.literal("callout"),
  text: nonEmpty,
  /** Anchor to an item. Without an anchor the callout floats at the top. */
  anchor: z.object({ rowId: nonEmpty, index }).optional(),
  speaker: z.string().optional(),
});

export const comparisonOpSchema = z.enum(["<", "=", ">"]);
export const operatorSchema = z.enum(["+", "-", "×"]);
/** How the verdict reads: good news, bad news, or just information. */
export const verdictToneSchema = z.enum(["positive", "negative", "neutral"]);

const equationShape = {
  ...baseElement,
  type: z.literal("equation"),
  terms: z.array(z.number().finite()).min(1),
  /** How the terms combine, left to right. */
  operator: operatorSchema.default("+"),
  result: z.number().finite(),
  comparison: z.object({ op: comparisonOpSchema, target: z.number().finite() }).optional(),
  unit: z.string().default(""),
  /** Short verdict rendered after the equation, e.g. "too high". */
  verdict: z.string().optional(),
  /**
   * Colors the verdict. Bound equations take it from the trace step when the step sets one. Without a tone the
   * comparison sign decides (`<` info, `>` danger, `=` success), which suits "too low / too high / found".
   */
  verdictTone: verdictToneSchema.optional(),
};
export const equationElementSchema = z.object(equationShape);
export const equationSourceSchema = z.object({
  ...equationShape,
  /** Omit terms/result/operator/comparison to take the whole equation from the trace step. */
  terms: equationShape.terms.optional(),
  operator: operatorSchema.optional(),
  result: equationShape.result.optional(),
});

const resultShape = {
  ...baseElement,
  type: z.literal("result"),
  title: nonEmpty,
  value: nonEmpty,
  detail: z.string().optional(),
  /** Item indices that form the answer, checked against the trace. */
  indices: z.array(index).optional(),
  /** This card states the final answer; its `value` must equal the trace's answer display. */
  showsAnswer: z.boolean().default(false),
  tone: z.enum(["success", "info"]).default("success"),
};
export const resultElementSchema = z.object(resultShape);
export const resultSourceSchema = z.object({
  ...resultShape,
  /** Omit with `showsAnswer: true` to display the trace's answer. */
  value: resultShape.value.optional(),
});

export const elementSchemas = [
  itemRowElementSchema,
  barRowElementSchema,
  pointerElementSchema,
  highlightElementSchema,
  calloutElementSchema,
  equationElementSchema,
  resultElementSchema,
  sortedRegionElementSchema,
  heldValueElementSchema,
  countArrayElementSchema,
] as const;

export const elementSourceSchemas = [
  itemRowSourceSchema,
  barRowSourceSchema,
  pointerSourceSchema,
  highlightSourceSchema,
  calloutElementSchema,
  equationSourceSchema,
  resultSourceSchema,
  sortedRegionSourceSchema,
  heldValueSourceSchema,
  countArraySourceSchema,
] as const;

export const elementSchema = z.discriminatedUnion("type", elementSchemas);
export const elementSourceSchema = z.discriminatedUnion("type", elementSourceSchemas);

export type Element = z.infer<typeof elementSchema>;
export type ElementSource = z.infer<typeof elementSourceSchema>;
export type ElementType = Element["type"];
export type ElementOf<T extends ElementType> = Extract<Element, { type: T }>;
export type ItemRowElement = ElementOf<"item-row">;
export type BarRowElement = ElementOf<"bar-row">;
export type PointerElement = ElementOf<"pointer">;
export type HighlightElement = ElementOf<"highlight">;
export type HighlightState = z.infer<typeof highlightStateSchema>;
export type CalloutElement = ElementOf<"callout">;
export type EquationElement = ElementOf<"equation">;
export type ResultElement = ElementOf<"result">;
export type SortedRegionElement = ElementOf<"sorted-region">;
export type HeldValueElement = ElementOf<"held-value">;
export type CountArrayElement = ElementOf<"count-array">;
export type ComparisonOp = z.infer<typeof comparisonOpSchema>;
export type VerdictTone = z.infer<typeof verdictToneSchema>;
export type Operator = z.infer<typeof operatorSchema>;
