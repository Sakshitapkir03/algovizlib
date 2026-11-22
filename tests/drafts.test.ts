import { describe, expect, it } from "vitest";

import { getPattern, getPatterns, getProblems } from "@/lib/catalog/repository";
import type { CacheEntry, GenerationCache } from "@/lib/generation/cache";
import { findTarget } from "@/lib/generation/catalog-access";
import type { CatalogAccess } from "@/lib/generation/cli";
import {
  createFileAttemptLog,
  problemKeyFromPath,
  validateDraftFiles,
  type DraftDeps,
} from "@/lib/generation/drafts";
import type { RowResult, RunSummary } from "@/lib/generation/pipeline";
import { currentPrompts } from "@/lib/generation/prompts";
import { exitStatus } from "@/lib/generation/report";
import { renderRegistry, type StoryboardWriter } from "@/lib/generation/writer";
import { formatIssue, type StoryboardSource } from "@/lib/storyboard";

import { buildDraft } from "./fixtures/drafts";

const CONTAINER = "two-pointers/container-with-most-water";
const PAIR = "two-pointers/pair-with-target-sum";

function setup(existing: Record<string, "hand-written" | "generated"> = {}) {
  const written = new Map<string, StoryboardSource>();
  const cache = new Map<string, CacheEntry>();
  const failures = new Map<string, number>();
  const writer: StoryboardWriter = {
    exists: (p) => written.has(p),
    write: (p, sb) => void written.set(p, sb),
  };
  const generationCache: GenerationCache = {
    read: (p) => cache.get(p),
    write: (e) => void cache.set(e.key.problem, e),
  };
  const catalog: CatalogAccess = {
    getPatterns: () => getPatterns("dsa"),
    getPattern,
    getProblems,
    existingStoryboard: (p) =>
      existing[`${p.patternSlug}/${p.slug}`] ??
      (written.has(`${p.patternSlug}/${p.slug}`) ? "generated" : undefined),
  };
  const deps: DraftDeps = {
    prompts: currentPrompts,
    cache: generationCache,
    writer,
    attempts: {
      failures: (p) => failures.get(p) ?? 0,
      recordFailure: (p) => void failures.set(p, (failures.get(p) ?? 0) + 1),
      reset: (p) => void failures.delete(p),
    },
    savedRepairs: (p) => {
      const generation = written.get(p)?.generation;
      return generation?.provider === "claude-code" ? generation.repairAttempts : 0;
    },
    findTarget: (p) => findTarget(catalog, p),
    modelId: "claude-opus-5-5",
    now: () => new Date("2026-11-18T12:00:00.000Z"),
  };
  return { deps, written, cache, failures };
}

const file = (key: string, draft: unknown) => ({
  path: `.cache/drafts/${key}.json`,
  content: JSON.stringify(draft),
});
const brokenDraft = () => {
  const draft = buildDraft(CONTAINER);
  const scene = draft.scenes.find((s) => s.traceStep === 1)!;
  scene.elements = scene.elements.map((e) =>
    e.type === "pointer" && e.binds === "left" ? { ...e, index: 4 } : e,
  );
  return draft;
};
const OPTS = { dryRun: false, force: false };

