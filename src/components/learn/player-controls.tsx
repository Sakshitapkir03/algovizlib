"use client";

import { Maximize, Minimize, Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatTime, type SceneTiming } from "@/lib/storyboard";
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
  onToggleFullscreen,
}: {
  durationInFrames: number;
  timings: readonly SceneTiming[];
  currentIndex: number;
  onToggleFullscreen: () => void;
}) {
  const frame = usePlayerStore((s) => s.frame);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
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
        <span className="ml-2 font-mono text-xs text-muted-foreground tabular-nums" aria-live="off">
          {formatTime(frame)} / {formatTime(durationInFrames)}
        </span>
        <div className="ml-auto flex items-center gap-1">
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
    </div>
  );
}
