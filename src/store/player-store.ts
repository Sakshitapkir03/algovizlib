import type { PlayerRef } from "@remotion/player";
import { create } from "zustand";

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

/** Where the sound settings are remembered across visits. */
export const AUDIO_PREFS_KEY = "algovizlib:audio";
/** Where "Quick checks: on / off" is remembered (on unless turned off). */
export const QUICK_CHECKS_KEY = "algovizlib:quick-checks";

type PlayerState = {
  player: PlayerRef | null;
  frame: number;
  isPlaying: boolean;
  /** The video played to its last frame (cleared by playing or seeking again). */
  ended: boolean;
  playbackRate: PlaybackRate;
  isFullscreen: boolean;
  /** Narration volume, 0–1. */
  volume: number;
  muted: boolean;
  /** Paused only to let the browser voice finish the scene; shown as playing. */
  holding: boolean;
  /** The browser can read scenes without ElevenLabs audio aloud (set once detected on the client). */
  speechAvailable: boolean;
  /** Quick check questions pause the video (the learner's setting; on by default). */
  quickChecks: boolean;
  /** A quick check is open: the video is paused for it and the player's shortcuts wait. */
  checking: boolean;
  attach: (player: PlayerRef | null) => void;
  setFrame: (frame: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  setEnded: () => void;
  setPlaybackRate: (rate: PlaybackRate) => void;
  setFullscreen: (isFullscreen: boolean) => void;
  setHolding: (holding: boolean) => void;
  setSpeechAvailable: (available: boolean) => void;
  setQuickChecks: (on: boolean) => void;
  setChecking: (checking: boolean) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  /** Read the remembered volume, mute, and quick-check setting (after hydration, so server and client render the
   * same first). */
  loadAudioPrefs: () => void;
  toggle: () => void;
  seekTo: (frame: number) => void;
};

function saveAudioPrefs(volume: number, muted: boolean) {
  try {
    localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify({ volume, muted }));
  } catch {
    // Storage blocked (private mode, quota): the setting lasts for this visit only.
  }
}

/** "Quick checks: on / off" as remembered: on unless the learner turned it off. */
export function readQuickChecksPref(): boolean {
  try {
    return localStorage.getItem(QUICK_CHECKS_KEY) !== "off";
  } catch {
    return true;
  }
}

export function readAudioPrefs(): { volume: number; muted: boolean } | undefined {
  try {
    const raw = localStorage.getItem(AUDIO_PREFS_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { volume?: unknown; muted?: unknown };
    const volume = typeof parsed.volume === "number" ? Math.min(1, Math.max(0, parsed.volume)) : 1;
    return { volume, muted: parsed.muted === true };
  } catch {
    return undefined;
  }
}

/**
 * UI-facing player state. The Remotion PlayerRef stays the source of truth for
 * playback; this store mirrors its events so any component (controls, scene
 * list, transcript) can read state or issue commands without prop drilling.
 */
export const usePlayerStore = create<PlayerState>()((set, get) => ({
  player: null,
  frame: 0,
  isPlaying: false,
  ended: false,
  playbackRate: 1,
  isFullscreen: false,
  volume: 1,
  muted: false,
  holding: false,
  speechAvailable: false,
  quickChecks: true,
  checking: false,
  attach: (player) =>
    set({ player, frame: 0, isPlaying: false, ended: false, holding: false, checking: false }),
  setFrame: (frame) => set({ frame }),
  setPlaying: (isPlaying) => set(isPlaying ? { isPlaying, ended: false } : { isPlaying }),
  setEnded: () => set({ ended: true, isPlaying: false }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setFullscreen: (isFullscreen) => set({ isFullscreen }),
  setHolding: (holding) => set({ holding }),
  setSpeechAvailable: (speechAvailable) => set({ speechAvailable }),
  setQuickChecks: (quickChecks) => {
    set({ quickChecks });
    try {
      localStorage.setItem(QUICK_CHECKS_KEY, quickChecks ? "on" : "off");
    } catch {
      // Storage blocked: the setting lasts for this visit only.
    }
  },
  setChecking: (checking) => set({ checking }),
  setVolume: (volume) => {
    const v = Math.min(1, Math.max(0, volume));
    // Dragging the volume up unmutes, like most players.
    const muted = v === 0 ? get().muted : false;
    set({ volume: v, muted });
    saveAudioPrefs(v, muted);
  },
  toggleMute: () => {
    const muted = !get().muted;
    set({ muted });
    saveAudioPrefs(get().volume, muted);
  },
  loadAudioPrefs: () => {
    const prefs = readAudioPrefs();
    if (prefs) set(prefs);
    set({ quickChecks: readQuickChecksPref() });
  },
  toggle: () => {
    const { player, holding } = get();
    // Pausing while the video waits for the browser voice stops the voice too (the player is already paused).
    if (holding) set({ holding: false });
    else player?.toggle();
  },
  seekTo: (frame) => {
    const { player } = get();
    if (!player) return;
    const target = Math.max(0, Math.round(frame));
    player.seekTo(target);
    set({ frame: target, ended: false });
  },
}));
