import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "use lowercase-kebab-case");

/** Any JSON value. Example `args`/`expected` must survive a JSON round trip so they can move to a database. */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ]),
);

export const categorySlugSchema = z.enum(["dsa", "system-design"]);

export const categorySchema = z.object({
  slug: categorySlugSchema,
  name: nonEmpty,
  description: nonEmpty,
  status: z.enum(["available", "coming-soon"]),
  /** Topics shown on a coming-soon category page. */
  plannedTopics: z.array(z.object({ name: nonEmpty, summary: nonEmpty })).default([]),
});

/** The four sections of the /dsa page, in display order. Group names and blurbs live in content/catalog/groups.ts. */
export const patternGroupSlugSchema = z.enum(["foundations", "core", "trees-graphs", "advanced"]);

export const patternGroupSchema = z.object({
  slug: patternGroupSlugSchema,
  name: nonEmpty,
  /** One sentence under the group heading. */
  summary: nonEmpty,
  order: z.number().int().min(0),
});

export const complexitySchema = z.object({ time: nonEmpty, space: nonEmpty });

export const patternSchema = z.object({
  slug,
  categorySlug: categorySlugSchema,
  /** Section of the /dsa page this pattern appears in. */
  group: patternGroupSlugSchema,
  name: nonEmpty,
  /** One or two sentences for the pattern card. */
  summary: nonEmpty,
  /** Recognition signals, e.g. "sorted input + find a pair". */
  whenToUse: z.array(nonEmpty).min(2),
  /** A short paragraph explaining why the pattern works. */
  coreIdea: nonEmpty,
  typicalComplexity: complexitySchema,
  /** Position in the pattern grid (ascending). */
  order: z.number().int().min(0),
});

export const difficultySchema = z.enum(["easy", "medium", "hard"]);

export const exampleSchema = z.object({
  /** Display text, e.g. `prices = [4, 9, 14], target = 23`. */
  input: nonEmpty,
  /** Display text, e.g. `[1, 2]`. */
  output: nonEmpty,
  explanation: nonEmpty.optional(),
  /** Machine-readable arguments, passed positionally to the reference solution. */
  args: z.array(jsonSchema),
  /** Machine-readable expected return value, compared using the problem's `judge`. */
  expected: jsonSchema,
});

/**
 * How a solution's return value is compared with `expected`.
 * - "exact": deep equality.
 * - "unordered": both are arrays; order doesn't matter.
 * - "unordered-nested": arrays of arrays; order doesn't matter at either level.
 * - "float": numbers equal within 1e-5.
 */
export const judgeSchema = z.enum(["exact", "unordered", "unordered-nested", "float"]);

export const externalRefSchema = z.object({
  label: nonEmpty,
  url: z.url(),
  /** The linked problem needs a paid subscription (e.g. LeetCode Premium); the page labels it "Premium". */
  premium: z.boolean().default(false),
});

export const problemSchema = z.object({
  slug,
  patternSlug: slug,
  title: nonEmpty,
  difficulty: difficultySchema,
  /** Position within the pattern (ascending); drives the table and previous/next. */
  order: z.number().int().min(0),
  /** Original wording. Paragraphs are separated by blank lines; `backticks` render as inline code. */
  statement: nonEmpty,
  examples: z.array(exampleSchema).min(2),
  /**
   * How `args`/`expected` are shaped. "call": `solve(...args)` returns `expected`. "operations" (data structure
   * design): `args` is `[operations, arguments]`, e.g. `[["MinStack", "push", "getMin"], [[], [3], []]]`, where the
   * first operation constructs the object, and `expected` lists each operation's return value (`null` for void).
   * The problem page renders these as an operation → output table.
   */
  exampleFormat: z.enum(["call", "operations"]).default("call"),
  judge: judgeSchema.default("exact"),
  constraints: z.array(nonEmpty).min(1),
  /** Ordered from gentle nudge to near-solution; revealed one at a time. */
  hints: z.array(nonEmpty).min(2),
  keyIdea: nonEmpty,
  complexity: complexitySchema,
  /** Links to a video when one exists (see content/storyboards). */
  storyboardId: nonEmpty.optional(),
  tags: z.array(nonEmpty).default([]),
  /**
   * Other patterns this problem also belongs to. It keeps one home (`patternSlug`: its URL and progress key) and is
   * listed in each related pattern's table with an "also in <home>" label.
   */
  relatedPatterns: z.array(slug).default([]),
  externalRefs: z.array(externalRefSchema).default([]),
});

