"use client";

import { ArrowRight, Check, CircleHelp, SkipForward, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { InlineText } from "@/components/catalog/rich-text";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { checkKey } from "@/lib/quickcheck/schedule";

import type { ActiveCheck } from "./use-quick-checks";

/**
 * The open quick check, under the player: the question, its options (1–4, arrows + Enter), and Skip (S or Esc). After
 * an answer: right or not, the answer, the step's note, and Continue. It scrolls into view when it opens (a phone's
 * player fills the screen), and focus moves to the first option, then to Continue.
 */
export function QuickCheckCard({
  active,
  onAnswer,
  onSkip,
  onContinue,
}: {
  active: ActiveCheck;
  onAnswer: (choice: number) => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const { check, chosen } = active;
  const answered = chosen !== undefined;
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const next = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    root.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
    options.current[0]?.focus({ preventScroll: true });
    // A new question opens fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check.id]);
  useEffect(() => {
    if (answered) next.current?.focus({ preventScroll: true });
  }, [answered]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (answered) {
      if (e.key === "Escape") {
        e.preventDefault();
        onContinue();
      }
      return;
    }
    const action = checkKey(e.key, check.options.length);
    if (action === undefined) return;
    // Enter and Space on a focused option are its own click.
    if (action === "submit") return;
    e.preventDefault();
    if (action === "skip") onSkip();
    else if ("choose" in action) onAnswer(action.choose);
    else {
      const at = options.current.findIndex((b) => b === document.activeElement);
      const to = (Math.max(0, at) + action.move + check.options.length) % check.options.length;
      options.current[to]?.focus();
    }
  };

  const right = answered && chosen === check.answer;
  return (
    <section
      ref={root}
      aria-labelledby={`${id}-prompt`}
      onKeyDown={onKeyDown}
      className="scroll-mt-20 scroll-mb-4 space-y-3 border-t bg-card p-3 sm:p-4"
    >
      <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
        <CircleHelp aria-hidden className="size-3.5" /> quick check
      </p>
      <h3 id={`${id}-prompt`} className="text-base font-semibold">
        <InlineText text={check.prompt} />
      </h3>
      <div role="group" aria-labelledby={`${id}-prompt`} className="grid gap-2 sm:grid-cols-2">
        {check.options.map((option, k) => {
          const isAnswer = answered && k === check.answer;
          const isWrongPick = answered && k === chosen && !isAnswer;
          return (
            <Button
              key={option}
              ref={(el) => {
                options.current[k] = el;
              }}
              variant="outline"
              disabled={answered}
              onClick={() => onAnswer(k)}
              aria-keyshortcuts={String(k + 1)}
              aria-describedby={isAnswer || isWrongPick ? `${id}-result` : undefined}
              data-state={isAnswer ? "answer" : isWrongPick ? "wrong" : undefined}
              className="h-auto min-h-9 justify-start gap-2 py-1.5 text-left whitespace-normal disabled:opacity-100 data-[state=answer]:border-2 data-[state=answer]:border-green-600 data-[state=wrong]:border-dashed data-[state=wrong]:border-destructive dark:data-[state=answer]:border-green-400"
            >
              <span aria-hidden className="font-mono text-xs text-muted-foreground">
                {k + 1}
              </span>
              <span className="min-w-0 flex-1">{option}</span>
              {isAnswer && <Check aria-label="the answer" className="text-green-600 dark:text-green-400" />}
              {isWrongPick && <X aria-label="your pick" className="text-destructive" />}
            </Button>
          );
        })}
      </div>
      <div id={`${id}-result`} aria-live="polite" className="space-y-2">
        {answered && (
          <>
            <p className="text-sm font-semibold">
              {right ? "✓ Right." : `✕ Not quite: it's ${check.options[check.answer]}.`}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              <InlineText text={check.explanation} />
            </p>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {answered ? (
          <Button ref={next} onClick={onContinue}>
            Continue <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onSkip} aria-keyshortcuts="S">
            <SkipForward aria-hidden /> Skip
          </Button>
        )}
        <span className="font-mono text-[11px] text-muted-foreground">
          {answered ? "enter continue" : `1–${check.options.length} answer · s skip`}
        </span>
      </div>
    </section>
  );
}

/** "Quick checks: 2 of 3 correct", once the video ends. */
export function QuickCheckSummary({ correct, answered }: { correct: number; answered: number }) {
  return (
    <p className="border-t px-3 py-2 text-sm" role="status">
      <span className="font-mono text-xs text-muted-foreground">quick checks</span>{" "}
      <span className="font-semibold">
        {correct} of {answered} correct
      </span>
    </p>
  );
}
