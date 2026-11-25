import { buildQuickChecks, validateQuickChecks, type QuickCheck } from "@/lib/quickcheck";
import { estimateDurationInFrames, type Storyboard, type StoryboardInput } from "@/lib/storyboard";
import { stalePrice, type CacheRange } from "@/lib/traces/system-design/stale-price";

import { cacheScenarioSchema, simulateCache, type CacheScenario, type Invalidation } from "./caching";
import { checkReplay } from "./scenario";

/**
 * "Your scenario" for "The price changed but users see the old one": the invalidation (none, delete after write,
 * versioned), the cache's TTL, and how long Ben's page pauses between reading the database and storing the price. The
 * replay is built from the simulation and checked like every committed video; the proof enumerates every interleaving
 * of one writer and one or two readers for each kind of invalidation. Loaded only when a learner opens "Your scenario".
 */
export type CacheChoices = {
  invalidation: Invalidation;
  ttlMs: number;
  stallMs: number;
  seed: number;
};

export const INVALIDATION_CHOICES: { value: Invalidation; label: string }[] = [
  { value: "none", label: "Off: the cache isn't told" },
  { value: "delete", label: "Delete the entry after the write" },
  { value: "versioned", label: "Versioned: delete, keep stores only if not older" },
];
export const TTLS = [5000, 10_000, 30_000];
export const STALLS = [0, 50, 200];

export const DEFAULT_CACHE_CHOICES: CacheChoices = {
  invalidation: "delete",
  ttlMs: 10_000,
  stallMs: 200,
  seed: 1,
};

const LESSON = "caching/stale-price";
const RANGE: CacheRange = { readers: [1, 2] };

export function toCacheScenario(c: CacheChoices): CacheScenario {
  return cacheScenarioSchema.parse({
    label: "your setup",
    seed: c.seed,
    invalidation: c.invalidation,
    ttlMs: c.ttlMs,
    slow: { atMs: 2005, stallMs: c.stallMs },
    // Ana reloads about five times over a TTL, so she sees the new price within the replay.
    follow: { firstReadMs: 300, retryEveryMs: Math.max(2000, Math.round(c.ttlMs / 5)) },
    durationMs: Math.max(30_000, c.ttlMs + 15_000),
  });
}

export type CacheReplay =
  | {
      ok: true;
      storyboard: Storyboard;
      checks: QuickCheck[];
      input: string;
      summary: { staleReads: number; staleForMs: number; violating: number; schedules: number };
    }
  | { ok: false; message: string };

export const TOO_BIG =
  "This scenario makes a replay that can't be shown clearly on a small screen. Try other settings.";

const WORDS: Record<Invalidation, string> = {
  none: "the cache isn't told",
  delete: "the entry is deleted after the write",
  versioned: "versioned invalidation",
};

