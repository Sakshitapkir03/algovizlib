import type { Problem } from "@/lib/catalog";
import {
  estimateDurationInFrames,
  type ElementSource,
  type Storyboard,
  type StoryboardInput,
} from "@/lib/storyboard";
import type { Trace } from "@/lib/traces/types";

import { traceScenes } from "./scenes";

/** What the walkthrough needs to know about the problem (serializable: it comes from the page). */
export type WalkthroughProblem = Pick<
  Problem,
  "patternSlug" | "slug" | "title" | "tags" | "keyIdea" | "complexity"
>;

/** Captions are at most 80 characters (the schema's limit: two lines on the stage). */
export const MAX_CAPTION = 80;

/** A step's note as a caption: whole when it fits, else cut at a word boundary with "…". */
export function captionFrom(note: string): string {
  const text = note.trim().replace(/\s+/g, " ");
  if (text.length <= MAX_CAPTION) return text;
  const cut = text.slice(0, MAX_CAPTION - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > MAX_CAPTION / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:–-]+$/, "")}…`;
}

/** Panel words for a walkthrough when the original video has no element of that type to borrow them from. */
const PLAIN_WORDS: Partial<Record<ElementSource["type"], Record<string, string>>> = {
  counter: { label: "count" },
  window: { label: "window" },
  "number-line": { label: "candidates" },
  "hash-map": { label: "map" },
  "freq-table": { label: "counts" },
  deque: { label: "deque", outputLabel: "output" },
  partial: { label: "so far", foundLabel: "found" },
  stack: { label: "stack" },
  queue: { label: "queue", levelLabel: "level" },
  "call-stack": { label: "calls" },
  "sorted-region": { label: "sorted" },
  "held-value": { label: "holding" },
  "count-array": { label: "count" },
  "split-tree": { label: "split" },
  "merge-buffer": { label: "merged" },
  partition: { label: "pivot" },
};

/** The first element of a type in the original video that sets a text field, for the walkthrough's panel words. */
function templateText(template: Storyboard | undefined) {
  const elements = template?.scenes.flatMap((scene) => scene.elements) ?? [];
  return (type: ElementSource["type"], field: string, fallback: string, nth = 0): string => {
    const values = [
      ...new Set(
        elements
          .filter((el) => el.type === type)
          .map((el) => (el as Record<string, unknown>)[field])
          .filter((v): v is string => typeof v === "string" && v.trim() !== ""),
      ),
    ];
    return values[nth] ?? (nth === 0 ? PLAIN_WORDS[type]?.[field] : undefined) ?? fallback;
  };
}

/**
 * The walkthrough of a learner's own input: a scene with the input, one scene per key step of the trace (its note
 * is the narration and, shortened, the caption), and the answer: on the last step's scene, or in a closing scene
 * when the stage is too full for the card. The primitives and their layout are the ones every committed video is
 * checked with (`traceScenes`); panel words ("in window", "till") come from the problem's original video. Plain
 * data: the caller parses, resolves, validates, and fit-checks it before anyone sees it.
 */
export function buildWalkthrough({
  problem,
  patternName,
  trace,
  args,
  inputSummary,
  template,
  levels,
}: {
  problem: WalkthroughProblem;
  patternName: string;
  trace: Trace;
  args: unknown[];
  /** The input in words, e.g. "nums = [4, 9, 14], target = 23". */
  inputSummary: string;
  /** The problem's original video, if any (its panel labels and takeaway). */
  template?: Storyboard;
  /** How much each scene leaves out to fit (`SceneLook.level`): by scene id, 0 when absent. */
  levels?: Readonly<Record<string, number>>;
}): StoryboardInput {
  const level = (id: string) => levels?.[id] ?? 0;
  const { rows, stepScenes, wideTable, answerCard } = traceScenes(trace, {
    itemLabels: (count) => Array.from({ length: count }, (_, i) => String(i)),
    text: templateText(template),
    caption: (step) => captionFrom(step.note),
    verdict: (step) => step.kind.replace(/-/g, " "),
    level: (index) => level(`step-${index}`),
  });
  const scenes = [
    {
      id: "your-input",
      caption: "Your input",
      narration: `Here is your input: ${inputSummary}. Let's follow the algorithm one step at a time.`,
      // When there's no input row (an empty list, two numbers) or it can't be drawn at phone size (long words as
      // cards), the input is stated on a card.
      elements:
        level("your-input") >= 4 || rows().length === 0
          ? [
              {
                id: "input",
                type: "result" as const,
                title: "Your input",
                value: inputSummary,
                tone: "info" as const,
                enterAt: 0,
              },
            ]
          : rows(),
    },
    ...stepScenes,
    ...(wideTable
      ? [
          {
            id: "answer",
            caption: captionFrom(`Answer: ${trace.answerDisplay}`),
            narration: `So the answer for your input is ${trace.answerDisplay}.`,
            elements: [answerCard],
          },
        ]
      : []),
  ];
  return {
    id: `${problem.patternSlug}-${problem.slug}-your-input`,
    title: `${problem.title}: your input`,
    concept: patternName,
    category: "dsa",
    summary: `A step-by-step walkthrough of ${problem.title} on your own input.`,
    exampleSource: "problem-native",
    tags: problem.tags,
    takeaway: template?.takeaway ?? {
      pattern: patternName,
      summary: problem.keyIdea,
      timeComplexity: problem.complexity.time,
      spaceComplexity: problem.complexity.space,
      whenToUse: [],
    },
    trace: { problem: trace.problem, args },
    scenes: scenes.map((scene) => ({
      ...scene,
      durationInFrames: estimateDurationInFrames(scene.narration),
    })),
  };
}
