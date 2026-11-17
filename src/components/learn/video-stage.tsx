"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useRef } from "react";

import { FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "@/lib/storyboard";
import { usePlayerStore } from "@/store/player-store";
import { StoryboardComposition, type StoryboardCompositionProps } from "@/video/StoryboardComposition";

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
  const playbackRate = usePlayerStore((s) => s.playbackRate);

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
    <Player
      ref={playerRef}
      component={StoryboardComposition}
      inputProps={inputProps}
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
  );
}
