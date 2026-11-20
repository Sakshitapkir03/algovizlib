import { storyboardPromptV6 } from "./storyboard-v6";

export type { StoryboardPromptInput } from "./storyboard-v6";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV6;
export type PromptSet = typeof currentPrompts;
