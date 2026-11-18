import { describe, expect, it } from "vitest";

import { twoPointersStoryboard } from "@/content/storyboards/two-pointers";
import {
  getSceneTimeline,
  sceneIndexAtFrame,
  storyboardSchema,
  validateStoryboard,
  type Storyboard,
} from "@/lib/storyboard";

/** Deep-copy so mutations in one test never leak into another. */
const clone = (): Storyboard => structuredClone(twoPointersStoryboard);

describe("two-pointers storyboard", () => {
  it("passes the Zod schema", () => {
    const result = storyboardSchema.safeParse(twoPointersStoryboard);
    expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
  });

  it("has 6–9 scenes and uses an analogy", () => {
    expect(twoPointersStoryboard.scenes.length).toBeGreaterThanOrEqual(6);
    expect(twoPointersStoryboard.scenes.length).toBeLessThanOrEqual(9);
    expect(twoPointersStoryboard.exampleSource).toBe("analogy");
    expect(twoPointersStoryboard.analogy?.mapping.length).toBeGreaterThan(0);
  });

  it("passes the trace validator", () => {
    const result = validateStoryboard(twoPointersStoryboard);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe("validator catches wrong storyboards", () => {
  it("rejects a pointer the algorithm would never reach", () => {
    const sb = clone();
    const scene = sb.scenes.find((s) => s.id === "check-2");
    const you = scene?.elements.find((el) => el.id === "you");
    if (you?.type !== "pointer") throw new Error("fixture changed");
    you.index = 3; // the algorithm moves to index 1, not 3
    const result = validateStoryboard(sb);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.sceneId === "check-2")).toBe(true);
  });

  it("rejects an equation with the wrong comparison", () => {
    const sb = clone();
    const eq = sb.scenes.find((s) => s.id === "check-1")?.elements.find((el) => el.id === "sum");
    if (eq?.type !== "equation" || !eq.comparison) throw new Error("fixture changed");
    eq.terms = [4, 46];
    eq.result = 50;
    eq.comparison.op = "=";
    const result = validateStoryboard(sb);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.message).join("\n")).toMatch(/should be 4 \+ 45|trace compares/);
  });

  it("rejects false arithmetic even without a trace", () => {
    const sb = clone();
    delete sb.trace;
    const eq = sb.scenes.find((s) => s.id === "found")?.elements.find((el) => el.id === "sum");
    if (eq?.type !== "equation") throw new Error("fixture changed");
    eq.result = 51;
    expect(validateStoryboard(sb).ok).toBe(false);
  });

  it("rejects the wrong answer", () => {
    const sb = clone();
    const hl = sb.scenes.find((s) => s.id === "found")?.elements.find((el) => el.id === "match");
    if (hl?.type !== "highlight") throw new Error("fixture changed");
    hl.indices = [3, 4];
    expect(validateStoryboard(sb).ok).toBe(false);
  });
});

describe("storyboard schema", () => {
  it("rejects a storyboard missing exampleSource", () => {
    const { exampleSource: _omit, ...rest } = clone();
    void _omit;
    const result = storyboardSchema.safeParse(rest);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "exampleSource")).toBe(true);
  });

  it("requires an analogy when exampleSource is analogy", () => {
    const { analogy: _omit, ...rest } = clone();
    void _omit;
    expect(storyboardSchema.safeParse(rest).success).toBe(false);
  });

  it("forbids an analogy on problem-native storyboards", () => {
    const sb = { ...clone(), exampleSource: "problem-native" };
    expect(storyboardSchema.safeParse(sb).success).toBe(false);
  });

  it("rejects an unknown element type", () => {
    const sb = clone();
    const bad = { ...sb, scenes: [{ ...sb.scenes[0], elements: [{ id: "x", type: "staircase" }] }] };
    expect(storyboardSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a pointer pointing past the end of its row", () => {
    const sb = clone();
    const you = sb.scenes[2].elements.find((el) => el.type === "pointer");
    if (you?.type !== "pointer") throw new Error("fixture changed");
    you.index = 99;
    expect(storyboardSchema.safeParse(sb).success).toBe(false);
  });
});

describe("scene timeline", () => {
  it("covers every frame with exactly one current scene", () => {
    const { timings, durationInFrames } = getSceneTimeline(twoPointersStoryboard.scenes);
    expect(timings[0].startFrame).toBe(0);
    expect(timings.at(-1)?.endFrame).toBe(durationInFrames);
    for (let i = 1; i < timings.length; i++) {
      expect(timings[i].startFrame).toBe(timings[i - 1].endFrame);
    }
    timings.forEach((t, i) => expect(sceneIndexAtFrame(timings, t.seekFrame)).toBe(i));
  });
});
