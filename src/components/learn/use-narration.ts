"use client";

import type { PlayerRef } from "@remotion/player";
import { useEffect, type RefObject } from "react";

import { createAudioElement, createBrowserSpeech } from "@/lib/narration/browser";
import { NarrationEngine, type PlaybackState } from "@/lib/narration/engine";
import type { Storyboard } from "@/lib/storyboard/schema";
import { FPS, getSceneTimeline } from "@/lib/storyboard/timing";
import { usePlayerStore } from "@/store/player-store";

/**
 * Plays the narration alongside the Player: the video's stitched ElevenLabs track when it has one, the browser's
 * voice otherwise (see `NarrationEngine`). Player events and store changes (speed, volume, mute, hold) drive the
 * engine.
 */
export function useNarration(
  playerRef: RefObject<PlayerRef | null>,
  storyboard: Pick<Storyboard, "scenes" | "narrationTrack">,
) {
  const { scenes, narrationTrack } = storyboard;
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const store = usePlayerStore;
    store.getState().loadAudioPrefs();

    const speech = createBrowserSpeech((available) => store.getState().setSpeechAvailable(available));
    store.getState().setSpeechAvailable(speech !== null);
    // The frame the player was parked at for a hold: its own "seeked" event isn't a viewer's seek.
    let holdSeek: number | null = null;

    const engine = new NarrationEngine({
      scenes,
      timings: getSceneTimeline(scenes).timings,
      fps: FPS,
      track: narrationTrack ? { src: narrationTrack.src, durationMs: narrationTrack.durationMs } : null,
      createAudio: createAudioElement,
      speech,
      onHold: (frame) => {
        store.getState().setHolding(true);
        player.pause();
        if (player.getCurrentFrame() !== frame) {
          holdSeek = frame;
          player.seekTo(frame);
        }
      },
      onRelease: () => {
        if (!store.getState().holding) return;
        // Play first, so the engine never sees a moment that's neither playing nor holding.
        player.play();
        store.getState().setHolding(false);
      },
    });

    const state = (): PlaybackState => {
      const s = store.getState();
      return {
        frame: player.getCurrentFrame(),
        playing: player.isPlaying(),
        holding: s.holding,
        rate: s.playbackRate,
        volume: s.volume,
        muted: s.muted,
      };
    };
    const onFrame = () => engine.update(state());
    const onSeeked = (e: { detail: { frame: number } }) => {
      if (holdSeek !== null && e.detail.frame === holdSeek) {
        holdSeek = null;
        return;
      }
      // A viewer's seek during a hold ends the wait and keeps playing from the new spot.
      if (store.getState().holding) {
        player.play();
        store.getState().setHolding(false);
      }
      engine.update(state(), true);
    };
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("seeked", onSeeked);
    player.addEventListener("play", onFrame);
    player.addEventListener("pause", onFrame);
    player.addEventListener("ended", onFrame);
    const unsubscribe = store.subscribe((s, prev) => {
      if (
        s.playbackRate !== prev.playbackRate ||
        s.volume !== prev.volume ||
        s.muted !== prev.muted ||
        s.holding !== prev.holding
      )
        engine.update(state());
    });
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("seeked", onSeeked);
      player.removeEventListener("play", onFrame);
      player.removeEventListener("pause", onFrame);
      player.removeEventListener("ended", onFrame);
      unsubscribe();
      engine.dispose();
    };
  }, [playerRef, scenes, narrationTrack]);
}
