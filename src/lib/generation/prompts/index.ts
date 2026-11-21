import { storyboardPromptV13 } from "./storyboard-v13";

export type { StoryboardPromptInput } from "./storyboard-v13";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV13;
export type PromptSet = typeof currentPrompts;
