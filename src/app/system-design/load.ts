import { notFound } from "next/navigation";

import type { Lesson, Topic } from "@/lib/catalog";
import { getLesson, getTopic } from "@/lib/catalog/repository";

/** Resolve a built lesson from its URL (its topic must match), or render the 404 page. */
export function loadLesson(topicSlug: string, slug: string): { topic: Topic; lesson: Lesson } {
  const topic = getTopic(topicSlug);
  const lesson = topic && getLesson(topic.slug, slug);
  if (!topic || !lesson) notFound();
  return { topic, lesson };
}
