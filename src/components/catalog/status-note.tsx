"use client";

import { X } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

/** Shown once (until dismissed), next to the status picker: how status changes on its own. */
export const STATUS_NOTE_KEY = "algovizlib:status-note-seen";

const listeners = new Set<() => void>();

function seen(): boolean {
  try {
    return localStorage.getItem(STATUS_NOTE_KEY) === "1";
  } catch {
    return true; // storage blocked: don't nag on every page
  }
}

function dismiss() {
  try {
    localStorage.setItem(STATUS_NOTE_KEY, "1");
  } catch {
    // Storage blocked: it hides for this page view only.
  }
  hidden = true;
  listeners.forEach((l) => l());
}

let hidden = false;
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));

export function StatusNote() {
  // Hidden on the server and until hydration, so markup always matches.
  const show = useSyncExternalStore(
    subscribe,
    () => !hidden && !seen(),
    () => false,
  );
  if (!show) return null;
  return (
    <div className="flex max-w-xs items-start gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground">
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
