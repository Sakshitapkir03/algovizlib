import { storyboardPromptV9 } from "./storyboard-v9";

export type { StoryboardPromptInput } from "./storyboard-v9";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV9;
export type PromptSet = typeof currentPrompts;
