"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { InlineText } from "./rich-text";

/** Progressive hints: one more each click, so the learner only sees as much as they ask for. */
export function Hints({ hints }: { hints: string[] }) {
  const [shown, setShown] = useState(0);
  return (
    <div className="space-y-3">
      {shown > 0 && (
        <ol className="space-y-2">
          {hints.slice(0, shown).map((hint, i) => (
            <li key={i} className="flex gap-3 rounded-lg border px-4 py-3 text-sm">
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <InlineText text={hint} />
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="flex items-center gap-3">
        {shown < hints.length ? (
          <Button variant="outline" size="sm" onClick={() => setShown((n) => n + 1)}>
            {shown === 0 ? "Show first hint" : "Show next hint"}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setShown(0)}>
            Hide hints
          </Button>
        )}
        <span className="font-mono text-xs text-muted-foreground" aria-live="polite">
          {shown}/{hints.length} revealed
        </span>
      </div>
    </div>
  );
}
