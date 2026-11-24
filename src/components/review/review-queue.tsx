"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import type { ProgressIndex } from "@/lib/catalog/repository";
import {
  QUEUE_LIMIT,
  REVIEW_INTERVAL_DAYS,
  SNOOZE_DAYS,
  STALE_LEARNING_DAYS,
  STOPPED_VIDEO_DAYS,
} from "@/lib/review/rules";
import { useReviewQueue, type ReviewMode } from "@/lib/review/use-review";

import { ReviewList } from "./review-list";

const WHERE: Record<ReviewMode, string> = {
  browser: "Built from the progress and quick check answers in this browser.",
  account: "Built from your account's progress and quick check answers.",
  unavailable:
    "Built from your account's progress and quick check answers. Reviews can't be saved right now; try again later.",
};

const noop = () => () => {};

/** /review: the whole queue (top 7), its reasons, and how it's ordered. */
export function ReviewQueue({ problems }: { problems: ProgressIndex["problems"] }) {
  const { items, mode } = useReviewQueue((key) => key in problems);
  // The server can't know what's due; render the empty state only once the browser has looked.
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const days = REVIEW_INTERVAL_DAYS.join(", ");

  return (
    <>
      <p className="mt-2 text-sm text-muted-foreground">{WHERE[mode]}</p>
      <section aria-labelledby="queue-heading" className="mt-8">
        <h2 id="queue-heading" className="mb-3 font-mono text-xs text-muted-foreground">
          due now{hydrated && items.length > 0 ? ` · ${items.length}` : ""}
        </h2>
        {!hydrated ? null : items.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">
            Nothing to review right now.{" "}
            <Link href="/dsa" className="text-primary underline underline-offset-4">
              Pick a pattern
            </Link>{" "}
            to keep going.
          </p>
        ) : (
          <ReviewList items={items} problems={problems} label="Review queue" />
        )}
      </section>

      <section aria-labelledby="order-heading" className="mt-10 max-w-2xl">
        <h2 id="order-heading" className="mb-3 font-mono text-xs text-muted-foreground">
          how this is ordered
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground">Missed quick checks:</span> your latest answer to a question on
            the video since you last reviewed it was wrong.
          </li>
          <li>
            <span className="text-foreground">Review due:</span> problems marked Done come back after {days}{" "}
            days. Answering every quick check right, or marking it reviewed with no misses, moves it to the
            next interval; a miss starts it over at {REVIEW_INTERVAL_DAYS[0]} days.
          </li>
          <li>
            <span className="text-foreground">Stopped video:</span> a video you left partway at least{" "}
            {STOPPED_VIDEO_DAYS} day ago; the link resumes where you stopped.
          </li>
          <li>
            <span className="text-foreground">Learning, inactive:</span> marked Learning with nothing done on
            it for {STALE_LEARNING_DAYS} days.
          </li>
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">
          A problem appears once, under the first reason that applies. Within a reason, the one that has
          waited longest comes first. The queue shows the top {QUEUE_LIMIT}. Snoozing hides a problem for{" "}
          {SNOOZE_DAYS} days. Walkthroughs of your own input don&apos;t count.
        </p>
      </section>
    </>
  );
}
