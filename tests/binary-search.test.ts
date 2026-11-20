import { describe, expect, it } from "vitest";

import { storyboards } from "@/content/storyboards";
import {
  sceneSchema,
  validateStoryboard,
  type Element,
  type PointerElement,
  type Storyboard,
} from "@/lib/storyboard";
import { layoutScene, pointerLevel } from "@/video/layout";

const byProblem = (problem: string) =>
  storyboards.find((sb) => sb.trace?.problem === `binary-search/${problem}`)!;

/** A copy with every element of one type in one scene changed. */
function mutate(
  sb: Storyboard,
  sceneId: string,
  type: Element["type"],
  change: (el: Element) => Element,
): Storyboard {
  const copy = structuredClone(sb);
  const scene = copy.scenes.find((s) => s.id === sceneId)!;
  scene.elements = scene.elements.map((el) => (el.type === type ? change(el) : el));
  return copy;
}

const messages = (sb: Storyboard) => validateStoryboard(sb).issues.map((i) => i.message);
const sceneOf = (sb: Storyboard, id: string) => sb.scenes.find((s) => s.id === id)!;
const pointers = (sb: Storyboard, id: string) =>
  Object.fromEntries(
    sceneOf(sb, id)
      .elements.filter((e): e is PointerElement => e.type === "pointer")
      .map((p) => [p.binds, p.index]),
  );

