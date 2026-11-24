import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { AccountProvider } from "@/components/account/account-provider";
import { VerifyBanner } from "@/components/account/verify-banner";
import { STATUS_NOTE_SCRIPT } from "@/components/catalog/status-note";
import { SiteHeader } from "@/components/site/site-header";
import { ThemeProvider } from "@/components/site/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_US" },
  twitter: { card: "summary_large_image" },
  title: {
    default: "algovizlib: CS concepts as short videos",
    template: "%s · algovizlib",
  },
  description:
    "Short animated videos that explain the approach behind algorithms and system design through real-world examples.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: STATUS_NOTE_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <AccountProvider>
            <TooltipProvider>
              <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-3 focus:ring-ring/50"
              >
                Skip to content
              </a>
              <SiteHeader />
              <VerifyBanner />
              <main id="main" className="flex-1">
                {children}
              </main>
              <footer className="border-t py-6 text-center text-xs text-muted-foreground">
                algovizlib · Learn the approach, not just the code. ·{" "}
                <span className="whitespace-nowrap">
                  Voice by{" "}
                  <a
                    href="https://elevenlabs.io"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    ElevenLabs
                  </a>
                </span>
                <nav aria-label="Legal" className="mt-2 flex justify-center gap-3 font-mono">
                  <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                    privacy
                  </Link>
                  <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
                    terms
                  </Link>
                </nav>
              </footer>
            </TooltipProvider>
          </AccountProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
