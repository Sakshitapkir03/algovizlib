import { getAllProblems, getPatterns, hasVideo } from "@/lib/catalog/repository";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og/card";

export const alt = "algovizlib: learn the pattern behind the problem, with short animated videos";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** The site's preview card (also the default for pages without their own). */
export default function Image() {
  const problems = getAllProblems();
  return ogImage({
    eyebrow: "algovizlib --learn approach",
    title: "Learn the pattern behind the problem.",
    subtitle: "Short animated videos that explain the approach, not the code.",
    facts: [
      `${getPatterns("dsa").length} patterns`,
      `${problems.length} problems`,
      `${problems.filter(hasVideo).length} videos`,
    ],
  });
}
