"use client";

import { ArrowLeft, Play, RotateCcw, Shuffle } from "lucide-react";
import { useId, useMemo, useState, useTransition } from "react";

import { LearnView } from "@/components/learn/learn-view";
import { Button } from "@/components/ui/button";
import {
  buildCapacityReplay,
  DEFAULT_CAPACITY_CHOICES,
  PEAKS,
  SERVERS,
  SERVICE_TIMES,
  WORKERS,
  type CapacityChoices,
} from "@/lib/sim/capacity-scenario";

/**
 * "Your scenario" for "Is one server enough?": peak traffic, servers, workers, and service time as plain selects;
 * "Replay" runs the simulation in the browser and plays a replay built from its steps, checked like every video.
 * No progress or tutor, and quick check answers are recorded as a walkthrough (never reviews).
 */
export default function CapacityScenarioPanel({
  lessonKey,
  onBack,
}: {
  lessonKey: string;
  onBack: () => void;
}) {
  const [choices, setChoices] = useState<CapacityChoices>(DEFAULT_CAPACITY_CHOICES);
  const [built, setBuilt] = useState(() => ({
    result: buildCapacityReplay(DEFAULT_CAPACITY_CHOICES),
    run: 0,
  }));
  const [pending, startTransition] = useTransition();
  const id = useId();
  const replay = (next: CapacityChoices) =>
    startTransition(() => setBuilt((b) => ({ result: buildCapacityReplay(next), run: b.run + 1 })));
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

  const select = (
    key: keyof Omit<CapacityChoices, "seed">,
    label: string,
    values: number[],
    unit: string,
  ) => (
    <div>
      <label htmlFor={`${id}-${key}`} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={`${id}-${key}`}
        className="mt-1 block w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
        value={choices[key]}
        onChange={(e) => setChoices((c) => ({ ...c, [key]: Number(e.target.value) }))}
      >
        {values.map((v) => (
          <option key={v} value={v}>
            {v} {unit}
          </option>
        ))}
      </select>
    </div>
  );

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
          {select("peak", "Peak traffic", PEAKS, "requests / s")}
          {select("servers", "App servers", SERVERS, "behind a balancer when more than one")}
          {select("workers", "Workers per server", WORKERS, "at a time")}
          {select("serviceMs", "Service time per request", SERVICE_TIMES, "ms")}
        </div>
        <p className="text-xs text-muted-foreground">
          Traffic rises to the peak in four measured steps. Service times are illustrative, not real hardware.
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
              setChoices(DEFAULT_CAPACITY_CHOICES);
              replay(DEFAULT_CAPACITY_CHOICES);
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
            measured limit {result.summary.limit} · about {result.summary.capacity} req/s in theory
            {result.summary.saturatedAt !== undefined
              ? ` · saturated at ${result.summary.saturatedAt} req/s`
              : " · never saturated"}
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
