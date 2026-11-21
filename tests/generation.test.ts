import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import { getPattern, getPatterns, getProblem, getProblems } from "@/lib/catalog/repository";
import type { CacheEntry, GenerationCache } from "@/lib/generation/cache";
import { parseCli, selectTargets, type CatalogAccess } from "@/lib/generation/cli";
import { readGenerationConfig } from "@/lib/generation/config";
import {
  classifyProviderError,
  DailyQuotaError,
  GenerationConfigError,
  OverloadedError,
  RateLimitError,
} from "@/lib/generation/errors";
import { createSdkStoryboardModel, type StoryboardModel } from "@/lib/generation/model";
import {
  MAX_REPAIRS,
  RATE_LIMIT_BASE_DELAY_MS,
  runGeneration,
  type GenerationDeps,
  type GenerationOptions,
  type GenerationTarget,
} from "@/lib/generation/pipeline";
import { currentPrompts } from "@/lib/generation/prompts";
import { exitStatus } from "@/lib/generation/report";
import { renderRegistry, type StoryboardWriter } from "@/lib/generation/writer";
import type { StoryboardSource } from "@/lib/storyboard";

import { buildDraft, traceFor } from "./fixtures/drafts";

// ── test doubles ────────────────────────────────────────────────────────────────────────────────────────────

type Response = unknown | Error;

/** A model that plays back scripted responses (thrown if they're errors) and records every prompt. */
function fakeModel(responses: Response[]): StoryboardModel & { prompts: string[] } {
  const queue = [...responses];
  const prompts: string[] = [];
  return {
    provider: "fake",
    modelId: "fake-1",
    prompts,
    async generate({ prompt }) {
      prompts.push(prompt);
      if (queue.length === 0) throw new Error("fake model ran out of responses");
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return structuredClone(next);
    },
  };
}

function memoryCache(initial: CacheEntry[] = []): GenerationCache & { entries: Map<string, CacheEntry> } {
  const entries = new Map(initial.map((e) => [e.key.problem, e]));
  return {
    entries,
    read: (p) => entries.get(p),
    write: (e) => void entries.set(e.key.problem, structuredClone(e)),
  };
}

function memoryWriter(): StoryboardWriter & { written: Map<string, StoryboardSource> } {
  const written = new Map<string, StoryboardSource>();
  return { written, exists: (p) => written.has(p), write: (p, sb) => void written.set(p, sb) };
}

function deps(model: StoryboardModel, overrides: Partial<GenerationDeps> = {}) {
  const sleeps: number[] = [];
  const logs: string[] = [];
  const cache = memoryCache();
  const writer = memoryWriter();
  return {
    sleeps,
    logs,
    cache,
    writer,
    deps: {
      model,
      prompts: currentPrompts,
      cache,
      writer,
      sleep: async (ms: number) => void sleeps.push(ms),
      log: (line: string) => void logs.push(line),
      now: () => new Date("2026-11-18T12:00:00.000Z"),
      ...overrides,
    } satisfies GenerationDeps,
  };
}

const OPTIONS: GenerationOptions = { dryRun: false, force: false, maxRequests: 15, delayMs: 10_000 };

const catalog: CatalogAccess = {
  getPatterns: () => getPatterns("dsa"),
  getPattern,
  getProblems,
  existingStoryboard: (p) => (p.storyboardId ? "hand-written" : undefined),
};

function target(key: string, existing?: GenerationTarget["existing"]): GenerationTarget {
  const t = selectTargets(
    { problem: key, missing: false, dryRun: false, force: false, maxRequests: 15 },
    catalog,
  )[0];
  return { ...t, existing };
}

const PALINDROME = "two-pointers/valid-palindrome";
const CONTAINER = "two-pointers/container-with-most-water";
const valid = (key: string) => buildDraft(key);
const invalid = (key: string) => ({
  ...buildDraft(key),
  scenes: buildDraft(key).scenes.map((s, i) => (i === 2 ? { ...s, traceStep: 99 } : s)),
});

// ── pipeline ────────────────────────────────────────────────────────────────────────────────────────────────