function caption(note: string): string {
  const first = note.split(/(?<=[.:])\s/)[0].replace(/[.:]$/, "");
  if (first.length <= 80) return first;
  const cut = first.slice(0, 79);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function storyboardFor(c: CacheChoices, scenario: CacheScenario): StoryboardInput {
  const trace = stalePrice([scenario], RANGE);
  const last = trace.steps.length - 1;
  const setup = `The page reads the price through a cache with a ${c.ttlMs / 1000}-second TTL, and ${WORDS[c.invalidation]}. The cached $49 expires at 2 seconds; Ben's page misses and pauses ${c.stallMs} milliseconds before storing what it read; the admin changes the price to $39 at 2.03 seconds. Latencies are illustrative.`;
  const scenes: StoryboardInput["scenes"] = [
    {
      id: "setup",
      caption: caption(
        `Your setup: ${WORDS[c.invalidation]}, TTL ${c.ttlMs / 1000} s, Ben pauses ${c.stallMs} ms`,
      ),
      narration: setup,
      durationInFrames: estimateDurationInFrames(setup),
      elements: [{ id: "system", type: "system-diagram" }],
    },
  ];
  trace.steps.slice(0, last).forEach((step, i) => {
    if (!step.key) return;
    const op = step.sim?.cacheOp?.op;
    scenes.push({
      id: `s${i}`,
      caption: caption(step.note),
      narration: step.note,
      traceStep: i,
      durationInFrames: estimateDurationInFrames(step.note),
      elements:
        step.kind === "cost"
          ? [
              {
                id: "chart",
                type: "load-chart",
                label: "db reads/min",
                labelUnit: "",
                chips: false,
                limitLine: false,
              },
              { id: "metrics", type: "metrics", show: ["extra", "at-max"] },
            ]
          : op === "db-read"
            ? [
                { id: "seq", type: "sequence", title: "your setup" },
                { id: "metrics", type: "metrics", show: ["cache", "db"] },
              ]
            : [
                { id: "system", type: "system-diagram" },
                { id: "tables", type: "data-table", show: ["cache", "db"] },
              ],
    });
  });
  const proof = trace.steps[last].sim!.cacheProof!;
  const mine = proof.cases.filter((x) => x.invalidation === c.invalidation);
  const bad = mine.reduce((t, x) => t + x.violating, 0);
  const all = mine.reduce((t, x) => t + x.schedules, 0);
  scenes.push({
    id: "proof",
    caption: `Every interleaving: ${bad} of ${all} let a later read see the old price`,
    narration: trace.steps[last].note,
    traceStep: last,
    durationInFrames: estimateDurationInFrames(trace.steps[last].note),
    elements: [
      { id: "metrics", type: "metrics", show: [c.invalidation] },
      {
        id: "answer",
        type: "result",
        title: "Stale with versioned invalidation",
        showsAnswer: true,
        detail: "Every interleaving: 1 writer, 1–2 readers, warm and cold",
        tone: "success",
      },
    ],
  });
  return {
    id: "stale-price-your-scenario",
    title: "Your scenario",
    concept: "Caching",
    category: "system-design",
    summary: "The learner's own invalidation, TTL, and slow reader, simulated and replayed.",
    exampleSource: "problem-native",
    takeaway: {
      pattern: "Versioned cache invalidation",
      summary: "Delete on write, leave the version behind, and keep a store only if it isn't older.",
      timeComplexity: "One version comparison per store",
      spaceComplexity: "One version marker per updated key",
      whenToUse: [],
    },
    trace: { problem: LESSON, args: [[scenario], RANGE] },
    scenes,
  };
}

export function encodeCache(c: CacheChoices): string {
  return btoa(JSON.stringify(c)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function buildCacheReplay(c: CacheChoices): CacheReplay {
  let scenario: CacheScenario;
  try {
    scenario = toCacheScenario(c);
  } catch {
    return { ok: false, message: "These settings can't be simulated." };
  }
  const checked = checkReplay(storyboardFor(c, scenario));
  if (!checked.storyboard) {
    if (typeof console !== "undefined") console.warn("[scenario] refused:", checked.problems);
    return { ok: false, message: TOO_BIG };
  }
  const trace = stalePrice([scenario], RANGE);
  const checks = buildQuickChecks(checked.storyboard, trace);
  const valid = validateQuickChecks(checked.storyboard, trace, checks).length === 0;
  const proof = trace.steps.at(-1)!.sim!.cacheProof!.cases.filter((x) => x.invalidation === c.invalidation);
  // The replay's own measure: reads started after the update that saw the old price, and for how long.
  const run = simulateCache(scenario);
  return {
    ok: true,
    storyboard: checked.storyboard,
    checks: valid ? checks : [],
    input: encodeCache(c),
    summary: {
      staleReads: run.stale.length,
      staleForMs: run.staleForMs,
      violating: proof.reduce((t, x) => t + x.violating, 0),
      schedules: proof.reduce((t, x) => t + x.schedules, 0),
    },
  };
}
