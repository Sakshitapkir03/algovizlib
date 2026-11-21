import { storyboardPromptV11 } from "./storyboard-v11";

export type { StoryboardPromptInput } from "./storyboard-v11";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV11;
export type PromptSet = typeof currentPrompts;
