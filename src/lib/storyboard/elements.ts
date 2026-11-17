import { z } from "zod";

/**
 * Visual primitives. Each element is one variant of a discriminated union on
 * `type`. To add a primitive: add a schema here, append it to
 * `elementSchemas`, then add a component to `src/video/primitives/registry.ts`
 * (the registry is typed so a missing component is a compile error).
 *
 * Planned (not built yet): "staircase", "house-row", "coin-set", "box-arrow".
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
  value: z.number().finite(),
  /** Optional secondary line, e.g. an emoji-free descriptor or array index. */
  sublabel: z.string().optional(),
});

export const itemRowElementSchema = z.object({
  ...baseElement,
  type: z.literal("item-row"),
  items: z.array(itemSchema).min(1),
  /** Prefix used when rendering values, e.g. "$". */
  unit: z.string().default(""),
});

export const pointerElementSchema = z.object({
  ...baseElement,
  type: z.literal("pointer"),
  rowId: nonEmpty,
  label: nonEmpty,
  index,
  /** If set, the pointer slides from this index to `index` as it enters. */
  fromIndex: index.optional(),
  placement: z.enum(["above", "below"]).default("below"),
  tone: z.enum(["primary", "secondary"]).default("primary"),
  /**
   * Which engine variable this pointer visualizes (e.g. "left" / "right" for
   * two-pointers). Unbound pointers are decorative and not validated.
   */
  binds: z.string().optional(),
});

export const highlightStateSchema = z.enum(["active", "rejected", "found"]);

export const highlightElementSchema = z.object({
  ...baseElement,
  type: z.literal("highlight"),
  rowId: nonEmpty,
  indices: z.array(index).min(1),
  state: highlightStateSchema,
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

export const equationElementSchema = z.object({
  ...baseElement,
  type: z.literal("equation"),
  terms: z.array(z.number().finite()).min(1),
  result: z.number().finite(),
  comparison: z.object({ op: comparisonOpSchema, target: z.number().finite() }).optional(),
  unit: z.string().default(""),
  /** Short verdict rendered after the equation, e.g. "too high". */
  verdict: z.string().optional(),
});

export const resultElementSchema = z.object({
  ...baseElement,
  type: z.literal("result"),
  title: nonEmpty,
  value: nonEmpty,
  detail: z.string().optional(),
  /** Item indices that form the answer, checked against the engine. */
  indices: z.array(index).optional(),
  tone: z.enum(["success", "info"]).default("success"),
});

export const elementSchemas = [
  itemRowElementSchema,
  pointerElementSchema,
  highlightElementSchema,
  calloutElementSchema,
  equationElementSchema,
  resultElementSchema,
] as const;

export const elementSchema = z.discriminatedUnion("type", elementSchemas);

export type Element = z.infer<typeof elementSchema>;
export type ElementType = Element["type"];
export type ElementOf<T extends ElementType> = Extract<Element, { type: T }>;
export type ItemRowElement = ElementOf<"item-row">;
export type PointerElement = ElementOf<"pointer">;
export type HighlightElement = ElementOf<"highlight">;
export type HighlightState = z.infer<typeof highlightStateSchema>;
export type CalloutElement = ElementOf<"callout">;
export type EquationElement = ElementOf<"equation">;
export type ResultElement = ElementOf<"result">;
export type ComparisonOp = z.infer<typeof comparisonOpSchema>;
