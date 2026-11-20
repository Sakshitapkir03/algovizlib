"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { DIFFICULTIES, type Difficulty } from "@/lib/catalog";
import type { ProblemSummary } from "@/lib/catalog/repository";
import {
  PROGRESS_LABEL,
  PROGRESS_STATUSES,
  progressKey,
  statusOf,
  type ProgressStatus,
} from "@/lib/progress";
import { useProgress } from "@/lib/progress/use-progress";

import { DIFFICULTY_LABEL, DifficultyBadge } from "./difficulty-badge";
import { StatusLabel } from "./progress-status";

type Filters = {
  query: string;
  difficulty: Difficulty | "all";
  video: "all" | "yes" | "no";
  status: ProgressStatus | "all";
};

const INITIAL: Filters = { query: "", difficulty: "all", video: "all", status: "all" };

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="font-mono text-xs text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 rounded-md border bg-background px-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** For rows cross-listed from another pattern: where the problem lives. */
function AlsoIn({ home }: { home?: string }) {
  if (!home) return null;
  return (
    <span className="ml-2 rounded border px-1.5 py-0.5 font-mono text-[11px] font-normal whitespace-nowrap text-muted-foreground">
      also in {home}
    </span>
  );
}

function VideoLabel({ hasVideo }: { hasVideo: boolean }) {
  return (
    <span className={hasVideo ? "font-mono text-xs" : "font-mono text-xs text-muted-foreground"}>
      {hasVideo ? "▶ yes" : "– no"}
    </span>
  );
}

export function ProblemTable({ problems }: { problems: ProblemSummary[] }) {
  const { snapshot } = useProgress();
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const searchId = useId();
  const set =
    <K extends keyof Filters>(key: K) =>
    (value: Filters[K]) =>
      setFilters((f) => ({ ...f, [key]: value }));

  const rows = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return problems
      .map((p) => ({ ...p, status: statusOf(snapshot, progressKey(p)) }))
      .filter(
        (p) =>
          (filters.difficulty === "all" || p.difficulty === filters.difficulty) &&
          (filters.video === "all" || p.hasVideo === (filters.video === "yes")) &&
          (filters.status === "all" || p.status === filters.status) &&
          (q === "" || p.title.toLowerCase().includes(q) || p.tags.some((t) => t.includes(q))),
      );
  }, [problems, snapshot, filters]);

  const filtered = rows.length !== problems.length;
  const related = problems.filter((p) => p.homePatternName).length;
  const total = `${problems.length - related} problems${related ? ` + ${related} related` : ""}`;

  return (
    <div className="space-y-4">
      <div role="search" className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative lg:w-72">
          <label htmlFor={searchId} className="sr-only">
            Search problems
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={searchId}
            type="search"
            placeholder="Search by title or tag"
            value={filters.query}
            onChange={(e) => set("query")(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <FilterSelect
            label="difficulty"
            value={filters.difficulty}
            onChange={set("difficulty")}
            options={[
              { value: "all", label: "All" },
              ...DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] })),
            ]}
          />
          <FilterSelect
            label="video"
            value={filters.video}
            onChange={set("video")}
            options={[
              { value: "all", label: "All" },
              { value: "yes", label: "Has video" },
              { value: "no", label: "No video" },
            ]}
          />
          <FilterSelect
            label="status"
            value={filters.status}
            onChange={set("status")}
            options={[
              { value: "all", label: "All" },
              ...PROGRESS_STATUSES.map((s) => ({ value: s, label: PROGRESS_LABEL[s] })),
            ]}
          />
        </div>
      </div>

      <p className="font-mono text-xs text-muted-foreground" aria-live="polite">
        {filtered ? `${rows.length} of ${problems.length} problems` : total}
        {filtered && (
          <>
            {" · "}
            <button
              type="button"
              onClick={() => setFilters(INITIAL)}
              className="rounded-sm underline underline-offset-4 hover:text-foreground"
            >
              clear filters
            </button>
          </>
        )}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No problems match these filters.
        </p>
      ) : (
        <>
          {/* Desktop: a real table. */}
          <table className="hidden w-full border-collapse text-sm md:table">
            <thead>
              <tr className="border-b text-left font-mono text-xs text-muted-foreground">
                <th scope="col" className="w-32 py-2 pr-4 font-normal">
                  status
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  title
                </th>
                <th scope="col" className="w-28 py-2 pr-4 font-normal">
                  difficulty
                </th>
                <th scope="col" className="w-20 py-2 font-normal">
                  video
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.slug} className="glow-box group border-b last:border-0 hover:bg-muted/40">
                  <td className="py-3 pr-4">
                    <StatusLabel status={p.status} />
                  </td>
                  <td className="py-3 pr-4">
                    <Link href={p.href} prefetch={true} className="rounded-sm font-medium hover:text-primary">
                      {p.title}
                    </Link>
                    <AlsoIn home={p.homePatternName} />
                  </td>
                  <td className="py-3 pr-4">
                    <DifficultyBadge difficulty={p.difficulty} />
                  </td>
                  <td className="py-3">
                    <VideoLabel hasVideo={p.hasVideo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile: stacked cards. */}
          <ul className="space-y-2 md:hidden">
            {rows.map((p) => (
              <li key={p.slug} className="glow-box relative rounded-lg border p-3 hover:bg-muted/40">
                <Link
                  href={p.href}
                  prefetch={true}
                  className="font-medium after:absolute after:inset-0 after:rounded-lg"
                >
                  {p.title}
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <DifficultyBadge difficulty={p.difficulty} />
                  {p.homePatternName && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      also in {p.homePatternName}
                    </span>
                  )}
                  <StatusLabel status={p.status} />
                  <VideoLabel hasVideo={p.hasVideo} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
