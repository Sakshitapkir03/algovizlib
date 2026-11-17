import { storyboardSchema, type Storyboard, type StoryboardInput } from "./schema";

/**
 * Parse an authored storyboard, applying defaults. Throws a readable error if
 * the storyboard is invalid, so a bad content file fails tests and builds.
 */
export function defineStoryboard(input: StoryboardInput): Storyboard {
  const result = storyboardSchema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid storyboard "${input.id}":\n${details}`);
  }
  return result.data;
}
