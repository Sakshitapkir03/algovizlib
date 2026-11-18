import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { GenerationMeta, ValidationIssue } from "@/lib/storyboard";

import type { GenerationCache } from "./cache";
import { evaluateDraft } from "./draft";
import { prepareTarget, type GenerationTarget, type RowResult, type RunSummary } from "./pipeline";
import type { PromptSet } from "./prompts";
import type { StoryboardWriter } from "./writer";

/**
 * Claude Code authoring fallback: a person or coding agent writes the draft JSON (exactly the format the model
 * returns) into `.cache/drafts/<pattern>/<slug>.json`, and this validates and saves it like a generated storyboard.
 */

export const AUTHOR_PROVIDER = "claude-code";

export type DraftFile = { path: string; content: string };

export type DraftOptions = {
  /** Validate and print only: no storyboard, registry, or cache writes. */
  dryRun: boolean;
  /** Replace an existing generated storyboard. Hand-written ones are never replaced. */
  force: boolean;
};

/** How many times each problem's draft failed validation, so `repairAttempts` records the real number. */
export interface AttemptLog {
  failures(problem: string): number;
  recordFailure(problem: string): void;
  reset(problem: string): void;
}

export type DraftDeps = {
  prompts: PromptSet;
  cache: GenerationCache;
  writer: StoryboardWriter;
  attempts: AttemptLog;
  /** The catalog target for "pattern/slug", including whether it already has a storyboard. */
  findTarget: (problem: string) => GenerationTarget | undefined;
  /** Recorded as the storyboard's `generation.model` ("claude-code" if unknown). */
  modelId: string;
  now: () => Date;
};

/** `.cache/drafts/two-pointers/three-sum.json` → `two-pointers/three-sum`. */
export function problemKeyFromPath(file: string): string {
  const parts = file.split(/[\\/]/);
  const slug = parts.at(-1)!.replace(/\.json$/, "");
  return `${parts.at(-2)}/${slug}`;
}

export function validateDraftFiles(
  files: readonly DraftFile[],
  options: DraftOptions,
  deps: DraftDeps,
): RunSummary {
  const rows: RowResult[] = files.map((file): RowResult => {
    const problem = problemKeyFromPath(file.path);
    const row: RowResult = { problem, status: "failed", repairs: 0, requests: 0, fromCache: false };
    const fail = (
      issues: ValidationIssue[],
      detail = `${issues.length} issue${issues.length === 1 ? "" : "s"}`,
    ) => {
      deps.attempts.recordFailure(problem);
      return { ...row, detail, issues, repairs: deps.attempts.failures(problem) };
    };

    const target = deps.findTarget(problem);
    if (!target) {
      return fail([
        { message: `No catalog problem "${problem}". Name the file .cache/drafts/<pattern>/<slug>.json.` },
      ]);
    }
    if (target.existing === "hand-written") {
      return { ...row, status: "skipped", detail: "has a hand-written storyboard (never replaced)" };
    }
    if (target.existing === "generated" && !options.force && !options.dryRun) {
      return { ...row, status: "skipped", detail: "already generated (use --force to replace)" };
    }
    const prepared = prepareTarget(target, deps.prompts.version);
    if (!prepared) return fail([{ message: `"${problem}" has no trace, so it can't be validated yet.` }]);

    let raw: unknown;
    try {
      raw = JSON.parse(file.content);
    } catch (error) {
      return fail([{ message: `Not valid JSON: ${error instanceof Error ? error.message : String(error)}` }]);
    }

    const meta: GenerationMeta = {
      promptVersion: deps.prompts.version,
      provider: AUTHOR_PROVIDER,
      model: deps.modelId,
      generatedAt: deps.now().toISOString(),
      repairAttempts: deps.attempts.failures(problem),
    };
    const evaluation = evaluateDraft(raw, prepared.ctx, meta);
    if (!evaluation.ok) return fail(evaluation.issues);

    const scenes = evaluation.storyboard.scenes.length;
    if (options.dryRun) return { ...row, status: "valid (dry run)", repairs: meta.repairAttempts, scenes };
    deps.writer.write(problem, evaluation.source);
    deps.cache.write({ key: prepared.key, savedAt: meta.generatedAt, storyboard: evaluation.source });
    deps.attempts.reset(problem);
    return { ...row, status: "saved", repairs: meta.repairAttempts, scenes };
  });

  return { rows, requestsUsed: 0, maxRequests: 0, remaining: [] };
}

/** Failure counts in one small JSON file (`.cache/drafts/attempts.json`). */
export function createFileAttemptLog(file: string): AttemptLog {
  const read = (): Record<string, number> => {
    try {
      return JSON.parse(readFileSync(file, "utf8")) as Record<string, number>;
    } catch {
      return {};
    }
  };
  const write = (data: Record<string, number>) => {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  };
  return {
    failures: (problem) => read()[problem] ?? 0,
    recordFailure: (problem) => {
      const data = read();
      write({ ...data, [problem]: (data[problem] ?? 0) + 1 });
    },
    reset: (problem) => {
      const { [problem]: _removed, ...rest } = read();
      void _removed;
      write(rest);
    },
  };
}
