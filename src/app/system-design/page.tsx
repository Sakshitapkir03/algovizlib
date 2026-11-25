import type { Metadata } from "next";
import Link from "next/link";

import { PathBreadcrumb } from "@/components/catalog/path-breadcrumb";
import { KindBadge } from "@/components/system-design/kind-badge";
import { LessonStatus } from "@/components/system-design/lesson-status";
import {
  getCategory,
  getLessons,
  getTopicLessons,
  getTopicsByGroup,
  lessonHref,
  lessonKey,
} from "@/lib/catalog/repository";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "System Design",
  description:
    "Production bugs replayed request by request in a deterministic simulation, then fixed and replayed again: retries, caches, replicas, queues.",
  path: "/system-design",
});

export default function SystemDesignPage() {
  const category = getCategory("system-design");
  const sections = getTopicsByGroup();
  const built = getLessons().length;
  const all = sections.flatMap((s) => s.topics.flatMap((t) => getTopicLessons(t.slug))).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PathBreadcrumb segments={[{ label: "system-design", href: "/system-design" }]} />
      <header className="mt-4 mb-6 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">{category?.name}</h1>
        <p className="mt-2 text-muted-foreground">{category?.description}</p>
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          {built} of {all} lessons built · the rest are planned
        </p>
      </header>

      <section aria-labelledby="how-heading" className="mb-10 grid gap-3 sm:grid-cols-3">
        <h2 id="how-heading" className="sr-only">
          How these lessons work
        </h2>
        <div className="rounded-xl border p-4">
          <KindBadge kind="incident" />
          <p className="mt-2 text-sm text-muted-foreground">
            A real class of bug, followed message by message until it happens. Then the fix, replayed under
            the same failures, until it can&apos;t.
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <KindBadge kind="growth" />
          <p className="mt-2 text-sm text-muted-foreground">
            A system that starts as one server and adds a component only after the simulation measures the
            bottleneck that needs it.
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="font-mono text-[11px] text-muted-foreground">
            <span aria-hidden className="text-primary">
              ${" "}
            </span>
            simulated, not drawn
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Every message, time, and stored value on screen comes from a deterministic, seeded simulation, and
            a validator rejects any video that disagrees with it.
          </p>
        </div>
      </section>

      <nav aria-label="Topic groups" className="mb-10 flex flex-wrap gap-2 font-mono text-xs">
        {sections.map(({ group, topics }) => (
          <a
            key={group.slug}
            href={`#${group.slug}`}
            className="rounded-md border px-2.5 py-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            {group.name} <span aria-hidden>·</span> {topics.length}
          </a>
        ))}
      </nav>

      <div className="space-y-14">
        {sections.map(({ group, topics }) => (
          <section
            key={group.slug}
            id={group.slug}
            aria-labelledby={`${group.slug}-heading`}
            className="scroll-mt-20"
          >
            <h2 id={`${group.slug}-heading`} className="text-xl font-semibold tracking-tight">
              {group.name}
            </h2>
            <p className="mt-1 mb-5 max-w-2xl text-sm text-muted-foreground">{group.summary}</p>
            <div className="space-y-6">
              {topics.map((topic) => (
                <div key={topic.slug} id={topic.slug} className="scroll-mt-20">
                  <h3 className="font-mono text-xs text-muted-foreground">
                    {topic.name.toLowerCase()} <span aria-hidden>·</span> {topic.summary}
                  </h3>
                  <ul className="mt-2 divide-y rounded-xl border">
                    {getTopicLessons(topic.slug).map((lesson) =>
                      lesson.status === "available" ? (
                        <li key={lesson.slug} className="glow-box relative px-4 py-3 hover:bg-muted/30">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <Link
                              href={lessonHref(lesson)}
                              prefetch={true}
                              className="font-medium after:absolute after:inset-0"
                            >
                              {lesson.title}
                            </Link>
                            <KindBadge kind={lesson.kind} />
                            <span className="ml-auto font-mono text-[11px]">
                              <LessonStatus lessonKey={lessonKey(lesson)} />
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{lesson.symptom}</p>
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                            {lesson.minutes} min · video, quick checks, your own scenario
                          </p>
                        </li>
                      ) : (
                        <li key={lesson.slug} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-muted-foreground">{lesson.title}</span>
                            <KindBadge kind={lesson.kind} />
                            <span className="ml-auto rounded-md border border-dashed px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                              planned
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{lesson.symptom}</p>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-14 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Algorithms first?{" "}
        <Link href="/dsa" className="text-primary underline underline-offset-4">
          Browse the DSA patterns
        </Link>
        .
      </div>
    </div>
  );
}