describe("binary search storyboards", () => {
  it.each([
    "search-sorted-array",
    "search-insert-position",
    "search-in-rotated-sorted-array",
    "koko-eating-bananas",
    "median-of-two-sorted-arrays",
  ])("%s is attached, validates, and keeps narration around 1,000 characters", (slug) => {
    const sb = byProblem(slug);
    expect(sb, slug).toBeDefined();
    expect(validateStoryboard(sb).issues).toEqual([]);
    expect(sb.scenes.reduce((sum, s) => sum + s.narration.length, 0)).toBeLessThanOrEqual(1200);
  });

  it("Koko keeps its own scenario; the others use an analogy", () => {
    expect(byProblem("koko-eating-bananas")).toMatchObject({ exampleSource: "problem-native" });
    expect(byProblem("koko-eating-bananas").analogy).toBeUndefined();
    for (const slug of ["search-sorted-array", "search-insert-position", "median-of-two-sorted-arrays"])
      expect(byProblem(slug).exampleSource).toBe("analogy");
  });

  it("Search Insert Position: mid 1 holds 5 < 7, so low becomes 2, and the words say so", () => {
    const sb = byProblem("search-insert-position");
    expect(pointers(sb, "later")).toEqual({ low: 0, mid: 2, high: 2 });
    expect(pointers(sb, "earlier")).toEqual({ low: 2, mid: 1, high: 2 });
    expect(sceneOf(sb, "earlier").narration).toMatch(
      /position 1, the minute-5 bus.*low becomes 1 plus 1, which is 2/,
    );
    expect(sceneOf(sb, "later").narration).toMatch(/high moves to 2/);
    expect(pointers(sb, "meet")).toEqual({ low: 2, high: 2 });
    // The empty range marks the gap before position 2.
    expect(sceneOf(sb, "meet").elements.find((e) => e.type === "search-range")).toMatchObject({
      from: 2,
      to: 1,
    });
  });

  it("search ranges shrink from where the previous bound scene left them", () => {
    const sb = byProblem("search-sorted-array");
    const range = (id: string) => sceneOf(sb, id).elements.find((e) => e.type === "search-range");
    expect(range("all-in-play")).toMatchObject({ from: 0, to: 6, fromRange: undefined });
    expect(range("too-low")).toMatchObject({ from: 4, to: 6, mid: 3, fromRange: { from: 0, to: 6 } });
    expect(range("too-high")).toMatchObject({ from: 4, to: 4, mid: 5, fromRange: { from: 4, to: 6 } });
  });

  it("rejects a wrong range, a wrong middle, a wrong sorted half, or a range shrinking from the wrong place", () => {
    const sb = byProblem("search-in-rotated-sorted-array");
    const range = mutate(sb, "keep-right", "search-range", (el) => ({ ...el, from: 0, to: 2 }) as Element);
    expect(messages(range)).toContain("Search range doesn't match trace step 2");
    const mid = mutate(sb, "keep-right", "search-range", (el) => ({ ...el, mid: 4 }) as Element);
    expect(messages(mid)).toContain("The middle doesn't match trace step 2");
    const sorted = mutate(
      sb,
      "sorted-right",
      "search-range",
      (el) => ({ ...el, sorted: { from: 0, to: 3 } }) as Element,
    );
    expect(messages(sorted)).toContain("The sorted half doesn't match trace step 1");
    const slide = mutate(
      sb,
      "keep-left",
      "search-range",
      (el) => ({ ...el, fromRange: { from: 0, to: 6 } }) as Element,
    );
    expect(messages(slide)).toContain("Search range should shrink from where the previous scene left it");
  });

  it("number lines follow the trace, and feasibility verdicts read as fits / too slow", () => {
    const sb = byProblem("koko-eating-bananas");
    const line = (id: string) => sceneOf(sb, id).elements.find((e) => e.type === "number-line");
    expect(line("speeds")).toMatchObject({ min: 1, max: 13, low: 1, high: 13, mid: undefined });
    expect(line("try-4")).toMatchObject({ low: 5, high: 7, mid: 4 });
    expect(line("answer")).toMatchObject({ low: 6, high: 6 });
    const tone = (id: string) =>
      sceneOf(sb, id).elements.flatMap((e) => (e.type === "equation" ? [e.verdictTone] : []))[0];
    // 7 = 7 hours fits (positive) even though the sign is "="; 8 > 7 is too slow.
    expect([tone("try-7"), tone("try-6"), tone("try-5")]).toEqual(["positive", "positive", "negative"]);

    const wrong = mutate(sb, "try-4", "number-line", (el) => ({ ...el, low: 4 }) as Element);
    expect(messages(wrong)).toContain("Candidate answers don't match trace step 2");
    const wrongMid = mutate(sb, "try-4", "number-line", (el) => ({ ...el, mid: 5 }) as Element);
    expect(messages(wrongMid)).toContain("Candidate answers don't match trace step 2");
  });

  it("cuts follow each list, and the second list must hold the trace's second array", () => {
    const sb = byProblem("median-of-two-sorted-arrays");
    const cuts = (id: string) =>
      sceneOf(sb, id)
        .elements.filter((e) => e.type === "cut")
        .map((c) => (c.type === "cut" ? [c.rowId, c.at, c.fromAt] : []));
    expect(cuts("cut-too-left")).toEqual([
      ["row", 1, undefined],
      ["row2", 3, undefined],
    ]);
    expect(cuts("check-a")).toEqual([
      ["row", 2, 1],
      ["row2", 2, 3],
    ]);

    const copy = structuredClone(sb);
    const cutB = sceneOf(copy, "check-a").elements.find((e) => e.id === "cut-b")!;
    Object.assign(cutB, { at: 3, fromAt: undefined });
    expect(messages(copy)).toContain('The cut in "row2" doesn\'t match trace step 2');

    const swapped = mutate(sb, "check-a", "item-row", (el) =>
      el.type === "item-row" && el.id === "row2" ? { ...el, traceRow: "first" } : el,
    );
    expect(messages(swapped)).toContain('Row "row2" must hold the trace\'s values');
    const slide = mutate(sb, "check-a", "cut", (el) => ({ ...el, fromAt: 0 }) as Element);
    expect(messages(slide)).toContain("The cut should slide from where the previous scene left it");
  });

  it("schema: ranges stay on the row (an empty one may sit at the end), number lines stay ordered, cuts fit", () => {
    const row = { id: "row", type: "item-row", items: [1, 2, 3].map((v) => ({ label: `${v}`, value: v })) };
    const scene = (el: Record<string, unknown>) =>
      sceneSchema.safeParse({
        id: "s",
        narration: "n",
        caption: "c",
        durationInFrames: 60,
        elements: [row, el],
      }).success;
    expect(scene({ id: "r", type: "search-range", rowId: "row", from: 0, to: 2, mid: 1 })).toBe(true);
    expect(scene({ id: "r", type: "search-range", rowId: "row", from: 3, to: 2 })).toBe(true); // insert at the end
    expect(scene({ id: "r", type: "search-range", rowId: "row", from: 4, to: 3 })).toBe(false);
    expect(scene({ id: "r", type: "search-range", rowId: "row", from: 0, to: 3 })).toBe(false);
    expect(scene({ id: "r", type: "search-range", rowId: "row", from: 0, to: 2, mid: 5 })).toBe(false);
    expect(scene({ id: "n", type: "number-line", min: 1, max: 13, low: 5, high: 7, mid: 4 })).toBe(true);
    expect(scene({ id: "n", type: "number-line", min: 1, max: 13, low: 8, high: 7 })).toBe(false);
    expect(scene({ id: "n", type: "number-line", min: 1, max: 20, low: 1, high: 20 })).toBe(false); // 20 ticks
    expect(scene({ id: "c", type: "cut", rowId: "row", at: 3 })).toBe(true);
    expect(scene({ id: "c", type: "cut", rowId: "row", at: 4 })).toBe(false);
  });

  it("pointers on the same position stack instead of overlapping", () => {
    const sb = byProblem("search-sorted-array");
    const scene = sceneOf(sb, "too-high");
    const [low, high] = ["low", "high"].map(
      (name) => scene.elements.find((e) => e.type === "pointer" && e.binds === name) as PointerElement,
    );
    expect(low.index).toBe(high.index);
    expect([pointerLevel(low, scene.elements), pointerLevel(high, scene.elements)]).toEqual([0, 1]);
    // The cards keep their full height: the short bottom stack moves down to make room.
    expect(layoutScene(scene.elements).rows.row.cardHeight).toBe(124);
  });
});
