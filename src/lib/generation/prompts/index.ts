import { storyboardPromptV23 } from "./storyboard-v23";

export type { StoryboardPromptInput } from "./storyboard-v23";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV23;
export type PromptSet = typeof currentPrompts;