describe("runGeneration", () => {
  it("saves a valid storyboard on the first try, with provenance, and caches it", async () => {
    const model = fakeModel([valid(PALINDROME)]);
    const t = deps(model);
    const summary = await runGeneration([target(PALINDROME)], OPTIONS, t.deps);
    expect(summary.rows[0]).toMatchObject({ status: "saved", repairs: 0, requests: 1 });
    expect(exitStatus(summary).code).toBe(0);
    expect(summary.requestsUsed).toBe(1);
    const saved = t.writer.written.get(PALINDROME)!;
    expect(saved.generation).toEqual({
      promptVersion: currentPrompts.version,
      provider: "fake",
      model: "fake-1",
      generatedAt: "2026-11-18T12:00:00.000Z",
      repairAttempts: 0,
    });
    expect(saved.trace).toEqual({ problem: PALINDROME, args: ["Taco cat!"] });
    expect(t.cache.entries.get(PALINDROME)?.key.promptVersion).toBe(currentPrompts.version);
    expect(t.sleeps).toEqual([]); // no delay before the run's first request
  });

  it("sends the exact issues back and saves the repaired storyboard", async () => {
    const model = fakeModel([invalid(PALINDROME), valid(PALINDROME)]);
    const t = deps(model);
    const summary = await runGeneration([target(PALINDROME)], OPTIONS, t.deps);
    expect(summary.rows[0]).toMatchObject({ status: "saved", repairs: 1, requests: 2 });
    expect(model.prompts[1]).toMatch(/Your previous attempt was rejected/);
    expect(model.prompts[1]).toMatch(/traceStep 99 does not exist/);
    expect(t.writer.written.get(PALINDROME)?.generation?.repairAttempts).toBe(1);
    expect(t.sleeps).toEqual([10_000]); // the delay between requests
  });

  it(`fails after ${MAX_REPAIRS} repairs, saves nothing for it, and continues with the next problem`, async () => {
    const model = fakeModel([
      invalid(PALINDROME),
      invalid(PALINDROME),
      invalid(PALINDROME),
      valid(CONTAINER),
    ]);
    const t = deps(model);
    const summary = await runGeneration([target(PALINDROME), target(CONTAINER)], OPTIONS, t.deps);
    expect(summary.rows[0]).toMatchObject({ status: "failed", repairs: MAX_REPAIRS, requests: 3 });
    expect(summary.rows[0].issues?.length).toBeGreaterThan(0);
    expect(summary.rows[1]).toMatchObject({ status: "saved", requests: 1 });
    expect([...t.writer.written.keys()]).toEqual([CONTAINER]);
    expect(t.cache.entries.has(PALINDROME)).toBe(false);
    expect(exitStatus(summary).code).toBe(1);
  });

  it("--dry-run validates and caches but writes nothing", async () => {
    const t = deps(fakeModel([valid(PALINDROME)]));
    const summary = await runGeneration([target(PALINDROME)], { ...OPTIONS, dryRun: true }, t.deps);
    expect(summary.rows[0].status).toBe("valid (dry run)");
    expect(t.writer.written.size).toBe(0);
    expect(t.cache.entries.has(PALINDROME)).toBe(true);
  });

  it("skips hand-written and already generated storyboards unless --force (never replaces hand-written)", async () => {
    const model = fakeModel([valid(PALINDROME)]);
    const t = deps(model);
    const summary = await runGeneration(
      [target("two-pointers/pair-with-target-sum", "hand-written"), target(PALINDROME, "generated")],
      OPTIONS,
      t.deps,
    );
    expect(summary.rows.map((r) => r.status)).toEqual(["skipped", "skipped"]);
    expect(model.prompts).toHaveLength(0);

    const forced = await runGeneration(
      [target("two-pointers/pair-with-target-sum", "hand-written"), target(PALINDROME, "generated")],
      { ...OPTIONS, force: true },
      t.deps,
    );
    expect(forced.rows.map((r) => r.status)).toEqual(["skipped", "saved"]);
  });

  it("skips problems that have no trace", async () => {
    const t = deps(fakeModel([]));
    const summary = await runGeneration([target("intervals/meeting-rooms")], OPTIONS, t.deps);
    expect(summary.rows[0]).toMatchObject({ status: "skipped", requests: 0 });
    expect(summary.rows[0].detail).toMatch(/no trace/);
  });

  it("retries per-minute rate limits with exponential backoff, counting each attempt", async () => {
    const model = fakeModel([new RateLimitError("429"), new RateLimitError("429"), valid(PALINDROME)]);
    const t = deps(model);
    const summary = await runGeneration([target(PALINDROME)], OPTIONS, t.deps);
    expect(summary.rows[0]).toMatchObject({ status: "saved", requests: 3 });
    expect(t.sleeps).toEqual([RATE_LIMIT_BASE_DELAY_MS, RATE_LIMIT_BASE_DELAY_MS * 2]);
    expect(t.logs.join("\n")).toMatch(/Retry 1\/3 in 20s/);
  });

  it("retries a temporary overload the same way", async () => {
    const t = deps(
      fakeModel([new OverloadedError("The model is temporarily overloaded."), valid(PALINDROME)]),
    );
    const summary = await runGeneration([target(PALINDROME)], OPTIONS, t.deps);
    expect(summary.rows[0]).toMatchObject({ status: "saved", requests: 2 });
    expect(t.logs.join("\n")).toMatch(/temporarily overloaded\. Retry 1\/3 in 20s/);
  });

  it("uses the provider's suggested wait when it gives one", async () => {
    const t = deps(fakeModel([new RateLimitError("429", 37_000), valid(PALINDROME)]));
    await runGeneration([target(PALINDROME)], OPTIONS, t.deps);
    expect(t.sleeps).toEqual([37_000]);
  });

  it("stops the run when the model is still unavailable after 3 retries", async () => {
    const busy = () => new OverloadedError("The model didn't respond in time.");
    const model = fakeModel([busy(), busy(), busy(), busy(), valid(CONTAINER)]);
    const t = deps(model);
    const summary = await runGeneration([target(PALINDROME), target(CONTAINER)], OPTIONS, t.deps);
    expect(model.prompts).toHaveLength(4); // first try + 3 retries, then the run stops
    expect(summary.stoppedBy).toBe("unavailable");
    expect(summary.rows.map((r) => r.status)).toEqual(["not run", "not run"]);
    expect(summary.remaining).toEqual([PALINDROME, CONTAINER]);
  });

  it("stops the whole run on daily quota exhaustion without retrying, keeping earlier results", async () => {
    const model = fakeModel([valid(CONTAINER), new DailyQuotaError("quota")]);
    const t = deps(model);
    const summary = await runGeneration(
      [target(CONTAINER), target(PALINDROME), target("two-pointers/three-sum")],
      OPTIONS,
      t.deps,
    );
    expect(model.prompts).toHaveLength(2); // no retry after the quota error
    expect(summary.stoppedBy).toBe("daily-quota");
    expect(summary.rows.map((r) => r.status)).toEqual(["saved", "not run", "not run"]);
    expect(summary.remaining).toEqual([PALINDROME, "two-pointers/three-sum"]);
    expect(exitStatus(summary).code).toBe(2);
    expect(t.writer.written.has(CONTAINER)).toBe(true);
    expect(t.cache.entries.has(CONTAINER)).toBe(true);
  });

  it("stops cleanly when the request budget is spent (repairs count)", async () => {
    const model = fakeModel([invalid(PALINDROME), invalid(PALINDROME), valid(PALINDROME), valid(CONTAINER)]);
    const t = deps(model);
    const summary = await runGeneration(
      [target(PALINDROME), target(CONTAINER)],
      { ...OPTIONS, maxRequests: 2 },
      t.deps,
    );
    expect(summary.requestsUsed).toBe(2);
    expect(model.prompts).toHaveLength(2);
    expect(summary.stoppedBy).toBe("budget");
    expect(exitStatus(summary).code).toBe(2);
    expect(summary.remaining).toEqual([PALINDROME, CONTAINER]);
  });
});

