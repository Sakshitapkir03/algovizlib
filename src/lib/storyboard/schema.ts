import { z } from "zod";

import { elementSchema } from "./elements";

const nonEmpty = z.string().trim().min(1);

/**
 * How the storyboard grounds the concept in the real world. See the
 * "Choosing the example" section of CLAUDE.md.
 * - "problem-native": the problem statement is already a real-world scenario;
 *   use its exact wording and numbers.
 * - "analogy": the problem is abstract; use a relatable analogy and map it
 *   back to the abstract problem in the closing scene.
 */
export const exampleSourceSchema = z.enum(["problem-native", "analogy"]);

export const analogySchema = z.object({
  /** One-sentence description of the real-world story. */
  scenario: nonEmpty,
  /** How each part of the story maps to the abstract problem. */
  mapping: z.array(z.object({ real: nonEmpty, abstract: nonEmpty })).min(1),
});

/**
 * Binds a storyboard to a deterministic engine so its pointers and equations
 * can be checked. One variant per engine.
 */
export const engineBindingSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("two-pointers"),
    input: z.object({
      values: z.array(z.number().finite()).min(2),
      target: z.number().finite(),
    }),
  }),
]);

export const takeawaySchema = z.object({
  pattern: nonEmpty,
  summary: nonEmpty,
  timeComplexity: nonEmpty,
  spaceComplexity: nonEmpty,
  whenToUse: z.array(nonEmpty).default([]),
});

export const sceneSchema = z
  .object({
    id: nonEmpty,
    /** Text to be voiced (ElevenLabs, later). */
    narration: nonEmpty,
    /** Short on-screen text. */
    caption: nonEmpty.max(80),
    /** Estimated from narration for now; audio length replaces this later. */
    durationInFrames: z.number().int().min(45),
    elements: z.array(elementSchema),
  })
  .superRefine((scene, ctx) => {
    const ids = new Set<string>();
    const rows = new Map<string, number>();
    scene.elements.forEach((el, i) => {
      if (ids.has(el.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["elements", i, "id"],
          message: `Duplicate element id "${el.id}" in scene "${scene.id}"`,
        });
      }
      ids.add(el.id);
      if (el.type === "item-row") rows.set(el.id, el.items.length);
    });

    const checkIndex = (rowId: string, idx: number, path: (string | number)[]) => {
      const len = rows.get(rowId);
      if (len === undefined) {
        ctx.addIssue({ code: "custom", path, message: `Unknown item-row "${rowId}"` });
      } else if (idx >= len) {
        ctx.addIssue({
          code: "custom",
          path,
          message: `Index ${idx} is out of range for "${rowId}" (${len} items)`,
        });
      }
    };

    scene.elements.forEach((el, i) => {
      const path = ["elements", i];
      switch (el.type) {
        case "pointer":
          checkIndex(el.rowId, el.index, [...path, "index"]);
          if (el.fromIndex !== undefined) checkIndex(el.rowId, el.fromIndex, [...path, "fromIndex"]);
          break;
        case "highlight":
          el.indices.forEach((idx) => checkIndex(el.rowId, idx, [...path, "indices"]));
          break;
        case "callout":
          if (el.anchor) checkIndex(el.anchor.rowId, el.anchor.index, [...path, "anchor"]);
          break;
        default:
          break;
      }
    });
  });

export const storyboardSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id must be kebab-case"),
    title: nonEmpty,
    /** The CS concept being taught, e.g. "Two Pointers". */
    concept: nonEmpty,
    category: z.enum(["dsa", "system-design"]),
    /** One-line hook used on cards and in metadata. */
    summary: nonEmpty,
    exampleSource: exampleSourceSchema,
    analogy: analogySchema.optional(),
    tags: z.array(nonEmpty).default([]),
    takeaway: takeawaySchema,
    engine: engineBindingSchema.optional(),
    scenes: z.array(sceneSchema).min(1),
  })
  .superRefine((sb, ctx) => {
    if (sb.exampleSource === "analogy" && !sb.analogy) {
      ctx.addIssue({
        code: "custom",
        path: ["analogy"],
        message: 'exampleSource "analogy" requires an analogy description',
      });
    }
    if (sb.exampleSource === "problem-native" && sb.analogy) {
      ctx.addIssue({
        code: "custom",
        path: ["analogy"],
        message: 'exampleSource "problem-native" must use the problem\'s own scenario, not an analogy',
      });
    }
    const sceneIds = new Set<string>();
    sb.scenes.forEach((scene, i) => {
      if (sceneIds.has(scene.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["scenes", i, "id"],
          message: `Duplicate scene id "${scene.id}"`,
        });
      }
      sceneIds.add(scene.id);
    });
  });

export type ExampleSource = z.infer<typeof exampleSourceSchema>;
export type Analogy = z.infer<typeof analogySchema>;
export type EngineBinding = z.infer<typeof engineBindingSchema>;
export type Takeaway = z.infer<typeof takeawaySchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Storyboard = z.infer<typeof storyboardSchema>;
/** Authoring shape: defaults (enterAt, unit, placement…) may be omitted. */
export type StoryboardInput = z.input<typeof storyboardSchema>;
export type SceneInput = z.input<typeof sceneSchema>;
