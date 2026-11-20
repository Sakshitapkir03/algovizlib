import { storyboardPromptV7 } from "./storyboard-v7";

export type { StoryboardPromptInput } from "./storyboard-v7";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV7;
export type PromptSet = typeof currentPrompts;
