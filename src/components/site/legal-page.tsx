import type { ReactNode } from "react";

import { PathBreadcrumb } from "@/components/catalog/path-breadcrumb";

/** Contact for privacy questions and account deletion. */
export const CONTACT_EMAIL = "sakshitapkir25@gmail.com";

/** The shared layout of /privacy and /terms: short sections, plain language, an effective date. */
export function LegalPage({
  slug,
  title,
  effective,
  summary,
  children,
}: {
  slug: string;
  title: string;
  /** ISO date, shown as "November 21, 2026". */
  effective: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  const date = new Date(`${effective}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PathBreadcrumb segments={[{ label: slug, href: `/${slug}` }]} />
      <header className="mt-4 mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          effective <time dateTime={effective}>{date}</time>
        </p>
        <div className="mt-4 text-muted-foreground">{summary}</div>
      </header>
      <div className="space-y-10">{children}</div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 font-mono text-xs text-muted-foreground">{title.toLowerCase()}</h2>
      <div className="space-y-3 leading-relaxed [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}

export function Mail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-4">
      {CONTACT_EMAIL}
    </a>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
