"use client";

import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { PatternProgress, StatusLabel } from "@/components/catalog/progress-status";
import { ReviewTodayCard } from "@/components/review/review-today-card";
import type { ProgressIndex } from "@/lib/catalog/repository";
import { formatSeconds, progressKey, statusOf } from "@/lib/progress";
import { continueList, recentlyDone, RESUME_HASH } from "@/lib/progress/summary";
import { useProgress, useProgressRecords } from "@/lib/progress/use-progress";

const WHERE = {
  browser: "Saved in this browser. Sign in to keep it across devices.",
  unverified: "Saved in this browser until you verify your email; then it syncs to your account.",
  syncing: "Syncing with your account…",
  account: "Synced to your account.",
} as const;

/** /me: what's due for review, progress by group and pattern, what to continue (straight to the saved video point), recently done. */
export function MyProgress({ index }: { index: ProgressIndex }) {
  const records = useProgressRecords();
  const { snapshot, sync } = useProgress();
  const { data } = useSession();
  const known = (key: string) => key in index.problems;
  const next = continueList(records, known);
  const done = recentlyDone(records, known);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-xs text-muted-foreground">
        <span className="text-primary">$</span> algovizlib --progress
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        {data?.user?.name ? `${data.user.name.split(" ")[0]}'s progress` : "My progress"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {WHERE[sync]}{" "}
        {sync === "browser" && !data?.user && (
          <Link href="/login?callbackUrl=%2Fme" className="text-primary underline underline-offset-4">
            Sign in
          </Link>
        )}
      </p>
      <Link
        href="/review"
        className="mt-3 inline-block font-mono text-xs text-primary underline-offset-4 hover:underline"
      >
        review queue →
      </Link>

      <ReviewTodayCard problems={index.problems} className="mt-8 max-w-2xl" />

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="continue-heading">
          <h2 id="continue-heading" className="mb-3 font-mono text-xs text-muted-foreground">
            continue where you left off
          </h2>
          {next.length === 0 ? (
            <Empty>
              Nothing in progress.{" "}
              <Link href="/dsa" className="text-primary underline underline-offset-4">
                Pick a pattern
              </Link>{" "}
              to start.
            </Empty>
          ) : (
            <ul className="space-y-2">
              {next.map((item) => {
                const p = index.problems[item.key];
                return (
                  <li key={item.key}>
                    <Link
                      href={item.seconds !== undefined ? `${p.href}${RESUME_HASH}` : p.href}
                      className="glow-box flex items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.title}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{p.patternName}</span>
                      </span>
                      {item.seconds !== undefined ? (
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-primary">
                          <Play aria-hidden className="size-3" /> Resume from {formatSeconds(item.seconds)}
                        </span>
                      ) : (
                        <StatusLabel status="learning" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="done-heading">
          <h2 id="done-heading" className="mb-3 font-mono text-xs text-muted-foreground">
            recently completed
          </h2>
          {done.length === 0 ? (
            <Empty>No problems marked done yet. Finish a video, then mark it done.</Empty>
          ) : (
            <ul className="divide-y rounded-lg border">
              {done.map(({ key }) => {
                const p = index.problems[key];
                return (
                  <li key={key}>
                    <Link
                      href={p.href}
                      className="glow-box flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                      <StatusLabel status="done" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="by-pattern-heading" className="mt-14">
        <h2 id="by-pattern-heading" className="mb-5 font-mono text-xs text-muted-foreground">
          by group and pattern
        </h2>
        <div className="space-y-10">
          {index.groups.map((group) => {
            const all = group.patterns.flatMap((p) => p.problems);
            const started = all.some((p) => statusOf(snapshot, progressKey(p)) !== "not-started");
            return (
              <section key={group.slug} aria-labelledby={`me-${group.slug}`}>
                <div className="mb-4 grid gap-3 md:grid-cols-[1fr_16rem] md:items-end">
                  <h3 id={`me-${group.slug}`} className="text-lg font-semibold tracking-tight">
                    {group.name}
                  </h3>
                  <PatternProgress problems={all} label={`${group.name} problems done`} />
                </div>
                {started && (
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.patterns.map((pattern) => (
                      <li
                        key={pattern.slug}
                        className="glow-box relative rounded-lg border px-4 py-3 hover:bg-muted/30"
                      >
                        <Link
                          href={pattern.href}
                          className="flex items-center justify-between text-sm font-medium after:absolute after:inset-0 after:rounded-lg"
                        >
                          {pattern.name}
                          <ArrowRight aria-hidden className="size-3.5 text-muted-foreground" />
                        </Link>
                        <PatternProgress
                          problems={pattern.problems}
                          label={`${pattern.name} problems done`}
                          className="mt-2"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">{children}</p>
  );
}
