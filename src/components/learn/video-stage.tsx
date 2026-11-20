"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "@/lib/storyboard";
import { usePlayerStore } from "@/store/player-store";
import { StoryboardComposition, type StoryboardCompositionProps } from "@/video/StoryboardComposition";

import { useNarration } from "./use-narration";

/**
 * The Remotion Player plus its event wiring. Loaded client-only (see
 * LearnView): the Player reads the clock while rendering, which can't run
 * during static prerendering.
 */
export default function VideoStage({
  inputProps,
  durationInFrames,
  label,
}: {
  inputProps: StoryboardCompositionProps;
  durationInFrames: number;
  label: string;
}) {
  const playerRef = useRef<PlayerRef>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  // The composition sizes its text from the player's rendered width, so labels stay readable on a phone.
  const [displayWidth, setDisplayWidth] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setDisplayWidth(Math.round(el.getBoundingClientRect().width) || undefined);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const props = useMemo(() => ({ ...inputProps, displayWidth }), [inputProps, displayWidth]);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  useNarration(playerRef, inputProps.storyboard.scenes);

  // Mirror player events into the store so controls/scene list can react.
  useEffect(() => {
    const player = playerRef.current;
    const store = usePlayerStore.getState();
    store.attach(player);
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => store.setFrame(e.detail.frame);
    const onPlay = () => store.setPlaying(true);
    const onPause = () => store.setPlaying(false);
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("seeked", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onPause);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("seeked", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onPause);
      store.attach(null);
    };
  }, []);

  return (
    <div ref={frameRef}>
      <Player
        ref={playerRef}
        component={StoryboardComposition}
        inputProps={props}
        durationInFrames={durationInFrames}
        fps={FPS}
        compositionWidth={VIDEO_WIDTH}
        compositionHeight={VIDEO_HEIGHT}
        playbackRate={playbackRate}
        controls={false}
        clickToPlay
        spaceKeyToPlayOrPause={false}
        acknowledgeRemotionLicense
        style={{ width: "100%", aspectRatio: `${VIDEO_WIDTH} / ${VIDEO_HEIGHT}` }}
        aria-label={label}
      />
    </div>
  );
}
