import { storyboardPromptV14 } from "./storyboard-v14";

export type { StoryboardPromptInput } from "./storyboard-v14";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV14;
export type PromptSet = typeof currentPrompts;
