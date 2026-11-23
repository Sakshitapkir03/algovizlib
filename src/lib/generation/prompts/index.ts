import { storyboardPromptV20 } from "./storyboard-v20";

export type { StoryboardPromptInput } from "./storyboard-v20";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV20;
export type PromptSet = typeof currentPrompts;
