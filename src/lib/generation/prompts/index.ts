import { storyboardPromptV16 } from "./storyboard-v16";

export type { StoryboardPromptInput } from "./storyboard-v16";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV16;
export type PromptSet = typeof currentPrompts;
