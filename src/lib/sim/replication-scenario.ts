import { buildQuickChecks, validateQuickChecks, type QuickCheck } from "@/lib/quickcheck";
import { estimateDurationInFrames, type Storyboard, type StoryboardInput } from "@/lib/storyboard";
import {
  LAG_LEVELS,
  PROOF_SPIKE,
  vanishedComment,
  type ReadProofRange,
} from "@/lib/traces/system-design/vanished-comment";

import { replicationScenarioSchema, type ReplicationScenario } from "./replication";
import { checkReplay } from "./scenario";

/**
 * "Your scenario" for "I posted a comment and it vanished": the replica's mean lag, a lag spike (on or off), read-your-
 * writes (on or off), and how soon Ana reloads after posting. The replay is built from the simulation and checked like
 * every committed video; the rule is checked over seeds 1–20 at the chosen lag, spike, and reload delay. Loaded only
 * when a learner opens "Your scenario".
 */
export type ReplicationChoices = {
  lagMs: number;
  spike: boolean;
  fix: boolean;
  readAfterMs: number;
  seed: number;
};

export const LAGS = [...LAG_LEVELS];
export const READ_AFTER = [100, 300, 1000];
export const PROOF_SEEDS: [number, number] = [1, 20];

export const DEFAULT_REPLICATION_CHOICES: ReplicationChoices = {
  lagMs: 200,
  spike: true,
  fix: false,
  readAfterMs: 300,
  seed: 7,
};

const LESSON = "replication/vanished-comment";

export function toReplicationScenario(c: ReplicationChoices): ReplicationScenario {
  return replicationScenarioSchema.parse({
    label: "your setup",
    seed: c.seed,
    fix: c.fix ? "read-your-writes" : "none",
    lagMs: c.lagMs,
    spike: c.spike ? PROOF_SPIKE : null,
    readAfterMs: c.readAfterMs,
    follow: { atMs: 3500 },
  });
}

export type ReplicationReplay =
  | {
      ok: true;
      storyboard: Storyboard;
      checks: QuickCheck[];
      input: string;
      summary: { broken: number; runs: number; stale: number; reloads: number; primaryShare: number };
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
  c: ReplicationChoices,
  scenario: ReplicationScenario,
  range: ReadProofRange,
): StoryboardInput {
  const trace = vanishedComment([scenario], range);
  const last = trace.steps.length - 1;
  const setup = `Writes go to the primary and reads to a replica whose mean lag is ${c.lagMs} milliseconds${c.spike ? `, with a ${PROOF_SPIKE.durationMs / 1000}-second lag spike to about ${PROOF_SPIKE.lagMs / 1000} seconds from 3 seconds in` : ""}. Ana posts a comment at 3.5 seconds and reloads ${c.readAfterMs} milliseconds after it's confirmed. Read-your-writes is ${c.fix ? "on" : "off"}. Latencies are illustrative.`;
  const scenes: StoryboardInput["scenes"] = [
    {
      id: "setup",
      caption: caption(
        `Your setup: ${c.lagMs} ms lag${c.spike ? " with a spike" : ""}, read-your-writes ${c.fix ? "on" : "off"}`,
      ),
      narration: setup,
      durationInFrames: estimateDurationInFrames(setup),
      elements: [{ id: "system", type: "system-diagram" }],
    },
  ];
  trace.steps.slice(0, last).forEach((step, i) => {
    if (!step.key) return;
    const base = { id: `s${i}`, caption: caption(step.note), narration: step.note, traceStep: i };
    const durationInFrames = estimateDurationInFrames(step.note);
    const elements: StoryboardInput["scenes"][number]["elements"] =
      step.kind === "ack"
        ? [
            { id: "system", type: "system-diagram" },
            { id: "stores", type: "data-table", show: ["primary", "replica"] },
          ]
        : step.kind === "sweep"
          ? [
              {
                id: "chart",
                type: "load-chart",
                label: "stale, lag in ms",
                labelUnit: "",
                chips: false,
                limitLine: false,
              },
              { id: "metrics", type: "metrics", show: [`lag-${LAG_LEVELS[0]}`, `lag-${LAG_LEVELS.at(-1)}`] },
            ]
          : step.kind === "cost"
            ? [
                {
                  id: "chart",
                  type: "load-chart",
                  label: "primary reads/s",
                  labelUnit: "",
                  chips: false,
                  limitLine: false,
                },
                { id: "metrics", type: "metrics", show: ["writes", "share"] },
              ]
            : [
                { id: "seq", type: "sequence", title: "your setup" },
                {
                  id: "metrics",
                  type: "metrics",
                  show: c.fix ? ["mine", "replica"] : ["primary", "replica"],
                },
              ];
    scenes.push({ ...base, durationInFrames, elements });
  });
  const proof = trace.steps[last].sim!.readProof!;
  scenes.push({
    id: "proof",
    caption: `Seeds ${range.seeds[0]}–${range.seeds[1]}: a user saw the past in ${proof.fixed} of ${proof.runs} runs`,
    narration: trace.steps[last].note,
    traceStep: last,
    durationInFrames: estimateDurationInFrames(trace.steps[last].note),
    elements: [
      { id: "metrics", type: "metrics", show: ["fixed"] },
      {
        id: "answer",
        type: "result",
        title: "Runs where a user saw the past",
        showsAnswer: true,
        detail: `Seeds ${range.seeds[0]}–${range.seeds[1]}, ${c.lagMs} ms lag${c.spike ? " + spike" : ""}, reload ${c.readAfterMs} ms`,
        tone: proof.fixed === 0 ? "success" : "info",
      },
    ],
  });
  return {
    id: "vanished-comment-your-scenario",
    title: "Your scenario",
    concept: "Replication",
    category: "system-design",
    summary:
      "The learner's own replication lag, lag spike, read-your-writes, and reload delay, simulated and replayed.",
    exampleSource: "problem-native",
    takeaway: {
      pattern: "Read-your-writes",
      summary: "Read from the replica only once it has the session's last confirmed write.",
      timeComplexity: "One version comparison per read",
      spaceComplexity: "One version per session",
      whenToUse: [],
    },
    trace: { problem: LESSON, args: [[scenario], range] },
    scenes,
  };
}

