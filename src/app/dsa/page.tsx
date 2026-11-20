import type { Metadata } from "next";
import Link from "next/link";

import { InlineText } from "@/components/catalog/rich-text";
import { PathBreadcrumb } from "@/components/catalog/path-breadcrumb";
import { PatternProgress } from "@/components/catalog/progress-status";
import { DIFFICULTIES } from "@/lib/catalog";
import {
  getCategory,
  getPatternsByGroup,
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
  const sections = getPatternsByGroup("dsa");
  // Patterns are numbered 01–20 across the whole page, in section order.
  const numberOf = new Map(sections.flatMap((s) => s.patterns).map((p, i) => [p.slug, i + 1]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PathBreadcrumb segments={[{ label: "dsa", href: "/dsa" }]} />
      <header className="mt-4 mb-6 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">{category?.name}</h1>
        <p className="mt-2 text-muted-foreground">{category?.description}</p>
      </header>

      <nav aria-label="Pattern groups" className="mb-10 flex flex-wrap gap-2 font-mono text-xs">
        {sections.map(({ group, patterns }) => (
          <a
            key={group.slug}
            href={`#${group.slug}`}
            className="rounded-md border px-2.5 py-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            {group.name} <span aria-hidden>·</span> {patterns.length}
          </a>
        ))}
      </nav>

      <div className="space-y-14">
        {sections.map(({ group, patterns }) => {
          const groupProblems = patterns.flatMap((pattern) =>
            getProblems(pattern.slug).map(({ patternSlug, slug }) => ({ patternSlug, slug })),
          );
          return (
            <section
              key={group.slug}
              id={group.slug}
              aria-labelledby={`${group.slug}-heading`}
              className="scroll-mt-20"
            >
              <div className="mb-5 grid gap-4 md:grid-cols-[1fr_16rem] md:items-end">
                <div>
                  <h2 id={`${group.slug}-heading`} className="text-xl font-semibold tracking-tight">
                    {group.name}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{group.summary}</p>
                </div>
                <PatternProgress problems={groupProblems} label={`${group.name} problems done`} />
              </div>

              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {patterns.map((pattern) => {
                  const stats = getPatternStats(pattern.slug);
                  const problems = getProblems(pattern.slug).map(({ patternSlug, slug }) => ({
                    patternSlug,
                    slug,
                  }));
                  return (
                    <li
                      key={pattern.slug}
                      className="glow-box group relative flex flex-col rounded-xl border p-5 hover:bg-muted/30"
                    >
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {String(numberOf.get(pattern.slug)).padStart(2, "0")}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold">
                        <Link
                          href={patternHref(pattern)}
                          prefetch={true}
                          className="after:absolute after:inset-0 after:rounded-xl"
                        >
                          {pattern.name}
                        </Link>
                      </h3>
                      <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
                        <InlineText text={pattern.summary} />
                      </p>
                      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
                        <span>{stats.total} problems</span>
                        {stats.related > 0 && <span>+{stats.related} related</span>}
                        <span aria-hidden>·</span>
                        {DIFFICULTIES.map((d) => (
                          <span key={d}>
                            <span aria-hidden>{DIFFICULTY_SHORT[d]} </span>
                            <span className="sr-only">{d}: </span>
                            <span className="text-foreground">{stats.byDifficulty[d]}</span>
                          </span>
                        ))}
                      </p>
                      <PatternProgress
                        problems={problems}
                        label={`${pattern.name} problems done`}
                        className="mt-4"
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
