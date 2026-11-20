import { parseArgs } from "node:util";

import { formatTable } from "../report";
import {
  DEFAULT_MAX_CHARS,
  type NarrationSummary,
  type NarrationStopReason,
  type NarrationTarget,
} from "./pipeline";

export type NarrationCliOptions = {
  /** Storyboard ids or problem keys ("pattern/slug"); repeat --storyboard for several. */
  storyboards: string[];
  pattern?: string;
  missing: boolean;
  dryRun: boolean;
  /** Build stitched tracks from existing clips only: no ElevenLabs requests, no key. */
  stitchOnly: boolean;
  maxChars: number;
};

export const NARRATION_USAGE = `Usage: pnpm generate:narration [selection] [flags]

Selection (at least one):
  --storyboard <id>        a storyboard id (two-pointers) or its problem (two-pointers/pair-with-target-sum);
                           repeat for several
  --pattern <slug>         every video in a pattern
  --missing                every video with a scene not voiced yet or a stale track (combine with --pattern)

Flags:
  --dry-run                print characters per video and the total; call nothing, write nothing
  --stitch-only            only stitch existing clips into each video's track (no requests, no key);
                           every video when nothing else is selected
  --max-chars <n>          stop before a video that would take the run past n characters (default ${DEFAULT_MAX_CHARS})`;

export function parseNarrationCli(argv: readonly string[]): NarrationCliOptions {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      storyboard: { type: "string", multiple: true },
      pattern: { type: "string" },
      missing: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      "stitch-only": { type: "boolean", default: false },
      "max-chars": { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });
  const maxChars = values["max-chars"] === undefined ? DEFAULT_MAX_CHARS : Number(values["max-chars"]);
  if (!Number.isInteger(maxChars) || maxChars < 1) throw new Error("--max-chars must be a positive integer");
  const storyboards = values.storyboard ?? [];
  if (storyboards.length === 0 && !values.pattern && !values.missing && !values["stitch-only"])
    throw new Error("Choose what to voice: --storyboard, --pattern, or --missing");
  return {
    storyboards,
    pattern: values.pattern,
    missing: values.missing,
    dryRun: values["dry-run"],
    stitchOnly: values["stitch-only"],
    maxChars,
  };
}

/** Every video, in catalog order, with the pattern it belongs to. */
export type NarrationCatalog = readonly (NarrationTarget & { pattern: string })[];

/**
 * The videos to voice, in the order given (`--storyboard`) or catalog order. `--missing` keeps only videos with a
 * scene still to voice or a stale track (`needsWork`).
 */
export function selectNarrationTargets(
  options: NarrationCliOptions,
  catalog: NarrationCatalog,
  needsWork: (target: NarrationTarget) => boolean,
): NarrationTarget[] {
  let targets: NarrationCatalog;
  if (options.storyboards.length > 0) {
    targets = options.storyboards.map((name) => {
      const found = catalog.find((t) => t.storyboardId === name || t.problemKey === name);
      if (!found)
        throw new Error(`Unknown storyboard "${name}" (use a storyboard id or a problem like pattern/slug)`);
      return found;
    });
    targets = targets.filter((t, i) => targets.indexOf(t) === i);
  } else {
    targets = catalog;
  }
  if (options.pattern) {
    if (!catalog.some((t) => t.pattern === options.pattern))
      throw new Error(`No videos in pattern "${options.pattern}"`);
    targets = targets.filter((t) => t.pattern === options.pattern);
  }
  return (options.missing ? targets.filter(needsWork) : targets).map(({ pattern: _, ...t }) => t);
}

export function formatNarrationTable(summary: Pick<NarrationSummary, "rows">): string {
  return formatTable([
    ["video", "problem", "scenes", "voiced", "characters", "result", "track", "note"],
    ...summary.rows.map((r) => [
      r.storyboardId,
      r.problemKey,
      String(r.scenes),
      `${r.voicedScenes}/${r.scenes}`,
      String(r.chars),
      r.status,
      r.track,
      r.detail ?? "",
    ]),
  ]);
}

/**
 * When a selection doesn't fit the budget: the single video whose removal brings it under, keeping as many
 * characters as possible (the smallest video that's at least the overflow). Undefined if one isn't enough.
 */
export function suggestDrop(
  rows: readonly { storyboardId: string; chars: number }[],
  maxChars: number,
): { storyboardId: string; chars: number } | undefined {
  const total = rows.reduce((sum, r) => sum + r.chars, 0);
  const over = total - maxChars;
  if (over <= 0) return undefined;
  return rows
    .filter((r) => r.chars >= over)
    .sort((a, b) => a.chars - b.chars)
    .at(0);
}

const STOP_TEXT: Record<NarrationStopReason, string> = {
  budget: "the character budget (--max-chars) was reached",
  quota: "the ElevenLabs character quota is used up",
  unavailable: "ElevenLabs stayed unavailable after every retry",
  "paid-plan": "ElevenLabs requires a paid plan for this voice or format",
};

/** Same codes as the storyboard scripts: 0 done, 1 something failed, 2 stopped early with work left. */
export function narrationExitStatus(summary: Pick<NarrationSummary, "rows" | "stoppedBy" | "remaining">): {
  code: 0 | 1 | 2;
  reason: string;
} {
  const failed = summary.rows.filter(
    (r) => r.status === "failed" || (r.status === "partial" && !summary.stoppedBy),
  );
  if (summary.stoppedBy && summary.remaining.length > 0) {
    const also = failed.length > 0 ? ` ${failed.length} failed before that.` : "";
    return {
      code: 2,
      reason: `Stopped early because ${STOP_TEXT[summary.stoppedBy]}; ${summary.remaining.length} video(s) still to voice.${also}`,
    };
  }
  if (failed.length > 0)
    return { code: 1, reason: `${failed.length} failed: ${failed.map((r) => r.storyboardId).join(", ")}.` };
  return {
    code: 0,
    reason: "Every targeted video is voiced and stitched, up to date, or planned (dry run).",
  };
}
