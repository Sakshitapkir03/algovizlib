import { describe, expect, it } from "vitest";

import { storyboards } from "@/content/storyboards";
import { sceneSchema, validateStoryboard, type Element, type Storyboard } from "@/lib/storyboard";

const byProblem = (problem: string) =>
  storyboards.find((sb) => sb.trace?.problem === `sliding-window/${problem}`)!;

/** A copy with one element of one scene changed. */
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

describe("sliding window storyboards", () => {
  it.each([
    "maximum-sum-subarray-of-size-k",
    "longest-substring-without-repeating-characters",
    "longest-repeating-character-replacement",
    "minimum-window-substring",
    "sliding-window-maximum",
  ])("%s is attached, validates, and keeps narration under 1,200 characters", (slug) => {
    const sb = byProblem(slug);
    expect(sb, slug).toBeDefined();
    expect(validateStoryboard(sb).issues).toEqual([]);
    expect(sb.scenes.reduce((sum, s) => sum + s.narration.length, 0)).toBeLessThanOrEqual(1200);
  });

  it("windows slide from where the previous bound scene left them", () => {
    const sb = byProblem("maximum-sum-subarray-of-size-k");
    const windows = sb.scenes.flatMap((s) => s.elements.filter((e) => e.type === "window"));
    expect(windows[0]).toMatchObject({ from: 0, to: 2, value: 13 - 3, fromRange: undefined });
    expect(windows[1]).toMatchObject({ from: 1, to: 3, value: 9, fromRange: { from: 0, to: 2 } });
  });

  it("rejects a window in the wrong place, with the wrong value, or sliding from the wrong place", () => {
    const sb = byProblem("maximum-sum-subarray-of-size-k");
    const moved = mutate(sb, "new-best", "window", (el) => ({ ...el, from: 3, to: 5 }) as Element);
    expect(messages(moved)).toContain("Window doesn't match trace step 2");
    const wrongSum = mutate(sb, "new-best", "window", (el) => ({ ...el, value: 14 }) as Element);
    expect(messages(wrongSum)).toContain("Window value doesn't match trace step 2");
    const wrongSlide = mutate(
      sb,
      "new-best",
      "window",
      (el) => ({ ...el, fromRange: { from: 0, to: 2 } }) as Element,
    );
    expect(messages(wrongSlide)).toContain("Window should slide from where the previous scene left it");
  });

  it("rejects wrong character counts and a wrong changed letter", () => {
    const sb = byProblem("longest-repeating-character-replacement");
    const counts = mutate(sb, "too-many", "freq-table", (el) =>
      el.type === "freq-table"
        ? { ...el, entries: el.entries.map((e) => (e.key === "B" ? { ...e, count: 3 } : e)) }
        : el,
    );
    expect(messages(counts)).toContain("Character counts don't match trace step 3");
    const active = mutate(sb, "too-many", "freq-table", (el) => ({ ...el, active: "A" }) as Element);
    expect(messages(active)).toContain("The changed count doesn't match trace step 3");
  });

  it("rejects a wrong deque, wrong removals, and wrong output", () => {
    const sb = byProblem("sliding-window-maximum");
    const order = mutate(sb, "first-max", "deque", (el) => ({ ...el, indices: [2, 1] }) as Element);
    expect(messages(order)).toContain("Deque positions don't match trace step 2");
    const popped = mutate(sb, "both-ends", "deque", (el) => ({ ...el, poppedFront: [] }) as Element);
    expect(messages(popped)).toContain("Values removed from the front don't match trace step 4");
    const output = mutate(sb, "answer", "deque", (el) => ({ ...el, output: [7, 7, 5, 5, 5] }) as Element);
    expect(messages(output)).toContain("The output so far doesn't match trace step 7");
  });

  it("schema: windows stay on the row, counts have unique keys, deques reference real positions", () => {
    const row = { id: "row", type: "item-row", items: [1, 2, 3].map((v) => ({ label: `${v}`, value: v })) };
    const scene = (el: Record<string, unknown>) =>
      sceneSchema.safeParse({
        id: "s",
        narration: "n",
        caption: "c",
        durationInFrames: 60,
        elements: [row, el],
      });
    expect(scene({ id: "w", type: "window", rowId: "row", from: 1, to: 2 }).success).toBe(true);
    expect(scene({ id: "w", type: "window", rowId: "row", from: 2, to: 1 }).success).toBe(true); // empty
    expect(scene({ id: "w", type: "window", rowId: "row", from: 2, to: 0 }).success).toBe(false);
    expect(scene({ id: "w", type: "window", rowId: "row", from: 1, to: 3 }).success).toBe(false);
    expect(
      scene({
        id: "f",
        type: "freq-table",
        entries: [
          { key: "A", count: 1 },
          { key: "A", count: 2 },
        ],
      }).success,
    ).toBe(false);
    expect(
      scene({ id: "f", type: "freq-table", entries: [{ key: "A", count: 1 }], active: "B" }).success,
    ).toBe(false);
    expect(scene({ id: "d", type: "deque", rowId: "row", indices: [0, 5], output: [] }).success).toBe(false);
  });
});
