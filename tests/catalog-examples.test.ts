import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { patterns, problems } from "@/content/catalog";
import { judgeOutput } from "@/lib/catalog";

/**
 * Every example's machine-readable `args`/`expected` must agree with an independent reference solution in
 * tests/reference-solutions/<pattern>/<slug>.ts (test-only; never imported by the app). This catches typos in
 * hand-written examples and is the seed of the future Practice tab's test cases.
 */
type Solve = (...args: never[]) => unknown;

const SOLUTIONS_DIR = path.join(import.meta.dirname, "reference-solutions");

async function loadSolve(patternSlug: string, slug: string): Promise<Solve> {
  const file = path.join(SOLUTIONS_DIR, patternSlug, `${slug}.ts`);
  if (!existsSync(file)) throw new Error(`missing reference solution: ${path.relative(process.cwd(), file)}`);
  const mod: { solve?: Solve } = await import(/* @vite-ignore */ pathToFileURL(file).href);
  if (typeof mod.solve !== "function") throw new Error(`${file} must export a function named "solve"`);
  return mod.solve;
}

for (const pattern of patterns) {
  describe(pattern.slug, () => {
    for (const problem of problems.filter((p) => p.patternSlug === pattern.slug)) {
      it(`${problem.slug}: examples match the reference solution`, async () => {
        const solve = await loadSolve(pattern.slug, problem.slug);
        problem.examples.forEach((example, i) => {
          // Clone so a solution that mutates its input can't change the catalog.
          const actual = solve(...(structuredClone(example.args) as never[]));
          expect(
            judgeOutput(problem.judge, actual, example.expected),
            `example ${i + 1} (${example.input}): expected ${JSON.stringify(example.expected)}, got ${JSON.stringify(actual)}`,
          ).toBe(true);
        });
      });
    }
  });
}
