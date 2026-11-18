/**
 * Offline storyboard generation. Writes validated storyboards into src/content/storyboards/generated and caches
 * every valid result in .cache/generation. Run with `pnpm generate:storyboards --help`.
 */
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { getPattern, getPatterns, getProblems } from "@/lib/catalog/repository";
import { createFileCache } from "@/lib/generation/cache";
import { parseCli, selectTargets, USAGE, type CliOptions } from "@/lib/generation/cli";
import { readGenerationConfig } from "@/lib/generation/config";
import { describeIssues } from "@/lib/generation/draft";
import { createStoryboardModel } from "@/lib/generation/model";
import { runGeneration, type RunSummary } from "@/lib/generation/pipeline";
import { currentPrompts } from "@/lib/generation/prompts";
import { createFileWriter } from "@/lib/generation/writer";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "src/content/storyboards/generated");
const CACHE_DIR = path.join(ROOT, ".cache/generation");

function table(rows: string[][]): string {
  const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)));
  return rows.map((r) => r.map((cell, c) => cell.padEnd(widths[c])).join("  ")).join("\n");
}

function printSummary(summary: RunSummary, options: CliOptions) {
  console.log("");
  console.log(
    table([
      ["problem", "result", "repairs", "scenes", "requests", "note"],
      ...summary.rows.map((r) => [
        r.problem,
        r.status,
        String(r.repairs),
        r.scenes === undefined ? "-" : String(r.scenes),
        String(r.requests),
        r.detail ?? "",
      ]),
    ]),
  );
  console.log(`\nRequests used: ${summary.requestsUsed} of ${summary.maxRequests}`);
  for (const r of summary.rows.filter((row) => row.issues?.length)) {
    console.log(`\nIssues for ${r.problem} (last attempt):\n${describeIssues(r.issues!.slice(0, 15))}`);
  }
  if (summary.stoppedBy === "daily-quota") {
    console.log(
      `\nStopped: the provider's daily quota is used up. Everything above that was saved or cached is kept.` +
        `\nStill to do: ${summary.remaining.join(", ") || "none"}` +
        `\nRerun tomorrow with: pnpm generate:storyboards --missing${options.pattern ? ` --pattern ${options.pattern}` : ""}`,
    );
  } else if (summary.stoppedBy === "unavailable") {
    console.log(
      `\nStopped: ${summary.rows.find((r) => r.detail === "model unavailable after retries")?.problem ?? "a request"} ` +
        `kept failing (rate limited, overloaded, or timing out) after every retry, so the rest would fail the same way.` +
        `\nStill to do: ${summary.remaining.join(", ")}` +
        `\nTry again later, or pick another model with AI_MODEL (see .env.example), then rerun with --missing.`,
    );
  } else if (summary.stoppedBy === "budget") {
    console.log(
      `\nStopped: reached --max-requests ${summary.maxRequests}. Still to do: ${summary.remaining.join(", ")}` +
        `\nRerun with --missing (cached results are reused without requests).`,
    );
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return;
  }
  const options = parseCli(argv);
  const config = readGenerationConfig(process.env);
  const writer = createFileWriter(GENERATED_DIR);
  const targets = selectTargets(options, {
    getPatterns: () => getPatterns("dsa"),
    getPattern,
    getProblems,
    existingStoryboard: (problem) =>
      problem.storyboardId
        ? "hand-written"
        : writer.exists(`${problem.patternSlug}/${problem.slug}`)
          ? "generated"
          : undefined,
  });

  console.log(
    `Provider: ${config.provider} · model: ${config.model} · prompt: ${currentPrompts.version} · ` +
      `${options.dryRun ? "dry run (nothing written)" : "writing to src/content/storyboards/generated"} · ` +
      `budget: ${options.maxRequests} requests\n`,
  );

  const summary = await runGeneration(
    targets,
    {
      dryRun: options.dryRun,
      force: options.force,
      maxRequests: options.maxRequests,
      delayMs: config.delayMs,
    },
    {
      model: createStoryboardModel(config, process.env),
      prompts: currentPrompts,
      cache: createFileCache(CACHE_DIR),
      writer,
      sleep: (ms) => sleep(ms),
      log: (line) => console.log(line),
      now: () => new Date(),
    },
  );

  if (options.dryRun) {
    for (const row of summary.rows.filter((r) => r.status === "valid (dry run)")) {
      const cached = createFileCache(CACHE_DIR).read(row.problem);
      if (!cached) continue;
      const sb = cached.storyboard;
      console.log(`\n── ${row.problem}: "${sb.title}" (${sb.exampleSource})`);
      if (sb.analogy) console.log(`   analogy: ${sb.analogy.scenario}`);
      sb.scenes.forEach((s, i) =>
        console.log(
          `   ${String(i + 1).padStart(2)}. [${s.traceStep === undefined ? "  " : `#${s.traceStep}`.padStart(3)}] ${s.caption}`,
        ),
      );
    }
  }

  printSummary(summary, options);
  if (summary.rows.some((r) => r.status === "failed")) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
