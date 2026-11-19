import { storyboardPromptV3 } from "./storyboard-v3";

export type { StoryboardPromptInput } from "./storyboard-v3";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV3;
export type PromptSet = typeof currentPrompts;
