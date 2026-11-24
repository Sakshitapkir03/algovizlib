import { describe, expect, it } from "vitest";

import { getAllProblems, getPattern, getProblem, getProblemStoryboard } from "@/lib/catalog/repository";
import { buildQuickChecks, type QuickCheck, validateQuickChecks } from "@/lib/quickcheck";
import type { Element, Scene } from "@/lib/storyboard";
import { runTrace } from "@/lib/traces";
import { inputSpecs } from "@/lib/walkthrough/specs";
import { buildWalkthroughFor, randomInput } from "@/lib/walkthrough/run";

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const videos = getAllProblems().flatMap((problem) => {
  const storyboard = getProblemStoryboard(problem);
  return storyboard?.trace ? [{ key: `${problem.patternSlug}/${problem.slug}`, storyboard }] : [];
});

const checksFor = (storyboard: (typeof videos)[number]["storyboard"]) => {
  const trace = runTrace(storyboard.trace!.problem, storyboard.trace!.args);
  return { trace, checks: buildQuickChecks(storyboard, trace) };
};

// Words a question may use that aren't on screen: its own fixed wording.
const QUESTION_WORDS = new Set(
  [
    "is less than equal to or greater what does return which choose already in the stored value leaves heap next",
    "min max goes cell row column call on are and same group how many new nodes add items come off stack queue",
    "do land together this round one moves yes no true false it max-heap min-heap vs happens there a node",
    "for under root choice go deeper record an answer cut branch where point null map set pointer",
  ]
    .join(" ")
    .split(" "),
);
const HIDDEN = new Set([
  "id",
  "rowId",
  "binds",
  "enterAt",
  "placement",
  "tone",
  "state",
  "kind",
  "display",
  "type",
]);
const words = (text: string) =>
  text
    .toLowerCase()
    .match(/[\p{L}\p{N}#'’:-]+/gu)
    ?.map((w) => w.replace(/^['’:-]+|['’:-]+$/g, ""))
    .filter(Boolean) ?? [];
/** What the viewer can read while the question is up (the scene before) and knows by name (the question's scene). */
function visible(scenes: readonly Scene[]): Set<string> {
  const out: string[] = [];
  const walk = (v: unknown, key?: string) => {
    if (key && HIDDEN.has(key)) return;
    if (typeof v === "string" || typeof v === "number") out.push(String(v));
    else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  scenes.forEach((s, i) => {
    if (i === 0) out.push(s.caption);
    s.elements.forEach((e: Element) => walk(e));
  });
  return new Set(out.flatMap(words));
}

describe("quick checks for every video", () => {
  it("builds 1–3 valid questions for nearly every video, each proven against the trace", () => {
    expect(videos).toHaveLength(103);
    const issues: string[] = [];
    const without: string[] = [];
    let total = 0;
    for (const { key, storyboard } of videos) {
      const { trace, checks } = checksFor(storyboard);
      total += checks.length;
      if (checks.length === 0) without.push(key);
      issues.push(...validateQuickChecks(storyboard, trace, checks).map((i) => `${key}: ${i}`));
    }
    expect(issues).toEqual([]);
    // No step in these makes a clean prediction question (bit panels, BFS grids, Kahn's graphs, N-Queens, sorts whose
    // comparisons all go one way): they get none rather than a forced one.
    expect(without).toEqual([
      "arrays-hashing/first-missing-positive",
      "prefix-sum/product-of-array-except-self",
      "sorting/heap-sort",
      "sorting/counting-sort",
      "bit-manipulation/single-number",
      "bit-manipulation/sum-of-two-integers",
      "bit-manipulation/single-number-ii",
      "bit-manipulation/shortest-path-visiting-all-nodes",
      "linked-list/merge-two-sorted-lists",
      "intervals/insert-interval",
      "graphs-bfs/number-of-islands",
      "graphs-bfs/shortest-path-in-binary-matrix",
      "advanced-graphs/course-schedule",
      "advanced-graphs/alien-dictionary",
      "backtracking/n-queens",
    ]);
    expect(total).toBeGreaterThan(200);
  });

  it("names only what's on screen", () => {
    const offenders: string[] = [];
    for (const { key, storyboard } of videos) {
      const { checks } = checksFor(storyboard);
      for (const check of checks) {
        const at = storyboard.scenes.findIndex((s) => s.id === check.sceneId);
        const seen = visible([storyboard.scenes[at - 1], storyboard.scenes[at]]);
        // A numeric option is an answer (a count, a value), not a name.
        // Verdict words come from the video's own equations, shown in other scenes.
        const named = check.options.filter((o) => !/^-?\d+$/.test(o) && check.claim.kind !== "verdict");
        for (const w of words([check.prompt, ...named].join(" ")))
          if (!QUESTION_WORDS.has(w) && !seen.has(w))
            offenders.push(`${key} › ${check.sceneId}: "${w}" in ${check.prompt}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("a wrong answer, a wrong option that's right, or a question on the wrong scene fails validation", () => {
    const { storyboard } = videos.find((v) => v.key === "two-pointers/pair-with-target-sum")!;
    const { trace, checks } = checksFor(storyboard);
    const compare = checks.find((c) => c.claim.kind === "verdict")!;
    expect(compare).toBeDefined();
    const wrongAnswer: QuickCheck = { ...compare, answer: (compare.answer + 1) % compare.options.length };
    expect(validateQuickChecks(storyboard, trace, [wrongAnswer]).join()).toMatch(/is wrong/);
    const otherScene: QuickCheck = { ...compare, step: compare.step + 1 };
    expect(validateQuickChecks(storyboard, trace, [otherScene]).length).toBeGreaterThan(0);
    const badTarget: QuickCheck = {
      ...compare,
      claim: { ...compare.claim, target: 999 } as QuickCheck["claim"],
    };
    expect(validateQuickChecks(storyboard, trace, [badTarget]).join()).toMatch(/can't be checked/);
    const firstScene: QuickCheck = { ...compare, sceneId: storyboard.scenes[0].id };
    expect(validateQuickChecks(storyboard, trace, [firstScene]).join()).toMatch(/scene before it/);
  });
});

describe("quick checks for walkthroughs of your own input", () => {
  it.each(inputSpecs.map((s) => [s.problem, s] as const))(
    "%s: random inputs get valid questions",
    (key, spec) => {
      const [pattern, slug] = key.split("/");
      const problem = getProblem(pattern, slug)!;
      const rng = seeded(key.length * 131 + 7);
      for (let n = 0; n < 4; n++) {
        const args = randomInput(spec, rng);
        const result = buildWalkthroughFor(
          problem,
          getPattern(pattern)!.name,
          spec,
          args,
          getProblemStoryboard(problem),
        );
        if (!result.ok) throw new Error(`${key} ${JSON.stringify(args)}: ${result.errors[0].message}`);
        const trace = runTrace(key, args);
        const checks = buildQuickChecks(result.storyboard, trace);
        expect(
          validateQuickChecks(result.storyboard, trace, checks),
          `${key} ${JSON.stringify(args)}`,
        ).toEqual([]);
      }
    },
  );
});
