import { storyboardPromptV2 } from "./storyboard-v2";

export type { StoryboardPromptInput } from "./storyboard-v2";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV2;
export type PromptSet = typeof currentPrompts;
