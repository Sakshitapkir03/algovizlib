import { parseArgs } from "node:util";

import type { Pattern, Problem } from "@/lib/catalog";
import { getTraceDefinition } from "@/lib/traces";

import { DEFAULT_MAX_REQUESTS, type GenerationTarget } from "./pipeline";

export type CliOptions = {
  problem?: string;
  pattern?: string;
  missing: boolean;
  dryRun: boolean;
  force: boolean;
  maxRequests: number;
};

export const USAGE = `Usage: pnpm generate:storyboards [selection] [flags]

Selection (at least one):
  --problem <pattern>/<slug>   one problem
  --pattern <slug>             every problem in a pattern
  --missing                    every generatable problem without a storyboard (combine with --pattern to narrow)

Flags:
  --dry-run                    validate and print; write nothing to the repo (results are still cached)
  --force                      regenerate even if a storyboard exists, ignoring the cache
  --max-requests <n>           stop after n model calls, including repairs and retries (default ${DEFAULT_MAX_REQUESTS})`;

export function parseCli(argv: readonly string[]): CliOptions {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      problem: { type: "string" },
      pattern: { type: "string" },
      missing: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      "max-requests": { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });
  const maxRequests =
    values["max-requests"] === undefined ? DEFAULT_MAX_REQUESTS : Number(values["max-requests"]);
  if (!Number.isInteger(maxRequests) || maxRequests < 1)
    throw new Error("--max-requests must be a positive integer");
  if (!values.problem && !values.pattern && !values.missing) {
    throw new Error("Choose what to generate: --problem, --pattern, or --missing");
  }
  if (values.problem && !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(values.problem)) {
    throw new Error("--problem must look like <pattern>/<slug>, e.g. two-pointers/three-sum");
  }
  return {
    problem: values.problem,
    pattern: values.pattern,
    missing: values.missing,
    dryRun: values["dry-run"],
    force: values.force,
    maxRequests,
  };
}

export type CatalogAccess = {
  getPatterns: () => Pattern[];
  getPattern: (slug: string) => Pattern | undefined;
  getProblems: (patternSlug: string) => Problem[];
  /** "hand-written" if the problem names a storyboardId, "generated" if a generated file exists. */
  existingStoryboard: (problem: Problem) => GenerationTarget["existing"];
};

/** Turn CLI options into an ordered list of targets. `--missing` drops problems that already have a storyboard. */
export function selectTargets(options: CliOptions, catalog: CatalogAccess): GenerationTarget[] {
  let problems: Problem[];
  if (options.problem) {
    const [patternSlug, slug] = options.problem.split("/");
    const problem = catalog.getProblems(patternSlug).find((p) => p.slug === slug);
    if (!problem) throw new Error(`Unknown problem "${options.problem}"`);
    problems = [problem];
  } else if (options.pattern) {
    if (!catalog.getPattern(options.pattern)) throw new Error(`Unknown pattern "${options.pattern}"`);
    problems = catalog.getProblems(options.pattern);
  } else {
    problems = catalog.getPatterns().flatMap((p) => catalog.getProblems(p.slug));
  }

  const targets = problems.map((problem): GenerationTarget => {
    const pattern = catalog.getPattern(problem.patternSlug)!;
    return {
      key: `${problem.patternSlug}/${problem.slug}`,
      problem,
      patternName: pattern.name,
      patternCoreIdea: pattern.coreIdea,
      existing: catalog.existingStoryboard(problem),
    };
  });
  return options.missing
    ? targets.filter((t) => t.existing === undefined && getTraceDefinition(t.key) !== undefined)
    : targets;
}