describe("cache", () => {
  async function primedCache() {
    const first = deps(fakeModel([valid(PALINDROME)]));
    await runGeneration([target(PALINDROME)], { ...OPTIONS, dryRun: true }, first.deps);
    return first.cache;
  }

  it("a valid cached result is saved without calling the model", async () => {
    const cache = await primedCache();
    const model = fakeModel([]);
    const t = deps(model, { cache });
    const summary = await runGeneration([target(PALINDROME)], OPTIONS, { ...t.deps, cache });
    expect(model.prompts).toHaveLength(0);
    expect(summary.requestsUsed).toBe(0);
    expect(summary.rows[0]).toMatchObject({ status: "saved", fromCache: true, requests: 0 });
    expect(t.writer.written.has(PALINDROME)).toBe(true);
  });

  it("a cache entry from another prompt version is stale and regenerated", async () => {
    const cache = await primedCache();
    const entry = cache.read(PALINDROME)!;
    cache.write({ ...entry, key: { ...entry.key, promptVersion: "storyboard-v0" } });
    const model = fakeModel([valid(PALINDROME)]);
    const summary = await runGeneration([target(PALINDROME)], OPTIONS, deps(model, { cache }).deps);
    expect(model.prompts).toHaveLength(1);
    expect(summary.rows[0]).toMatchObject({ status: "saved", fromCache: false });
    expect(cache.read(PALINDROME)?.key.promptVersion).toBe(currentPrompts.version);
  });

  it("a cache entry for a different trace is stale and regenerated", async () => {
    const cache = await primedCache();
    const entry = cache.read(PALINDROME)!;
    cache.write({ ...entry, key: { ...entry.key, traceHash: "0000000000000000" } });
    const model = fakeModel([valid(PALINDROME)]);
    await runGeneration([target(PALINDROME)], OPTIONS, deps(model, { cache }).deps);
    expect(model.prompts).toHaveLength(1);
  });

  it("--force ignores a valid cache entry", async () => {
    const cache = await primedCache();
    const model = fakeModel([valid(PALINDROME)]);
    await runGeneration([target(PALINDROME)], { ...OPTIONS, force: true }, deps(model, { cache }).deps);
    expect(model.prompts).toHaveLength(1);
  });
});

