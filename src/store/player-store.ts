import type { PlayerRef } from "@remotion/player";
import { create } from "zustand";

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

type PlayerState = {
  player: PlayerRef | null;
  frame: number;
  isPlaying: boolean;
  playbackRate: PlaybackRate;
  isFullscreen: boolean;
  attach: (player: PlayerRef | null) => void;
  setFrame: (frame: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  setPlaybackRate: (rate: PlaybackRate) => void;
  setFullscreen: (isFullscreen: boolean) => void;
  toggle: () => void;
  seekTo: (frame: number) => void;
};

/**
 * UI-facing player state. The Remotion PlayerRef stays the source of truth for
 * playback; this store mirrors its events so any component (controls, scene
 * list, transcript) can read state or issue commands without prop drilling.
 */
export const usePlayerStore = create<PlayerState>()((set, get) => ({
  player: null,
  frame: 0,
  isPlaying: false,
  playbackRate: 1,
  isFullscreen: false,
  attach: (player) => set({ player, frame: 0, isPlaying: false }),
  setFrame: (frame) => set({ frame }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setFullscreen: (isFullscreen) => set({ isFullscreen }),
  toggle: () => get().player?.toggle(),
  seekTo: (frame) => {
    const { player } = get();
    if (!player) return;
    const target = Math.max(0, Math.round(frame));
    player.seekTo(target);
    set({ frame: target });
  },
}));
