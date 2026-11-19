"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const noop = () => () => {};

/** True only after hydration: the stored theme isn't known on the server, so the label waits for the client. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** The active theme flipped, and the matching "Switch to … mode" label. */
export function useThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const next = resolvedTheme === "light" ? "dark" : "light";
  return {
    label: hydrated ? `Switch to ${next} mode` : "Switch theme",
    toggle: () => setTheme(next),
  };
}

export function ThemeToggle() {
  const { label, toggle } = useThemeSwitch();
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label={label}>
            {/* Both icons render; CSS picks one so SSR and client markup match. Each shows the mode you'd switch to. */}
            <Sun aria-hidden className="hidden dark:block" />
            <Moon aria-hidden className="block dark:hidden" />
          </Button>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