// --- System design --------------------------------------------------------------------------------------------

/** The sections of the /system-design page, in display order. */
export const topicGroupSlugSchema = z.enum(["foundations", "data", "reliability", "case-studies"]);

/** A system design topic: what patterns are to problems, topics are to lessons. */
export const topicSchema = z.object({
  slug,
  name: nonEmpty,
  group: topicGroupSlugSchema,
  /** One sentence for the topic's heading. */
  summary: nonEmpty,
  order: z.number().int().min(0),
});

/**
 * "incident": a replay of a real class of bug, followed request by request, then the fix replayed so the bug can't
 * happen. "growth": a system that grows from one server, adding a component only after the simulation measures the
 * bottleneck that justifies it.
 */
export const lessonKindSchema = z.enum(["incident", "growth"]);

const lessonShape = {
  slug,
  topicSlug: slug,
  title: nonEmpty,
  kind: lessonKindSchema,
  /** The symptom, the way a support ticket would put it ("A customer was charged $40 twice"). */
  symptom: nonEmpty.max(100),
  /** Position within the topic (ascending). */
  order: z.number().int().min(0),
};

/** A lesson that's listed but not built yet: no page, no link. */
export const plannedLessonSchema = z.object({ ...lessonShape, status: z.literal("planned") });

/**
 * A built lesson. Paragraph fields use the same text format as problem statements (blank lines, "- " bullets,
 * `backticks`). `replays` are the simulation scenarios the video runs (the trace's args, as a problem example's
 * `args` are); `rules` are what the simulation checks on every replay.
 */
export const lessonSchema = z.object({
  ...lessonShape,
  status: z.literal("available"),
  minutes: z.number().int().min(1).max(30),
  /** "The report": what was seen, before anyone knew why. */
  report: nonEmpty,
  /** Behind the spoiler toggle with `fix`. */
  whatWentWrong: nonEmpty,
  fix: nonEmpty,
  /** What the simulation's proof covers, and what it doesn't. */
  proofScope: nonEmpty,
  rules: z.array(nonEmpty).min(1),
  takeaways: z.array(nonEmpty).min(2),
  replays: z.array(z.object({ args: z.array(jsonSchema) })).min(1),
  /** DSA patterns that share an idea with this lesson. */
  relatedPatterns: z.array(slug).default([]),
  tags: z.array(nonEmpty).default([]),
});

export const anyLessonSchema = z.discriminatedUnion("status", [lessonSchema, plannedLessonSchema]);

export type TopicGroupSlug = z.infer<typeof topicGroupSlugSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type LessonKind = z.infer<typeof lessonKindSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type LessonInput = z.input<typeof lessonSchema>;
export type PlannedLesson = z.infer<typeof plannedLessonSchema>;
export type AnyLesson = z.infer<typeof anyLessonSchema>;

export type Category = z.infer<typeof categorySchema>;
export type CategoryInput = z.input<typeof categorySchema>;
export type CategorySlug = z.infer<typeof categorySlugSchema>;
export type PatternGroupSlug = z.infer<typeof patternGroupSlugSchema>;
export type PatternGroup = z.infer<typeof patternGroupSchema>;
export type Pattern = z.infer<typeof patternSchema>;
export type PatternInput = z.input<typeof patternSchema>;
export type Difficulty = z.infer<typeof difficultySchema>;
export type ProblemExample = z.infer<typeof exampleSchema>;
export type Judge = z.infer<typeof judgeSchema>;
export type Problem = z.infer<typeof problemSchema>;
export type ProblemInput = z.input<typeof problemSchema>;
export type Complexity = z.infer<typeof complexitySchema>;

export const DIFFICULTIES: readonly Difficulty[] = difficultySchema.options;
