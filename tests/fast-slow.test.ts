import { describe, expect, it } from "vitest";

import { getProblem } from "@/lib/catalog/repository";
import { assembleStoryboard, evaluateDraft, type GenerationContext } from "@/lib/generation/draft";
import { resolveStoryboard, storyboardSourceSchema, validateStoryboard } from "@/lib/storyboard";
import { getTraceDefinition } from "@/lib/traces";
import { PHONE_PLAYER_WIDTH, textMetrics } from "@/video/text";

import { buildDraft, traceFor } from "./fixtures/drafts";
import { raceProblems } from "./fixtures/race-fit";

const RACES = [
  "fast-slow-pointers/linked-list-cycle",
  "fast-slow-pointers/middle-of-the-linked-list",
  "fast-slow-pointers/linked-list-cycle-ii",
  "fast-slow-pointers/find-the-duplicate-number",
  "fast-slow-pointers/circular-array-loop",
];

describe("fast and slow traces", () => {
  it.each(RACES)(
    "%s: every move follows the links, at the right speed, and ends where the pointer is",
    (key) => {
      const { trace } = traceFor(key);
      expect(trace.steps.filter((s) => s.key).length + 3).toBeLessThanOrEqual(10);
      for (const step of trace.steps) {
        const race = step.race!;
        const next = new Map(step.links!.nodes.map((n) => [n.id, n.next]));
        for (const move of race.moves) {
          const stops = [move.from, ...move.path, move.to];
          stops.forEach((id, k) => k > 0 && expect(next.get(stops[k - 1] as number)).toBe(id));
          expect(move.hops).toBe(stops.length - 1);
          // Phase 1: slow takes 1 hop and fast 2 (fewer only when refused); phase 2: 1 each.
          const speed = race.phase === 2 || move.pointer === "slow" ? 1 : 2;
          if (move.blocked === undefined && move.to !== null) expect(move.hops).toBe(speed);
          if (move.to !== null) expect(step.pointers[move.pointer]).toBe(move.to);
        }
        if (race.meet !== undefined && race.phase === 1) expect(step.pointers.slow).toBe(race.meet);
        if (race.loop) expect(next.get(race.loop.from)).toBe(race.loop.to);
      }
    },
  );

  it.each(["fast-slow-pointers/linked-list-cycle-ii", "fast-slow-pointers/find-the-duplicate-number"])(
    "%s: the pointers meet away from the loop's start, so phase 2 has a walk to show",
    (key) => {
      const { trace } = traceFor(key);
      const last = trace.steps.at(-1)!.race!;
      expect(last.entry).toBeDefined();
      expect(last.meet).not.toBe(last.entry);
      // head → entry = meet → entry: the restart scene's equation says so.
      const restart = trace.steps.find((s) => s.kind === "restart")!;
      expect(restart.equation).toMatchObject({ comparison: { op: "=" }, tone: "positive" });
      expect(restart.equation!.result).toBe(restart.equation!.comparison!.target);
      expect(
        trace.steps.filter((s) => s.race!.phase === 2 && s.race!.moves.length > 0).length,
      ).toBeGreaterThan(0);
    },
  );

  it("Linked List Cycle II meets at 50 and finds the loop at 30", () => {
    const { trace } = traceFor("fast-slow-pointers/linked-list-cycle-ii");
    const values = trace.row.values;
    const last = trace.steps.at(-1)!.race!;
    expect(values[last.meet!]).toBe(50);
    expect(values[last.entry!]).toBe(30);
    expect(trace.answer).toBe(2);
  });

  it("Find the Duplicate walks indices from 0 and finds 4 where the loop starts", () => {
    const { trace } = traceFor("fast-slow-pointers/find-the-duplicate-number");
    expect(trace.row.values).toEqual([0, 4, 2, 1, 3]);
    const last = trace.steps.at(-1)!.race!;
    expect(trace.row.values[last.meet!]).toBe(3);
    expect(trace.row.values[last.entry!]).toBe(4);
    expect(trace.answer).toBe(4);
  });

  it("Middle keeps fast twice as far as slow and stops slow on the middle", () => {
    const { trace } = traceFor("fast-slow-pointers/middle-of-the-linked-list");
    for (const step of trace.steps.filter((s) => s.equation))
      expect(step.pointers.fast).toBe(2 * step.pointers.slow);
    expect(trace.steps.at(-1)!.found).toEqual([2]);
  });

  it("Circular Array Loop refuses a jump the other way, rules out its path, then finds a forward loop", () => {
    const { trace } = traceFor("fast-slow-pointers/circular-array-loop");
    const fail = trace.steps.find((s) => s.kind === "fail")!;
    expect(fail.race!.moves.find((m) => m.blocked !== undefined)).toMatchObject({ to: 4, blocked: 3 });
    expect(fail.rejected).toEqual([0, 4]);
    expect(trace.steps.at(-1)!.race!.loop).toEqual({ from: 3, to: 1 });
    expect(trace.answer).toBe(true);
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
    patternName: "Fast & Slow Pointers",
    definition: getTraceDefinition(key)!,
    args: traceFor(key).args,
  };
}

describe("fast and slow storyboards", () => {
  it.each(RACES)("%s: a fixture draft passes, and the race fits at phone and full size", (key) => {
    const result = evaluateDraft(buildDraft(key), context(key), META);
    expect(result.issues).toEqual([]);
    if (!result.ok) return;
    for (const width of [PHONE_PLAYER_WIDTH, 1280])
      for (const scene of result.storyboard.scenes)
        expect(raceProblems(scene.elements, textMetrics(width)), `${scene.id} at ${width}`).toEqual([]);
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
  const two = "fast-slow-pointers/linked-list-cycle-ii";
  const mutate = (step: number, change: (el: Record<string, unknown>) => void) => {
    const sb = source(two);
    const scene = sb.scenes.find((s) => s.traceStep === step)!;
    change(scene.elements.find((e) => e.type === "race") as Record<string, unknown>);
    return issues(sb);
  };

  it("the fixture source resolves and validates", () => {
    expect(issues(source(two))).toBe("");
  });

  it("rejects a wrong move, meeting node, loop start, or phase", () => {
    // fast really moved 4 → 5 → 2; claiming it took 4 → 5 alone is a wrong move (and a wrong hop count).
    expect(
      mutate(3, (r) => {
        r.moves = [
          { pointer: "slow", from: 2, to: 3, path: [], hops: 1 },
          { pointer: "fast", from: 4, to: 5, path: [], hops: 1 },
        ];
      }),
    ).toMatch(/race's moves doesn't match/);
    expect(mutate(4, (r) => (r.meet = 2))).toMatch(/race's meet doesn't match/);
    expect(mutate(7, (r) => (r.entry = 4))).toMatch(/race's entry doesn't match/);
    expect(mutate(6, (r) => (r.phase = 1))).toMatch(/race's phase doesn't match/);
  });

  it("schema: a move must follow the list's links, and the loop must be a real link", () => {
    expect(
      mutate(3, (r) => {
        r.moves = [{ pointer: "fast", from: 4, to: 2, path: [3], hops: 2 }];
      }),
    ).toMatch(/fast's move doesn't follow the list's links/);
    expect(mutate(3, (r) => (r.loop = { from: 5, to: 3 }))).toMatch(/loop's link 5 → 3 isn't in the list/);
  });

  it("an unbound race shows no moves", () => {
    const sb = source(two);
    // The intro shows the list; a race there may not show moves.
    sb.scenes[0].elements.push({
      id: "r",
      type: "race",
      rowId: "row",
      enterAt: 0,
      phase: 1,
      moves: [{ pointer: "slow", from: 0, to: 1, path: [], hops: 1 }],
    } as never);
    expect(issues(sb)).toMatch(/Without a traceStep, the race shows no moves/);
  });
});
