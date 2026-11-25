import { buildQuickChecks, validateQuickChecks, type QuickCheck } from "@/lib/quickcheck";
import { estimateDurationInFrames, type Storyboard, type StoryboardInput } from "@/lib/storyboard";
import { slowdownWords, slowServer, type ProofRange } from "@/lib/traces/system-design/slow-server";

import { balancingScenarioSchema, type BalancingScenario } from "./balancing";
import { checkReplay } from "./scenario";

/**
 * "Your scenario" for "One slow server takes everyone down": the routing, how slow server 2 gets, health checks (off,
 * or how often), and the traffic. Both servers always have the same 4 workers: least-outstanding's guarantee (rule 1)
 * depends on it. The replay is built from the simulation and checked like every committed video; rule 1 is checked
 * over seeds 1–20 at the chosen slowdown and traffic. Loaded only when a learner opens "Your scenario".
 */
export type BalancingChoices = {
  policy: BalancingScenario["policy"];
  factor: number;
  /** 0 = no health checks; otherwise how often (ms). */
  healthMs: number;
  rps: number;
  seed: number;
};

export const POLICIES: { value: BalancingScenario["policy"]; label: string }[] = [
  { value: "round-robin", label: "Round robin" },
  { value: "least-outstanding", label: "Least outstanding" },
];
export const FACTORS = [3, 5, 8, 50];
export const HEALTH = [0, 500, 1000, 2000];
export const TRAFFIC = [20, 30, 40];
/** Both servers, always: rule 1's guarantee for least outstanding needs equal servers. */
export const WORKERS = 4;
export const PROOF_SEEDS: [number, number] = [1, 20];

export const DEFAULT_BALANCING_CHOICES: BalancingChoices = {
  policy: "round-robin",
  factor: 8,
  healthMs: 0,
  rps: 40,
  seed: 3,
};

const LESSON = "load-balancing/slow-server";

export function toBalancingScenario(c: BalancingChoices): BalancingScenario {
  return balancingScenarioSchema.parse({
    label: "your setup",
    seed: c.seed,
    policy: c.policy,
    workers: WORKERS,
    serviceMs: 80,
    rps: c.rps,
    degrade: { atMs: 3000, factor: c.factor, recoverAtMs: 9000 },
    health: c.healthMs ? { intervalMs: c.healthMs } : null,
    followAtMs: 3500,
  });
}

export type BalancingReplay =
  | {
      ok: true;
      storyboard: Storyboard;
      checks: QuickCheck[];
      input: string;
      summary: { broken: number; runs: number; worstP99: number; timeouts: number };
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

function storyboardFor(c: BalancingChoices, scenario: BalancingScenario, range: ProofRange): StoryboardInput {
  const trace = slowServer([scenario], range);
  const last = trace.steps.length - 1;
  const routing = c.policy === "round-robin" ? "round robin" : "least-outstanding routing";
  const setup = `Two servers with ${WORKERS} workers each, ${routing}, ${c.healthMs ? `health checks every ${c.healthMs} milliseconds` : "no health checks"}, ${c.rps} requests a second. At 3 seconds server 2 becomes ${slowdownWords(c.factor)}; at 9 seconds it recovers. Latencies are illustrative.`;
  const scenes: StoryboardInput["scenes"] = [
    {
      id: "setup",
      caption: caption(
        `Your setup: ${routing}, ${c.healthMs ? `checks every ${c.healthMs} ms` : "no health checks"}`,
      ),
      narration: setup,
      durationInFrames: estimateDurationInFrames(setup),
      elements: [{ id: "system", type: "system-diagram" }],
    },
  ];
  trace.steps.slice(0, last).forEach((step, i) => {
    if (!step.key && step.kind !== "window") return;
    const sequence = step.kind !== "window";
    scenes.push({
      id: `s${i}`,
      caption: caption(step.note),
      narration: step.note,
      traceStep: i,
      durationInFrames: estimateDurationInFrames(step.note),
      elements: sequence
        ? [
            { id: "seq", type: "sequence", title: "your setup" },
            {
              id: "metrics",
              type: "metrics",
              show:
                step.kind === "healthy" || step.kind === "unhealthy"
                  ? ["health-2", "in-2"]
                  : ["in-1", "in-2"],
            },
          ]
        : [
            { id: "chart", type: "load-chart", limitLine: false, labelUnit: "" },
            { id: "metrics", type: "metrics", show: ["p99", "affected", "broken"] },
          ],
    });
  });
  const proof = trace.steps[last].sim!.ruleProof!;
  scenes.push({
    id: "proof",
    caption: `Rule 1, seeds ${range.seeds[0]}–${range.seeds[1]}, both servers at ${WORKERS} workers: ${proof.fixed} of ${proof.runs} broken`,
    narration: trace.steps[last].note,
    traceStep: last,
    durationInFrames: estimateDurationInFrames(trace.steps[last].note),
    elements: [
      { id: "metrics", type: "metrics", show: ["fixed"] },
      {
        id: "answer",
        type: "result",
        title: "Rule 1 broken with your setup",
        showsAnswer: true,
        detail: `Seeds ${range.seeds[0]}–${range.seeds[1]}, ${slowdownWords(c.factor)}, ${c.rps} req/s`,
        tone: proof.fixed === 0 ? "success" : "info",
      },
    ],
  });
  return {
    id: "slow-server-your-scenario",
    title: "Your scenario",
    concept: "Load balancing",
    category: "system-design",
    summary: "The learner's own routing, slowdown, health checks, and traffic, simulated and replayed.",
    exampleSource: "problem-native",
    takeaway: {
      pattern: "Least-outstanding routing + health checks",
      summary: "Route by load and take a server that can't answer out of rotation.",
      timeComplexity: "One comparison per request",
      spaceComplexity: "One count and one health state per server",
      whenToUse: [],
    },
    trace: { problem: LESSON, args: [[scenario], range] },
    scenes,
  };
}

export function encodeBalancing(c: BalancingChoices): string {
  return btoa(JSON.stringify(c)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function buildBalancingReplay(c: BalancingChoices): BalancingReplay {
  let scenario: BalancingScenario;
  try {
    scenario = toBalancingScenario(c);
  } catch {
    return { ok: false, message: "These settings can't be simulated." };
  }
  const range: ProofRange = { seeds: PROOF_SEEDS, factors: [c.factor] };
  const checked = checkReplay(storyboardFor(c, scenario, range));
  if (!checked.storyboard) {
    if (typeof console !== "undefined") console.warn("[scenario] refused:", checked.problems);
    return { ok: false, message: TOO_BIG };
  }
  const trace = slowServer([scenario], range);
  const checks = buildQuickChecks(checked.storyboard, trace);
  const valid = validateQuickChecks(checked.storyboard, trace, checks).length === 0;
  const proof = trace.steps.at(-1)!.sim!.ruleProof!;
  const windows = trace.steps.at(-1)!.sim!.load!.windows;
  return {
    ok: true,
    storyboard: checked.storyboard,
    checks: valid ? checks : [],
    input: encodeBalancing(c),
    summary: {
      broken: proof.fixed,
      runs: proof.runs,
      worstP99: Math.max(...windows.map((w) => w.p99)),
      timeouts: windows.reduce((n, w) => n + w.errors, 0),
    },
  };
}
