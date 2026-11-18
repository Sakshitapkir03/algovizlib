import { storyboardPromptV1 } from "./storyboard-v1";

export type { StoryboardPromptInput } from "./storyboard-v1";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV1;
export type PromptSet = typeof currentPrompts;
