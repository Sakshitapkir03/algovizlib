import type { ProgressRecords } from "./records";

/**
 * Lists for /me and the landing page: what to continue (a saved video position first, newest first, then problems
 * marked Learning), and what was finished recently.
 */
export type ContinueItem = { key: string; seconds?: number; updatedAt: number };

export function continueList(
  records: ProgressRecords,
  known: (key: string) => boolean,
  limit = 6,
): ContinueItem[] {
  const withPosition: ContinueItem[] = [];
  const learning: ContinueItem[] = [];
  for (const [key, r] of Object.entries(records)) {
    if (!known(key) || r.status === "done") continue;
    if (r.position) withPosition.push({ key, seconds: r.position.seconds, updatedAt: r.position.updatedAt });
    else if (r.status === "learning") learning.push({ key, updatedAt: r.updatedAt });
  }
  const newest = (a: ContinueItem, b: ContinueItem) => b.updatedAt - a.updatedAt;
  return [...withPosition.sort(newest), ...learning.sort(newest)].slice(0, limit);
}

export function recentlyDone(records: ProgressRecords, known: (key: string) => boolean, limit = 8) {
  return Object.entries(records)
    .filter(([key, r]) => known(key) && r.status === "done")
    .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(([key, r]) => ({ key, updatedAt: r.updatedAt }));
}

/** "#resume" on a problem link opens its video at the saved point. */
export const RESUME_HASH = "#resume";
