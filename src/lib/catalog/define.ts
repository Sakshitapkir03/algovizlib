import type { z } from "zod";

import {
  categorySchema,
  patternGroupSchema,
  patternSchema,
  problemSchema,
  type Category,
  type CategoryInput,
  type Pattern,
  type PatternGroup,
  type PatternInput,
  type Problem,
  type ProblemInput,
} from "./schema";

function parse<S extends z.ZodType>(schema: S, input: z.input<S>, label: string): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid ${label}:\n${details}`);
  }
  return result.data;
}

/** Parse an authored category, applying defaults. Throws a readable error if invalid. */
export function defineCategory(input: CategoryInput): Category {
  return parse(categorySchema, input, `category "${input.slug}"`);
}

/** Parse an authored pattern group. Throws a readable error if invalid. */
export function definePatternGroup(input: z.input<typeof patternGroupSchema>): PatternGroup {
  return parse(patternGroupSchema, input, `pattern group "${input.slug}"`);
}

/** Parse an authored pattern. Throws a readable error if invalid. */
export function definePattern(input: PatternInput): Pattern {
  return parse(patternSchema, input, `pattern "${input.slug}"`);
}

/** Parse an authored problem, applying defaults. Throws a readable error if invalid. */
export function defineProblem(input: ProblemInput): Problem {
  return parse(problemSchema, input, `problem "${input.slug}"`);
}
