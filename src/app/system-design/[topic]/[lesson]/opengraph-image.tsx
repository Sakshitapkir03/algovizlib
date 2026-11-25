import { notFound } from "next/navigation";

import { KIND_LABEL } from "@/components/system-design/kind-badge";
import { getLesson, getLessons, getLessonStoryboard, getTopic } from "@/lib/catalog/repository";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og/card";
import { runTrace } from "@/lib/traces";

export const alt = "The lesson's title, topic, and kind on algovizlib";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return getLessons().map((l) => ({ topic: l.topicSlug, lesson: l.slug }));
}

/** A system design lesson's preview card: its title, topic, and kind, and how many failures the fix was checked against. */
export default async function Image({ params }: { params: Promise<{ topic: string; lesson: string }> }) {
  const { topic: topicSlug, lesson: slug } = await params;
  const lesson = getLesson(topicSlug, slug);
  const topic = getTopic(topicSlug);
  if (!lesson || !topic) notFound();
  const storyboard = getLessonStoryboard(lesson);
  const trace = storyboard?.trace ? runTrace(storyboard.trace.problem, storyboard.trace.args) : undefined;
  const proof = trace?.steps.at(-1)?.sim?.proof;
  const ruleProof =
    trace?.steps.at(-1)?.sim?.ruleProof ??
    trace?.steps.at(-1)?.sim?.readProof ??
    trace?.steps.at(-1)?.sim?.stampedeProof;
  const interleavings = trace?.steps.at(-1)?.sim?.interleavingProof ?? trace?.steps.at(-1)?.sim?.cacheProof;
  return ogImage({
    eyebrow: `system-design / ${topic.slug}`,
    title: lesson.title,
    subtitle: `${topic.name} · ${KIND_LABEL[lesson.kind].words}`,
    facts: [
      lesson.kind === "growth" ? "measured in a simulation" : "simulated replay",
      ...(proof
        ? [`${proof.runs} single and double losses checked`]
        : ruleProof
          ? [`checked over ${ruleProof.runs} runs`]
          : interleavings
            ? ["every interleaving checked"]
            : trace && lesson.kind === "growth"
              ? [`limits ${trace.answerDisplay}`]
              : []),
      `${lesson.minutes} min`,
    ],
  });
}
