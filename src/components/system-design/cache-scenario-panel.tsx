"use client";

import { ArrowLeft, Play, RotateCcw, Shuffle } from "lucide-react";
import { useId, useMemo, useState, useTransition } from "react";

import { LearnView } from "@/components/learn/learn-view";
import { Button } from "@/components/ui/button";
import {
  buildCacheReplay,
  DEFAULT_CACHE_CHOICES,
  INVALIDATION_CHOICES,
  STALLS,
  TTLS,
  type CacheChoices,
} from "@/lib/sim/cache-scenario";

/**
 * "Your scenario" for "The price changed but users see the old one": the invalidation, the cache's TTL, and how long
 * Ben's page pauses between reading the database and storing the price. "Replay" runs the simulation in the browser
 * and plays a replay checked like every video. No progress or tutor; quick check answers are recorded as a
 * walkthrough (never reviews).
 */
export default function CacheScenarioPanel({ lessonKey, onBack }: { lessonKey: string; onBack: () => void }) {
  const [choices, setChoices] = useState<CacheChoices>(DEFAULT_CACHE_CHOICES);
  const [built, setBuilt] = useState(() => ({
    result: buildCacheReplay(DEFAULT_CACHE_CHOICES),
    run: 0,
  }));
  const [pending, startTransition] = useTransition();
  const id = useId();
  const replay = (next: CacheChoices) =>
    startTransition(() => setBuilt((b) => ({ result: buildCacheReplay(next), run: b.run + 1 })));
  const result = built.result;
  const checks = useMemo(
    () =>
      result.ok
        ? {
            checks: result.checks,
            problemKey: lessonKey,
            source: "walkthrough" as const,
            input: result.input,
          }
        : undefined,
    [result, lessonKey],
  );
  const set = <K extends keyof CacheChoices>(key: K, value: CacheChoices[K]) =>
    setChoices((c) => ({ ...c, [key]: value }));
  const field = (key: string, label: string, control: React.ReactNode) => (
    <div>
      <label htmlFor={`${id}-${key}`} className="text-sm font-medium">
        {label}
      </label>
      {control}
    </div>
  );
  const selectClass = "mt-1 block w-full rounded-md border bg-background px-2.5 py-1.5 text-sm";

  return (
    <div className="space-y-5">
      <form
        className="space-y-5 rounded-xl border p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          replay(choices);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {field(
            "invalidation",
            "When the price changes",
            <select
              id={`${id}-invalidation`}
              className={selectClass}
              value={choices.invalidation}
              onChange={(e) => set("invalidation", e.target.value as CacheChoices["invalidation"])}
            >
              {INVALIDATION_CHOICES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>,
          )}
          {field(
            "ttl",
            "Cache TTL",
            <select
              id={`${id}-ttl`}
              className={selectClass}
              value={choices.ttlMs}
              onChange={(e) => set("ttlMs", Number(e.target.value))}
            >
              {TTLS.map((t) => (
                <option key={t} value={t}>
                  {t / 1000} s
                </option>
              ))}
            </select>,
          )}
          {field(
            "stall",
            "Ben's page pauses before storing",
            <select
              id={`${id}-stall`}
              className={selectClass}
              value={choices.stallMs}
              onChange={(e) => set("stallMs", Number(e.target.value))}
            >
              {STALLS.map((s) => (
                <option key={s} value={s}>
                  {s === 0 ? "No pause" : `${s} ms`}
                </option>
              ))}
            </select>,
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          The rule: once the price update is saved, no read that starts after that returns the old price. The
          proof enumerates every interleaving of one writer and one or two readers, from a warm and an empty
          cache, for each kind of invalidation. Versioned invalidation guarantees it when the cache makes the
          conditional store in one atomic step and keeps the version marker longer than any read takes.
          Latencies are illustrative.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            <Play aria-hidden /> Replay
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setChoices(DEFAULT_CACHE_CHOICES);
              replay(DEFAULT_CACHE_CHOICES);
            }}
          >
            <RotateCcw aria-hidden /> Reset
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              const next = { ...choices, seed: choices.seed + 1 };
              setChoices(next);
              replay(next);
            }}
          >
            <Shuffle aria-hidden /> New timings
          </Button>
          <Button type="button" variant="ghost" onClick={onBack}>
            <ArrowLeft aria-hidden /> Back to the replay
          </Button>
        </div>
      </form>

      <div aria-live="polite">
        {result.ok ? (
          <p className="font-mono text-xs text-muted-foreground">
            <span className="mr-2 rounded-md border border-primary/60 px-1.5 py-0.5 text-primary">
              Your scenario
            </span>
            {result.summary.staleReads} reads saw the old price after it was saved
            {result.summary.staleReads ? ` (for ${(result.summary.staleForMs / 1000).toFixed(1)} s)` : ""} ·
            every interleaving: {result.summary.violating} of {result.summary.schedules} let a later read see
            it
          </p>
        ) : (
          <p role="alert" className="rounded-lg border border-dashed px-4 py-3 text-sm">
            {result.message}
          </p>
        )}
      </div>

      {result.ok && checks ? (
        <div className="space-y-3">
          {/* Like a DSA walkthrough: no problemKey (no progress, resume, or "Mark as done?") and no tutor. */}
          <LearnView
            key={built.run}
            storyboard={result.storyboard}
            showTakeaway={false}
            askEnabled={false}
            quickChecks={checks}
          />
          <p className="text-xs text-muted-foreground">
            Simulated in your browser with the same engine as the lesson, with plain captions from each step.
            Browser voice only. Your scenario doesn&apos;t change your progress.
          </p>
        </div>
      ) : null}
    </div>
  );
}
