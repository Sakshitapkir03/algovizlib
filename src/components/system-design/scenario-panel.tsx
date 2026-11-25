"use client";

import { ArrowLeft, Play, RotateCcw, Shuffle } from "lucide-react";
import { useId, useMemo, useState, useTransition } from "react";

import { LearnView } from "@/components/learn/learn-view";
import { Button } from "@/components/ui/button";
import {
  buildScenarioReplay,
  DEFAULT_CHOICES,
  LOSS_LABEL,
  LOSSES,
  type ScenarioChoices,
} from "@/lib/sim/scenario";

/**
 * "Your scenario": the safeguards, what goes wrong, and the timings as plain controls; "Replay" runs the simulation in
 * the browser and plays a replay built from its steps, checked like every video. No progress or tutor (it isn't the
 * lesson's video), and quick check answers are recorded as a walkthrough, so they never count toward reviews.
 */
export default function ScenarioPanel({ lessonKey, onBack }: { lessonKey: string; onBack: () => void }) {
  const [choices, setChoices] = useState<ScenarioChoices>(DEFAULT_CHOICES);
  const [built, setBuilt] = useState(() => ({ result: buildScenarioReplay(DEFAULT_CHOICES), run: 0 }));
  const [pending, startTransition] = useTransition();
  const id = useId();
  const set = <K extends keyof ScenarioChoices>(key: K, value: ScenarioChoices[K]) =>
    setChoices((c) => ({ ...c, [key]: value }));

  const replay = (next: ScenarioChoices) =>
    startTransition(() => setBuilt((b) => ({ result: buildScenarioReplay(next), run: b.run + 1 })));

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

  const check = (key: "key" | "inProgress" | "forwardKey", label: string, hint: string, disabled = false) => (
    <label className={`flex items-start gap-2.5 text-sm ${disabled ? "opacity-60" : ""}`}>
      <input
        type="checkbox"
        className="mt-1 size-4 accent-[var(--primary)]"
        checked={choices[key] && !disabled}
        disabled={disabled}
        onChange={(e) => set(key, e.target.checked)}
      />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
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
        <div className="grid gap-5 md:grid-cols-2">
          <fieldset className="space-y-3">
            <legend className="mb-2 font-mono text-xs text-muted-foreground">safeguards</legend>
            {check(
              "key",
              "Idempotency key",
              "The client sends k-17 with every attempt; the API keeps the result.",
            )}
            {check(
              "inProgress",
              "Claim the key first",
              "The API records k-17 as in progress before charging, so an overlapping retry waits.",
              !choices.key,
            )}
            {check(
              "forwardKey",
              "Forward the key to the provider",
              "The provider deduplicates by k-17 too, so the API's own retries are safe.",
              !choices.key,
            )}
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="mb-2 font-mono text-xs text-muted-foreground">what goes wrong</legend>
            <div>
              <label htmlFor={`${id}-lose`} className="text-sm font-medium">
                Lost message
              </label>
              <select
                id={`${id}-lose`}
                className="mt-1 block w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
                value={choices.lose}
                onChange={(e) => set("lose", e.target.value as ScenarioChoices["lose"])}
              >
                {LOSSES.map((l) => (
                  <option key={l} value={l}>
                    {LOSS_LABEL[l]}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-[var(--primary)]"
                checked={choices.slowProvider}
                onChange={(e) => set("slowProvider", e.target.checked)}
              />
              <span>
                <span className="font-medium">Slow provider</span>
                <span className="block text-xs text-muted-foreground">
                  A charge takes 2.6 s, longer than the client waits, so a retry overlaps it.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-[var(--primary)]"
                checked={choices.patientClient}
                onChange={(e) => set("patientClient", e.target.checked)}
              />
              <span>
                <span className="font-medium">Patient client</span>
                <span className="block text-xs text-muted-foreground">
                  The client waits 5 s instead of 2 s.
                </span>
              </span>
            </label>
            <div>
              <label htmlFor={`${id}-retries`} className="text-sm font-medium">
                Client retries
              </label>
              <select
                id={`${id}-retries`}
                className="mt-1 block w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
                value={choices.retries}
                onChange={(e) => set("retries", Number(e.target.value))}
              >
                {[0, 1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            <Play aria-hidden /> Replay
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setChoices(DEFAULT_CHOICES);
              replay(DEFAULT_CHOICES);
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
            {result.summary.charges} {result.summary.charges === 1 ? "charge" : "charges"} ·{" "}
            {result.summary.outcome} · every single and double lost message: {result.summary.doubleCharges} of{" "}
            {result.summary.runs} runs double-charge
          </p>
        ) : (
          <p role="alert" className="rounded-lg border border-dashed px-4 py-3 text-sm">
            {result.message}
          </p>
        )}
      </div>

      {result.ok && checks ? (
        <div className="space-y-3">
          {/* A new run is a new player (fresh clock and narration). */}
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
