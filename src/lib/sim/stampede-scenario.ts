import { buildQuickChecks, validateQuickChecks, type QuickCheck } from "@/lib/quickcheck";
import { estimateDurationInFrames, type Storyboard, type StoryboardInput } from "@/lib/storyboard";
import { stampede, SWEEP_JITTER, type StampedeRange } from "@/lib/traces/system-design/stampede";

import { simulateStampede, stampedeScenarioSchema, type StampedeScenario } from "./stampede";
import { checkReplay } from "./scenario";

/**
 * "Your scenario" for "Everything fell over when the cache expired": traffic, single-flight on or off, jittered TTLs
 * on or off, and how many keys the deploy fills. The replay is built from the simulation and checked like every
 * committed video; the rules are checked over seeds 1–10 at the chosen traffic and key count. Loaded only when a
 * learner opens "Your scenario".
 */
export type StampedeChoices = {
  rps: number;
  singleFlight: boolean;
  jitter: boolean;
  keys: number;
  seed: number;
};

export const RATES = [200, 500, 1000];
export const KEY_COUNTS = [1, 4, 16, 32];
export const PROOF_SEEDS: [number, number] = [1, 10];

export const DEFAULT_STAMPEDE_CHOICES: StampedeChoices = {
  rps: 500,
  singleFlight: false,
  jitter: false,
  keys: 4,
  seed: 1,
};

const LESSON = "caching/stampede";

export function toStampedeScenario(c: StampedeChoices): StampedeScenario {
  return stampedeScenarioSchema.parse({
    label: "your setup",
    seed: c.seed,
    singleFlight: c.singleFlight,
    jitter: c.jitter ? SWEEP_JITTER : 0,
    keys: c.keys,
    rps: c.rps,
    // Nothing expires before 8 s, so page views start just before the measured windows.
    trafficFromMs: 7500,
  });
}

export type StampedeReplay =
  | {
      ok: true;
      storyboard: Storyboard;
      checks: QuickCheck[];
      input: string;
      summary: { queries: number; maxQueue: number; failed: number; broken: number; runs: number };
    }
  | { ok: false; message: string };

export const TOO_BIG =
  "This scenario makes a replay that can't be shown clearly on a small screen. Try other settings.";

