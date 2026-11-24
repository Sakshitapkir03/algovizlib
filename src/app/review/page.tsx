import type { Metadata } from "next";

import { ReviewQueue } from "@/components/review/review-queue";
import { getProgressIndex } from "@/lib/catalog/repository";

export const metadata: Metadata = { title: "Review", robots: { index: false } };

/** Static shell; the queue is computed in the browser (this browser's data, or the account's). */
export default function ReviewPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="font-mono text-xs text-muted-foreground">
        <span className="text-primary">$</span> algovizlib --review
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Review</h1>
      <ReviewQueue problems={getProgressIndex().problems} />
    </div>
  );
}
