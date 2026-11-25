/**
 * Claude Code authoring fallback: validate hand-authored drafts (the same JSON the model returns) and save valid
 * ones exactly like generated storyboards. Run with `pnpm storyboards:validate-draft --help`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { createFileCache } from "@/lib/generation/cache";
import { createCatalogAccess, findTarget } from "@/lib/generation/catalog-access";
import {
  AUTHOR_PROVIDER,
  createFileAttemptLog,
  validateDraftFiles,
  type DraftFile,
} from "@/lib/generation/drafts";
import { prepareLesson } from "@/lib/generation/lesson";
import { currentPrompts } from "@/lib/generation/prompts";
import { exitStatus, formatFailures, formatSummaryTable } from "@/lib/generation/report";
import { createFileWriter } from "@/lib/generation/writer";

const ROOT = process.cwd();
const USAGE = `Usage: pnpm storyboards:validate-draft <path...> [--dry-run] [--force] [--model <id>]

Validates drafts in the model's draft format (write them to .cache/drafts/<pattern>/<slug>.json, or
.cache/drafts/<topic>/<slug>.json for a system design lesson; render the instructions with
pnpm storyboards:prompt <key>). Valid drafts are saved like generated storyboards.

  --dry-run      validate and print only; write nothing
  --force        replace an existing generated storyboard (hand-written ones are never replaced)
  --model <id>   recorded as generation.model (default "${AUTHOR_PROVIDER}")`;

function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "dry-run": { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      model: { type: "string", default: AUTHOR_PROVIDER },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });
  if (values.help || positionals.length === 0) {
    console.log(USAGE);
    process.exitCode = values.help ? 0 : 1;
    return;
  }

  const files: DraftFile[] = positionals.map((file) => {
    try {
      return { path: file, content: readFileSync(file, "utf8") };
    } catch {
      return { path: file, content: "" };
    }
  });
  const writer = createFileWriter(path.join(ROOT, "src/content/storyboards/generated"));
  const catalog = createCatalogAccess(writer);
  const summary = validateDraftFiles(
    files,
    { dryRun: values["dry-run"], force: values.force },
    {
      prompts: currentPrompts,
      cache: createFileCache(path.join(ROOT, ".cache/generation")),
      writer,
      attempts: createFileAttemptLog(path.join(ROOT, ".cache/drafts/attempts.json")),
      savedRepairs: (problem) => savedRepairs(problem),
      findTarget: (problem) => findTarget(catalog, problem),
      findLesson: (key) => prepareLesson(key, writer),
      modelId: values.model,
      now: () => new Date(),
    },
  );

  summary.rows.forEach((row, i) => {
    const valid = row.status === "saved" || row.status === "valid (dry run)";
    console.log(`${valid ? "valid  " : row.status === "skipped" ? "skipped" : "INVALID"}  ${files[i].path}`);
  });
  const failures = formatFailures(summary, 200);
  if (failures) console.log(`\n${failures}`);
  console.log(`\n${formatSummaryTable(summary)}`);
  const status = exitStatus(summary);
  console.log(`\n${status.code === 0 ? "OK" : "FAILED"} (exit ${status.code}): ${status.reason}`);
  process.exitCode = status.code;
}

main();

/** Repairs recorded on a saved storyboard this fallback authored (a model's repairs don't carry over). */
function savedRepairs(problem: string): number {
  try {
    const file = path.join(ROOT, "src/content/storyboards/generated", `${problem}.json`);
    const saved = JSON.parse(readFileSync(file, "utf8")) as {
      generation?: { provider?: string; repairAttempts?: number };
    };
    return saved.generation?.provider === AUTHOR_PROVIDER ? (saved.generation.repairAttempts ?? 0) : 0;
  } catch {
    return 0;
  }
}
