"use client";

import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { applyProgress } from "@/lib/progress/use-progress";

/**
 * Hides the key idea and complexity until the learner asks, so the page never spoils the solution by default.
 * With `problemKey`, opening it marks the problem "Learning" (only if it's "Not started").
 */
export function ApproachToggle({
  children,
  problemKey,
  label = "approach",
}: {
  children: ReactNode;
  problemKey?: string;
  /** What's hidden, as in "Show approach" (a lesson: "what went wrong and the fix"). */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && problemKey) applyProgress({ op: "mark-learning", key: problemKey });
  };
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="rounded-lg border">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left text-sm font-medium hover:bg-muted/40">
        <ChevronRight
          aria-hidden
          className="size-4 text-muted-foreground transition-transform data-[open=true]:rotate-90 motion-reduce:transition-none"
          data-open={open}
        />
        {open ? `Hide ${label}` : `Show ${label}`}
        <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">spoilers</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 border-t px-4 py-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
