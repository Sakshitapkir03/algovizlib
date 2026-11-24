import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { judgeOutput } from "@/lib/catalog";
import {
  getAllProblems,
  getPattern,
  getProblem,
  getProblemStoryboard,
  hasTryInput,
} from "@/lib/catalog/repository";
import { getTraceDefinition, runTrace } from "@/lib/traces";
import { TRY_INPUT_PROBLEMS } from "@/lib/walkthrough/supported";
import { inputSpecs } from "@/lib/walkthrough/specs";
import {
  buildWalkthroughFor,
  decodeInput,
  encodeInput,
  formatInput,
  getInputSpec,
  parseInput,
  randomInput,
  TOO_BIG,
} from "@/lib/walkthrough/run";
import { captionFrom } from "@/lib/walkthrough/build";

/** Random inputs per problem: each must match the reference solution, validate, and fit at phone width. */
const RANDOM_INPUTS = Number(process.env.WALKTHROUGH_RANDOM ?? 8);

/** A small seeded generator (mulberry32), so failures reproduce. */
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

type Solve = (...args: never[]) => unknown;
async function loadSolve(key: string): Promise<Solve> {
  const file = path.join(import.meta.dirname, "reference-solutions", `${key}.ts`);
  const mod: { solve: Solve } = await import(/* @vite-ignore */ pathToFileURL(file).href);
  return mod.solve;
}

const problemOf = (key: string) => {
  const [pattern, slug] = key.split("/");
  return getProblem(pattern, slug)!;
};

function walkthrough(key: string, args: unknown[]) {
  const problem = problemOf(key);
  return buildWalkthroughFor(
    problem,
    getPattern(problem.patternSlug)!.name,
    getInputSpec(key)!,
    args,
    getProblemStoryboard(problem),
  );
}

describe("try your own input: supported problems", () => {
  it("covers the 70 problems whose inputs are numbers, strings, or lists of them", () => {
    const keys = inputSpecs.map((s) => s.problem);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBe(70);
    // The page's tiny list (kept apart so pages don't load the specs) matches the specs.
    expect([...TRY_INPUT_PROBLEMS].sort()).toEqual([...keys].sort());
    for (const key of keys) {
      const problem = problemOf(key);
      expect(problem, key).toBeDefined();
      expect(getTraceDefinition(key), key).toBeDefined();
      expect(problem.exampleFormat, key).toBe("call");
      expect(hasTryInput(problem), key).toBe(true);
    }
    // Every other problem with a trace takes a tree, a grid, a graph, intervals, or operations.
    const unsupported = getAllProblems().filter(
      (p) => getTraceDefinition(`${p.patternSlug}/${p.slug}`) && !hasTryInput(p),
    );
    expect(unsupported.length).toBe(33);
  });
});

describe.each(inputSpecs.map((s) => [s.problem, s] as const))("try your own input: %s", (key, spec) => {
  const problem = problemOf(key);
  const def = getTraceDefinition(key)!;
  const example = problem.examples[def.exampleIndex].args as unknown[];

  it("accepts the video's example, prefilled into the boxes, and builds its walkthrough", () => {
    const texts = formatInput(spec, example);
    const parsed = parseInput(spec, texts);
    expect(parsed).toEqual({ ok: true, args: example });
    const result = walkthrough(key, example);
    expect(result.ok ? "ok" : result.errors).toBe("ok");
  });

  it(`builds a correct walkthrough that fits a phone for ${RANDOM_INPUTS} random inputs`, async () => {
    const solve = await loadSolve(key);
    const rng = seeded(key.length * 7919 + key.charCodeAt(0));
    for (let n = 0; n < RANDOM_INPUTS; n++) {
      const args = randomInput(spec, rng);
      const label = `${key} ${JSON.stringify(args)}`;
      // What the boxes show parses back to the same input.
      expect(parseInput(spec, formatInput(spec, args)), label).toEqual({ ok: true, args });
      // The trace's answer is the reference solution's.
      const trace = runTrace(key, structuredClone(args));
      const expected = solve(...(structuredClone(args) as never[]));
      expect(
        judgeOutput(problem.judge, trace.answer, expected),
        `${label}: ${JSON.stringify(trace.answer)}`,
      ).toBe(true);
      // The walkthrough passes the schema, the validator, and the phone-width fit check.
      const result = walkthrough(key, args);
      expect(result.ok ? "ok" : result.errors, label).toBe("ok");
      if (result.ok) {
        expect(result.storyboard.scenes[0].id).toBe("your-input");
        expect(result.storyboard.scenes.every((s) => s.caption.length <= 80)).toBe(true);
        // Simplifying a crowded scene never leaves it empty (an empty list's steps have nothing to draw).
        const emptyInput = args.some((a) => Array.isArray(a) && a.length === 0);
        if (!emptyInput)
          expect(
            result.storyboard.scenes.filter((s) => s.elements.length === 0).map((s) => s.id),
            label,
          ).toEqual([]);
        // Only the browser voice: no stitched track.
        expect(result.storyboard.narrationTrack).toBeUndefined();
      }
    }
  });

  it("round-trips through a share link, and refuses a tampered one", () => {
    const rng = seeded(42 + key.length);
    const args = randomInput(spec, rng);
    const encoded = encodeInput(args);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const decoded = decodeInput(spec, encoded)!;
    expect(decoded).toEqual(args);
    expect(parseInput(spec, formatInput(spec, decoded))).toEqual({ ok: true, args });
    expect(decodeInput(spec, `${encoded}!`)).toBeUndefined();
    expect(decodeInput(spec, encodeInput([...args, 1]))).toBeUndefined();
    expect(decodeInput(spec, "bm90IGpzb24")).toBeUndefined();
  });
});

