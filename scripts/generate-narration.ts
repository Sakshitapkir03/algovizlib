/**
 * Offline narration: voices every scene's narration with ElevenLabs into public/audio and records each clip's
 * measured length in src/content/narration/manifest.json. Run with `pnpm generate:narration --help`.
 */
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { narrationCatalog } from "@/lib/generation/narration/catalog";
import {
  formatNarrationTable,
  NARRATION_USAGE,
  narrationExitStatus,
  parseNarrationCli,
  selectNarrationTargets,
  suggestDrop,
  type NarrationCliOptions,
} from "@/lib/generation/narration/cli";
import { readApiKey, readNarrationConfig } from "@/lib/generation/narration/config";
import { createElevenLabs, type Synthesize } from "@/lib/generation/narration/elevenlabs";
import { mp3DurationMs } from "@/lib/generation/narration/mp3";
import { plannedChars, runNarration, type NarrationSummary } from "@/lib/generation/narration/pipeline";
import { createFileAudioStore } from "@/lib/generation/narration/store";

const ROOT = process.cwd();

function printSummary(summary: NarrationSummary, options: NarrationCliOptions) {
  console.log("");
  console.log(formatNarrationTable(summary));
  const planned = summary.rows.reduce((sum, r) => sum + r.chars, 0);
  if (options.dryRun) {
    console.log(`\nCharacters to voice: ${planned} (budget --max-chars ${summary.maxChars})`);
    const drop = suggestDrop(summary.rows, summary.maxChars);
    if (drop)
      console.log(
        `Over the budget by ${planned - summary.maxChars}. Drop ${drop.storyboardId} (${drop.chars} characters) ` +
          `to fit, and voice it next month.`,
      );
    else if (planned > summary.maxChars)
      console.log(
        `Over the budget by ${planned - summary.maxChars}; no single video covers it. Select fewer videos.`,
      );
    return;
  }
  console.log(
    `\nCharacters used: ${summary.charsUsed} of ${summary.maxChars} · requests: ${summary.requests}`,
  );
  if (summary.stoppedBy) {
    const resume = `pnpm generate:narration --missing${options.pattern ? ` --pattern ${options.pattern}` : ""}`;
    const why = {
      budget: `reached --max-chars ${summary.maxChars} before the next video.`,
      quota: "the ElevenLabs character quota is used up. It resets with your monthly billing cycle.",
      unavailable: "ElevenLabs kept rate limiting or failing after every retry. Try again later.",
      "paid-plan":
        "ElevenLabs requires a paid plan for this voice or format. Set ELEVENLABS_VOICE_ID to a default voice.",
    }[summary.stoppedBy];
    console.log(
      `\nStopped: ${why} Everything saved above is kept.` +
        `\nStill to voice: ${summary.remaining.join(", ") || "none"}` +
        `\nResume with: ${resume}`,
    );
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(NARRATION_USAGE);
    return;
  }
  const options = parseNarrationCli(argv);
  const config = readNarrationConfig(process.env);
  const store = createFileAudioStore({
    publicDir: path.join(ROOT, "public"),
    manifestFile: path.join(ROOT, "src/content/narration/manifest.json"),
  });
  const targets = selectNarrationTargets(
    options,
    narrationCatalog(),
    (t) => plannedChars(t, store, config.voice) > 0,
  );

  // A dry run never needs the key, and never makes a request.
  const synthesize: Synthesize = options.dryRun
    ? () => Promise.reject(new Error("dry run: no requests"))
    : createElevenLabs({ apiKey: readApiKey(process.env), timeoutMs: config.timeoutMs });

  console.log(
    `Voice: ${config.voice.voiceId} · model: ${config.voice.modelId} · format: ${config.voice.outputFormat} · ` +
      `${options.dryRun ? "dry run (nothing called or written)" : "writing to public/audio"} · ` +
      `budget: ${options.maxChars} characters\n`,
  );

  const summary = await runNarration(
    targets,
    { dryRun: options.dryRun, maxChars: options.maxChars, delayMs: config.delayMs, voice: config.voice },
    {
      synthesize,
      store,
      measureMs: mp3DurationMs,
      sleep: (ms) => sleep(ms),
      log: (line) => console.log(line),
    },
  );

  printSummary(summary, options);
  const status = narrationExitStatus(summary);
  console.log(`\n${status.code === 0 ? "OK" : "FAILED"} (exit ${status.code}): ${status.reason}`);
  process.exitCode = status.code;
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
