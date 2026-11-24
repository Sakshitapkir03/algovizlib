"use client";

import {
  Maximize,
  Minimize,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { chooseVoice } from "@/lib/narration/engine";
import { formatTime, type SceneTiming } from "@/lib/storyboard/timing";
import { PLAYBACK_RATES, usePlayerStore, type PlaybackRate } from "@/store/player-store";

function IconButton({
  label,
  shortcut,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={onClick} aria-label={label} aria-keyshortcuts={shortcut}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut ? <kbd className="ml-2 font-mono text-xs opacity-70">{shortcut}</kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}

export function PlayerControls({
  durationInFrames,
  timings,
  currentIndex,
  hasTrack,
  onToggleFullscreen,
  quickChecksAvailable = false,
}: {
  durationInFrames: number;
  timings: readonly SceneTiming[];
  currentIndex: number;
  /** The video has a stitched ElevenLabs narration track. */
  hasTrack: boolean;
  onToggleFullscreen: () => void;
  /** The video has quick checks: show their on/off setting. */
  quickChecksAvailable?: boolean;
}) {
  const quickChecks = usePlayerStore((s) => s.quickChecks);
  const setQuickChecks = usePlayerStore((s) => s.setQuickChecks);
  const frame = usePlayerStore((s) => s.frame);
  // Waiting for the browser voice to finish a scene still counts as playing.
  const isPlaying = usePlayerStore((s) => s.isPlaying || s.holding);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const speechAvailable = usePlayerStore((s) => s.speechAvailable);
  const voice = chooseVoice(hasTrack, speechAvailable);
  const silent = muted || volume === 0;
  const isFullscreen = usePlayerStore((s) => s.isFullscreen);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const toggle = usePlayerStore((s) => s.toggle);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);

  const lastFrame = durationInFrames - 1;
  const prev = timings[Math.max(0, currentIndex - 1)];
  const next = timings[Math.min(timings.length - 1, currentIndex + 1)];

  return (
    <div className="flex flex-col gap-2 border-t bg-card px-3 py-2" role="group" aria-label="Video controls">
      <Slider
        min={0}
        max={lastFrame}
        step={1}
        value={[Math.min(frame, lastFrame)]}
        onValueChange={([v]) => seekTo(v)}
        thumbLabel="Seek"
        thumbValueText={`${formatTime(frame)} of ${formatTime(durationInFrames)}, scene ${currentIndex + 1} of ${timings.length}`}
        className="py-2"
      />
      <div className="flex items-center gap-1">
        <IconButton label="Previous scene" shortcut="Shift+ArrowLeft" onClick={() => seekTo(prev.seekFrame)}>
          <SkipBack aria-hidden />
        </IconButton>
        <IconButton label={isPlaying ? "Pause" : "Play"} shortcut="Space" onClick={toggle}>
          {isPlaying ? <Pause aria-hidden /> : <Play aria-hidden />}
        </IconButton>
        <IconButton label="Next scene" shortcut="Shift+ArrowRight" onClick={() => seekTo(next.seekFrame)}>
          <SkipForward aria-hidden />
        </IconButton>
        <span
          className="ml-1 font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums sm:ml-2"
          aria-live="off"
        >
          {formatTime(frame)}
          {/* On a phone the bar is full; the scrubber still announces the total. */}
          <span className="hidden sm:inline"> / {formatTime(durationInFrames)}</span>
        </span>
        <div className="ml-auto flex items-center gap-1">
          <IconButton
            label={silent ? "Unmute narration" : "Mute narration"}
            shortcut="M"
            onClick={toggleMute}
          >
            {silent ? (
              <VolumeX aria-hidden />
            ) : volume < 0.5 ? (
              <Volume1 aria-hidden />
            ) : (
              <Volume2 aria-hidden />
            )}
          </IconButton>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[muted ? 0 : Math.round(volume * 100)]}
            onValueChange={([v]) => setVolume(v / 100)}
            thumbLabel="Narration volume"
            thumbValueText={muted ? "Muted" : `${Math.round(volume * 100)}%`}
            className="mr-2 hidden w-20 sm:flex"
          />
          <Select
            value={String(playbackRate)}
            onValueChange={(v) => setPlaybackRate(Number(v) as PlaybackRate)}
          >
            <SelectTrigger size="sm" aria-label="Playback speed" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAYBACK_RATES.map((rate) => (
                <SelectItem key={rate} value={String(rate)}>
                  {rate}x
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <IconButton
            label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            shortcut="F"
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
          </IconButton>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="font-mono text-[11px] text-muted-foreground" data-voice={voice}>
          {voice === "elevenlabs" ? (
            <>
              Narrated by{" "}
              <a
                href="https://elevenlabs.io"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                ElevenLabs
              </a>
            </>
          ) : voice === "browser" ? (
            "Browser voice"
          ) : (
            "No voice available: follow the captions and transcript"
          )}
        </p>
        {quickChecksAvailable && (
          <button
            type="button"
            aria-pressed={quickChecks}
            onClick={() => setQuickChecks(!quickChecks)}
            className="rounded-sm font-mono text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Quick checks: {quickChecks ? "on" : "off"}
          </button>
        )}
      </div>
    </div>
  );
}
