import { describe, expect, it } from "vitest";

import { getProblem } from "@/lib/catalog/repository";
import { assembleStoryboard, evaluateDraft, type GenerationContext } from "@/lib/generation/draft";
import { resolveStoryboard, storyboardSourceSchema, validateStoryboard } from "@/lib/storyboard";
import { getTraceDefinition } from "@/lib/traces";
import { layoutScene } from "@/video/layout";
import { PHONE_PLAYER_WIDTH, TEXT, textMetrics } from "@/video/text";

import { buildDraft, traceFor } from "./fixtures/drafts";

const HASHING = [
  "arrays-hashing/two-sum",
  "arrays-hashing/valid-anagram",
  "arrays-hashing/group-anagrams",
  "arrays-hashing/longest-consecutive-sequence",
];

describe("hashing traces", () => {
  it.each(HASHING)("%s: every lookup's answer matches the map", (key) => {
    const { trace } = traceFor(key);
    expect(trace.steps.filter((s) => s.key).length + 3).toBeLessThanOrEqual(10);
    let before: string[] = [];
    for (const step of trace.steps) {
      const map = step.map!;
      const keys = map.entries.map((e) => e.key);
      // Found means it's in the map; not found means it wasn't there before this step.
      if (map.lookup?.found) expect(keys).toContain(map.lookup.key);
      if (map.lookup && !map.lookup.found) expect(before).not.toContain(map.lookup.key);
      if (map.inserted) expect(before).not.toContain(map.inserted);
      if (map.updated) expect(keys).toContain(map.updated.key);
      before = keys;
    }
  });

  it("Two Sum finds the partner in one look", () => {
    const { trace } = traceFor("arrays-hashing/two-sum");
    const last = trace.steps.at(-1)!;
    expect(last.map!.lookup).toEqual({ key: "3", found: true });
    expect(last.equation).toMatchObject({ terms: [9, 6], operator: "-", result: 3, tone: "positive" });
    expect(trace.steps[0].equation!.tone).toBe("neutral");
    expect(trace.answer).toEqual([1, 3]);
  });

  it("Group Anagrams files each word under its sorted letters", () => {
    const { trace } = traceFor("arrays-hashing/group-anagrams");
    expect(trace.steps.at(-1)!.map!.entries).toEqual([
      { key: "opst", value: "stop, pots, tops" },
      { key: "art", value: "rat, art" },
      { key: "act", value: "cat" },
    ]);
  });

  it("Longest Consecutive skips values that aren't a run's start and walks each run once", () => {
    const { trace } = traceFor("arrays-hashing/longest-consecutive-sequence");
    const skipped = trace.steps.filter((s) => s.kind === "skip").map((s) => s.map!.lookup!.key);
    expect(skipped).toEqual(["11", "3", "2", "1", "12"]);
    expect(trace.steps.filter((s) => s.kind === "extend")).toHaveLength(5);
    expect(trace.answer).toBe(4);
  });

  it("First Missing Positive swaps each value into its own slot", () => {
    const { trace } = traceFor("arrays-hashing/first-missing-positive");
    expect(trace.steps.filter((s) => s.kind === "swap").map((s) => s.values)).toEqual([
      [1, 4, 2],
      [1, 2, 4],
    ]);
    expect(trace.steps.at(-1)!.rejected).toEqual([2]);
  });
});

const META = {
  promptVersion: "test",
  provider: "fake",
  model: "fake",
  generatedAt: "2026-01-01T00:00:00.000Z",
  repairAttempts: 0,
};

function context(key: string): GenerationContext {
  const [pattern, slug] = key.split("/");
  return {
    problem: getProblem(pattern, slug)!,
    patternName: "Arrays & Hashing",
    definition: getTraceDefinition(key)!,
    args: traceFor(key).args,
  };
}

describe("hashing storyboards", () => {
  it.each([...HASHING, "arrays-hashing/first-missing-positive"])(
    "%s: a fixture draft passes, and the rows clear the map at phone and full size",
    (key) => {
      const result = evaluateDraft(buildDraft(key), context(key), META);
      expect(result.issues).toEqual([]);
      if (!result.ok) return;
      for (const width of [PHONE_PLAYER_WIDTH, 1280]) {
        const t = textMetrics(width);
        const captionBottom = 70 + 2 * Math.ceil(t.size(TEXT.caption) * 1.25);
        for (const scene of result.storyboard.scenes) {
          const { rows, bottomTop } = layoutScene(scene.elements, t);
          for (const row of Object.values(rows)) {
            expect(row.top + row.cardHeight, `${scene.id} at ${width}`).toBeLessThanOrEqual(bottomTop);
            expect(row.reservedTop, `${scene.id} at ${width}`).toBeGreaterThanOrEqual(captionBottom);
          }
        }
      }
    },
  );

  type Source = ReturnType<typeof assembleStoryboard>;
  const source = (key: string): Source =>
    structuredClone(assembleStoryboard(buildDraft(key), context(key), META));
  const issues = (sb: Source) => {
    const { storyboard, issues } = resolveStoryboard(storyboardSourceSchema.parse(sb));
    return [...issues, ...(storyboard ? validateStoryboard(storyboard).issues : [])]
      .map((i) => i.message)
      .join("\n");
  };
  const two = "arrays-hashing/two-sum";
  const mutate = (step: number, change: (el: Record<string, unknown>) => void) => {
    const sb = source(two);
    const scene = sb.scenes.find((s) => s.traceStep === step)!;
    change(scene.elements.find((e) => e.type === "hash-map") as Record<string, unknown>);
    return issues(sb);
  };

  it("the fixture source resolves and validates", () => {
    expect(issues(source(two))).toBe("");
  });

  it("rejects wrong entries, a wrong lookup or result, and a wrong insert", () => {
    expect(
      mutate(
        1,
        (m) =>
          (m.entries = [
            { key: "8", value: "#0" },
            { key: "3", value: "#2" },
          ]),
      ),
    ).toMatch(/map's entries doesn't match/);
    expect(mutate(1, (m) => (m.lookup = { key: "5", found: false }))).toMatch(/map's lookup doesn't match/);
    expect(mutate(1, (m) => (m.inserted = "8"))).toMatch(/map's inserted doesn't match/);
  });

  it("schema: a lookup's result must agree with the map, and a set has no values", () => {
    expect(
      mutate(3, (m) => {
        m.entries = [
          { key: "8", value: "#0" },
          { key: "3", value: "#1" },
        ];
        m.lookup = { key: "3", found: false };
      }),
    ).toMatch(/says not found, but the map has it/);
    expect(
      mutate(1, (m) => {
        m.kind = "set";
        m.display = "cells";
        m.entries = [{ key: "8", value: "#0" }];
      }),
    ).toMatch(/a set's entries have no values/);
  });

  it("an unbound map is empty", () => {
    const sb = source(two);
    sb.scenes[0].elements.push({
      id: "m",
      type: "hash-map",
      enterAt: 0,
      entries: [{ key: "8", value: "#0" }],
    } as never);
    expect(issues(sb)).toMatch(/Without a traceStep, the map is empty/);
  });
});
