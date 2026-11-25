"use client";

import { ArrowLeft, Play, RotateCcw, Shuffle } from "lucide-react";
import { useId, useMemo, useState, useTransition } from "react";

import { LearnView } from "@/components/learn/learn-view";
import { Button } from "@/components/ui/button";
import {
  buildBalancingReplay,
  DEFAULT_BALANCING_CHOICES,
  FACTORS,
  HEALTH,
  POLICIES,
  PROOF_SEEDS,
  TRAFFIC,
  WORKERS,
  type BalancingChoices,
} from "@/lib/sim/balancing-scenario";
import { slowdownWords } from "@/lib/traces/system-design/slow-server";

/**
 * "Your scenario" for "One slow server takes everyone down": routing, how slow server 2 gets, health checks, and
 * traffic; both servers always have the same number of workers, as least-outstanding's guarantee requires (said
 * here). "Replay" runs the simulation in the browser and plays a replay checked like every video. No progress or
 * tutor; quick check answers are recorded as a walkthrough (never reviews).
 */
export default function BalancingScenarioPanel({
  lessonKey,
  onBack,
}: {
  lessonKey: string;
  onBack: () => void;
}) {
  const [choices, setChoices] = useState<BalancingChoices>(DEFAULT_BALANCING_CHOICES);
  const [built, setBuilt] = useState(() => ({
    result: buildBalancingReplay(DEFAULT_BALANCING_CHOICES),
    run: 0,
  }));
  const [pending, startTransition] = useTransition();
  const id = useId();
  const replay = (next: BalancingChoices) =>
    startTransition(() => setBuilt((b) => ({ result: buildBalancingReplay(next), run: b.run + 1 })));
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
  const set = <K extends keyof BalancingChoices>(key: K, value: BalancingChoices[K]) =>
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
            "policy",
            "Routing",
            <select
              id={`${id}-policy`}
              className={selectClass}
              value={choices.policy}
              onChange={(e) => set("policy", e.target.value as BalancingChoices["policy"])}
            >
              {POLICIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>,
          )}
          {field(
            "factor",
            "How slow server 2 gets",
            <select
              id={`${id}-factor`}
              className={selectClass}
              value={choices.factor}
              onChange={(e) => set("factor", Number(e.target.value))}
            >
              {FACTORS.map((f) => (
                <option key={f} value={f}>
                  {slowdownWords(f)}
                </option>
              ))}
            </select>,
          )}
          {field(
            "health",
            "Health checks",
            <select
              id={`${id}-health`}
              className={selectClass}
              value={choices.healthMs}
              onChange={(e) => set("healthMs", Number(e.target.value))}
            >
              {HEALTH.map((h) => (
                <option key={h} value={h}>
                  {h ? `Every ${h / 1000} s` : "Off"}
                </option>
              ))}
            </select>,
          )}
          {field(
            "rps",
            "Traffic",
            <select
              id={`${id}-rps`}
              className={selectClass}
              value={choices.rps}
              onChange={(e) => set("rps", Number(e.target.value))}
            >
              {TRAFFIC.map((r) => (
                <option key={r} value={r}>
                  {r} requests / s
                </option>
              ))}
            </select>,
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Both servers always have the same {WORKERS} workers: least outstanding&apos;s guarantee (never
          sending a request to a full server while the other has room) holds only when the servers are equal.
          Rule 1 is checked over seeds {PROOF_SEEDS[0]}–{PROOF_SEEDS[1]} at your slowdown and traffic. Service
          times are illustrative.
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
              setChoices(DEFAULT_BALANCING_CHOICES);
              replay(DEFAULT_BALANCING_CHOICES);
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
            rule 1 broken in {result.summary.broken} of {result.summary.runs} runs · worst p99{" "}
            {result.summary.worstP99 >= 1000
              ? `${(result.summary.worstP99 / 1000).toFixed(1)} s`
              : `${result.summary.worstP99} ms`}{" "}
            · {result.summary.timeouts} timeouts in this replay
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
