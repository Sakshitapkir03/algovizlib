import { storyboardPromptV21 } from "./storyboard-v21";

export type { StoryboardPromptInput } from "./storyboard-v21";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV21;
export type PromptSet = typeof currentPrompts;
