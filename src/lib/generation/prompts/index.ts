import { storyboardPromptV22 } from "./storyboard-v22";

export type { StoryboardPromptInput } from "./storyboard-v22";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV22;
export type PromptSet = typeof currentPrompts;
