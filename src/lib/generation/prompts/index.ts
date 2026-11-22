import { storyboardPromptV18 } from "./storyboard-v18";

export type { StoryboardPromptInput } from "./storyboard-v18";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV18;
export type PromptSet = typeof currentPrompts;