// ── selection, CLI, config, provider adapter ───────────────────────────────────────────────────────────────

describe("selectTargets", () => {
  const base = { missing: false, dryRun: false, force: false, maxRequests: 15 };

  it("selects a pattern in catalog order", () => {
    expect(selectTargets({ ...base, pattern: "two-pointers" }, catalog).map((t) => t.key)).toEqual([
      "two-pointers/pair-with-target-sum",
      "two-pointers/valid-palindrome",
      "two-pointers/container-with-most-water",
      "two-pointers/three-sum",
      "two-pointers/trapping-rain-water",
    ]);
  });

  it("--missing keeps only generatable problems without a storyboard", () => {
    const withGenerated: CatalogAccess = {
      ...catalog,
      existingStoryboard: (p) =>
        p.storyboardId ? "hand-written" : p.slug === "three-sum" ? "generated" : undefined,
    };
    expect(selectTargets({ ...base, missing: true }, withGenerated).map((t) => t.key)).toEqual([
      "sorting/bubble-sort",
      "sorting/selection-sort",
      "sorting/insertion-sort",
      "sorting/merge-sort",
      "sorting/quick-sort",
      "sorting/heap-sort",
      "sorting/counting-sort",
      "sorting/count-inversions",
      "two-pointers/valid-palindrome",
      "two-pointers/container-with-most-water",
      "two-pointers/trapping-rain-water",
      "sliding-window/maximum-sum-subarray-of-size-k",
      "sliding-window/longest-substring-without-repeating-characters",
      "sliding-window/longest-repeating-character-replacement",
      "sliding-window/minimum-window-substring",
      "sliding-window/sliding-window-maximum",
      "binary-search/search-sorted-array",
      "binary-search/search-insert-position",
      "binary-search/search-in-rotated-sorted-array",
      "binary-search/koko-eating-bananas",
      "binary-search/median-of-two-sorted-arrays",
      "stack/valid-parentheses",
      "stack/evaluate-reverse-polish-notation",
      "stack/daily-temperatures",
      "stack/decode-string",
      "stack/largest-rectangle-in-histogram",
      "linked-list/reverse-linked-list",
      "linked-list/merge-two-sorted-lists",
      "linked-list/remove-nth-node-from-end",
      "linked-list/reorder-list",
      "linked-list/merge-k-sorted-lists",
      "trees-dfs/maximum-depth-of-binary-tree",
      "trees-dfs/path-sum",
      "trees-dfs/validate-binary-search-tree",
      "trees-dfs/count-good-nodes-in-binary-tree",
      "trees-dfs/binary-tree-maximum-path-sum",
      "graphs-bfs/flood-fill",
      "graphs-bfs/number-of-islands",
      "graphs-bfs/rotting-oranges",
      "graphs-bfs/shortest-path-in-binary-matrix",
      "graphs-bfs/word-ladder",
      "heap/last-stone-weight",
      "heap/kth-largest-element-in-an-array",
      "heap/top-k-frequent-elements",
      "heap/k-closest-points-to-origin",
      "heap/find-median-from-data-stream",
      "dynamic-programming/climbing-stairs",
      "dynamic-programming/house-robber",
      "dynamic-programming/coin-change",
      "dynamic-programming/longest-common-subsequence",
      "dynamic-programming/edit-distance",
    ]);
  });

  it("rejects unknown problems and patterns", () => {
    expect(() => selectTargets({ ...base, problem: "two-pointers/nope" }, catalog)).toThrow(
      /Unknown problem/,
    );
    expect(() => selectTargets({ ...base, pattern: "nope" }, catalog)).toThrow(/Unknown pattern/);
  });
});

