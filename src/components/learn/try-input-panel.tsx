"use client";

import { ArrowLeft, Check, Link2, Play, RotateCcw, Shuffle } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Storyboard } from "@/lib/storyboard";
import type { WalkthroughProblem } from "@/lib/walkthrough/build";
import { fieldHint } from "@/lib/walkthrough/fields";
import { INPUT_PARAM } from "@/lib/walkthrough/link";
import {
  buildWalkthroughFor,
  decodeInput,
  describeInput,
  encodeInput,
  formatInput,
  getInputSpec,
  type InputError,
  parseInput,
  randomInput,
} from "@/lib/walkthrough/run";

import { LearnView } from "./learn-view";

/**
 * A walkthrough's player: no `problemKey` (so no progress, saved position, resume, or "Mark as done?") and no tutor
 * (it only knows the committed videos). Kept as one function so a test can pin it.
 */
export function walkthroughViewProps(storyboard: Storyboard) {
  return { storyboard, showTakeaway: false, askEnabled: false } as const;
}

/**
 * "Your input": boxes prefilled with the video's example, the problem's requirements, and the walkthrough of
 * whatever passes them, built here in the browser from the problem's trace and checked like every video (see
 * `lib/walkthrough/run.ts`). A built input goes into the address bar (`?input=`), so "Copy link" shares exactly it.
 */
export default function TryInputPanel({
  problemKey,
  problem,
  patternName,
  template,
  shared,
  onBack,
}: {
  problemKey: string;
  problem: WalkthroughProblem;
  patternName: string;
  template: Storyboard;
  /** A shared link's `?input=` value, if the page was opened with one. */
  shared: string | null;
  onBack: () => void;
}) {
  const spec = getInputSpec(problemKey)!;
  const example = useMemo(() => template.trace?.args ?? [], [template]);
  type Built = { storyboard: Storyboard; args: unknown[]; summary: string; run: number };
  /** Parse, build, and check (pure: no state is touched). */
  const attempt = (list: readonly string[]): { errors: InputError[]; built?: Omit<Built, "run"> } => {
    const parsed = parseInput(spec, list);
    const result = parsed.ok
      ? buildWalkthroughFor(problem, patternName, spec, parsed.args, template)
      : parsed;
    if (!result.ok) return { errors: result.errors };
    return {
      errors: [],
      built: { storyboard: result.storyboard, args: result.args, summary: describeInput(spec, result.args) },
    };
  };

  // On open: a shared link's input (checked like typed input), else the video's example. The panel only renders in
  // the browser, so this runs once, before the first paint.
  const [initial] = useState(() => {
    const decoded = shared === null ? undefined : decodeInput(spec, shared);
    const list = formatInput(spec, decoded ?? example);
    const notice =
      shared !== null && !decoded
        ? "The input in this link couldn't be read, so the boxes show the video's example."
        : null;
    const outcome = attempt(list);
    return { list, notice, ...outcome };
  });
  const [texts, setTexts] = useState(initial.list);
  const [errors, setErrors] = useState<InputError[]>(initial.errors);
  const [notice, setNotice] = useState<string | null>(initial.notice);
  const [walkthrough, setWalkthrough] = useState<Built | null>(
    initial.built ? { ...initial.built, run: 0 } : null,
  );
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);

  // The address bar always holds the input on screen, so the page's URL is its share link.
  useEffect(() => {
    if (!walkthrough) return;
    const url = new URL(window.location.href);
    url.searchParams.set(INPUT_PARAM, encodeInput(walkthrough.args));
    window.history.replaceState(window.history.state, "", url);
  }, [walkthrough]);

  const show = (list: readonly string[]) => {
    startTransition(() => {
      setCopied(false);
      const outcome = attempt(list);
      setErrors(outcome.errors);
      if (!outcome.built) {
        requestAnimationFrame(() => errorRef.current?.focus());
        return;
      }
      const built = outcome.built;
      setWalkthrough((w) => ({ ...built, run: (w?.run ?? 0) + 1 }));
    });
  };

  const setText = (i: number, value: string) => setTexts((list) => list.map((t, k) => (k === i ? value : t)));
  const reset = () => {
    const next = formatInput(spec, example);
    setTexts(next);
    setNotice(null);
    show(next);
  };
  const random = () => {
    const next = formatInput(spec, randomInput(spec, Math.random));
    setTexts(next);
    setNotice(null);
    show(next);
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setNotice("Couldn't copy automatically: copy the address from the address bar instead.");
    }
  };

  const fieldErrors = new Map(errors.flatMap((e) => (e.field === undefined ? [] : [[e.field, e.message]])));
  const formErrors = errors.filter((e) => e.field === undefined);

  return (
    <div className="space-y-4">
      <form
        id={formId}
        aria-label="Your input"
        className="space-y-4 rounded-xl border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          show(texts);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {spec.fields.map((field, i) => {
            const id = `${formId}-${i}`;
            const error = fieldErrors.get(i);
            return (
              <div
                key={field.name}
                className={spec.fields.length === 1 ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}
              >
                <label htmlFor={id} className="font-mono text-xs font-medium">
                  {field.name}
                </label>
                <Input
                  id={id}
                  value={texts[i] ?? ""}
                  onChange={(e) => setText(i, e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={`${id}-hint`}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="font-mono"
                />
                <p
                  id={`${id}-hint`}
                  className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
                >
                  {error ?? fieldHint(field)}
                </p>
              </div>
            );
          })}
        </div>

        {spec.requirements && spec.requirements.length > 0 && (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {spec.requirements.map((r) => (
              <li key={r} className="flex gap-2">
                <span aria-hidden>-</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}

        <div ref={errorRef} tabIndex={-1} aria-live="polite" className="outline-none">
          {formErrors.map((e) => (
            <p
              key={e.message}
              className="rounded-md border border-dashed border-destructive/50 px-3 py-2 text-sm"
            >
              <span aria-hidden className="mr-1.5 text-destructive">
                ✕
              </span>
              {e.message}
            </p>
          ))}
          {notice && (
            <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              {notice}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            <Play aria-hidden /> Show walkthrough
          </Button>
          <Button type="button" variant="outline" onClick={reset} disabled={pending}>
            <RotateCcw aria-hidden /> Reset to example
          </Button>
          <Button type="button" variant="outline" onClick={random} disabled={pending}>
            <Shuffle aria-hidden /> Random
          </Button>
          <Button type="button" variant="ghost" onClick={onBack}>
            <ArrowLeft aria-hidden /> Back to the video
          </Button>
        </div>
      </form>

      {walkthrough && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 font-mono text-xs">
              <span className="mr-2 rounded-md border border-primary/60 px-1.5 py-0.5 text-primary">
                Your input
              </span>
              <span className="break-all text-muted-foreground">{walkthrough.summary}</span>
            </p>
            <Button size="sm" variant="outline" onClick={() => void copyLink()} aria-live="polite">
              {copied ? <Check aria-hidden /> : <Link2 aria-hidden />}
              {copied ? "Link copied" : "Copy link"}
            </Button>
          </div>
          {/* A new run is a new player (fresh clock and narration). */}
          <LearnView key={walkthrough.run} {...walkthroughViewProps(walkthrough.storyboard)} />
          <p className="text-xs text-muted-foreground">
            Built in your browser from the same algorithm as the video, with plain captions from each step.
            Browser voice only. Your input doesn&apos;t change your progress.
          </p>
        </div>
      )}
    </div>
  );
}
