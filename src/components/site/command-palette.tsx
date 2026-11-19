"use client";

import { FileCode2, Layers, Search, SunMoon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DIFFICULTY_LABEL } from "@/components/catalog/difficulty-badge";
import { Kbd } from "@/components/catalog/kbd";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import type { SearchIndex } from "@/lib/catalog/repository";

import { useThemeSwitch } from "./theme-toggle";

/**
 * Every typed word must appear in the item's text; title matches rank above tag/pattern matches. (cmdk's default
 * fuzzy matching treats "islan" as a scattered subsequence and matches most of the catalog.)
 */
function filter(value: string, search: string, keywords: string[] = []): number {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const title = value.toLowerCase();
  const haystack = `${title} ${keywords.join(" ").toLowerCase()}`;
  if (!words.every((w) => haystack.includes(w))) return 0;
  if (title.startsWith(words[0])) return 1;
  return words.every((w) => title.includes(w)) ? 0.8 : 0.4;
}

/** Cmd/Ctrl+K: jump to any pattern or problem by name, or run an action (toggle theme). */
export function CommandPalette({ index }: { index: SearchIndex }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const theme = useThemeSwitch();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Meta+K Control+K"
        aria-label="Search patterns and problems"
        className="flex h-8 items-center gap-2 rounded-md border px-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground sm:w-56"
      >
        <Search aria-hidden className="size-4" />
        <span className="hidden sm:inline">Search problems…</span>
        <span className="ml-auto hidden items-center gap-0.5 sm:flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Jump to a pattern or problem"
        description="Type a pattern or problem name, or an action like Toggle theme, then press Enter."
      >
        <Command filter={filter}>
          <CommandInput placeholder="Type a pattern or problem…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup heading="Patterns">
              {index.patterns.map((p) => (
                <CommandItem key={p.slug} value={p.name} keywords={["pattern"]} onSelect={() => go(p.href)}>
                  <Layers aria-hidden className="text-muted-foreground" />
                  {p.name}
                  <CommandShortcut className="shrink-0 font-mono whitespace-nowrap">
                    {p.problemCount} problems
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Problems">
              {index.problems.map((p) => (
                <CommandItem
                  key={`${p.patternSlug}/${p.slug}`}
                  value={p.title}
                  keywords={[p.patternName, ...p.tags]}
                  onSelect={() => go(p.href)}
                >
                  <FileCode2 aria-hidden className="text-muted-foreground" />
                  <span className="min-w-0 truncate">{p.title}</span>
                  <CommandShortcut className="shrink-0 font-mono whitespace-nowrap">
                    {p.patternName} · {DIFFICULTY_LABEL[p.difficulty]}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Actions">
              <CommandItem
                value="Toggle theme"
                keywords={["dark", "light", "mode", "theme", theme.label]}
                onSelect={() => {
                  theme.toggle();
                  setOpen(false);
                }}
              >
                <SunMoon aria-hidden className="text-muted-foreground" />
                Toggle theme
                <CommandShortcut className="shrink-0 font-mono whitespace-nowrap">
                  {theme.label}
                </CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