describe("parseCli", () => {
  it("parses every flag", () => {
    expect(
      parseCli(["--pattern", "two-pointers", "--dry-run", "--force", "--missing", "--max-requests", "4"]),
    ).toEqual({
      problem: undefined,
      pattern: "two-pointers",
      missing: true,
      dryRun: true,
      force: true,
      maxRequests: 4,
    });
  });

  it("defaults the budget to 15 and requires a selection", () => {
    expect(parseCli(["--problem", "two-pointers/three-sum"]).maxRequests).toBe(15);
    expect(() => parseCli(["--dry-run"])).toThrow(/--problem, --pattern, or --missing/);
    expect(() => parseCli(["--missing", "--max-requests", "0"])).toThrow(/positive integer/);
    expect(() => parseCli(["--problem", "three-sum"])).toThrow(/<pattern>\/<slug>/);
  });
});

describe("readGenerationConfig", () => {
  it("defaults to Google Gemini 3.8 Flash", () => {
    expect(readGenerationConfig({ GOOGLE_GENERATIVE_AI_API_KEY: "k" })).toEqual({
      provider: "google",
      model: "gemini-3.8-flash",
      apiKeyVar: "GOOGLE_GENERATIVE_AI_API_KEY",
      delayMs: 10_000,
      timeoutMs: 120_000,
    });
  });

  it("selects Anthropic and honors AI_MODEL and GENERATION_DELAY_MS", () => {
    expect(readGenerationConfig({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" })).toMatchObject({
      provider: "anthropic",
      model: "claude-opus-5-5",
      apiKeyVar: "ANTHROPIC_API_KEY",
    });
    expect(
      readGenerationConfig({
        GOOGLE_GENERATIVE_AI_API_KEY: "k",
        AI_MODEL: "gemini-3.5-flash",
        GENERATION_DELAY_MS: "0",
      }),
    ).toMatchObject({ model: "gemini-3.5-flash", delayMs: 0 });
    expect(
      readGenerationConfig({ GOOGLE_GENERATIVE_AI_API_KEY: "k", GENERATION_TIMEOUT_MS: "60000" }).timeoutMs,
    ).toBe(60_000);
    expect(() =>
      readGenerationConfig({ GOOGLE_GENERATIVE_AI_API_KEY: "k", GENERATION_TIMEOUT_MS: "5" }),
    ).toThrow(/GENERATION_TIMEOUT_MS/);
  });

  it("fails fast when the selected provider's key is missing, without echoing any key", () => {
    const env = { AI_PROVIDER: "anthropic", GOOGLE_GENERATIVE_AI_API_KEY: "secret-google-key" };
    expect(() => readGenerationConfig(env)).toThrow(GenerationConfigError);
    try {
      readGenerationConfig(env);
    } catch (error) {
      expect((error as Error).message).toMatch(/ANTHROPIC_API_KEY is not set/);
      expect((error as Error).message).not.toMatch(/secret/);
    }
  });

  it("rejects an unknown provider", () => {
    expect(() => readGenerationConfig({ AI_PROVIDER: "openai" })).toThrow(/AI_PROVIDER must be one of/);
  });
});

describe("classifyProviderError", () => {
  const apiError = (statusCode: number, responseBody: string) =>
    new APICallError({ message: "error", url: "https://x", requestBodyValues: {}, statusCode, responseBody });

  it("tells a daily quota from a per-minute limit (Gemini puts both under 429)", () => {
    const daily = apiError(
      429,
      '{"error":{"details":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}}',
    );
    const minute = apiError(
      429,
      '{"error":{"details":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"},{"retryDelay":"37s"}]}}',
    );
    expect(classifyProviderError(daily)).toBeInstanceOf(DailyQuotaError);
    const limited = classifyProviderError(minute);
    expect(limited).toBeInstanceOf(RateLimitError);
    expect((limited as RateLimitError).retryAfterMs).toBe(37_000);
  });

  it("treats a temporary overload (Gemini 503, Anthropic 529) as retryable", () => {
    const busy = apiError(503, '{"error":{"code":503,"status":"UNAVAILABLE","message":"high demand"}}');
    expect(classifyProviderError(busy)).toBeInstanceOf(OverloadedError);
    expect(classifyProviderError(apiError(529, "overloaded"))).toBeInstanceOf(RateLimitError);
  });

  it("treats our request timeout and dropped connections as a temporary overload", () => {
    const timeout = Object.assign(new Error("The operation was aborted due to timeout"), {
      name: "TimeoutError",
    });
    expect(classifyProviderError(timeout)).toBeInstanceOf(OverloadedError);
    const dropped = new APICallError({
      message: "Cannot connect to API: Headers Timeout Error",
      url: "https://x",
      requestBodyValues: {},
      isRetryable: true,
    });
    expect(classifyProviderError(dropped)).toBeInstanceOf(OverloadedError);
  });

  it("leaves other errors alone", () => {
    const server = apiError(500, "oops");
    expect(classifyProviderError(server)).toBe(server);
  });
});

describe("createSdkStoryboardModel", () => {
  const usage = {
    inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 1, text: 1, reasoning: undefined },
  };
  const textModel = (text: string) =>
    new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      }),
    });

  it("returns the structured output", async () => {
    const draft = valid(PALINDROME);
    const model = createSdkStoryboardModel(textModel(JSON.stringify(draft)), "mock", "mock-1");
    expect(await model.generate({ system: "s", prompt: "p" })).toMatchObject({ title: draft.title });
  });

  it("returns schema-invalid output as-is so the pipeline can report exact issues", async () => {
    const model = createSdkStoryboardModel(textModel('{"title":"only a title"}'), "mock", "mock-1");
    expect(await model.generate({ system: "s", prompt: "p" })).toEqual({ title: "only a title" });
  });

  it("turns a 429 into a RateLimitError", async () => {
    const model = createSdkStoryboardModel(
      new MockLanguageModelV4({
        doGenerate: async () => {
          throw new APICallError({
            message: "Too many",
            url: "https://x",
            requestBodyValues: {},
            statusCode: 429,
            responseBody: "{}",
          });
        },
      }),
      "mock",
      "mock-1",
    );
    await expect(model.generate({ system: "s", prompt: "p" })).rejects.toBeInstanceOf(RateLimitError);
  });
});

