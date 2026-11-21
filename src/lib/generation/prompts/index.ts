import { storyboardPromptV8 } from "./storyboard-v8";

export type { StoryboardPromptInput } from "./storyboard-v8";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV8;
export type PromptSet = typeof currentPrompts;
