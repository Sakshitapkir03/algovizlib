import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { judgeOutput } from "@/lib/catalog";
import { getProblem } from "@/lib/catalog/repository";
import { runTrace, traceRegistry } from "@/lib/traces";

type Solve = (...args: never[]) => unknown;

async function referenceSolve(problem: string): Promise<Solve> {
  const file = path.join(import.meta.dirname, "reference-solutions", `${problem}.ts`);
  const mod: { solve: Solve } = await import(/* @vite-ignore */ pathToFileURL(file).href);
  return mod.solve;
}

describe.each(Object.values(traceRegistry))("trace $problem", (def) => {
  const [patternSlug, slug] = def.problem.split("/");
  const problem = getProblem(patternSlug, slug);

  it("belongs to a catalog problem and picks an existing example", () => {
    expect(problem).toBeDefined();
    expect(problem!.examples[def.exampleIndex]).toBeDefined();
  });

  it("ends with the reference solution's answer on its example and on every other example", async () => {
    const solve = await referenceSolve(def.problem);
    for (const example of problem!.examples) {
      if (!def.args.safeParse(example.args).success) continue; // too large to animate
      const trace = runTrace(def.problem, structuredClone(example.args));
      const expected = solve(...(structuredClone(example.args) as never[]));
      expect(judgeOutput(problem!.judge, trace.answer, expected), example.input).toBe(true);
    }
  });

  it("produces a well-formed step list", () => {
    const trace = runTrace(def.problem, problem!.examples[def.exampleIndex].args);
    expect(trace.steps.length).toBeGreaterThan(0);
    expect(trace.steps.at(-1)?.key).toBe(true);
    const n = trace.row.values.length;
    for (const step of trace.steps) {
      for (const [name, index] of Object.entries(step.pointers)) {
        expect(trace.pointerNames).toContain(name);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(n);
      }
      // On a linked list, highlights name node ids (a cache's ids aren't reused after an eviction).
      const ids = step.links ? new Set(step.links.nodes.map((node) => node.id)) : undefined;
      for (const list of [step.active, step.rejected, step.found]) {
        for (const index of list ?? []) {
          if (ids) expect(ids.has(index)).toBe(true);
          else expect(index).toBeLessThan(n);
        }
      }
    }
    // Small enough to tell in one short video.
    expect(trace.steps.filter((s) => s.key).length).toBeLessThanOrEqual(7);
  });
});

describe("runTrace", () => {
  it("rejects unknown problems and bad args", () => {
    expect(() => runTrace("two-pointers/nope", [])).toThrow(/No trace/);
    expect(() => runTrace("two-pointers/pair-with-target-sum", ["x"])).toThrow(/Invalid args/);
  });

  it("matches the hand-checked pair-sum walk", () => {
    const trace = runTrace("two-pointers/pair-with-target-sum", [[4, 9, 14, 21, 28, 36, 45], 50]);
    expect(trace.steps.map((s) => [s.pointers.left, s.pointers.right, s.equation?.comparison?.op])).toEqual([
      [0, 6, "<"],
      [1, 6, ">"],
      [1, 5, "<"],
      [2, 5, "="],
    ]);
    expect(trace.answerIndices).toEqual([2, 5]);
  });
});
