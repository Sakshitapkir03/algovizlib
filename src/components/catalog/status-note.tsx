"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Shown once (until dismissed), next to the status picker: how status changes on its own. */
export const STATUS_NOTE_KEY = "algovizlib:status-note-seen";
/** Set on <html> before first paint when the note was dismissed; CSS hides the note (globals.css). */
export const STATUS_NOTE_ATTR = "data-status-note-seen";

/**
 * Runs in <head> before the page paints (like next-themes' script): marks <html> when the note was dismissed. The note
 * is in the server HTML for everyone, so first-time visitors don't see the page jump when it appears after
 * hydration, and returning visitors never see it flash.
 */
export const STATUS_NOTE_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(STATUS_NOTE_KEY)})==="1")document.documentElement.setAttribute(${JSON.stringify(STATUS_NOTE_ATTR)},"")}catch(e){document.documentElement.setAttribute(${JSON.stringify(STATUS_NOTE_ATTR)},"")}`;

function dismiss() {
  try {
    localStorage.setItem(STATUS_NOTE_KEY, "1");
  } catch {
    // Storage blocked: it hides for this page view only.
  }
  document.documentElement.setAttribute(STATUS_NOTE_ATTR, "");
}

export function StatusNote() {
  return (
    <div className="status-note flex max-w-xs items-start gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground">
      <p>
        Status updates on its own: playing the video, opening a hint, or showing the approach marks a problem{" "}
        <span className="text-foreground">Learning</span>. <span className="text-foreground">Done</span> is
        always your call, and your choice here always wins.
      </p>
      <Button variant="ghost" size="icon-xs" aria-label="Dismiss this note" onClick={dismiss}>
        <X aria-hidden />
      </Button>
    </div>
  );
}