describe("validateDraftFiles", () => {
  it("saves a valid draft like a generated storyboard: file, cache, and claude-code metadata", () => {
    const t = setup();
    const summary = validateDraftFiles([file(CONTAINER, buildDraft(CONTAINER))], OPTS, t.deps);
    expect(summary.rows[0]).toMatchObject({ problem: CONTAINER, status: "saved", repairs: 0 });
    const saved = t.written.get(CONTAINER)!;
    expect(saved.generation).toEqual({
      promptVersion: currentPrompts.version,
      provider: "claude-code",
      model: "claude-opus-5-5",
      generatedAt: "2026-11-18T12:00:00.000Z",
      repairAttempts: 0,
    });
    expect(saved.id).toBe("two-pointers-container-with-most-water");
    expect(t.cache.get(CONTAINER)?.key).toMatchObject({
      problem: CONTAINER,
      promptVersion: currentPrompts.version,
    });
    expect(exitStatus(summary).code).toBe(0);
  });

  it("rejects an invalid draft with located, expected-vs-actual issues and writes nothing", () => {
    const t = setup();
    const summary = validateDraftFiles([file(CONTAINER, brokenDraft())], OPTS, t.deps);
    expect(summary.rows[0].status).toBe("failed");
    const lines = summary.rows[0].issues!.map(formatIssue);
    expect(lines).toContain(
      'scene "step-1" › element "p-left" › index: Pointer "left" should be at 1 in trace step 1, not 4',
    );
    expect(t.written.size).toBe(0);
    expect(t.cache.size).toBe(0);
    expect(exitStatus(summary).code).toBe(1);
  });

  it("locates schema errors by scene and element id, not array position", () => {
    const t = setup();
    const draft = buildDraft(CONTAINER);
    draft.scenes[3].caption = "x".repeat(81);
    const summary = validateDraftFiles([file(CONTAINER, draft)], OPTS, t.deps);
    expect(summary.rows[0].issues!.map(formatIssue).join("\n")).toMatch(/scene "step-1" › caption: .*80/);
  });

  it("reports trace issues even when a text field also fails the schema", () => {
    const t = setup();
    const draft = brokenDraft();
    draft.scenes[0].caption = "x".repeat(90);
    const lines = validateDraftFiles([file(CONTAINER, draft)], OPTS, t.deps).rows[0].issues!.map(formatIssue);
    expect(lines.join("\n")).toMatch(/scene "problem" › caption: .*80/);
    expect(lines.join("\n")).toMatch(/element "p-left" › index: Pointer "left" should be at 1/);
  });

  it("records failed validations as repairs on the eventual save", () => {
    const t = setup();
    validateDraftFiles([file(CONTAINER, brokenDraft())], OPTS, t.deps);
    validateDraftFiles([file(CONTAINER, brokenDraft())], { ...OPTS, dryRun: true }, t.deps);
    const summary = validateDraftFiles([file(CONTAINER, buildDraft(CONTAINER))], OPTS, t.deps);
    expect(summary.rows[0]).toMatchObject({ status: "saved", repairs: 2 });
    expect(t.written.get(CONTAINER)?.generation?.repairAttempts).toBe(2);
    expect(t.failures.has(CONTAINER)).toBe(false);
  });

  it("saving again never lowers the recorded repairs, whatever failed in between", () => {
    const t = setup();
    // Gas Station's history: one failed validation, a save, then a re-save with --force after an edit.
    validateDraftFiles([file(CONTAINER, brokenDraft())], OPTS, t.deps);
    validateDraftFiles([file(CONTAINER, buildDraft(CONTAINER))], OPTS, t.deps);
    expect(t.written.get(CONTAINER)?.generation?.repairAttempts).toBe(1);
    const forced = { dryRun: false, force: true };
    const resaved = validateDraftFiles([file(CONTAINER, buildDraft(CONTAINER))], forced, t.deps);
    expect(resaved.rows[0]).toMatchObject({ status: "saved", repairs: 1 });
    expect(t.written.get(CONTAINER)?.generation?.repairAttempts).toBe(1);
    // A failure after the save adds to the count, in the dry run's report and on the next save.
    validateDraftFiles([file(CONTAINER, brokenDraft())], forced, t.deps);
    const dry = validateDraftFiles(
      [file(CONTAINER, buildDraft(CONTAINER))],
      { ...OPTS, dryRun: true },
      t.deps,
    );
    expect(dry.rows[0]).toMatchObject({ repairs: 2 });
    validateDraftFiles([file(CONTAINER, buildDraft(CONTAINER))], forced, t.deps);
    expect(t.written.get(CONTAINER)?.generation?.repairAttempts).toBe(2);
  });

  it("a model's repairs don't carry over to a storyboard authored over it", () => {
    const t = setup();
    validateDraftFiles([file(CONTAINER, brokenDraft())], OPTS, t.deps);
    validateDraftFiles([file(CONTAINER, buildDraft(CONTAINER))], OPTS, t.deps);
    const saved = t.written.get(CONTAINER)!;
    t.written.set(CONTAINER, { ...saved, generation: { ...saved.generation!, provider: "google" } });
    validateDraftFiles([file(CONTAINER, buildDraft(CONTAINER))], { dryRun: false, force: true }, t.deps);
    expect(t.written.get(CONTAINER)?.generation?.repairAttempts).toBe(0);
  });

  it("--dry-run validates and writes nothing", () => {
    const t = setup();
    const summary = validateDraftFiles(
      [file(CONTAINER, buildDraft(CONTAINER))],
      { ...OPTS, dryRun: true },
      t.deps,
    );
    expect(summary.rows[0]).toMatchObject({ status: "valid (dry run)" });
    expect(t.written.size).toBe(0);
    expect(t.cache.size).toBe(0);
    expect(exitStatus(summary).code).toBe(0);
  });

  it("never replaces a hand-written storyboard, even with --force", () => {
    const t = setup({ [PAIR]: "hand-written" });
    const summary = validateDraftFiles(
      [file(PAIR, buildDraft(PAIR))],
      { dryRun: false, force: true },
      t.deps,
    );
    expect(summary.rows[0]).toMatchObject({ status: "skipped" });
    expect(summary.rows[0].detail).toMatch(/hand-written/);
    expect(t.written.size).toBe(0);
  });

  it("replaces an existing generated storyboard only with --force", () => {
    const t = setup();
    validateDraftFiles([file(CONTAINER, buildDraft(CONTAINER))], OPTS, t.deps);
    const again = validateDraftFiles([file(CONTAINER, buildDraft(CONTAINER))], OPTS, t.deps);
    expect(again.rows[0]).toMatchObject({ status: "skipped" });
    const forced = validateDraftFiles(
      [file(CONTAINER, buildDraft(CONTAINER))],
      { dryRun: false, force: true },
      t.deps,
    );
    expect(forced.rows[0]).toMatchObject({ status: "saved" });
  });

  it("reports bad JSON and unknown problems as invalid", () => {
    const t = setup();
    const summary = validateDraftFiles(
      [
        { path: `.cache/drafts/${CONTAINER}.json`, content: "{ nope" },
        { path: ".cache/drafts/two-pointers/not-a-problem.json", content: "{}" },
      ],
      OPTS,
      t.deps,
    );
    expect(summary.rows.map((r) => r.status)).toEqual(["failed", "failed"]);
    expect(summary.rows[0].issues![0].message).toMatch(/Not valid JSON/);
    expect(summary.rows[1].issues![0].message).toMatch(/No catalog problem/);
  });

  it("reads the problem from the draft's path", () => {
    expect(problemKeyFromPath(".cache/drafts/two-pointers/three-sum.json")).toBe("two-pointers/three-sum");
    expect(problemKeyFromPath("two-pointers\\three-sum.json")).toBe("two-pointers/three-sum");
  });
});

