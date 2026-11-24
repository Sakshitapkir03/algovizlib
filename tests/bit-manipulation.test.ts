import { describe, expect, it } from "vitest";

import { getProblem } from "@/lib/catalog/repository";
import { assembleStoryboard, evaluateDraft, type GenerationContext } from "@/lib/generation/draft";
import { resolveStoryboard, storyboardSourceSchema, validateStoryboard } from "@/lib/storyboard";
import { getTraceDefinition } from "@/lib/traces";
import { layoutScene } from "@/video/layout";
import { PHONE_PLAYER_WIDTH, textMetrics } from "@/video/text";

import { bitsProblems } from "@/video/fit/bits";
import { buildDraft, traceFor } from "./fixtures/drafts";
import { searchProblems } from "@/video/fit/search";

const BITS = [
  "bit-manipulation/single-number",
  "bit-manipulation/counting-bits",
  "bit-manipulation/single-number-ii",
  "bit-manipulation/sum-of-two-integers",
  "bit-manipulation/shortest-path-visiting-all-nodes",
];

/** Every row's value fits the width, and a result row is its operation applied to the rows above it. */
describe("bit traces", () => {
  it.each(BITS)("%s: fits a 10-scene video, and every value fits the bit width", (key) => {
    const { trace } = traceFor(key);
    expect(trace.steps.filter((s) => s.key).length + 3).toBeLessThanOrEqual(10);
    expect(trace.steps.at(-1)!.key).toBe(true);
    for (const step of trace.steps) {
      const { width, rows } = step.bits!;
      for (const row of rows) {
        expect(row.value).toBeGreaterThanOrEqual(0);
        expect(row.value).toBeLessThan(2 ** width);
      }
    }
  });

  it("Single Number XORs everything: pairs cancel and 9 is left", () => {
    const { trace } = traceFor("bit-manipulation/single-number");
    for (const step of trace.steps) {
      const [acc, x, next] = step.bits!.rows;
      expect(next.value).toBe(acc.value ^ x.value);
      expect(next.changed).toEqual([0, 1, 2, 3].filter((k) => (x.value >> k) & 1));
    }
    expect(trace.answer).toBe(9);
  });

  it("Counting Bits reads ones[i >> 1] and adds the dropped bit, with the shift sliding right", () => {
    const { trace } = traceFor("bit-manipulation/counting-bits");
    const six = trace.steps.at(-1)!;
    expect(six.bits!.rows.map((r) => r.value)).toEqual([6, 3, 0]);
    expect(six.bits!.rows[1].from).toEqual({ value: 6, shift: -1 });
    expect(six.table!.reads).toEqual([{ at: [0, 3], label: "i>>1" }]);
    expect(trace.answer).toEqual([0, 1, 1, 2, 1, 2, 2]);
  });

  it("Single Number II counts each bit modulo 3: the third 5 clears its bits from both masks", () => {
    const { trace } = traceFor("bit-manipulation/single-number-ii");
    const masks = trace.steps.map((s) => s.bits!.rows.slice(1).map((r) => r.value));
    expect(masks).toEqual([
      [5, 0],
      [4, 1],
      [0, 4],
      [1, 0],
    ]);
    expect(trace.answer).toBe(1);
  });

  it("Sum of Two Integers repeats XOR and shifted AND until the carry is 0", () => {
    const { trace } = traceFor("bit-manipulation/sum-of-two-integers");
    const rounds = trace.steps.filter((s) => s.kind === "round");
    expect(rounds.map((s) => s.bits!.rows.map((r) => r.value))).toEqual([
      [5, 7, 2, 10],
      [2, 10, 8, 4],
      [8, 4, 12, 0],
    ]);
    for (const s of rounds) {
      const [x, y, , carry] = s.bits!.rows;
      expect(carry.from).toEqual({ value: x.value & y.value, shift: 1 });
    }
    expect(trace.answer).toBe(12);
  });

  it("Shortest Path follows a walk whose mask gains one node's bit per move until all are set", () => {
    const { trace } = traceFor("bit-manipulation/shortest-path-visiting-all-nodes");
    const masks = trace.steps.map((s) => s.bits!.rows.at(-1)!.value);
    masks.slice(1).forEach((m, k) => expect(m).toBeGreaterThan(masks[k]));
    expect(masks.at(-1)).toBe(0b11111);
    for (const s of trace.steps)
      expect(s.found!.length).toBe(s.bits!.rows.at(-1)!.value.toString(2).replaceAll("0", "").length);
    expect(trace.answer).toBe(4);
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
    patternName: "Bit Manipulation",
    definition: getTraceDefinition(key)!,
    args: traceFor(key).args,
  };
}

describe("bit storyboards", () => {
  it.each(BITS)("%s: a fixture draft passes and fits at phone and full size", (key) => {
    const result = evaluateDraft(buildDraft(key), context(key), META);
    expect(result.issues).toEqual([]);
    if (!result.ok) return;
    for (const width of [PHONE_PLAYER_WIDTH, 1280])
      for (const scene of result.storyboard.scenes) {
        const t = textMetrics(width);
        expect(bitsProblems(scene.elements, t), `${scene.id} at ${width}`).toEqual([]);
        if (scene.elements.some((e) => e.type === "graph"))
          expect(searchProblems(scene.elements, t, "graph"), `${scene.id} at ${width}`).toEqual([]);
        const { rows, bottomTop } = layoutScene(scene.elements, t);
        for (const row of Object.values(rows))
          expect(row.top + row.cardHeight, `${scene.id} at ${width}`).toBeLessThanOrEqual(bottomTop);
      }
  });

  type Source = ReturnType<typeof assembleStoryboard>;
  const source = (key: string): Source =>
    structuredClone(assembleStoryboard(buildDraft(key), context(key), META));
  const issues = (sb: Source) => {
    const { storyboard, issues } = resolveStoryboard(storyboardSourceSchema.parse(sb));
    return [...issues, ...(storyboard ? validateStoryboard(storyboard).issues : [])]
      .map((i) => i.message)
      .join("\n");
  };
  const SUM = "bit-manipulation/sum-of-two-integers";
  const mutate = (step: number, change: (rows: Record<string, unknown>[]) => void) => {
    const sb = source(SUM);
    const scene = sb.scenes.find((s) => s.traceStep === step)!;
    const el = scene.elements.find((e) => e.type === "bits") as Record<string, unknown>;
    const rows = structuredClone(traceFor(SUM).trace.steps[step].bits!.rows) as Record<string, unknown>[];
    change(rows);
    Object.assign(el, { width: 5, rows });
    return issues(sb);
  };

  it("the fixture sources resolve and validate", () => {
    for (const key of BITS) expect(issues(source(key)), key).toBe("");
  });

  it("rejects a wrong bit, operator, changed bit, or shift", () => {
    expect(mutate(0, () => {})).toBe("");
    expect(mutate(0, (rows) => (rows[2].value = 3))).toMatch(/bits' rows don't match/);
    expect(mutate(0, (rows) => (rows[2].op = "&"))).toMatch(/bits' rows don't match/);
    expect(mutate(0, (rows) => (rows[2].changed = [1]))).toMatch(/bits' rows don't match/);
    expect(mutate(0, (rows) => (rows[3].from = { value: 4, shift: 1 }))).toMatch(/bits' rows don't match/);
  });

  it("schema: values fit the width, changed bits are columns, labels match the width", () => {
    expect(mutate(0, (rows) => (rows[0].value = 40))).toMatch(/40 doesn't fit 5 bits/);
    expect(mutate(0, (rows) => (rows[2].changed = [7]))).toMatch(/bit positions are 0–4/);
    const sb = source(SUM);
    const el = sb.scenes.find((s) => s.traceStep === 0)!.elements.find((e) => e.type === "bits") as Record<
      string,
      unknown
    >;
    el.bitLabels = ["a", "b"];
    expect(issues(sb)).toMatch(/one label per bit: 5/);
  });

  it("a bits panel needs a bound step", () => {
    const sb = source(SUM);
    sb.scenes[0].elements.push({
      id: "b",
      type: "bits",
      width: 4,
      rows: [{ name: "x", value: 5 }],
      enterAt: 0,
    } as never);
    expect(issues(sb)).toMatch(/A bits panel needs the scene to set traceStep/);
  });
});
