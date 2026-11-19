import { storyboardPromptV4 } from "./storyboard-v4";

export type { StoryboardPromptInput } from "./storyboard-v4";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV4;
export type PromptSet = typeof currentPrompts;
