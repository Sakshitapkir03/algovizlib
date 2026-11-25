import { buildQuickChecks, validateQuickChecks, type QuickCheck } from "@/lib/quickcheck";
import { estimateDurationInFrames, type Storyboard, type StoryboardInput } from "@/lib/storyboard";
import { oneServer } from "@/lib/traces/system-design/one-server";

import { capacityScenarioSchema, type CapacityScenario } from "./capacity";
import { checkReplay } from "./scenario";

/**
 * "Your scenario" for "Is one server enough?": the learner picks the peak traffic, the servers, the workers per
 * server, and the service time; the simulation ramps to the peak in four measured windows, and the replay is built
 * from its steps and checked like every committed video. Loaded only when a learner opens "Your scenario".
 */
export type CapacityChoices = {
  peak: number;
  servers: number;
  workers: number;
  serviceMs: number;
  seed: number;
};

export const PEAKS = [20, 40, 60, 80, 100, 120];
export const WORKERS = [2, 4, 6, 8];
export const SERVICE_TIMES = [40, 80, 120, 160];
export const SERVERS = [1, 2, 3];

export const DEFAULT_CAPACITY_CHOICES: CapacityChoices = {
  peak: 80,
  servers: 1,
  workers: 4,
  serviceMs: 80,
  seed: 11,
};

const LESSON = "estimates/one-server";

export function toCapacityScenario(c: CapacityChoices): CapacityScenario {
  const steps = [1, 2, 3, 4].map((k) => Math.max(5, Math.round((c.peak * k) / 4)));
  return capacityScenarioSchema.parse({
    label: `${c.servers} ${c.servers === 1 ? "server" : "servers"}`,
    seed: c.seed,
    servers: c.servers,
    workers: c.workers,
    serviceMs: c.serviceMs,
    // Shorter windows than the lesson's: the same rates, measured over 5 simulated seconds each.
    windowMs: 5000,
    steps,
  });
}

export type CapacityReplay =
  | {
      ok: true;
      storyboard: Storyboard;
      checks: QuickCheck[];
      input: string;
      summary: { limit: string; capacity: number; saturatedAt?: number };
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

function storyboardFor(c: CapacityChoices, scenario: CapacityScenario): StoryboardInput {
  const trace = oneServer(null, [scenario]);
  const last = trace.steps.length - 1;
  const setup = `${scenario.servers === 1 ? "One server" : `${scenario.servers} servers behind a round-robin balancer`}, each with ${scenario.workers} workers taking about ${scenario.serviceMs} milliseconds per request, so roughly ${Math.round((scenario.servers * scenario.workers * 1000) / scenario.serviceMs)} requests a second in theory. Traffic rises to ${c.peak} a second in four steps. Latencies are illustrative.`;
  const scenes: StoryboardInput["scenes"] = [
    {
      id: "setup",
      caption: caption(
        `Your scenario: ${scenario.label}, ${scenario.workers} workers, ${scenario.serviceMs} ms each`,
      ),
      narration: setup,
      durationInFrames: estimateDurationInFrames(setup),
      elements: [{ id: "system", type: "system-diagram" }],
    },
    ...trace.steps.slice(0, last).map((step, i) => ({
      id: `w${i}`,
      caption: caption(step.note),
      narration: step.note,
      traceStep: i,
      durationInFrames: estimateDurationInFrames(step.note),
      elements: [
        { id: "chart", type: "load-chart" as const },
        {
          id: "metrics",
          type: "metrics" as const,
          // Three fit a phone whatever the values; the offered load is the chart's own label.
          show: step.kind === "saturated" ? ["served", "p99", "queue"] : ["served", "p99", "busy"],
        },
      ],
    })),
    {
      id: "limit",
      caption: caption(trace.steps[last].note),
      narration: trace.steps[last].note,
      traceStep: last,
      durationInFrames: estimateDurationInFrames(trace.steps[last].note),
      elements: [
        { id: "metrics", type: "metrics", show: ["limit-0"] },
        {
          id: "answer",
          type: "result",
          title: "Measured limit",
          showsAnswer: true,
          detail: "Simulated: service times are illustrative",
        },
      ],
    },
  ];
  return {
    id: "one-server-your-scenario",
    title: "Your scenario",
    concept: "Estimates & capacity",
    category: "system-design",
    summary: "The learner's own traffic, servers, workers, and service time, simulated and replayed.",
    exampleSource: "problem-native",
    takeaway: {
      pattern: "Estimate, measure, scale the bottleneck",
      summary: "Measure where it saturates, then scale that part.",
      timeComplexity: "The limit grows with servers × workers ÷ service time",
      spaceComplexity: "One more server and a balancer in front",
      whenToUse: [],
    },
    trace: { problem: LESSON, args: [null, [scenario]] },
    scenes,
  };
}

export function encodeCapacity(c: CapacityChoices): string {
  return btoa(JSON.stringify(c)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function buildCapacityReplay(c: CapacityChoices): CapacityReplay {
  let scenario: CapacityScenario;
  try {
    scenario = toCapacityScenario(c);
  } catch {
    return { ok: false, message: "These settings can't be simulated." };
  }
  const checked = checkReplay(storyboardFor(c, scenario));
  if (!checked.storyboard) {
    if (typeof console !== "undefined") console.warn("[scenario] refused:", checked.problems);
    return { ok: false, message: TOO_BIG };
  }
  const trace = oneServer(null, [scenario]);
  const checks = buildQuickChecks(checked.storyboard, trace);
  const valid = validateQuickChecks(checked.storyboard, trace, checks).length === 0;
  const windows = trace.steps.at(-1)!.sim!.load!.windows;
  const first = windows.find((w) => w.saturated.length > 0);
  return {
    ok: true,
    storyboard: checked.storyboard,
    checks: valid ? checks : [],
    input: encodeCapacity(c),
    summary: {
      limit: trace.answerDisplay,
      capacity: Math.round((scenario.servers * scenario.workers * 1000) / scenario.serviceMs),
      ...(first && { saturatedAt: first.offered }),
    },
  };
}
