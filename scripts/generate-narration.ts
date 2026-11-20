/**
 * Offline narration: voices every scene's narration with ElevenLabs into narration/clips, stitches each video's
 * clips into one track in public/audio, and records clips, track, and scene offsets in
 * src/content/narration/manifest.json. Run with `pnpm generate:narration --help`.
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
import { createFfmpegStitcher, ffmpegPath } from "@/lib/generation/narration/ffmpeg";
import { mp3DurationMs } from "@/lib/generation/narration/mp3";
import { needsWork, runNarration, type NarrationSummary } from "@/lib/generation/narration/pipeline";
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
    clipsDir: path.join(ROOT, "narration/clips"),
    manifestFile: path.join(ROOT, "src/content/narration/manifest.json"),
  });
  const targets = selectNarrationTargets(options, narrationCatalog(), (t) =>
    needsWork(t, store, config.voice),
  );

  // A dry run or a stitch-only run never needs the key, and never makes a request.
  const synthesize: Synthesize =
    options.dryRun || options.stitchOnly
      ? () => Promise.reject(new Error("no requests in this mode"))
      : createElevenLabs({ apiKey: readApiKey(process.env), timeoutMs: config.timeoutMs });
  // Stitching needs ffmpeg; a dry run doesn't stitch.
  const stitch = options.dryRun
    ? () => {
        throw new Error("dry run: nothing is stitched");
      }
    : createFfmpegStitcher(ffmpegPath(), store.clipPath);

  const mode = options.dryRun
    ? "dry run (nothing called or written)"
    : options.stitchOnly
      ? "stitch only (no requests)"
      : "clips to narration/clips, tracks to public/audio";
  console.log(
    `Voice: ${config.voice.voiceId} · model: ${config.voice.modelId} · format: ${config.voice.outputFormat} · ` +
      `${mode} · budget: ${options.maxChars} characters\n`,
  );

  const summary = await runNarration(
    targets,
    {
      dryRun: options.dryRun,
      stitchOnly: options.stitchOnly,
      maxChars: options.maxChars,
      delayMs: config.delayMs,
      voice: config.voice,
    },
    {
      synthesize,
      stitch,
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
