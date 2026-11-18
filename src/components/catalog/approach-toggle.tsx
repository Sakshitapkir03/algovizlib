"use client";

import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/** Hides the key idea and complexity until the learner asks, so the page never spoils the solution by default. */
export function ApproachToggle({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left text-sm font-medium hover:bg-muted/40">
        <ChevronRight
          aria-hidden
          className="size-4 text-muted-foreground transition-transform data-[open=true]:rotate-90 motion-reduce:transition-none"
          data-open={open}
        />
        {open ? "Hide approach" : "Show approach"}
        <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">spoilers</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 border-t px-4 py-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
