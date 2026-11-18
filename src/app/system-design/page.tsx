import type { Metadata } from "next";
import Link from "next/link";

import { PathBreadcrumb } from "@/components/catalog/path-breadcrumb";
import { Button } from "@/components/ui/button";
import { getCategory } from "@/lib/catalog/repository";

export const metadata: Metadata = {
  title: "System Design",
  description: "System design explainers are coming soon.",
};

export default function SystemDesignPage() {
  const category = getCategory("system-design");
  const topics = category?.plannedTopics ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PathBreadcrumb segments={[{ label: "system-design", href: "/system-design" }]} />
      <header className="mt-4 mb-10">
        <p className="inline-flex rounded-md border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          coming soon
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{category?.name}</h1>
        <p className="mt-2 text-muted-foreground">{category?.description}</p>
      </header>

      <h2 className="mb-3 font-mono text-xs text-muted-foreground">planned topics</h2>
      <ol className="divide-y rounded-xl border">
        {topics.map((topic, i) => (
          <li key={topic.name} className="flex gap-4 px-5 py-4">
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="font-medium">{topic.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{topic.summary}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        In the meantime, the algorithm patterns are ready to explore.
        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/dsa">Browse DSA patterns</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
