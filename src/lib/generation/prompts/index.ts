import { storyboardPromptV17 } from "./storyboard-v17";

export type { StoryboardPromptInput } from "./storyboard-v17";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV17;
export type PromptSet = typeof currentPrompts;
