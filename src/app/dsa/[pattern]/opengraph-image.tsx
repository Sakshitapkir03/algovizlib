import { notFound } from "next/navigation";

import { getPattern, getPatternGroup, getPatterns, getPatternStats } from "@/lib/catalog/repository";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og/card";

export const alt = "The pattern's name and group, with how many problems and videos it has, on algovizlib";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return getPatterns("dsa").map((p) => ({ pattern: p.slug }));
}

/** A pattern's preview card: its name, group, and problem counts. */
export default async function Image({ params }: { params: Promise<{ pattern: string }> }) {
  const pattern = getPattern((await params).pattern);
  if (!pattern) notFound();
  const stats = getPatternStats(pattern.slug);
  return ogImage({
    eyebrow: `dsa / ${pattern.slug}`,
    title: pattern.name,
    subtitle: `${getPatternGroup(pattern.group)?.name ?? "DSA"} · time ${pattern.typicalComplexity.time}`,
    facts: [
      `${stats.total} problems`,
      `${stats.byDifficulty.easy} easy, ${stats.byDifficulty.medium} medium, ${stats.byDifficulty.hard} hard`,
      `${stats.videos} videos`,
    ],
  });
}
