import { storyboardPromptV10 } from "./storyboard-v10";

export type { StoryboardPromptInput } from "./storyboard-v10";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV10;
export type PromptSet = typeof currentPrompts;
