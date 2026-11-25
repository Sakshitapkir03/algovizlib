import { getLesson, getTopic } from "@/lib/catalog/repository";
import { getTraceDefinition, runTrace } from "@/lib/traces";

import { hashTrace, type CacheKey } from "./cache";
import type { GenerationContext } from "./draft";
import { systemDesignGrowthPromptV1 } from "./prompts/system-design-growth-v1";
import { type LessonPromptInput } from "./prompts/system-design-v1";
import { systemDesignPromptV2 } from "./prompts/system-design-v2";
import type { StoryboardWriter } from "./writer";

/**
 * A system design lesson as a storyboard target for the authoring fallback (`pnpm storyboards:prompt` and
 * `pnpm storyboards:validate-draft` with a lesson key, "<topic>/<slug>"): the lesson's first replay is the trace's
 * args, the prompt is the system design one, and the draft passes the same checks as any storyboard. Saved like a
 * generated storyboard (content/storyboards/generated/<topic>/<slug>.json), where the repository finds it.
 */
export type PreparedLesson = {
  key: CacheKey;
  ctx: GenerationContext;
  promptInput: LessonPromptInput;
  prompts: ReturnType<typeof promptsFor>;
  existing?: "generated";
};

/**
 * The prompt for a lesson's kind: incident replays and growth stories tell different arcs. Incidents use version 2
 * (version 1, which the flagship's storyboard records, plus the load chart, followed requests, and health checks).
 */
export const promptsFor = (kind: "incident" | "growth") =>
  kind === "growth" ? systemDesignGrowthPromptV1 : systemDesignPromptV2;

export function prepareLesson(
  key: string,
  writer: Pick<StoryboardWriter, "exists">,
): PreparedLesson | undefined {
  const [topicSlug, slug] = key.split("/");
  const lesson = topicSlug && slug ? getLesson(topicSlug, slug) : undefined;
  const definition = getTraceDefinition(key);
  if (!lesson || !definition) return undefined;
  const args = lesson.replays[definition.exampleIndex].args;
  const trace = runTrace(key, args);
  const topicName = getTopic(topicSlug)?.name ?? topicSlug;
  return {
    key: { problem: key, promptVersion: promptsFor(lesson.kind).version, traceHash: hashTrace(args, trace) },
    ctx: {
      problem: { patternSlug: topicSlug, slug, tags: lesson.tags },
      patternName: topicName,
      category: "system-design",
      definition,
      args,
    },
    promptInput: { lesson, topicName, trace },
    prompts: promptsFor(lesson.kind),
    ...(writer.exists(key) && { existing: "generated" as const }),
  };
}
