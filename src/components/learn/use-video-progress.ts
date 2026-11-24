"use client";

import { useEffect, useRef, useState } from "react";

import { applyProgress, useProgress, useProgressRecords } from "@/lib/progress/use-progress";
import { resumeFrame } from "@/lib/progress/resume";
import { RESUME_HASH } from "@/lib/progress/summary";
import { trackVideoProgress } from "@/lib/progress/video-tracker";
import { FPS, type SceneTiming } from "@/lib/storyboard/timing";
import { usePlayerStore } from "@/store/player-store";

/**
 * A problem video's progress: the first play marks the problem "Learning" (if it's still "Not started"); the
 * position is saved every 5 seconds while playing, on pause, on a scene change, and when the page is hidden (sent
 * with `sendBeacon` for accounts); watching to the end clears it and offers "Mark as done?". On open, a saved
 * position is offered as "Resume from 0:42".
 */
export function useVideoProgress(
  problemKey: string | undefined,
  timings: readonly SceneTiming[],
  durationInFrames: number,
) {
  const records = useProgressRecords();
  const { snapshot, setStatus } = useProgress();
  const record = problemKey ? records[problemKey] : undefined;
  const ended = usePlayerStore((s) => s.ended);
  const [interacted, setInteracted] = useState(false);
  const [doneDismissed, setDoneDismissed] = useState(false);

  useEffect(() => {
    if (!problemKey) return;
    const tracker = trackVideoProgress({
      problemKey,
      timings,
      durationInFrames,
      fps: FPS,
      getState: usePlayerStore.getState,
      subscribe: (listener) => usePlayerStore.subscribe(listener),
      apply: applyProgress,
      onInteract: () => setInteracted(true),
    });
    const onHide = () => {
      if (document.visibilityState === "hidden") tracker.hide();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", tracker.hide);
    return () => {
      tracker.dispose();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", tracker.hide);
    };
  }, [problemKey, timings, durationInFrames]);

  const resumeAt = interacted ? null : resumeFrame(record?.position, timings, durationInFrames, FPS);
  const status = problemKey ? (snapshot[problemKey] ?? "not-started") : "not-started";

  const resume = () => {
    if (resumeAt === null) return;
    setInteracted(true);
    const { seekTo, toggle } = usePlayerStore.getState();
    seekTo(resumeAt);
    toggle();
  };

  // "Continue" links (/me, the landing page) end in #resume: resume as soon as the player and the saved
  // position are both ready (the click that followed the link lets the narration play).
  const attached = usePlayerStore((s) => s.player !== null);
  const autoResumed = useRef(false);
  useEffect(() => {
    if (autoResumed.current || !attached || resumeAt === null || window.location.hash !== RESUME_HASH) return;
    autoResumed.current = true;
    history.replaceState(history.state, "", window.location.pathname + window.location.search);
    resume();
  });

  return {
    /** The frame to offer resuming from, or null. */
    resumeAt,
    resume,
    startOver() {
      setInteracted(true);
      if (problemKey) applyProgress({ op: "clear-position", key: problemKey });
      const { seekTo, toggle } = usePlayerStore.getState();
      seekTo(0);
      toggle();
    },
    /** Watched to the end and not marked done yet (never set automatically). */
    askDone: Boolean(problemKey) && ended && status !== "done" && !doneDismissed,
    markDone() {
      if (problemKey) setStatus(problemKey, "done");
    },
    dismissDone: () => setDoneDismissed(true),
  };
}
