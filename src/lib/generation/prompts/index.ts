import { storyboardPromptV12 } from "./storyboard-v12";

export type { StoryboardPromptInput } from "./storyboard-v12";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV12;
export type PromptSet = typeof currentPrompts;
