import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ExampleSourceBadge } from "@/components/learn/example-source-badge";
import { LearnView } from "@/components/learn/learn-view";
import { getStoryboard, storyboards } from "@/content/storyboards";

// Storyboards are static, so render the whole route before responding. Without this, Partial Prefetching serves
// the fallback shell with a 200 for unknown ids before notFound() runs. (dynamicParams isn't allowed with Cache
// Components.)
export const ensureStatic = "navigation";

export function generateStaticParams() {
  return storyboards.map((sb) => ({ id: sb.id }));
}

export async function generateMetadata({ params }: PageProps<"/learn/[id]">): Promise<Metadata> {
  const { id } = await params;
  const storyboard = getStoryboard(id);
  if (!storyboard) return {};
  return { title: storyboard.concept, description: storyboard.summary };
}

// The App Shell is shared by every /learn/<id> link, so it can't include anything that depends on `params`. The
// layout chrome renders in the shell; the storyboard renders inside Suspense. Problem cards use
// <Link prefetch={true}>, which resolves the boundary before the click.
export default function LearnPage({ params }: PageProps<"/learn/[id]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Suspense fallback={<LessonSkeleton />}>
        <Lesson params={params} />
      </Suspense>
      <p className="mt-6 text-xs text-muted-foreground">
        Keyboard: <kbd className="font-mono">Space</kbd> play/pause · <kbd className="font-mono">←</kbd>/
        <kbd className="font-mono">→</kbd> seek 5s · <kbd className="font-mono">Shift</kbd>+arrows change
        scene · <kbd className="font-mono">F</kbd> fullscreen
      </p>
    </div>
  );
}

async function Lesson({ params }: { params: PageProps<"/learn/[id]">["params"] }) {
  const { id } = await params;
  const storyboard = getStoryboard(id);
  if (!storyboard) notFound();

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Library
        </Link>
        <span aria-hidden> / </span>
        <span aria-current="page">{storyboard.concept}</span>
      </nav>
      <header className="mb-6 space-y-2">
        <ExampleSourceBadge source={storyboard.exampleSource} />
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{storyboard.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{storyboard.summary}</p>
      </header>
      <LearnView storyboard={storyboard} />
    </>
  );
}

function LessonSkeleton() {
  return (
    <div role="status" aria-label="Loading lesson" className="animate-pulse motion-reduce:animate-none">
      <div className="mb-4 h-5 w-40 rounded bg-muted" />
      <div className="mb-6 space-y-2">
        <div className="h-5 w-36 rounded-full bg-muted" />
        <div className="h-8 w-2/3 rounded bg-muted" />
        <div className="h-5 w-full max-w-3xl rounded bg-muted" />
      </div>
      <div className="aspect-video w-full rounded-xl bg-muted" />
    </div>
  );
}
