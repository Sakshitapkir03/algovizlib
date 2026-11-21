"use client";

import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import type { ProgressIndex } from "@/lib/catalog/repository";
import { formatSeconds } from "@/lib/progress";
import { continueList, RESUME_HASH } from "@/lib/progress/summary";
import { useProgressRecords } from "@/lib/progress/use-progress";

/** Landing page, signed-in users with something in progress: one card straight back to it. */
export function ContinueCard({ problems }: { problems: ProgressIndex["problems"] }) {
  const { status } = useSession();
  const records = useProgressRecords();
  if (status !== "authenticated") return null;
  const [item] = continueList(records, (key) => key in problems, 1);
  if (!item) return null;
  const p = problems[item.key];
  const resume = item.seconds !== undefined;
  return (
    <section aria-labelledby="continue-card-heading" className="mt-8 max-w-xl">
      <h2 id="continue-card-heading" className="mb-2 font-mono text-xs text-muted-foreground">
        continue
      </h2>
      <Link
        href={resume ? `${p.href}${RESUME_HASH}` : p.href}
        className="glow-box flex items-center gap-4 rounded-xl border px-5 py-4 hover:bg-muted/30"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{p.title}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{p.patternName}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs text-primary">
          {resume ? (
            <>
              <Play aria-hidden className="size-3" /> Resume from {formatSeconds(item.seconds!)}
            </>
          ) : (
            <>
              Keep going <ArrowRight aria-hidden className="size-3" />
            </>
          )}
        </span>
      </Link>
      <Link
        href="/me"
        className="mt-2 inline-block font-mono text-[11px] text-muted-foreground hover:text-foreground"
      >
        all progress →
      </Link>
    </section>
  );
}
