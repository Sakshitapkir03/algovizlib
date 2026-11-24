import { getQuickChecks } from "@/lib/quickcheck/for-problem";
import { readTutorConfig } from "@/lib/tutor/config";
import { ArrowLeft, ArrowRight, ExternalLink, Film } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ApproachToggle } from "@/components/catalog/approach-toggle";
import { ComplexityBlock } from "@/components/catalog/complexity";
import { DifficultyBadge } from "@/components/catalog/difficulty-badge";
import { Examples } from "@/components/catalog/examples";
import { Hints } from "@/components/catalog/hints";
import { PageSkeleton } from "@/components/catalog/page-skeleton";
import { PathBreadcrumb } from "@/components/catalog/path-breadcrumb";
import { ProblemTabs } from "@/components/catalog/problem-tabs";
import { StatusPicker } from "@/components/catalog/progress-status";
import { InlineText, RichText } from "@/components/catalog/rich-text";
import { KeyTakeaway } from "@/components/learn/key-takeaway";
import { VideoSection } from "@/components/learn/video-section";
import type { Problem } from "@/lib/catalog";
import { progressKey } from "@/lib/progress";
import {
  getAdjacentProblems,
  getRelatedPatterns,
  getAllProblems,
  getPattern,
  getProblem,
  getProblemStoryboard,
  hasTryInput,
  hasVideo,
  patternHref,
  problemHref,
} from "@/lib/catalog/repository";

import { pageMetadata } from "@/lib/seo";

import { loadProblem } from "../../load";

// Fully static; unknown slugs 404 instead of streaming a fallback shell. See /dsa/[pattern]/page.tsx.
export const ensureStatic = "navigation";

