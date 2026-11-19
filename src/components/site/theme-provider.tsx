"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Dark by default for first-time visitors, whatever the OS prefers; the visitor's choice is stored in
 * localStorage ("theme"). next-themes injects a blocking script that sets the `dark` class before first paint, so
 * a stored "light" never flashes dark (or the other way round).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
