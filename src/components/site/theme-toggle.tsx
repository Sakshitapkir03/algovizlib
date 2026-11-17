"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === "dark" ? "light" : "dark";
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(next)} aria-label="Toggle dark mode">
      {/* Both icons render; CSS picks one so SSR and client markup match. */}
      <Sun aria-hidden className="hidden dark:block" />
      <Moon aria-hidden className="block dark:hidden" />
    </Button>
  );
}
