import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

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

export default async function LearnPage({ params }: PageProps<"/learn/[id]">) {
  const { id } = await params;
  const storyboard = getStoryboard(id);
  if (!storyboard) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
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
      <p className="mt-6 text-xs text-muted-foreground">
        Keyboard: <kbd className="font-mono">Space</kbd> play/pause · <kbd className="font-mono">←</kbd>/
        <kbd className="font-mono">→</kbd> seek 5s · <kbd className="font-mono">Shift</kbd>+arrows change
        scene · <kbd className="font-mono">F</kbd> fullscreen
      </p>
    </div>
  );
}
