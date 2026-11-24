"use client";

import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/storyboard/schema";
import { formatTime, type SceneTiming } from "@/lib/storyboard/timing";
import { usePlayerStore } from "@/store/player-store";

export function SceneList({
  scenes,
  timings,
  currentIndex,
}: {
  scenes: readonly Scene[];
  timings: readonly SceneTiming[];
  currentIndex: number;
}) {
  const seekTo = usePlayerStore((s) => s.seekTo);
  return (
    <nav aria-label="Scenes">
      <ol className="space-y-1.5">
        {scenes.map((scene, i) => {
          const active = i === currentIndex;
          return (
            <li key={scene.id}>
              <button
                type="button"
                onClick={() => seekTo(timings[i].seekFrame)}
                aria-current={active ? "step" : undefined}
                aria-label={`Scene ${i + 1}: ${scene.caption}. Starts at ${formatTime(timings[i].seekFrame)}`}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors motion-reduce:transition-none",
                  "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active
                    ? "border-primary bg-primary/5 shadow-[0_0_14px_-6px_var(--glow)]"
                    : "border-transparent",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                    active ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block leading-snug", active && "font-semibold")}>{scene.caption}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                    {formatTime(timings[i].seekFrame)}
                    {active ? <span className="font-medium text-primary">· Now playing</span> : null}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
