import { describeIssues } from "./draft";
import type { RunSummary, StopReason } from "./pipeline";

export function formatTable(rows: string[][]): string {
  const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)));
  return rows
    .map((r) =>
      r
        .map((cell, c) => cell.padEnd(widths[c]))
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
}

/** The summary table shared by the generator and the draft validator. */
export function formatSummaryTable(summary: Pick<RunSummary, "rows">): string {
  return formatTable([
    ["problem", "result", "repairs", "scenes", "requests", "note"],
    ...summary.rows.map((r) => [
      r.problem,
      r.status,
      String(r.repairs),
      r.scenes === undefined ? "-" : String(r.scenes),
      String(r.requests),
      r.detail ?? "",
    ]),
  ]);
}

/** Every issue of every failed row, located and with expected vs. actual values. */
export function formatFailures(summary: Pick<RunSummary, "rows">, limit = 25): string {
  return summary.rows
    .filter((r) => r.issues?.length)
    .map((r) => {
      const shown = r.issues!.slice(0, limit);
      const more = r.issues!.length - shown.length;
      return `Issues for ${r.problem}:\n${describeIssues(shown)}${more > 0 ? `\n- …and ${more} more` : ""}`;
    })
    .join("\n\n");
}

const STOP_TEXT: Record<StopReason, string> = {
  budget: "the request budget (--max-requests) was reached",
  "daily-quota": "the provider's daily quota is used up",
  unavailable: "the model stayed unavailable after every retry",
};

export type ExitStatus = { code: 0 | 1 | 2; reason: string };

/**
 * 0: every targeted problem ended saved, cached, valid (dry run), or skipped.
 * 1: at least one problem failed (invalid after repairs, or an error).
 * 2: the run stopped early (budget, daily quota, unavailable) with problems still to do.
 */
export function exitStatus(summary: Pick<RunSummary, "rows" | "stoppedBy" | "remaining">): ExitStatus {
  const failed = summary.rows.filter((r) => r.status === "failed").map((r) => r.problem);
  if (summary.stoppedBy && summary.remaining.length > 0) {
    const also = failed.length > 0 ? ` ${failed.length} failed before that.` : "";
    return {
      code: 2,
      reason: `Stopped early because ${STOP_TEXT[summary.stoppedBy]}; ${summary.remaining.length} still to do.${also}`,
    };
  }
  if (failed.length > 0) return { code: 1, reason: `${failed.length} failed: ${failed.join(", ")}.` };
  return { code: 0, reason: "Every targeted problem is saved, cached, valid, or skipped." };
}
