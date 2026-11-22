import { storyboardPromptV15 } from "./storyboard-v15";

export type { StoryboardPromptInput } from "./storyboard-v15";

/** The prompt set the generator uses. Switching versions invalidates cached results automatically. */
export const currentPrompts = storyboardPromptV15;
export type PromptSet = typeof currentPrompts;