describe("renderRegistry", () => {
  it("imports each generated JSON file through loadStoryboard", () => {
    const code = renderRegistry(["two-pointers/three-sum", "two-pointers/container-with-most-water"]);
    expect(code).toMatch(
      /import twoPointersContainerWithMostWater from "\.\/two-pointers\/container-with-most-water\.json";/,
    );
    expect(code).toMatch(/"two-pointers\/three-sum": loadStoryboard\(twoPointersThreeSum\),/);
    expect(renderRegistry([])).toMatch(/Record<string, Storyboard>> = \{\};/);
  });
});

describe("prompt", () => {
  it("tells the model the step's tone and to omit verdictTone", () => {
    const { trace } = traceFor("two-pointers/container-with-most-water");
    const prompt = currentPrompts.generatePrompt({
      problem: getProblem("two-pointers", "container-with-most-water")!,
      patternName: "Two Pointers",
      patternCoreIdea: "x",
      exampleSource: "analogy",
      trace,
      exampleIndex: 0,
    });
    expect(currentPrompts.version).toBe("storyboard-v13");
    expect(prompt).toMatch(/equation: 5 × 2 = 10 > 0 \(tone: positive\)/);
    expect(prompt).toMatch(/= 9 < 20 \(tone: neutral\)/);
    expect(currentPrompts.systemPrompt()).toMatch(/OMIT verdictTone/);
  });
});