export function generateStaticParams() {
  return getAllProblems().map((p) => ({ pattern: p.patternSlug, problem: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/dsa/[pattern]/[problem]">): Promise<Metadata> {
  const { pattern, problem: slug } = await params;
  const problem = getProblem(pattern, slug);
  const home = getPattern(pattern);
  if (!problem || !home) return {};
  const what = hasVideo(problem)
    ? "An animated walkthrough of the approach, with hints"
    : "The approach, with hints";
  return pageMetadata({
    title: problem.title,
    description: `${problem.title} (${problem.difficulty}, ${home.name}). ${what} and worked examples.`,
    path: problemHref(problem),
  });
}

export default function ProblemPage({ params }: PageProps<"/dsa/[pattern]/[problem]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Suspense fallback={<PageSkeleton label="Loading problem" />}>
        <ProblemContent params={params} />
      </Suspense>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 font-mono text-xs text-muted-foreground">{title.toLowerCase()}</h2>
      {children}
    </section>
  );
}

async function ProblemContent({ params }: { params: PageProps<"/dsa/[pattern]/[problem]">["params"] }) {
  const { pattern: patternSlug, problem: slug } = await params;
  const { pattern, problem } = loadProblem(patternSlug, slug);
  const storyboard = getProblemStoryboard(problem);
  const { previous, next } = getAdjacentProblems(problem);
  const related = getRelatedPatterns(problem);

  return (
    <>
      <PathBreadcrumb
        segments={[
          { label: "dsa", href: "/dsa" },
          { label: pattern.slug, href: patternHref(pattern) },
          { label: problem.slug, href: problemHref(problem) },
        ]}
      />
      <header className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{problem.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={problem.difficulty} />
            {problem.tags.map((tag) => (
              <span key={tag} className="font-mono text-[11px] text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
          {related.length > 0 && (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              also in{" "}
              {related.map((p, i) => (
                <span key={p.slug}>
                  {i > 0 && ", "}
                  <Link
                    href={patternHref(p)}
                    prefetch={true}
                    className="rounded-sm underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {p.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </div>
        <StatusPicker problem={{ patternSlug: problem.patternSlug, slug: problem.slug }} />
      </header>

      <div className="mt-8">
        <ProblemTabs
          explanation={
            <div className="space-y-10">
              <Section title="Problem">
                <RichText text={problem.statement} className="space-y-3 leading-relaxed" />
              </Section>
              <Section title="Examples">
                <Examples examples={problem.examples} format={problem.exampleFormat} />
              </Section>
              <Section title="Constraints">
                <ul className="space-y-1 font-mono text-[13px]">
                  {problem.constraints.map((c) => (
                    <li key={c} className="flex gap-2">
                      <span aria-hidden className="text-muted-foreground">
                        -
                      </span>
                      <span>
                        <InlineText text={c} />
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="Video">
                {storyboard ? (
                  <div className="space-y-3">
                    <VideoSection
                      storyboard={storyboard}
                      problemKey={progressKey(problem)}
                      askEnabled={readTutorConfig().enabled}
                      quickChecks={getQuickChecks(problem)}
                      tryInput={
                        hasTryInput(problem)
                          ? {
                              problem: {
                                patternSlug: problem.patternSlug,
                                slug: problem.slug,
                                title: problem.title,
                                tags: problem.tags,
                                keyIdea: problem.keyIdea,
                                complexity: problem.complexity,
                              },
                              patternName: pattern.name,
                            }
                          : undefined
                      }
                    />
                    <p className="font-mono text-[11px] text-muted-foreground">
                      space play/pause · ←/→ seek 5s · shift+←/→ change scene · f fullscreen
                    </p>
                  </div>
                ) : (
                  <VideoComingSoon />
                )}
              </Section>
              <Section title="Hints">
                <Hints hints={problem.hints} problemKey={progressKey(problem)} />
              </Section>
              <Section title="Approach">
                <ApproachToggle problemKey={progressKey(problem)}>
                  <RichText text={problem.keyIdea} className="space-y-3 leading-relaxed" />
                  <ComplexityBlock complexity={problem.complexity} />
                  {storyboard && <KeyTakeaway takeaway={storyboard.takeaway} analogy={storyboard.analogy} />}
                </ApproachToggle>
              </Section>
              {problem.externalRefs.length > 0 && (
                <Section title="Practice elsewhere">
                  <ul className="flex flex-wrap gap-3 text-sm">
                    {problem.externalRefs.map((ref) => (
                      <li key={ref.url} className="inline-flex items-center gap-2">
                        <a
                          href={ref.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-sm font-mono text-xs underline-offset-4 hover:underline"
                        >
                          {ref.label}
                          <ExternalLink aria-hidden className="size-3" />
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                        {ref.premium && (
                          <span
                            className="rounded-sm border px-1.5 py-px font-mono text-[11px] leading-4 text-muted-foreground"
                            title="Needs a LeetCode Premium subscription"
                          >
                            Premium
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          }
        />
      </div>

      <ProblemPager previous={previous} next={next} />
    </>
  );
}

function VideoComingSoon() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-dashed px-5 py-6">
      <Film aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">Video explanation coming soon</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Until then, the hints and the approach below walk through the idea step by step.
        </p>
      </div>
    </div>
  );
}

function ProblemPager({ previous, next }: { previous?: Problem; next?: Problem }) {
  return (
    <nav aria-label="Problems in this pattern" className="mt-14 grid gap-3 border-t pt-6 sm:grid-cols-2">
      {previous ? (
        <Link
          href={problemHref(previous)}
          prefetch={true}
          className="glow-box group rounded-lg border px-4 py-3 hover:bg-muted/40"
        >
          <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <ArrowLeft aria-hidden className="size-3" /> previous
          </span>
          <span className="mt-1 block text-sm font-medium">{previous.title}</span>
        </Link>
      ) : (
        <span aria-hidden className="hidden sm:block" />
      )}
      {next && (
        <Link
          href={problemHref(next)}
          prefetch={true}
          className="glow-box group rounded-lg border px-4 py-3 text-right hover:bg-muted/40"
        >
          <span className="flex items-center justify-end gap-1 font-mono text-[11px] text-muted-foreground">
            next <ArrowRight aria-hidden className="size-3" />
          </span>
          <span className="mt-1 block text-sm font-medium">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}
