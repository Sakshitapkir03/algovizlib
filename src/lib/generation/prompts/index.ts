import { storyboardPromptV5 } from "./storyboard-v5";

export type { StoryboardPromptInput } from "./storyboard-v5";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV5;
export type PromptSet = typeof currentPrompts;
