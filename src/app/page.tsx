import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ContinueCard } from "@/components/account/continue-card";
import { ReviewTodayCard } from "@/components/review/review-today-card";
import {
  getAllProblems,
  getCategories,
  getPatterns,
  getProgressIndex,
  hasVideo,
} from "@/lib/catalog/repository";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "algovizlib: CS concepts as short videos",
  description:
    "Short animated videos that explain the approach behind algorithm problems through real-world examples: 20 patterns, 103 problems, hints, and quick checks.",
  path: "/",
  absoluteTitle: true,
});

const PRINCIPLES = [
  {
    label: "approach-first",
    body: "Build intuition for why an approach works, not a line-by-line code walkthrough.",
  },
  {
    label: "real-examples",
    body: "Problems that are already real-world stories keep their scenario. Abstract ones get one clear analogy.",
  },
  {
    label: "verified",
    body: "Every animated step and every example is checked against a reference implementation.",
  },
];

export default function Home() {
  const categories = getCategories();
  const patterns = getPatterns("dsa");
  const problems = getAllProblems();
  const videos = problems.filter(hasVideo).length;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="py-16 sm:py-24" aria-labelledby="hero-heading">
        <p className="font-mono text-xs text-muted-foreground">
          <span className="text-primary">$</span> algovizlib --learn approach
        </p>
        <h1
          id="hero-heading"
          className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl"
        >
          Learn the pattern behind the problem.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
          Short animated explanations and a curated problem set, organized by the handful of patterns that
          solve most algorithm questions.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/dsa/two-pointers" prefetch={true}>
              Start with Two Pointers
              <ArrowRight aria-hidden data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="/dsa">Browse all patterns</Link>
          </Button>
        </div>
        <p className="mt-6 font-mono text-xs text-muted-foreground">
          {patterns.length} patterns · {problems.length} problems · {videos}{" "}
          {videos === 1 ? "video" : "videos"}
        </p>
        <ContinueCard problems={getProgressIndex().problems} />
        <ReviewTodayCard problems={getProgressIndex().problems} className="mt-8 max-w-xl" />
      </section>

      <section className="pb-16" aria-labelledby="categories-heading">
        <h2 id="categories-heading" className="mb-4 font-mono text-xs text-muted-foreground">
          categories
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {categories.map((c) => {
            const available = c.status === "available";
            return (
              <li key={c.slug} className="glow-box group relative rounded-xl border p-6 hover:bg-muted/30">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold">
                    <Link href={`/${c.slug}`} className="after:absolute after:inset-0 after:rounded-xl">
                      {c.name}
                    </Link>
                  </h3>
                  <span className="rounded-md border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {available ? `${patterns.length} patterns` : "coming soon"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
                <p className="mt-6 font-mono text-xs text-muted-foreground group-hover:text-foreground">
                  /{c.slug} <span aria-hidden>→</span>
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="border-t py-12" aria-labelledby="principles-heading">
        <h2 id="principles-heading" className="sr-only">
          How it works
        </h2>
        <ul className="grid gap-8 sm:grid-cols-3">
          {PRINCIPLES.map(({ label, body }) => (
            <li key={label}>
              <p className="font-mono text-xs text-primary">{`// ${label}`}</p>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
