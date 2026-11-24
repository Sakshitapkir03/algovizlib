"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ProgressIndex } from "@/lib/catalog/repository";
import { RESUME_HASH } from "@/lib/progress/summary";
import type { ReviewItem, ReviewKind } from "@/lib/review/rules";
import { applyReview } from "@/lib/review/use-review";

/** Each reason pairs a glyph with its words (never color alone). */
const GLYPH: Record<ReviewKind, string> = {
  "missed-checks": "✕",
  "review-due": "↻",
  "stopped-video": "▶",
  "stale-learning": "◐",
};

/**
 * Review items with their reason, a link to the problem (or straight to the saved video point), and "Reviewed" /
 * "Snooze 3 days". A polite live region says what happened, or that it couldn't be saved.
 */
export function ReviewList({
  items,
  problems,
  label,
}: {
  items: readonly ReviewItem[];
  problems: ProgressIndex["problems"];
  label: string;
}) {
  const [message, setMessage] = useState("");

  const act = async (item: ReviewItem, op: "reviewed" | "snooze") => {
    const title = problems[item.key].title;
    const ok = await applyReview(
      op === "reviewed" ? { op, key: item.key, grade: item.grade } : { op, key: item.key },
    );
    setMessage(
      !ok
        ? "Couldn't save that right now. Try again later."
        : op === "reviewed"
          ? `${title} marked reviewed.`
          : `${title} snoozed for 3 days.`,
    );
  };

  return (
    <>
      <ul aria-label={label} className="divide-y rounded-lg border">
        {items.map((item) => {
          const p = problems[item.key];
          const href = item.kind === "stopped-video" ? `${p.href}${RESUME_HASH}` : p.href;
          return (
            <li key={item.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <Link
                href={href}
                className="glow-box -mx-2 -my-1 min-w-0 flex-1 basis-56 rounded-md px-2 py-1 hover:bg-muted/40"
              >
                <span className="block truncate text-sm font-medium">{p.title}</span>
                <span className="block font-mono text-[11px] text-muted-foreground">
                  <span aria-hidden className="mr-1.5">
                    {GLYPH[item.kind]}
                  </span>
                  {item.reason}
                  <span className="max-[420px]:sr-only"> · {p.patternName}</span>
                </span>
              </Link>
              <span className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Mark ${p.title} reviewed`}
                  onClick={() => void act(item, "reviewed")}
                >
                  Reviewed
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Snooze ${p.title} for 3 days`}
                  onClick={() => void act(item, "snooze")}
                >
                  Snooze 3 days
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
      <p
        role="status"
        aria-live="polite"
        className="mt-2 min-h-4 font-mono text-[11px] text-muted-foreground"
      >
        {message}
      </p>
    </>
  );
}
