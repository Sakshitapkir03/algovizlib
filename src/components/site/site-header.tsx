import Link from "next/link";

import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
          >
            a
          </span>
          algovizlib
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
