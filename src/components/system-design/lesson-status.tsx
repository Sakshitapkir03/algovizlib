"use client";

import { StatusLabel } from "@/components/catalog/progress-status";
import { statusOf } from "@/lib/progress";
import { useProgress } from "@/lib/progress/use-progress";

/** A lesson's progress on the /system-design page (read in the browser, like the DSA tables). */
export function LessonStatus({ lessonKey }: { lessonKey: string }) {
  const { snapshot } = useProgress();
  const status = statusOf(snapshot, lessonKey);
  return (
    <StatusLabel status={status} className={status === "not-started" ? "text-muted-foreground" : undefined} />
  );
}
