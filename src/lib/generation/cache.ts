import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { StoryboardSource } from "@/lib/storyboard";
import type { Trace } from "@/lib/traces";

/** What makes a cached result reusable: same problem, same prompt version, same trace (args and every step). */
export type CacheKey = { problem: string; promptVersion: string; traceHash: string };

export type CacheEntry = {
  key: CacheKey;
  savedAt: string;
  /** The validated storyboard, in source form (exactly what would be written to the repo). */
  storyboard: StoryboardSource;
};

export interface GenerationCache {
  read(problem: string): CacheEntry | undefined;
  write(entry: CacheEntry): void;
}

export function hashTrace(args: unknown[], trace: Trace): string {
  return createHash("sha256").update(JSON.stringify({ args, trace })).digest("hex").slice(0, 16);
}

export function sameKey(a: CacheKey, b: CacheKey): boolean {
  return a.problem === b.problem && a.promptVersion === b.promptVersion && a.traceHash === b.traceHash;
}

/** One JSON file per problem under `.cache/generation/<pattern>/<slug>.json` (gitignored). */
export function createFileCache(root: string): GenerationCache {
  const fileFor = (problem: string) => path.join(root, `${problem}.json`);
  return {
    read(problem) {
      try {
        return JSON.parse(readFileSync(fileFor(problem), "utf8")) as CacheEntry;
      } catch {
        return undefined;
      }
    },
    write(entry) {
      const file = fileFor(entry.key.problem);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, `${JSON.stringify(entry, null, 2)}\n`);
    },
  };
}
