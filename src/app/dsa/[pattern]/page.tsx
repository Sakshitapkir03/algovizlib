import type { Metadata } from "next";
import { Suspense } from "react";

import { ComplexityBlock } from "@/components/catalog/complexity";
import { PageSkeleton } from "@/components/catalog/page-skeleton";
import { PathBreadcrumb } from "@/components/catalog/path-breadcrumb";
import { ProblemTable } from "@/components/catalog/problem-table";
import { PatternProgress } from "@/components/catalog/progress-status";
import { InlineText, RichText } from "@/components/catalog/rich-text";
import {
  getPattern,
  getPatternListing,
  getPatterns,
  getProblems,
  patternHref,
} from "@/lib/catalog/repository";

import { loadPattern } from "../load";

// Catalog pages are fully static. Unknown slugs must 404 rather than stream a fallback shell with a 200, so the whole
// route renders before responding. (dynamicParams isn't allowed with Cache Components.)
export const ensureStatic = "navigation";

export function generateStaticParams() {
  return getPatterns("dsa").map((p) => ({ pattern: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/dsa/[pattern]">): Promise<Metadata> {
  const pattern = getPattern((await params).pattern);
  if (!pattern) return {};
  return { title: pattern.name, description: pattern.summary.replaceAll("`", "") };
}

// The App Shell is shared by every /dsa/<pattern> link and can't depend on params, so everything that reads them
// sits inside Suspense. Links into this route use prefetch={true}, which resolves the boundary before the click.
export default function PatternPage({ params }: PageProps<"/dsa/[pattern]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Suspense fallback={<PageSkeleton label="Loading pattern" />}>
        <PatternContent params={params} />
      </Suspense>
    </div>
  );
}

async function PatternContent({ params }: { params: PageProps<"/dsa/[pattern]">["params"] }) {
  const pattern = loadPattern((await params).pattern);
  const problems = getProblems(pattern.slug);

  return (
    <>
      <PathBreadcrumb
        segments={[
          { label: "dsa", href: "/dsa" },
          { label: pattern.slug, href: patternHref(pattern) },
        ]}
      />
      <header className="mt-4 grid gap-6 md:grid-cols-[1fr_16rem] md:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{pattern.name}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            <InlineText text={pattern.summary} />
          </p>
        </div>
        <PatternProgress problems={problems.map(({ patternSlug, slug }) => ({ patternSlug, slug }))} />
      </header>

      <section aria-label="About this pattern" className="mt-10 grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div>
          <h2 className="mb-3 font-mono text-xs text-muted-foreground">core idea</h2>
          <RichText text={pattern.coreIdea} className="space-y-3 leading-relaxed" />
        </div>
        <div className="space-y-8">
          <div>
            <h2 className="mb-3 font-mono text-xs text-muted-foreground">when to use it</h2>
            <ul className="space-y-2 text-sm">
              {pattern.whenToUse.map((signal) => (
                <li key={signal} className="flex gap-2">
                  <span aria-hidden className="font-mono text-primary">
                    →
                  </span>
                  <span>
                    <InlineText text={signal} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-3 font-mono text-xs text-muted-foreground">typical complexity</h2>
            <ComplexityBlock complexity={pattern.typicalComplexity} />
          </div>
        </div>
      </section>

      <section aria-labelledby="problems-heading" className="mt-14">
        <h2 id="problems-heading" className="mb-4 text-xl font-semibold tracking-tight">
          Problems
        </h2>
        <ProblemTable problems={getPatternListing(pattern.slug)} />
      </section>
    </>
  );
}
