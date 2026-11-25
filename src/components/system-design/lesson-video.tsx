"use client";

import { FlaskConical, Film } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { LearnView } from "@/components/learn/learn-view";
import { Button } from "@/components/ui/button";
import type { QuickCheck } from "@/lib/quickcheck/schema";
import type { Storyboard } from "@/lib/storyboard";

// The scenario editor, the simulation, and the fit checks load only when a learner opens "Your scenario".
const ScenarioPanel = dynamic(() => import("./scenario-panel"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-video w-full items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground">
      Loading…
    </div>
  ),
});

/**
 * A lesson's video. A switch above it moves between the original replay (tied to progress, resume, quick checks, and
 * the tutor) and "Your scenario": the learner changes the failures, timings, and safeguards, and the browser runs the
 * simulation and builds a checked replay of it (none of those). Only one player is mounted at a time.
 */
export function LessonVideo({
  storyboard,
  lessonKey,
  askEnabled,
  quickChecks,
}: {
  storyboard: Storyboard;
  lessonKey: string;
  askEnabled: boolean;
  quickChecks: QuickCheck[];
}) {
  const [mode, setMode] = useState<"original" | "custom">("original");
  const checks = useMemo(
    () => ({ checks: quickChecks, problemKey: lessonKey, source: "video" as const }),
    [quickChecks, lessonKey],
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {mode === "original" ? "the incident, replayed" : "your scenario · simulated in your browser"}
        </span>
        <div role="group" aria-label="Which replay" className="flex rounded-lg border p-0.5">
          <Button
            size="sm"
            variant={mode === "original" ? "secondary" : "ghost"}
            aria-pressed={mode === "original"}
            onClick={() => setMode("original")}
          >
            <Film aria-hidden /> Original replay
          </Button>
          <Button
            size="sm"
            variant={mode === "custom" ? "secondary" : "ghost"}
            aria-pressed={mode === "custom"}
            onClick={() => setMode("custom")}
          >
            <FlaskConical aria-hidden /> Your scenario
          </Button>
        </div>
      </div>
      {mode === "original" ? (
        <LearnView
          storyboard={storyboard}
          showTakeaway={false}
          problemKey={lessonKey}
          askEnabled={askEnabled}
          quickChecks={checks}
        />
      ) : (
        <ScenarioPanel lessonKey={lessonKey} onBack={() => setMode("original")} />
      )}
    </div>
  );
}
