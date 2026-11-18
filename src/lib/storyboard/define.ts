import { formatIssue, zodIssues } from "./issues";
import { resolveStoryboard } from "./resolve";
import { storyboardSourceSchema, type Storyboard, type StoryboardInput } from "./schema";

/**
 * Parse an authored storyboard, apply defaults, and resolve trace-derived values. Throws a readable error if
 * the storyboard is invalid, so a bad content file fails tests and builds.
 */
export function defineStoryboard(input: StoryboardInput): Storyboard {
  return loadStoryboard(input);
}

/** Same as `defineStoryboard`, for untyped input such as a generated JSON file. */
export function loadStoryboard(input: unknown): Storyboard {
  const id = (input as { id?: unknown } | null)?.id;
  const fail = (lines: string[]) => {
    throw new Error(`Invalid storyboard "${String(id)}":\n${lines.map((l) => `  - ${l}`).join("\n")}`);
  };
  const source = storyboardSourceSchema.safeParse(input);
  if (!source.success) return fail(zodIssues("", source.error.issues, input).map(formatIssue));
  const { storyboard, issues } = resolveStoryboard(source.data);
  if (!storyboard) return fail(issues.map(formatIssue));
  return storyboard;
}