describe("try your own input: refusals", () => {
  const spec = (key: string) => getInputSpec(key)!;
  const errors = (key: string, texts: string[]) => {
    const parsed = parseInput(spec(key), texts);
    return parsed.ok ? [] : parsed.errors.map((e) => e.message);
  };

  it("explains a list that isn't numbers, is out of range, or has the wrong length", () => {
    expect(errors("two-pointers/pair-with-target-sum", ["1, 2, x", "3"])).toEqual([
      `"x" isn't a whole number. Use 2–8 whole numbers between −99 and 99, separated by commas.`,
    ]);
    expect(errors("two-pointers/pair-with-target-sum", ["1, 200", "3"])[0]).toMatch(
      /^200 is out of range\. Use 2–8/,
    );
    expect(errors("two-pointers/pair-with-target-sum", ["1", "3"])[0]).toMatch(/^That's 1 number\./);
    expect(errors("two-pointers/pair-with-target-sum", ["1, 2", "abc"])[0]).toBe(
      `"abc" isn't a whole number. Use a whole number between −198 and 198.`,
    );
    expect(errors("two-pointers/pair-with-target-sum", ["1, 2", ""])[0]).toBe(
      "Use a whole number between −198 and 198.",
    );
    expect(errors("two-pointers/pair-with-target-sum", ["1.5, 2", "3"])[0]).toMatch(/isn't a whole number/);
  });

  it("enforces the problem's constraints with the reason", () => {
    expect(errors("two-pointers/pair-with-target-sum", ["9, 4, 14", "13"])[0]).toMatch(
      /sorted from smallest to largest/,
    );
    expect(errors("binary-search/search-sorted-array", ["1, 3, 3, 8", "3"])[0]).toMatch(/no value twice/);
    expect(errors("binary-search/search-in-rotated-sorted-array", ["5, 1, 9, 2", "3"])[0]).toMatch(/rotated/);
    expect(errors("arrays-hashing/two-sum", ["1, 2, 3, 4", "5"])[0]).toMatch(/Exactly one pair/);
    expect(errors("bit-manipulation/single-number", ["1, 1, 2, 3"])[0]).toMatch(
      /Exactly one value must appear once/,
    );
    expect(errors("fast-slow-pointers/linked-list-cycle", ["1, 2, 3", "4"])[0]).toMatch(/pos must be −1/);
    expect(errors("fast-slow-pointers/find-the-duplicate-number", ["1, 2, 3"])[0]).toMatch(/between 1 and n/);
    expect(errors("fast-slow-pointers/circular-array-loop", ["1, 0, 2"])[0]).toMatch(/0 isn't allowed/);
    expect(errors("stack/evaluate-reverse-polish-notation", ["1 +"])[0]).toMatch(
      /isn't a complete expression/,
    );
    expect(errors("stack/evaluate-reverse-polish-notation", ["4 0 /"])[0]).toMatch(/divides by 0/);
    expect(errors("stack/decode-string", ["2[a"])[0]).toMatch(/well formed/);
    expect(errors("stack/decode-string", ["9[9[a]]"])[0]).toMatch(/more than 20 letters/);
    expect(errors("sliding-window/maximum-sum-subarray-of-size-k", ["1, 2", "3"])[0]).toMatch(
      /k can't be more/,
    );
    expect(errors("binary-search/koko-eating-bananas", ["3, 4, 5", "2"])[0]).toMatch(
      /at least the number of piles/,
    );
    expect(errors("heap/top-k-frequent-elements", ["1, 1, 2, 2, 3", "1"])[0]).toMatch(/can't tie/);
    expect(errors("greedy/gas-station", ["1, 2", "1"])[0]).toMatch(/same number of values/);
    expect(errors("greedy/lemonade-change", ["5, 15"])[0]).toMatch(
      /^15 isn't allowed here\. Use 1–8 whole numbers, each 5, 10 or 20\./,
    );
    expect(errors("dynamic-programming/coin-change", ["5, 1", "3"])[0]).toMatch(/smallest to largest/);
    expect(errors("backtracking/subsets", ["1, 1"])[0]).toMatch(/must be different/);
    expect(errors("arrays-hashing/valid-anagram", ["Abc", "abc"])[0]).toBe(
      `"A" isn't allowed here. Use 1–7 lowercase letters (a–z).`,
    );
    expect(errors("trie/replace-words", ["re", "two  spaces"])[0]).toMatch(/one space between words/);
  });

  it("is forgiving about how a list is typed", () => {
    const key = "two-pointers/pair-with-target-sum";
    for (const text of ["[4, 9, 14]", "4 9 14", "4,9,14", " 4 , 9 ,14 "])
      expect(parseInput(spec(key), [text, "23"])).toEqual({ ok: true, args: [[4, 9, 14], 23] });
    expect(parseInput(spec(key), ["−3, 4", "−1"])).toEqual({ ok: true, args: [[-3, 4], -1] });
    expect(parseInput(spec("trie/longest-common-prefix"), [`["trap", "tram"]`])).toEqual({
      ok: true,
      args: [["trap", "tram"]],
    });
  });

  it("refuses a walkthrough that doesn't fit a phone with a plain message, after simplifying what it can", () => {
    // Five four-letter words over six letters: a graph of letters too tall for a phone, even with nothing else in the
    // scene.
    const parsed = parseInput(spec("advanced-graphs/alien-dictionary"), ["bsrs, rtoa, btsb, saat, rstr"]);
    expect(parsed.ok).toBe(true);
    const result = walkthrough("advanced-graphs/alien-dictionary", (parsed as { args: unknown[] }).args);
    expect(result).toEqual({ ok: false, errors: [{ message: TOO_BIG }] });
  });

  it("captions are step notes, cut at a word boundary", () => {
    expect(captionFrom("Short note.")).toBe("Short note.");
    const long = captionFrom("word ".repeat(40));
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith("word…")).toBe(true);
  });
});

describe("try your own input: progress stays with the original video", () => {
  it("plays the walkthrough without a problem key or the tutor", async () => {
    const { walkthroughViewProps } = await import("@/components/learn/try-input-panel");
    const result = walkthrough("two-pointers/pair-with-target-sum", [[1, 3, 8], 11]);
    if (!result.ok) throw new Error("expected a walkthrough");
    const props = walkthroughViewProps(result.storyboard);
    // Without `problemKey`, LearnView's progress hook tracks nothing: no "Learning", no saved position, no resume,
    // no "Mark as done?" (see useVideoProgress).
    expect("problemKey" in props).toBe(false);
    expect(props.askEnabled).toBe(false);
  });

  it("renders the walkthrough's player only through those props, and one player at a time", () => {
    const panel = readFileSync("src/components/learn/try-input-panel.tsx", "utf8");
    const players = panel.match(/<LearnView[^>]*>/g) ?? [];
    expect(players.length).toBe(1);
    expect(players[0]).toMatch(/\{\.\.\.walkthroughViewProps\(/);
    expect(players[0]).not.toMatch(/problemKey/);
    // The section shows either the original video (with progress) or the walkthrough, never both: they share the
    // player store.
    const section = readFileSync("src/components/learn/video-section.tsx", "utf8");
    expect(section).toMatch(/mode === "original" \|\| !tryInput \? \(\s*<LearnView/);
  });
});
