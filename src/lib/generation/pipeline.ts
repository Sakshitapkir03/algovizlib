import type { Problem } from "@/lib/catalog";
import type { GenerationMeta, ValidationIssue } from "@/lib/storyboard";
import { getTraceDefinition, runTrace } from "@/lib/traces";

import { hashTrace, sameKey, type CacheKey, type GenerationCache } from "./cache";
import { evaluateDraft, evaluateSource, type GenerationContext } from "./draft";
import { DailyQuotaError, RateLimitError } from "./errors";
import type { StoryboardModel } from "./model";
import type { PromptSet } from "./prompts";
import type { StoryboardWriter } from "./writer";

export const MAX_REPAIRS = 2;
export const MAX_RATE_LIMIT_RETRIES = 3;
export const RATE_LIMIT_BASE_DELAY_MS = 20_000;
export const DEFAULT_MAX_REQUESTS = 15;

export type GenerationTarget = {
  /** "pattern/slug". */
  key: string;
  problem: Problem;
  patternName: string;
  patternCoreIdea: string;
  /** A storyboard the problem already has. */
  existing?: "hand-written" | "generated";
};

export type GenerationOptions = {
  dryRun: boolean;
  /** Regenerate even if a storyboard exists, and ignore the cache. Hand-written storyboards are never replaced. */
  force: boolean;
  /** Every model call counts, including repairs and rate-limit retries. */
  maxRequests: number;
  /** Pause before every model call except the run's first. */
  delayMs: number;
};

export type GenerationDeps = {
  model: StoryboardModel;
  prompts: PromptSet;
  cache: GenerationCache;
  writer: StoryboardWriter;
  sleep: (ms: number) => Promise<void>;
  log: (line: string) => void;
  now: () => Date;
};

export type RowStatus = "saved" | "valid (dry run)" | "failed" | "skipped" | "not run";

export type RowResult = {
  problem: string;
  status: RowStatus;
  /** Why it was skipped, failed, or not run; or "from cache". */
  detail?: string;
  repairs: number;
  scenes?: number;
  requests: number;
  fromCache: boolean;
  issues?: ValidationIssue[];
};

export type RunSummary = {
  rows: RowResult[];
  requestsUsed: number;
  maxRequests: number;
  /** budget: --max-requests reached. daily-quota: provider quota for today used up. unavailable: still rate
   *  limited or overloaded after every retry, so the remaining problems would only fail the same way. */
  stoppedBy?: StopReason;
  /** Problems still without a storyboard because the run stopped early. */
  remaining: string[];
};

export type StopReason = "budget" | "daily-quota" | "unavailable";

const STOP_DETAIL: Record<StopReason, string> = {
  budget: "request budget reached",
  "daily-quota": "daily quota exhausted",
  unavailable: "model unavailable after retries",
};

class StopRun extends Error {
  constructor(readonly reason: StopReason) {
    super(reason);
  }
}

/**
 * Generate, validate, cache, and save storyboards for each target in order. Never throws for a single problem's
 * failure: it records the row and moves on. Stops the whole run (keeping everything already cached or saved) when
 * the request budget is spent, the provider's daily quota is exhausted, or the model stays unavailable after
 * every retry.
 */
