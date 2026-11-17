"use client";

import { ChevronDown, ScrollText } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Scene, SceneTiming } from "@/lib/storyboard";
import { usePlayerStore } from "@/store/player-store";

export function Transcript({
  scenes,
  timings,
  currentIndex,
}: {
  scenes: readonly Scene[];
  timings: readonly SceneTiming[];
  currentIndex: number;
}) {
  const [open, setOpen] = useState(false);
  const seekTo = usePlayerStore((s) => s.seekTo);

  return (
    <Card className="py-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto w-full justify-between rounded-xl px-6 py-4 text-base font-semibold"
          >
            <span className="flex items-center gap-2">
              <ScrollText aria-hidden className="size-4 text-primary" />
              Transcript
            </span>
            <ChevronDown
              aria-hidden
              className={cn(
                "size-4 transition-transform motion-reduce:transition-none",
                open && "rotate-180",
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="space-y-4 px-6 pb-6 text-sm leading-relaxed">
            {scenes.map((scene, i) => (
              <li
                key={scene.id}
                className={cn(
                  "border-l-2 pl-4",
                  i === currentIndex ? "border-primary" : "border-transparent",
                )}
              >
                <button
                  type="button"
                  onClick={() => seekTo(timings[i].seekFrame)}
                  className="mb-1 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:underline focus-visible:outline-none"
                  aria-label={`Jump to scene ${i + 1}: ${scene.caption}`}
                >
                  Scene {i + 1} · {scene.caption}
                  {i === currentIndex ? <span className="text-primary"> · Now playing</span> : null}
                </button>
                <p>{scene.narration}</p>
              </li>
            ))}
          </ol>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
