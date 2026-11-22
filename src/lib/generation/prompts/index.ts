import { storyboardPromptV19 } from "./storyboard-v19";

export type { StoryboardPromptInput } from "./storyboard-v19";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV19;
export type PromptSet = typeof currentPrompts;