function caption(note: string): string {
  const first = note.split(/(?<=[.:])\s/)[0].replace(/[.:]$/, "");
  if (first.length <= 80) return first;
  const cut = first.slice(0, 79);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function storyboardFor(
  c: StampedeChoices,
  scenario: StampedeScenario,
  range: StampedeRange,
): StoryboardInput {
  const trace = stampede([scenario], range);
  const last = trace.steps.length - 1;
  const setup = `${c.keys === 1 ? "One cached entry" : `${c.keys} cached entries`}, filled by a deploy with ${c.jitter ? "TTLs jittered within 20 percent of" : "the same"} 10 seconds, ${c.rps} page views a second, and a database with 8 workers. Single-flight is ${c.singleFlight ? "on" : "off"}. Query times are illustrative.`;
  const scenes: StoryboardInput["scenes"] = [
    {
      id: "setup",
      caption: caption(
        `Your setup: ${c.keys} ${c.keys === 1 ? "key" : "keys"}, ${c.rps}/s, single-flight ${c.singleFlight ? "on" : "off"}, jitter ${c.jitter ? "on" : "off"}`,
      ),
      narration: setup,
      durationInFrames: estimateDurationInFrames(setup),
      elements: [{ id: "system", type: "system-diagram" }],
    },
  ];
  trace.steps.slice(0, last).forEach((step, i) => {
    if (!step.key) return;
    const elements: StoryboardInput["scenes"][number]["elements"] =
      step.kind === "window"
        ? [
            { id: "chart", type: "load-chart", label: "pages / s", labelUnit: "s", limitLine: false },
            { id: "metrics", type: "metrics", show: ["queries", "peak-queue"] },
          ]
        : step.kind === "keys-sweep"
          ? [
              {
                id: "chart",
                type: "load-chart",
                label: "queue at most",
                labelUnit: "",
                chips: false,
                limitLine: false,
              },
              { id: "metrics", type: "metrics", show: ["same-32", "jitter-32"] },
            ]
          : step.kind === "deploy"
            ? [
                { id: "system", type: "system-diagram" },
                { id: "keys", type: "data-table", show: ["keys"] },
              ]
            : step.kind === "cost"
              ? [
                  { id: "system", type: "system-diagram" },
                  { id: "cost", type: "data-table", show: ["cost"] },
                ]
              : [
                  { id: "seq", type: "sequence", title: "your setup" },
                  { id: "metrics", type: "metrics", show: ["fetches", "queue"] },
                ];
    scenes.push({
      id: `s${i}`,
      caption: caption(step.note),
      narration: step.note,
      traceStep: i,
      durationInFrames: estimateDurationInFrames(step.note),
      elements,
    });
  });
  const proof = trace.steps[last].sim!.stampedeProof!;
  scenes.push({
    id: "proof",
    caption: `Seeds ${range.seeds[0]}–${range.seeds[1]}: your setup broke a rule in ${proof.fixed} of ${proof.runs} runs`,
    narration: trace.steps[last].note,
    traceStep: last,
    durationInFrames: estimateDurationInFrames(trace.steps[last].note),
    elements: [
      { id: "metrics", type: "metrics", show: ["no-fix", "both"] },
      {
        id: "answer",
        type: "result",
        title: "Runs breaking a rule (yours)",
        showsAnswer: true,
        detail: `Seeds ${range.seeds[0]}–${range.seeds[1]}, ${c.rps} pages/s, ${c.keys} ${c.keys === 1 ? "key" : "keys"}`,
        tone: proof.fixed === 0 ? "success" : "info",
      },
    ],
  });
  return {
    id: "stampede-your-scenario",
    title: "Your scenario",
    concept: "Caching",
    category: "system-design",
    summary: "The learner's own traffic, single-flight, jitter, and key count, simulated and replayed.",
    exampleSource: "problem-native",
    takeaway: {
      pattern: "Single-flight + jittered TTLs",
      summary: "One fetch per key per expiry, and keys set together that don't expire together.",
      timeComplexity: "One query per key per expiry",
      spaceComplexity: "One in-flight entry per key being fetched",
      whenToUse: [],
    },
    trace: { problem: LESSON, args: [[scenario], range] },
    scenes,
  };
}

export function encodeStampede(c: StampedeChoices): string {
  return btoa(JSON.stringify(c)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function buildStampedeReplay(c: StampedeChoices): StampedeReplay {
  let scenario: StampedeScenario;
  try {
    scenario = toStampedeScenario(c);
  } catch {
    return { ok: false, message: "These settings can't be simulated." };
  }
  const range: StampedeRange = { seeds: PROOF_SEEDS, rps: [c.rps], keys: [c.keys] };
  const checked = checkReplay(storyboardFor(c, scenario, range));
  if (!checked.storyboard) {
    if (typeof console !== "undefined") console.warn("[scenario] refused:", checked.problems);
    return { ok: false, message: TOO_BIG };
  }
  const trace = stampede([scenario], range);
  const checks = buildQuickChecks(checked.storyboard, trace);
  const valid = validateQuickChecks(checked.storyboard, trace, checks).length === 0;
  const proof = trace.steps.at(-1)!.sim!.stampedeProof!;
  const run = simulateStampede({ ...scenario, record: false });
  return {
    ok: true,
    storyboard: checked.storyboard,
    checks: valid ? checks : [],
    input: encodeStampede(c),
    summary: {
      queries: run.queries,
      maxQueue: run.maxQueue,
      failed: run.timeouts + run.rejected,
      broken: proof.fixed,
      runs: proof.runs,
    },
  };
}
