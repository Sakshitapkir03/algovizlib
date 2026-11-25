"use client";

import { ArrowLeft, Play, RotateCcw, Shuffle } from "lucide-react";
import { useId, useMemo, useState, useTransition } from "react";

import { LearnView } from "@/components/learn/learn-view";
import { Button } from "@/components/ui/button";
import {
  buildReplicationReplay,
  DEFAULT_REPLICATION_CHOICES,
  LAGS,
  PROOF_SEEDS,
  READ_AFTER,
  type ReplicationChoices,
} from "@/lib/sim/replication-scenario";

/**
 * "Your scenario" for "I posted a comment and it vanished": the replica's mean lag, a lag spike, read-your-writes, and
 * how soon Ana reloads after posting. "Replay" runs the simulation in the browser and plays a replay checked like every
 * video. No progress or tutor; quick check answers are recorded as a walkthrough (never reviews).
 */
export default function ReplicationScenarioPanel({
  lessonKey,
  onBack,
}: {
  lessonKey: string;
  onBack: () => void;
}) {
  const [choices, setChoices] = useState<ReplicationChoices>(DEFAULT_REPLICATION_CHOICES);
  const [built, setBuilt] = useState(() => ({
    result: buildReplicationReplay(DEFAULT_REPLICATION_CHOICES),
    run: 0,
  }));
  const [pending, startTransition] = useTransition();
  const id = useId();
  const replay = (next: ReplicationChoices) =>
    startTransition(() => setBuilt((b) => ({ result: buildReplicationReplay(next), run: b.run + 1 })));
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
  const set = <K extends keyof ReplicationChoices>(key: K, value: ReplicationChoices[K]) =>
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
            "lag",
            "Replication lag (mean)",
            <select
              id={`${id}-lag`}
              className={selectClass}
              value={choices.lagMs}
              onChange={(e) => set("lagMs", Number(e.target.value))}
            >
              {LAGS.map((l) => (
                <option key={l} value={l}>
                  {l} ms
                </option>
              ))}
            </select>,
          )}
          {field(
            "spike",
            "Lag spike",
            <select
              id={`${id}-spike`}
              className={selectClass}
              value={choices.spike ? "on" : "off"}
              onChange={(e) => set("spike", e.target.value === "on")}
            >
              <option value="off">Off</option>
              <option value="on">3 s spike to about 2 s</option>
            </select>,
          )}
          {field(
            "fix",
            "Read-your-writes",
            <select
              id={`${id}-fix`}
              className={selectClass}
              value={choices.fix ? "on" : "off"}
              onChange={(e) => set("fix", e.target.value === "on")}
            >
              <option value="off">Off: every read goes to the replica</option>
              <option value="on">On: the replica only once it has your write</option>
            </select>,
          )}
          {field(
            "after",
            "Ana reloads after posting",
            <select
              id={`${id}-after`}
              className={selectClass}
              value={choices.readAfterMs}
              onChange={(e) => set("readAfterMs", Number(e.target.value))}
            >
              {READ_AFTER.map((r) => (
                <option key={r} value={r}>
                  {r} ms later
                </option>
              ))}
            </select>,
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          The rule (after your write is confirmed, your reads never show an older version) is checked on every
          read over seeds {PROOF_SEEDS[0]}–{PROOF_SEEDS[1]} at your lag, spike, and reload delay.
          Read-your-writes guarantees it with one primary taking every write in order, the session&apos;s
          token sent with every read, and no failover. Latencies are illustrative.
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
              setChoices(DEFAULT_REPLICATION_CHOICES);
              replay(DEFAULT_REPLICATION_CHOICES);
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
            a user saw an older version than their own write in {result.summary.broken} of{" "}
            {result.summary.runs} runs · {result.summary.stale} of {result.summary.reloads} reloads right
            after a post were stale at your lag · {result.summary.primaryShare}% of reads went to the primary
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