describe("the saved registry and the generator agree", () => {
  it("a saved draft makes the problem count as generated (so --missing skips it)", () => {
    const t = setup();
    validateDraftFiles([file(CONTAINER, buildDraft(CONTAINER))], OPTS, t.deps);
    expect(t.deps.findTarget(CONTAINER)?.existing).toBe("generated");
    expect(renderRegistry([CONTAINER])).toMatch(/"two-pointers\/container-with-most-water": loadStoryboard/);
  });
});

describe("exitStatus (both commands)", () => {
  const row = (status: RowResult["status"]): RowResult => ({
    problem: "p",
    status,
    repairs: 0,
    requests: 0,
    fromCache: false,
  });
  const summary = (rows: RowResult[], extra: Partial<RunSummary> = {}): RunSummary => ({
    rows,
    requestsUsed: 0,
    maxRequests: 15,
    remaining: [],
    ...extra,
  });

  it("is 0 when everything is saved, cached, valid, or skipped", () => {
    expect(exitStatus(summary([row("saved"), row("valid (dry run)"), row("skipped")])).code).toBe(0);
  });

  it("is 1 when any problem failed", () => {
    const status = exitStatus(summary([row("saved"), row("failed")]));
    expect(status).toMatchObject({ code: 1 });
    expect(status.reason).toMatch(/1 failed/);
  });

  it("is 2 when the run stopped early with problems left, and says why", () => {
    for (const stoppedBy of ["budget", "daily-quota", "unavailable"] as const) {
      const status = exitStatus(summary([row("saved"), row("not run")], { stoppedBy, remaining: ["p"] }));
      expect(status.code).toBe(2);
      expect(status.reason).toMatch(/Stopped early because .*; 1 still to do/);
    }
  });
});

describe("createFileAttemptLog", () => {
  it("counts, persists, and resets failures", async () => {
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(`${tmpdir()}/attempts-`);
    const log = createFileAttemptLog(`${dir}/attempts.json`);
    log.recordFailure("a/b");
    log.recordFailure("a/b");
    expect(createFileAttemptLog(`${dir}/attempts.json`).failures("a/b")).toBe(2);
    log.reset("a/b");
    expect(log.failures("a/b")).toBe(0);
  });
});