export function encodeReplication(c: ReplicationChoices): string {
  return btoa(JSON.stringify(c)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function buildReplicationReplay(c: ReplicationChoices): ReplicationReplay {
  let scenario: ReplicationScenario;
  try {
    scenario = toReplicationScenario(c);
  } catch {
    return { ok: false, message: "These settings can't be simulated." };
  }
  const range: ReadProofRange = {
    seeds: PROOF_SEEDS,
    lags: [c.lagMs],
    spikes: [c.spike],
    readAfter: [c.readAfterMs],
  };
  const checked = checkReplay(storyboardFor(c, scenario, range));
  if (!checked.storyboard) {
    if (typeof console !== "undefined") console.warn("[scenario] refused:", checked.problems);
    return { ok: false, message: TOO_BIG };
  }
  const trace = vanishedComment([scenario], range);
  const checks = buildQuickChecks(checked.storyboard, trace);
  const valid = validateQuickChecks(checked.storyboard, trace, checks).length === 0;
  const proof = trace.steps.at(-1)!.sim!.readProof!;
  const sweep = trace.steps.find((s) => s.kind === "sweep")!.sim!.load!.windows;
  const at = sweep[LAG_LEVELS.indexOf(c.lagMs as (typeof LAG_LEVELS)[number])];
  // The share of reads read-your-writes sent to the primary at the chosen lag (0 without it).
  const row = trace.steps
    .find((s) => s.kind === "cost")
    ?.sim?.tables[0]?.rows.find((r) => r.cells[0] === `${c.lagMs} ms`);
  const primaryShare = row ? Number(/(\d+)%/.exec(row.cells[1])?.[1] ?? 0) : 0;
  return {
    ok: true,
    storyboard: checked.storyboard,
    checks: valid ? checks : [],
    input: encodeReplication(c),
    summary: {
      broken: proof.fixed,
      runs: proof.runs,
      stale: at ? at.served : 0,
      reloads: at ? at.offered : 0,
      primaryShare,
    },
  };
}
