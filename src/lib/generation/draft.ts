import { z } from "zod";

import type { Problem } from "@/lib/catalog";
import {
  analogySchema,
  elementSourceSchema,
  estimateDurationInFrames,
  exampleSourceSchema,
  formatIssue,
  resolveStoryboard,
  storyboardSourceSchema,
  takeawaySchema,
  validateStoryboard,
  zodIssues,
  type GenerationMeta,
  type Storyboard,
  type StoryboardInput,
  type StoryboardSource,
  type ValidationIssue,
} from "@/lib/storyboard";
import type { TraceDefinition } from "@/lib/traces";

const nonEmpty = z.string().trim().min(1);

export const MIN_SCENES = 5;
export const MAX_SCENES = 10;

/**
 * What the model writes: the story, not the bookkeeping. Ids, category, tags, the trace binding, scene durations,
 * and provenance are filled in by `assembleStoryboard`. State-carrying values are omitted so they come from the
 * trace (see elementSourceSchema).
 */
export const draftSceneSchema = z.object({
  id: nonEmpty.describe("kebab-case, unique within the storyboard"),
  caption: nonEmpty.max(80).describe("Short on-screen headline, at most 80 characters"),
  narration: nonEmpty.describe("What the narrator says in this scene, 2–4 sentences"),
  traceStep: z.number().int().nonnegative().optional().describe("Index of the trace step this scene shows"),
  elements: z.array(elementSourceSchema),
});

export const draftSchema = z.object({
  title: nonEmpty,
  summary: nonEmpty.describe("One-line hook"),
  exampleSource: exampleSourceSchema,
  analogy: analogySchema.optional(),
  takeaway: takeawaySchema,
  scenes: z.array(draftSceneSchema).min(MIN_SCENES).max(MAX_SCENES),
});

export type Draft = z.infer<typeof draftSchema>;

export type GenerationContext = {
  problem: Problem;
  patternName: string;
  definition: Pick<TraceDefinition, "problem" | "exampleIndex" | "exampleSource">;
  args: unknown[];
};

/** Fill in everything the model doesn't write. */
export function assembleStoryboard(
  draft: Draft,
  ctx: GenerationContext,
  generation: GenerationMeta,
): StoryboardInput {
  return {
    id: `${ctx.problem.patternSlug}-${ctx.problem.slug}`,
    title: draft.title,
    concept: ctx.patternName,
    category: "dsa",
    summary: draft.summary,
    exampleSource: draft.exampleSource,
    analogy: draft.analogy,
    tags: ctx.problem.tags,
    takeaway: draft.takeaway,
    trace: { problem: ctx.definition.problem, args: ctx.args },
    generation,
    scenes: draft.scenes.map((scene) => ({
      ...scene,
      durationInFrames: estimateDurationInFrames(scene.narration),
    })),
  };
}

export type Evaluation =
  | { ok: true; source: StoryboardSource; storyboard: Storyboard; issues: [] }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Run a model's raw output through every check a storyboard must pass before it's saved: the draft schema, the
 * storyboard schema, trace resolution, `validateStoryboard`, and the "Choosing the example" rule. Issues are
 * phrased so they can be sent back to the model verbatim.
 */
export function evaluateDraft(raw: unknown, ctx: GenerationContext, generation: GenerationMeta): Evaluation {
  const draft = draftSchema.safeParse(raw);
  if (draft.success) return evaluateSource(assembleStoryboard(draft.data, ctx, generation), ctx);

  const schemaIssues = zodIssues("", draft.error.issues, raw);
  // Text-only problems (an over-long caption, an empty label) shouldn't hide the trace checks: patch them on a
  // copy and keep going, so one round reports every issue.
  const patched = patchTextFields(raw, draft.error.issues);
  const retry = patched === undefined ? undefined : draftSchema.safeParse(patched);
  if (!retry?.success) return { ok: false, issues: schemaIssues };
  const rest = evaluateSource(assembleStoryboard(retry.data, ctx, generation), ctx);
  return { ok: false, issues: [...schemaIssues, ...rest.issues] };
}

/** Fields that never affect structure or trace checks. */
const TEXT_FIELDS = new Set([
  "caption",
  "narration",
  "title",
  "summary",
  "text",
  "verdict",
  "detail",
  "label",
  "speaker",
]);

/** A copy of `raw` with each failing text field replaced by a valid placeholder, or undefined if any other field failed. */
function patchTextFields(raw: unknown, issues: readonly { path: PropertyKey[] }[]): unknown {
  if (
    issues.some((i) => !TEXT_FIELDS.has(String(i.path.at(-1))) && !TEXT_FIELDS.has(String(i.path.at(-2))))
  ) {
    return undefined;
  }
  const copy: unknown = structuredClone(raw);
  for (const { path } of issues) {
    const key = TEXT_FIELDS.has(String(path.at(-1))) ? path.at(-1)! : path.at(-2)!;
    const parentPath = path.slice(0, path.lastIndexOf(key));
    let parent: unknown = copy;
    for (const step of parentPath) parent = (parent as Record<PropertyKey, unknown> | undefined)?.[step];
    if (parent && typeof parent === "object") (parent as Record<PropertyKey, unknown>)[key] = "…";
  }
  return copy;
}

/** The same checks for an already-assembled storyboard (e.g. one read back from the cache). */
export function evaluateSource(input: unknown, ctx: GenerationContext): Evaluation {
  const issues: ValidationIssue[] = [];
  const source = storyboardSourceSchema.safeParse(input);
  if (!source.success) return { ok: false, issues: zodIssues("", source.error.issues, input) };

  if (source.data.exampleSource !== ctx.definition.exampleSource) {
    issues.push({
      message:
        ctx.definition.exampleSource === "problem-native"
          ? 'This problem already describes a real-world scenario: set exampleSource to "problem-native", omit analogy, and tell its own story with its own numbers.'
          : 'This problem is abstract: set exampleSource to "analogy", describe one relatable analogy, and map it back to the abstract problem in the closing scene.',
    });
  }

  const resolved = resolveStoryboard(source.data);
  issues.push(...resolved.issues);
  if (resolved.storyboard) issues.push(...validateStoryboard(resolved.storyboard).issues);
  if (issues.length > 0 || !resolved.storyboard) return { ok: false, issues };
  return { ok: true, source: source.data, storyboard: resolved.storyboard, issues: [] };
}

export function describeIssues(issues: readonly ValidationIssue[]): string {
  return issues.map((issue) => `- ${formatIssue(issue)}`).join("\n");
}
