"use client";

import { cn } from "@/lib/utils";
import {
  PROGRESS_LABEL,
  PROGRESS_STATUSES,
  progressKey,
  statusOf,
  type ProgressStatus,
} from "@/lib/progress";
import { useProgress, type SyncState } from "@/lib/progress/use-progress";

import { StatusNote } from "./status-note";

const WHERE: Record<SyncState, string> = {
  browser: "saved in this browser",
  unverified: "saved in this browser · verify your email to sync",
  syncing: "syncing…",
  account: "synced to your account",
};

const GLYPH: Record<ProgressStatus, string> = { "not-started": "○", learning: "◐", done: "●" };

/** Glyph + word, never color alone. */
export function StatusLabel({ status, className }: { status: ProgressStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs whitespace-nowrap",
        status === "not-started" ? "text-muted-foreground" : "text-foreground",
        className,
      )}
    >
      <span aria-hidden className={cn(status === "done" && "text-primary")}>
        {GLYPH[status]}
      </span>
      {PROGRESS_LABEL[status]}
    </span>
  );
}

type ProblemRef = { patternSlug: string; slug: string };

/** Read-only status for one problem (tables, cards). */
export function ProblemStatus({ problem }: { problem: ProblemRef }) {
  const { snapshot } = useProgress();
  return <StatusLabel status={statusOf(snapshot, progressKey(problem))} />;
}

/** Segmented radio group for the problem page. */
export function StatusPicker({ problem }: { problem: ProblemRef }) {
  const { snapshot, setStatus, persistent, sync } = useProgress();
  const key = progressKey(problem);
  const current = statusOf(snapshot, key);
  return (
    <div className="flex flex-col items-start gap-1.5">
      <fieldset className="inline-flex rounded-lg border p-0.5">
        <legend className="sr-only">Your progress on this problem</legend>
        {PROGRESS_STATUSES.map((status) => (
          <label
            key={status}
            className={cn(
              "relative cursor-pointer rounded-md px-2.5 py-1 transition-colors motion-reduce:transition-none",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-ring",
              current === status ? "bg-muted" : "hover:bg-muted/50",
            )}
          >
            <input
              type="radio"
              name={`progress-${key}`}
              value={status}
              checked={current === status}
              onChange={() => setStatus(key, status)}
              className="sr-only"
            />
            <StatusLabel status={status} className={cn(current !== status && "text-muted-foreground")} />
          </label>
        ))}
      </fieldset>
      <p className="font-mono text-[11px] text-muted-foreground" aria-live="polite">
        {persistent || sync === "account"
          ? WHERE[sync]
          : "storage unavailable: progress lasts until you reload"}
      </p>
      <StatusNote />
    </div>
  );
}

/** "3 / 5 done" with a bar. Learning counts as in progress but not done. */
export function PatternProgress({
  problems,
  label = "Problems done",
  className,
}: {
  problems: ProblemRef[];
  /** Accessible name for the progress bar; must be unique when several bars share a page. */
  label?: string;
  className?: string;
}) {
  const { snapshot } = useProgress();
  const statuses = problems.map((p) => statusOf(snapshot, progressKey(p)));
  const done = statuses.filter((s) => s === "done").length;
  const learning = statuses.filter((s) => s === "learning").length;
  const total = problems.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between font-mono text-[11px] text-muted-foreground">
        <span>
          <span className="text-foreground">{done}</span>/{total} done
          {learning > 0 && <span> · {learning} learning</span>}
        </span>
        <span>{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} problems done`}
        className="h-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
