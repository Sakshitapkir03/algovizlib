"use client";

import { FlaskConical, Film } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import type { Storyboard } from "@/lib/storyboard";
import type { WalkthroughProblem } from "@/lib/walkthrough/build";
import { INPUT_PARAM } from "@/lib/walkthrough/link";

import { ExampleSourceBadge } from "./example-source-badge";
import { LearnView } from "./learn-view";

const noSubscribe = () => () => {};

// The editor, every trace, and the fit checks load only when a learner opens "Your input".
const TryInputPanel = dynamic(() => import("./try-input-panel"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-video w-full items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground">
      Loading…
    </div>
  ),
});

/**
 * The problem page's video. With "Try your own input" (`tryInput`), a switch above it moves between the original
 * video (tied to progress, resume, and the tutor) and a walkthrough of the learner's own input (none of those). Only
 * one player is mounted at a time: they share the player store. A link with `?input=` opens "Your input" with it.
 */
export function VideoSection({
  storyboard,
  problemKey,
  askEnabled,
  tryInput,
}: {
  storyboard: Storyboard;
  problemKey: string;
  askEnabled: boolean;
  tryInput?: { problem: WalkthroughProblem; patternName: string };
}) {
  // A shared link opens "Your input" (read in the browser: the page is static, so the server sees no query).
  const shared = useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get(INPUT_PARAM),
    () => null,
  );
  const [choice, setChoice] = useState<"original" | "custom" | null>(null);
  const mode = choice ?? (tryInput && shared !== null ? "custom" : "original");
  const setMode = setChoice;

  const showOriginal = () => {
    setMode("original");
    const url = new URL(window.location.href);
    if (url.searchParams.has(INPUT_PARAM)) {
      url.searchParams.delete(INPUT_PARAM);
      window.history.replaceState(window.history.state, "", url);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {mode === "original" ? (
          <ExampleSourceBadge source={storyboard.exampleSource} />
        ) : (
          <span className="font-mono text-xs text-muted-foreground">your input · step by step</span>
        )}
        {tryInput && (
          <div role="group" aria-label="Which video" className="flex rounded-lg border p-0.5">
            <Button
              size="sm"
              variant={mode === "original" ? "secondary" : "ghost"}
              aria-pressed={mode === "original"}
              onClick={showOriginal}
            >
              <Film aria-hidden /> Original video
            </Button>
            <Button
              size="sm"
              variant={mode === "custom" ? "secondary" : "ghost"}
              aria-pressed={mode === "custom"}
              onClick={() => setMode("custom")}
            >
              <FlaskConical aria-hidden /> Your input
            </Button>
          </div>
        )}
      </div>
      {mode === "original" || !tryInput ? (
        <LearnView
          storyboard={storyboard}
          showTakeaway={false}
          problemKey={problemKey}
          askEnabled={askEnabled}
        />
      ) : (
        <TryInputPanel
          problemKey={problemKey}
          problem={tryInput.problem}
          patternName={tryInput.patternName}
          template={storyboard}
          shared={shared}
          onBack={showOriginal}
        />
      )}
    </div>
  );
}
