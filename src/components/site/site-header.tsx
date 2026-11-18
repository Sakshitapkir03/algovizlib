import Link from "next/link";

import { getSearchIndex } from "@/lib/catalog/repository";

import { CommandPalette } from "./command-palette";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/dsa", label: "dsa" },
  { href: "/system-design", label: "system-design" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-sm font-mono text-sm font-semibold tracking-tight"
        >
          <span aria-hidden className="text-primary">
            &gt;_
          </span>
          <span className="max-sm:sr-only">algovizlib</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 font-mono text-xs">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <CommandPalette index={getSearchIndex()} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
