"use client";

import { ArrowLeft, Play, RotateCcw, Shuffle } from "lucide-react";
import { useId, useMemo, useState, useTransition } from "react";

import { LearnView } from "@/components/learn/learn-view";
import { Button } from "@/components/ui/button";
import {
  buildConcurrencyReplay,
  DEFAULT_CONCURRENCY_CHOICES,
  EDITOR_COUNTS,
  GAPS,
  KINDS,
  type ConcurrencyChoices,
} from "@/lib/sim/concurrency-scenario";

/**
 * "Your scenario" for "Two edits, one lost": two or three editors, the gap between their starts, compare-and-set on or
 * off, and the kind of edit. "Replay" runs the simulation in the browser and plays a replay checked like every
 * video. No progress or tutor; quick check answers are recorded as a walkthrough (never reviews).
 */
export default function ConcurrencyScenarioPanel({
  lessonKey,
  onBack,
}: {
  lessonKey: string;
  onBack: () => void;
}) {
  const [choices, setChoices] = useState<ConcurrencyChoices>(DEFAULT_CONCURRENCY_CHOICES);
  const [built, setBuilt] = useState(() => ({
    result: buildConcurrencyReplay(DEFAULT_CONCURRENCY_CHOICES),
    run: 0,
  }));
  const [pending, startTransition] = useTransition();
  const id = useId();
  const replay = (next: ConcurrencyChoices) =>
    startTransition(() => setBuilt((b) => ({ result: buildConcurrencyReplay(next), run: b.run + 1 })));
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
  const set = <K extends keyof ConcurrencyChoices>(key: K, value: ConcurrencyChoices[K]) =>
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
            "editors",
            "Editors",
            <select
              id={`${id}-editors`}
              className={selectClass}
              value={choices.editors}
              onChange={(e) => set("editors", Number(e.target.value) as ConcurrencyChoices["editors"])}
            >
              {EDITOR_COUNTS.map((n) => (
                <option key={n} value={n}>
                  {n === 2 ? "Two: Bo and Cy" : "Three: Bo, Cy, and Dee"}
                </option>
              ))}
            </select>,
          )}
          {field(
            "gap",
            "Time between their starts",
            <select
              id={`${id}-gap`}
              className={selectClass}
              value={choices.gapMs}
              onChange={(e) => set("gapMs", Number(e.target.value))}
            >
              {[...new Set([DEFAULT_CONCURRENCY_CHOICES.gapMs, ...GAPS])]
                .sort((a, b) => a - b)
                .map((g) => (
                  <option key={g} value={g}>
                    {g === 0 ? "Same moment" : `${g} ms`}
                  </option>
                ))}
            </select>,
          )}
          {field(
            "cas",
            "Writes",
            <select
              id={`${id}-cas`}
              className={selectClass}
              value={choices.cas ? "on" : "off"}
              onChange={(e) => set("cas", e.target.value === "on")}
            >
              <option value="off">Blind: always applied</option>
              <option value="on">Compare-and-set on the version</option>
            </select>,
          )}
          {field(
            "kind",
            "Kind of edit",
            <select
              id={`${id}-kind`}
              className={selectClass}
              value={choices.kind}
              onChange={(e) => set("kind", e.target.value as ConcurrencyChoices["kind"])}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>,
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Each editor reads the row, works out its change, and writes about 40 ms later. The proof enumerates
          every interleaving of your editors&apos; reads and writes. Compare-and-set guarantees no lost update
          when one database compares and writes atomically and every editor retries until its write applies;
          it doesn&apos;t promise anyone finishes quickly under heavy contention. Latencies are illustrative.
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
              setChoices(DEFAULT_CONCURRENCY_CHOICES);
              replay(DEFAULT_CONCURRENCY_CHOICES);
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
            {result.summary.lost} edit{result.summary.lost === 1 ? "" : "s"} lost in this replay · every
            interleaving: {result.summary.lostSchedules} of {result.summary.schedules} lose an edit
            {result.summary.maxRetries
              ? ` · 16 editors at once: ${result.summary.avgRetries} retries on average, ${result.summary.maxRetries} at most, ${result.summary.gaveUp} gave up`
              : ""}
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
