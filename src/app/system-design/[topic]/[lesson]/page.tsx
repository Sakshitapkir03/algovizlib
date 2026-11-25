import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ApproachToggle } from "@/components/catalog/approach-toggle";
import { PageSkeleton } from "@/components/catalog/page-skeleton";
import { PathBreadcrumb } from "@/components/catalog/path-breadcrumb";
import { StatusPicker } from "@/components/catalog/progress-status";
import { RichText } from "@/components/catalog/rich-text";
import { KindBadge } from "@/components/system-design/kind-badge";
import { LessonVideo } from "@/components/system-design/lesson-video";
import {
  getLesson,
  getLessons,
  getLessonStoryboard,
  getPattern,
  getTopic,
  lessonHref,
  lessonKey,
  patternHref,
} from "@/lib/catalog/repository";
import { getLessonQuickChecks } from "@/lib/quickcheck/for-problem";
import { pageMetadata } from "@/lib/seo";
import { runTrace } from "@/lib/traces";
import { readTutorConfig } from "@/lib/tutor/config";

import { loadLesson } from "../../load";

// Fully static; unknown slugs 404 instead of streaming a fallback shell. See /dsa/[pattern]/page.tsx.
export const ensureStatic = "navigation";

export function generateStaticParams() {
  return getLessons().map((l) => ({ topic: l.topicSlug, lesson: l.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/system-design/[topic]/[lesson]">): Promise<Metadata> {
  const { topic, lesson: slug } = await params;
  const lesson = getLesson(topic, slug);
  if (!lesson) return {};
  return pageMetadata({
    title: lesson.title,
    description: `${lesson.symptom} An incident replayed message by message in a deterministic simulation, then fixed and replayed again.`,
    path: lessonHref(lesson),
  });
}

export default function LessonPage({ params }: PageProps<"/system-design/[topic]/[lesson]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Suspense fallback={<PageSkeleton label="Loading lesson" />}>
        <LessonContent params={params} />
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

async function LessonContent({ params }: { params: PageProps<"/system-design/[topic]/[lesson]">["params"] }) {
  const { topic: topicSlug, lesson: slug } = await params;
  const { topic, lesson } = loadLesson(topicSlug, slug);
  const storyboard = getLessonStoryboard(lesson);
  const key = lessonKey(lesson);
  const trace = storyboard?.trace ? runTrace(storyboard.trace.problem, storyboard.trace.args) : undefined;
  const proof = trace?.steps.at(-1)?.sim?.proof;
  const related = lesson.relatedPatterns.map((s) => getPattern(s)).filter((p) => p !== undefined);

  return (
    <>
      <PathBreadcrumb
        segments={[
          { label: "system-design", href: "/system-design" },
          { label: topic.slug, href: `/system-design#${topic.slug}` },
          { label: lesson.slug, href: lessonHref(lesson) },
        ]}
      />
      <header className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{lesson.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <KindBadge kind={lesson.kind} />
            <span className="font-mono text-[11px] text-muted-foreground">
              {getTopic(lesson.topicSlug)?.name} · {lesson.minutes} min
            </span>
          </div>
        </div>
        <StatusPicker problem={{ patternSlug: lesson.topicSlug, slug: lesson.slug }} />
      </header>

      <div className="mt-8 space-y-10">
        <Section title="The report">
          <RichText text={lesson.report} className="space-y-3 leading-relaxed" />
        </Section>

        <Section title="Replay">
          {storyboard ? (
            <div className="space-y-3">
              <LessonVideo
                storyboard={storyboard}
                lessonKey={key}
                askEnabled={readTutorConfig().enabled}
                quickChecks={getLessonQuickChecks(lesson)}
              />
              <p className="font-mono text-[11px] text-muted-foreground">
                space play/pause · ←/→ seek 5s · shift+←/→ change scene · f fullscreen
              </p>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed px-5 py-6 text-sm text-muted-foreground">
              The replay for this lesson is coming soon.
            </p>
          )}
        </Section>

        <Section title="What went wrong">
          <ApproachToggle problemKey={key} label="what went wrong and the fix">
            <RichText text={lesson.whatWentWrong} className="space-y-3 leading-relaxed" />
            <h3 className="pt-2 font-mono text-xs text-muted-foreground">the fix</h3>
            <RichText text={lesson.fix} className="space-y-3 leading-relaxed" />
          </ApproachToggle>
        </Section>

        <Section title="What the simulation checked">
          <div className="space-y-3 rounded-xl border p-4 text-sm">
            <ul className="space-y-1">
              {lesson.rules.map((rule) => (
                <li key={rule} className="flex gap-2">
                  <span aria-hidden className="text-muted-foreground">
                    -
                  </span>
                  {rule}
                </li>
              ))}
            </ul>
            {proof ? (
              <p className="font-mono text-xs">
                With the fix: {proof.runs} runs ({proof.singles} with one lost message, {proof.pairs} with
                two) ·{" "}
                <span className={proof.doubleCharges === 0 ? "text-foreground" : ""}>
                  {proof.doubleCharges === 0 ? "✓" : "✕"} {proof.doubleCharges} double charges
                </span>
              </p>
            ) : null}
            <RichText text={lesson.proofScope} className="space-y-3 leading-relaxed text-muted-foreground" />
          </div>
        </Section>

        <Section title="Takeaways">
          <ul className="space-y-2 text-sm">
            {lesson.takeaways.map((t) => (
              <li key={t} className="flex gap-2">
                <span aria-hidden className="text-primary">
                  ▸
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Section>

        {related.length > 0 && (
          <Section title="Related DSA patterns">
            <ul className="flex flex-wrap gap-2">
              {related.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={patternHref(p)}
                    prefetch={true}
                    className="rounded-md border px-2.5 py-1 font-mono text-xs hover:bg-muted/50"
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <nav aria-label="System design" className="mt-14 border-t pt-6">
        <Link
          href="/system-design"
          className="glow-box inline-block rounded-lg border px-4 py-3 text-sm hover:bg-muted/40"
        >
          <span className="block font-mono text-[11px] text-muted-foreground">back to</span>
          All system design lessons
        </Link>
      </nav>
    </>
  );
}