export async function runGeneration(
  targets: readonly GenerationTarget[],
  options: GenerationOptions,
  deps: GenerationDeps,
): Promise<RunSummary> {
  const { model, prompts, cache, writer, sleep, log } = deps;
  const rows: RowResult[] = [];
  let requestsUsed = 0;
  let stoppedBy: RunSummary["stoppedBy"];

  /** One model call, with the inter-request delay and backoff for rate limits and overloads. Counts every attempt. */
  async function call(request: { system: string; prompt: string }, onRequest: () => void): Promise<unknown> {
    for (let retry = 0; ; retry++) {
      if (requestsUsed >= options.maxRequests) throw new StopRun("budget");
      if (requestsUsed > 0 && retry === 0 && options.delayMs > 0) {
        log(`  waiting ${Math.round(options.delayMs / 1000)}s between requests…`);
        await sleep(options.delayMs);
      }
      requestsUsed++;
      onRequest();
      try {
        return await model.generate(request);
      } catch (error) {
        if (error instanceof DailyQuotaError) throw new StopRun("daily-quota");
        if (!(error instanceof RateLimitError)) throw error;
        if (retry >= MAX_RATE_LIMIT_RETRIES) {
          log(`  ${error.message} Giving up after ${MAX_RATE_LIMIT_RETRIES} retries.`);
          throw new StopRun("unavailable");
        }
        const wait = error.retryAfterMs ?? RATE_LIMIT_BASE_DELAY_MS * 2 ** retry;
        log(
          `  ${error.message} Retry ${retry + 1}/${MAX_RATE_LIMIT_RETRIES} in ${Math.round(wait / 1000)}s…`,
        );
        await sleep(wait);
      }
    }
  }

  for (const [i, target] of targets.entries()) {
    const row: RowResult = {
      problem: target.key,
      status: "skipped",
      repairs: 0,
      requests: 0,
      fromCache: false,
    };
    const skip = (detail: string) => rows.push({ ...row, detail });

    if (target.existing === "hand-written") {
      skip("has a hand-written storyboard");
      continue;
    }
    if (target.existing === "generated" && !options.force) {
      skip("already generated (use --force to regenerate)");
      continue;
    }
    const definition = getTraceDefinition(target.key);
    if (!definition) {
      skip("no trace yet (see 'How to make a problem generatable')");
      continue;
    }

    const args = target.problem.examples[definition.exampleIndex].args;
    const trace = runTrace(target.key, args);
    const key: CacheKey = {
      problem: target.key,
      promptVersion: prompts.version,
      traceHash: hashTrace(args, trace),
    };
    const ctx: GenerationContext = {
      problem: target.problem,
      patternName: target.patternName,
      definition,
      args,
    };
    const promptInput = {
      problem: target.problem,
      patternName: target.patternName,
      patternCoreIdea: target.patternCoreIdea,
      exampleSource: definition.exampleSource,
      trace,
      exampleIndex: definition.exampleIndex,
    };

    const finish = (source: Parameters<StoryboardWriter["write"]>[1], scenes: number) => {
      if (!options.dryRun) writer.write(target.key, source);
      rows.push({ ...row, status: options.dryRun ? "valid (dry run)" : "saved", scenes });
    };

    log(`${target.key}`);
    if (!options.force) {
      const cached = cache.read(target.key);
      if (cached && sameKey(cached.key, key)) {
        const evaluation = evaluateSource(cached.storyboard, ctx);
        if (evaluation.ok) {
          log("  using cached result (no request)");
          row.fromCache = true;
          row.detail = "from cache";
          row.repairs = cached.storyboard.generation?.repairAttempts ?? 0;
          finish(evaluation.source, evaluation.storyboard.scenes.length);
          continue;
        }
        log("  cached result no longer validates; regenerating");
      } else if (cached) {
        log("  cache is stale (prompt version or trace changed); regenerating");
      }
    }

    let previous: unknown;
    let issues: ValidationIssue[] = [];
    try {
      for (let attempt = 0; attempt <= MAX_REPAIRS; attempt++) {
        row.repairs = attempt;
        const prompt =
          attempt === 0
            ? prompts.generatePrompt(promptInput)
            : prompts.repairPrompt(promptInput, previous, issues);
        log(
          attempt === 0 ? "  generating…" : `  repair ${attempt}/${MAX_REPAIRS} (${issues.length} issues)…`,
        );
        previous = await call({ system: prompts.systemPrompt(), prompt }, () => row.requests++);
        const meta: GenerationMeta = {
          promptVersion: prompts.version,
          provider: model.provider,
          model: model.modelId,
          generatedAt: deps.now().toISOString(),
          repairAttempts: attempt,
        };
        const evaluation = evaluateDraft(previous, ctx, meta);
        if (evaluation.ok) {
          cache.write({ key, savedAt: meta.generatedAt, storyboard: evaluation.source });
          log(`  valid (${evaluation.storyboard.scenes.length} scenes)`);
          finish(evaluation.source, evaluation.storyboard.scenes.length);
          break;
        }
        issues = evaluation.issues;
        if (attempt === MAX_REPAIRS) {
          log(`  failed after ${MAX_REPAIRS} repairs`);
          rows.push({
            ...row,
            status: "failed",
            detail: `${issues.length} issues after ${MAX_REPAIRS} repairs`,
            issues,
          });
        }
      }
    } catch (error) {
      if (error instanceof StopRun) {
        stoppedBy = error.reason;
        rows.push({
          ...row,
          status: "not run",
          detail: STOP_DETAIL[error.reason],
        });
        for (const rest of targets.slice(i + 1)) {
          rows.push({
            problem: rest.key,
            status: "not run",
            detail: "run stopped",
            repairs: 0,
            requests: 0,
            fromCache: false,
          });
        }
        break;
      }
      const message = error instanceof Error ? error.message : String(error);
      log(`  error: ${message}`);
      rows.push({ ...row, status: "failed", detail: message });
    }
  }

  return {
    rows,
    requestsUsed,
    maxRequests: options.maxRequests,
    stoppedBy,
    remaining: rows.filter((r) => r.status === "not run").map((r) => r.problem),
  };
}
