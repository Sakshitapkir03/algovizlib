import type { Metadata } from "next";
import Link from "next/link";

import { InlineText } from "@/components/catalog/rich-text";
import { PathBreadcrumb } from "@/components/catalog/path-breadcrumb";
import { PatternProgress } from "@/components/catalog/progress-status";
import { DIFFICULTIES } from "@/lib/catalog";
import {
  getCategory,
  getPatterns,
  getPatternStats,
  getProblems,
  patternHref,
} from "@/lib/catalog/repository";

export const metadata: Metadata = {
  title: "Data Structures & Algorithms",
  description: "Algorithm patterns, each with a short explanation and a curated set of problems.",
};

const DIFFICULTY_SHORT = { easy: "E", medium: "M", hard: "H" } as const;

export default function DsaPage() {
  const category = getCategory("dsa");
  const patterns = getPatterns("dsa");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PathBreadcrumb segments={[{ label: "dsa", href: "/dsa" }]} />
      <header className="mt-4 mb-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">{category?.name}</h1>
        <p className="mt-2 text-muted-foreground">{category?.description}</p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {patterns.map((pattern, i) => {
          const stats = getPatternStats(pattern.slug);
          const problems = getProblems(pattern.slug).map(({ patternSlug, slug }) => ({ patternSlug, slug }));
          return (
            <li
              key={pattern.slug}
              className="group relative flex flex-col rounded-xl border p-5 hover:bg-muted/30"
            >
              <p className="font-mono text-[11px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</p>
              <h2 className="mt-1 text-lg font-semibold">
                <Link
                  href={patternHref(pattern)}
                  prefetch={true}
                  className="after:absolute after:inset-0 after:rounded-xl"
                >
                  {pattern.name}
                </Link>
              </h2>
              <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
                <InlineText text={pattern.summary} />
              </p>
              <p className="mt-4 flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                <span>{stats.total} problems</span>
                <span aria-hidden>·</span>
                {DIFFICULTIES.map((d) => (
                  <span key={d}>
                    <span aria-hidden>{DIFFICULTY_SHORT[d]} </span>
                    <span className="sr-only">{d}: </span>
                    <span className="text-foreground">{stats.byDifficulty[d]}</span>
                  </span>
                ))}
              </p>
              <PatternProgress problems={problems} className="mt-4" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
