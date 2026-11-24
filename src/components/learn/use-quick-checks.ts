"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { QuickCheck } from "@/lib/quickcheck/schema";
import { newResultId, checkRecorder } from "@/lib/quickcheck/results";
import { dueCheck, pauseFrames, summarize } from "@/lib/quickcheck/schedule";
import { noteVideoViewing } from "@/lib/review/use-review";
import type { SceneTiming } from "@/lib/storyboard";
import { usePlayerStore } from "@/store/player-store";

/** A video's quick checks and where their answers are recorded. */
export type QuickCheckSet = {
  checks: QuickCheck[];
  /** The problem the answers belong to ("pattern/slug"). */
  problemKey: string;
  /** "walkthrough" for a learner's own input (with `input`, as in its share link): not the problem's video. */
  source: "video" | "walkthrough";
  input?: string;
};

export type ActiveCheck = { check: QuickCheck; chosen?: number };

/**
 * Quick checks during playback: when playing reaches a check's pause frame on its own (not by a seek or a jump), the
 * video pauses there (`checking` in the store holds the player's shortcuts) and the question opens. Answering
 * records the result and shows the explanation; Continue (or Skip) closes it and plays on. Pressing play while a
 * question is open skips it. Each question is asked once per viewing, and only with "Quick checks" on.
 */
export function useQuickChecks(set: QuickCheckSet | undefined, timings: readonly SceneTiming[]) {
  const [active, setActive] = useState<ActiveCheck | null>(null);
  const [answers, setAnswers] = useState<{ id: string; correct: boolean }[]>([]);
  const asked = useRef(new Set<string>());
  const frames = useMemo(
    () => (set ? pauseFrames(set.checks, timings) : new Map<string, number>()),
    [set, timings],
  );

  useEffect(() => {
    if (!set || frames.size === 0) return;
    return usePlayerStore.subscribe((state, previous) => {
      if (!state.quickChecks || state.checking || state.frame === previous.frame) return;
      const id = dueCheck(
        frames,
        asked.current,
        previous.frame,
        state.frame,
        previous.isPlaying && state.isPlaying,
      );
      if (!id) return;
      asked.current.add(id);
      const check = set.checks.find((c) => c.id === id)!;
      state.player?.pause();
      state.seekTo(frames.get(id)!);
      state.setChecking(true);
      setActive({ check });
    });
  }, [set, frames]);

  const close = useCallback((resume: boolean) => {
    setActive(null);
    const store = usePlayerStore.getState();
    store.setChecking(false);
    if (resume && !store.isPlaying) store.player?.play();
  }, []);

  // Playing again (the player's own button, or a click on the stage) while a question is open skips it.
  useEffect(() => {
    if (!active) return;
    return usePlayerStore.subscribe((state, previous) => {
      if (state.isPlaying && !previous.isPlaying) close(false);
    });
  }, [active, close]);

  // Leaving the page (or this video) never leaves the player's shortcuts held.
  useEffect(() => () => usePlayerStore.getState().setChecking(false), []);

  const answer = useCallback(
    (choice: number) => {
      if (!active || active.chosen !== undefined || !set) return;
      const { check } = active;
      const correct = choice === check.answer;
      setActive({ check, chosen: choice });
      const viewing = [...answers, { id: check.id, correct }];
      setAnswers(viewing);
      void checkRecorder.record({
        id: newResultId(),
        problemKey: set.problemKey,
        questionId: check.id,
        sceneId: check.sceneId,
        step: check.step,
        correct,
        source: set.source,
        ...(set.input ? { input: set.input } : {}),
        answeredAt: Date.now(),
      });
      // Every question of a Done problem's video answered right in one viewing counts as its spaced review.
      if (set.source === "video" && viewing.length === set.checks.length)
        noteVideoViewing(set.problemKey, viewing);
    },
    [active, set, answers],
  );

  return {
    /** The video has questions (the setting shows only then). */
    available: frames.size > 0,
    active,
    answer,
    skip: () => close(true),
    resume: () => close(true),
    summary: summarize(answers),
  };
}
