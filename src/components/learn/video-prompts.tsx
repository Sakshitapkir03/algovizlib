"use client";

import { Check, RotateCcw, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatSeconds } from "@/lib/progress";
import { FPS } from "@/lib/storyboard";

/** Small, non-blocking prompts over the bottom of the video: "Resume from 0:42" and "Mark as done?". */
export function ResumePrompt({
  frame,
  onResume,
  onStartOver,
}: {
  frame: number;
  onResume: () => void;
  onStartOver: () => void;
}) {
  return (
    <PromptShell label="Resume where you left off">
      <span className="text-muted-foreground">You stopped at {formatSeconds(frame / FPS)}.</span>
      <Button size="sm" onClick={onResume}>
        <Play aria-hidden /> Resume from {formatSeconds(frame / FPS)}
      </Button>
      <Button size="sm" variant="ghost" onClick={onStartOver}>
        <RotateCcw aria-hidden /> Start over
      </Button>
    </PromptShell>
  );
}

export function DonePrompt({ onDone, onDismiss }: { onDone: () => void; onDismiss: () => void }) {
  return (
    <PromptShell label="Mark this problem as done">
      <span>Finished the video. Mark this problem as done?</span>
      <Button size="sm" onClick={onDone}>
        <Check aria-hidden /> Mark as done
      </Button>
      <Button size="sm" variant="ghost" onClick={onDismiss}>
        Not yet
      </Button>
    </PromptShell>
  );
}

function PromptShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-center sm:inset-x-3 sm:bottom-3">
      <section
        aria-label={label}
        className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-lg border bg-background/95 px-3 py-2 text-sm shadow-lg backdrop-blur motion-safe:animate-in motion-safe:fade-in"
      >
        {children}
      </section>
    </div>
  );
}
