"use client";

import { ArrowLeft, Play, RotateCcw, Shuffle } from "lucide-react";
import { useId, useMemo, useState, useTransition } from "react";

import { LearnView } from "@/components/learn/learn-view";
import { Button } from "@/components/ui/button";
import {
  buildStampedeReplay,
  DEFAULT_STAMPEDE_CHOICES,
  KEY_COUNTS,
  PROOF_SEEDS,
  RATES,
  type StampedeChoices,
} from "@/lib/sim/stampede-scenario";

/**
 * "Your scenario" for "Everything fell over when the cache expired": traffic, single-flight, jittered TTLs, and how
 * many keys the deploy fills. "Replay" runs the simulation in the browser and plays a replay checked like every video.
 * No progress or tutor; quick check answers are recorded as a walkthrough (never reviews).
 */
export default function StampedeScenarioPanel({
  lessonKey,
  onBack,
}: {
  lessonKey: string;
  onBack: () => void;
}) {
  const [choices, setChoices] = useState<StampedeChoices>(DEFAULT_STAMPEDE_CHOICES);
  const [built, setBuilt] = useState(() => ({
    result: buildStampedeReplay(DEFAULT_STAMPEDE_CHOICES),
    run: 0,
  }));
  const [pending, startTransition] = useTransition();
  const id = useId();
  const replay = (next: StampedeChoices) =>
    startTransition(() => setBuilt((b) => ({ result: buildStampedeReplay(next), run: b.run + 1 })));
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
  const set = <K extends keyof StampedeChoices>(key: K, value: StampedeChoices[K]) =>
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
            "rps",
            "Traffic",
            <select
              id={`${id}-rps`}
              className={selectClass}
              value={choices.rps}
              onChange={(e) => set("rps", Number(e.target.value))}
            >
              {RATES.map((r) => (
                <option key={r} value={r}>
                  {r} page views / s
                </option>
              ))}
            </select>,
          )}
          {field(
            "keys",
            "Keys the deploy fills",
            <select
              id={`${id}-keys`}
              className={selectClass}
              value={choices.keys}
              onChange={(e) => set("keys", Number(e.target.value))}
            >
              {KEY_COUNTS.map((k) => (
                <option key={k} value={k}>
                  {k === 1 ? "1 key" : `${k} keys`}
                </option>
              ))}
            </select>,
          )}
          {field(
            "single-flight",
            "Single-flight",
            <select
              id={`${id}-single-flight`}
              className={selectClass}
              value={choices.singleFlight ? "on" : "off"}
              onChange={(e) => set("singleFlight", e.target.value === "on")}
            >
              <option value="off">Off: every miss queries the database</option>
              <option value="on">On: one fetch per key, others wait</option>
            </select>,
          )}
          {field(
            "jitter",
            "TTLs",
            <select
              id={`${id}-jitter`}
              className={selectClass}
              value={choices.jitter ? "on" : "off"}
              onChange={(e) => set("jitter", e.target.value === "on")}
            >
              <option value="off">All the same (10 s)</option>
              <option value="on">Jittered within 20%</option>
            </select>,
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          The rules: the database never runs two fetches of one key at once on an app node, and its queue
          never holds more requests than its 8 workers, with no failed pages. They&apos;re checked over seeds{" "}
          {PROOF_SEEDS[0]}–{PROOF_SEEDS[1]} at your traffic and key count, on one app node. Single-flight is
          per app node unless coordinated. Query times are illustrative.
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
              setChoices(DEFAULT_STAMPEDE_CHOICES);
              replay(DEFAULT_STAMPEDE_CHOICES);
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
            {result.summary.queries} database queries · queue at most {result.summary.maxQueue} ·{" "}
            {result.summary.failed} failed pages · a rule broken in {result.summary.broken} of{" "}
            {result.summary.runs} runs
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
