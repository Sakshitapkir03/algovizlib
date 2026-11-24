import { notFound } from "next/navigation";

import { DIFFICULTY_LABEL } from "@/components/catalog/difficulty-badge";
import { getAllProblems, getPattern, getProblem, hasVideo } from "@/lib/catalog/repository";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og/card";

export const alt = "The problem's title, pattern, and difficulty on algovizlib";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return getAllProblems().map((p) => ({ pattern: p.patternSlug, problem: p.slug }));
}

/** A problem's preview card: its title, pattern, and difficulty. */
export default async function Image({ params }: { params: Promise<{ pattern: string; problem: string }> }) {
  const { pattern: patternSlug, problem: slug } = await params;
  const problem = getProblem(patternSlug, slug);
  const pattern = getPattern(patternSlug);
  if (!problem || !pattern) notFound();
  return ogImage({
    eyebrow: `dsa / ${pattern.slug}`,
    title: problem.title,
    subtitle: `${pattern.name} · ${DIFFICULTY_LABEL[problem.difficulty]}`,
    facts: [
      ...(hasVideo(problem) ? ["animated video"] : []),
      `${problem.hints.length} hints`,
      `${problem.examples.length} examples`,
    ],
  });
}
