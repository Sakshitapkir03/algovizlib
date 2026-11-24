"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { Card } from "@/components/ui/card";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { FPS, getSceneTimeline, sceneIndexAtFrame, type Storyboard } from "@/lib/storyboard";
import { usePlayerStore } from "@/store/player-store";
import type { StoryboardCompositionProps } from "@/video/StoryboardComposition";

import { KeyTakeaway } from "./key-takeaway";
import { QuickCheckCard, QuickCheckSummary } from "./quick-check";
import { type QuickCheckSet, useQuickChecks } from "./use-quick-checks";
import { AskAboutStep } from "./ask-panel";
import { PlayerControls } from "./player-controls";
import { SceneList } from "./scene-list";
import { Transcript } from "./transcript";
import { useVideoProgress } from "./use-video-progress";
import { DonePrompt, ResumePrompt } from "./video-prompts";

const SEEK_SECONDS = 5;

const VideoStage = dynamic(() => import("./video-stage"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-video w-full items-center justify-center bg-muted text-sm text-muted-foreground">
      Loading video…
    </div>
  ),
});

/** Keys on these elements keep their native behavior (e.g. Space on a button). */
function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest(
      "button, a, input, textarea, select, [role='slider'], [role='combobox'], [role='listbox'], [role='option']",
    ) !== null
  );
}

/**
 * `showTakeaway={false}` leaves out the takeaway card, for pages that hide the approach behind a spoiler toggle
 * and render `<KeyTakeaway>` there instead. `problemKey` ties the video to a problem's progress: playing it marks
 * the problem "Learning", its position is saved for "Resume", and finishing it asks "Mark as done?". `askEnabled`
 * adds the tutor ("Ask about this step") under the controls.
 */
export function LearnView({
  storyboard,
  showTakeaway = true,
  problemKey,
  askEnabled = false,
  quickChecks,
}: {
  storyboard: Storyboard;
  showTakeaway?: boolean;
  problemKey?: string;
  /** Show "Ask about this step" under the player (the tutor; needs `problemKey`). */
  askEnabled?: boolean;
  /** Questions that pause the video before key steps, and where their answers go. */
  quickChecks?: QuickCheckSet;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const reducedMotion = useReducedMotion();

  const frame = usePlayerStore((s) => s.frame);
  const isFullscreen = usePlayerStore((s) => s.isFullscreen);

  const { timings, durationInFrames } = useMemo(() => getSceneTimeline(storyboard.scenes), [storyboard]);
  const currentIndex = sceneIndexAtFrame(timings, frame);
  const progress = useVideoProgress(problemKey, timings, durationInFrames);
  const checks = useQuickChecks(quickChecks, timings);
  const ended = usePlayerStore((s) => s.ended);

  const inputProps = useMemo<StoryboardCompositionProps>(
    () => ({ storyboard, theme: resolvedTheme === "light" ? "light" : "dark", reducedMotion }),
    [storyboard, resolvedTheme, reducedMotion],
  );

  const toggleFullscreen = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () =>
      usePlayerStore.getState().setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Keyboard: Space play/pause, ←/→ seek 5s, Shift+←/→ previous/next scene, F fullscreen, M mute.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // An open quick check has its own keys (and holds the video).
      if (e.metaKey || e.ctrlKey || e.altKey || isInteractive(e.target) || usePlayerStore.getState().checking)
        return;
      const { frame: f, seekTo, toggle, toggleMute } = usePlayerStore.getState();
      const idx = sceneIndexAtFrame(timings, f);
      switch (e.key) {
        case " ":
          toggle();
          break;
        case "ArrowLeft":
          seekTo(e.shiftKey ? timings[Math.max(0, idx - 1)].seekFrame : f - SEEK_SECONDS * FPS);
          break;
        case "ArrowRight":
          seekTo(
            e.shiftKey
              ? timings[Math.min(timings.length - 1, idx + 1)].seekFrame
              : Math.min(durationInFrames - 1, f + SEEK_SECONDS * FPS),
          );
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "m":
        case "M":
          toggleMute();
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [timings, durationInFrames, toggleFullscreen]);

  return (
    <div
      id={problemKey ? "resume" : undefined}
      className="grid scroll-mt-20 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
    >
      <div className="min-w-0 space-y-6">
        <Card className="gap-0 overflow-hidden py-0">
          <div
            ref={stageRef}
            className="flex flex-col bg-card data-[fullscreen=true]:h-full data-[fullscreen=true]:justify-center"
            data-fullscreen={isFullscreen}
          >
            {/* In fullscreen, cap the width so the 16:9 stage plus controls fit the screen height. */}
            <div
              className="relative w-full data-[fullscreen=true]:mx-auto data-[fullscreen=true]:max-w-[calc((100dvh-6rem)*16/9)]"
              data-fullscreen={isFullscreen}
            >
              <VideoStage
                inputProps={inputProps}
                durationInFrames={durationInFrames}
                label={`${storyboard.title} video. Currently on scene ${currentIndex + 1}: ${storyboard.scenes[currentIndex].caption}`}
              />
              {progress.resumeAt !== null && (
                <ResumePrompt
                  frame={progress.resumeAt}
                  onResume={progress.resume}
                  onStartOver={progress.startOver}
                />
              )}
              {progress.askDone && <DonePrompt onDone={progress.markDone} onDismiss={progress.dismissDone} />}
              {checks.active && (
                // The stage dims while a question waits under it.
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-background/55" />
              )}
            </div>
            <PlayerControls
              durationInFrames={durationInFrames}
              timings={timings}
              currentIndex={currentIndex}
              hasTrack={storyboard.narrationTrack !== undefined}
              onToggleFullscreen={toggleFullscreen}
              quickChecksAvailable={checks.available}
            />
            {checks.active && (
              <QuickCheckCard
                active={checks.active}
                onAnswer={checks.answer}
                onSkip={checks.skip}
                onContinue={checks.resume}
              />
            )}
            {ended && !checks.active && checks.summary.answered > 0 && (
              <QuickCheckSummary {...checks.summary} />
            )}
            {askEnabled && problemKey && !isFullscreen && (
              <AskAboutStep problemKey={problemKey} sceneId={storyboard.scenes[currentIndex].id} />
            )}
          </div>
        </Card>
        <p className="sr-only" aria-live="polite">
          Scene {currentIndex + 1} of {timings.length}: {storyboard.scenes[currentIndex].caption}
        </p>
        <Transcript scenes={storyboard.scenes} timings={timings} currentIndex={currentIndex} />
        {showTakeaway && <KeyTakeaway takeaway={storyboard.takeaway} analogy={storyboard.analogy} />}
      </div>
      <section className="lg:sticky lg:top-20 lg:self-start" aria-labelledby="scenes-heading">
        <h2 id="scenes-heading" className="mb-3 text-sm font-semibold text-muted-foreground">
          Scenes
        </h2>
        <SceneList scenes={storyboard.scenes} timings={timings} currentIndex={currentIndex} />
      </section>
    </div>
  );
}
