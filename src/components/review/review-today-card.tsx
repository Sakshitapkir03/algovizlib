"use client";

import Link from "next/link";

import type { ProgressIndex } from "@/lib/catalog/repository";
import { useReviewQueue } from "@/lib/review/use-review";

import { ReviewList } from "./review-list";

const SHOWN = 3;

/** Landing page and /me: "Review today", the top of the queue, only when something is due. */
export function ReviewTodayCard({
  problems,
  className,
}: {
  problems: ProgressIndex["problems"];
  className?: string;
}) {
  const { items } = useReviewQueue((key) => key in problems);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="review-today-heading" className={className}>
      <h2 id="review-today-heading" className="mb-2 font-mono text-xs text-muted-foreground">
        review today
      </h2>
      <ReviewList items={items.slice(0, SHOWN)} problems={problems} label="Due for review" />
      <Link
        href="/review"
        className="inline-block font-mono text-[11px] text-muted-foreground hover:text-foreground"
      >
        {items.length > SHOWN ? `all ${items.length} in the review queue →` : "review queue →"}
      </Link>
    </section>
  );
}
