import { z } from "zod";

/**
 * A quick check: a short multiple-choice question asked just before a key step's scene plays, about what that step
 * is about to do. Built from the trace (`build.ts`), so the right answer is the algorithm's own; `claim` holds what the
 * validator (`validate.ts`) recomputes from the trace, independently, to prove the answer right and every other
 * option wrong.
 */
const cell = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]);

export const quickCheckClaimSchema = z.discriminatedUnion("kind", [
  /** "Is 4 + 45 less than, equal to, or greater than 50?": options are <, =, > in that order. */
  z.object({
    kind: z.literal("compare"),
    terms: z.array(z.number()).min(2),
    operator: z.enum(["+", "-", "×"]),
    target: z.number(),
  }),
  /** "4 + 45 vs 50: what happens next?": options are the video's own verdict words, one per comparison result. */
  z.object({
    kind: z.literal("verdict"),
    terms: z.array(z.number()).min(1),
    operator: z.enum(["+", "-", "×"]),
    target: z.number(),
  }),
  /** "Where does 7 point next?": options are node values (or "null"); `node` is the node whose link changes. */
  z.object({ kind: z.literal("rewire"), node: z.number().int().nonnegative() }),
  /** "Next choice: +4. What happens?": go deeper, record an answer, or cut the branch; `node` is the new node. */
  z.object({ kind: z.literal("explore"), node: z.number().int().nonnegative() }),
  /** "Is there already a node for a under c?": Yes / No; `parent` is a trie node, `letter` its child's letter. */
  z.object({
    kind: z.literal("trie-child"),
    parent: z.number().int().nonnegative(),
    letter: z.string().length(1),
  }),
  /** "Which one moves next?": options are the on-screen pointers, `binds` their trace names in option order. */
  z.object({ kind: z.literal("pointer"), binds: z.array(z.string()).min(2), fromStep: z.number().int() }),
  /** "Is 6 already in the register?": Yes / No. */
  z.object({ kind: z.literal("lookup"), key: z.string() }),
  /** "What value goes in the next cell?": options are numbers. */
  z.object({ kind: z.literal("cell"), cell }),
  /** "Which value leaves the heap next?": options are heap item labels; `heap` is the heap's index in the step. */
  z.object({ kind: z.literal("heap-pop"), heap: z.number().int().nonnegative() }),
  /** "How many items come off the stack?": options are counts. */
  z.object({ kind: z.literal("stack-pop") }),
  /** "Which leaves the queue next?": options are queue item labels. */
  z.object({ kind: z.literal("queue") }),
  /** "Which does it choose?": options are the step's chosen and rejected options. */
  z.object({ kind: z.literal("choice") }),
  /** "What does the call on 9 return?": options are values; `node` is the returning call's node. */
  z.object({ kind: z.literal("returns"), node: z.number().int().nonnegative() }),
  /** "Are b and d already in the same group?": Yes / No; `a`, `b` are union-find elements. */
  z.object({ kind: z.literal("same-group"), a: z.number().int(), b: z.number().int() }),
  /** "Do slow and fast meet this round?": Yes / No. */
  z.object({ kind: z.literal("meet"), slow: z.string(), fast: z.string() }),
  /** "How many new nodes does "stem" add?": options are counts. */
  z.object({ kind: z.literal("trie-new") }),
  /** "What does get(1) return?": options are outputs; `call` is the call's index in the trace's ops. */
  z.object({ kind: z.literal("output"), call: z.number().int().nonnegative() }),
]);

export const quickCheckSchema = z
  .object({
    /** Unique within a video: the scene it's asked before. */
    id: z.string().min(1),
    /** The scene the question is asked before: playback pauses just as it would start. */
    sceneId: z.string().min(1),
    /** The trace step the question is about (the scene's bound step). */
    step: z.number().int().nonnegative(),
    prompt: z.string().trim().min(1).max(140),
    options: z.array(z.string().trim().min(1).max(40)).min(2).max(4),
    /** The correct option's index. */
    answer: z.number().int().nonnegative(),
    /** Shown after answering: the step's own note. */
    explanation: z.string().trim().min(1),
    claim: quickCheckClaimSchema,
  })
  .refine((q) => q.answer < q.options.length, "answer must be one of the options")
  .refine((q) => new Set(q.options).size === q.options.length, "options must be distinct");

export type QuickCheck = z.infer<typeof quickCheckSchema>;
export type QuickCheckClaim = z.infer<typeof quickCheckClaimSchema>;
export type QuickCheckKind = QuickCheckClaim["kind"];

/** At most this many questions per video. */
export const MAX_CHECKS = 3;
