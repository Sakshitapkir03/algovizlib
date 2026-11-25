import { z } from "zod";

import {
  capacityScenarioSchema,
  capacityTopology,
  formatMs,
  rps,
  simulateCapacity,
  windowNodes,
  type CapacityScenario,
  type CapacityScenarioInput,
} from "@/lib/sim/capacity";

import type { Trace, TraceDefinition, TraceLoadWindow, TraceStep, TraceSystem } from "../types";

/**
 * "Is one server enough?" as a trace. An optional back-of-envelope estimate (users × requests a day ÷ 86,400 s =
 * the average rate, × a peak factor = the peak), then one replay per scenario, each a ramp of measured windows. The
 * components a later replay adds (a balancer, more servers) are marked `addedAfter` the component the first replay
 * measured saturated, so the validator's growth rule can hold the story to "measure the bottleneck first". The last
 * step sums up each replay's measured limit.
 */
const SECONDS_PER_DAY = 86_400;

export const estimateSchema = z
  .object({
    users: z.number().int().min(100).max(10_000_000),
    requestsPerUser: z.number().int().min(1).max(1000),
    peakFactor: z.number().int().min(1).max(10),
  })
  .refine((e) => (e.users * e.requestsPerUser) % SECONDS_PER_DAY === 0, {
    message: "users × requests a day must divide evenly by 86,400 (the estimate shows exact arithmetic)",
  });
export type Estimate = z.infer<typeof estimateSchema>;

const args = z.tuple([estimateSchema.nullable(), z.array(capacityScenarioSchema).min(1).max(3)]);

const sameTopology = (a: TraceSystem, b: TraceSystem) => JSON.stringify(a) === JSON.stringify(b);

/** The highest throughput a replay sustained while saturated (its measured limit), or undefined if it never saturated. */
export function measuredLimit(
  windows: readonly { served: number; saturated: readonly string[] }[],
): number | undefined {
  const sat = windows.filter((w) => w.saturated.length > 0);
  return sat.length ? Math.max(...sat.map((w) => rps(w.served))) : undefined;
}

export function oneServer(estimate: Estimate | null, input: CapacityScenarioInput[]): Trace {
  const scenarios: CapacityScenario[] = input.map((s) => capacityScenarioSchema.parse(s));
  const steps: TraceStep[] = [];
  let peak: number | undefined;

  if (estimate) {
    const daily = estimate.users * estimate.requestsPerUser;
    const average = daily / SECONDS_PER_DAY;
    peak = average * estimate.peakFactor;
    steps.push(
      {
        kind: "daily",
        key: false,
        pointers: {},
        equation: { terms: [estimate.users, estimate.requestsPerUser], operator: "×", result: daily },
        note: `${estimate.users} users making ${estimate.requestsPerUser} requests each send ${daily} requests a day.`,
      },
      {
        kind: "average",
        key: false,
        pointers: {},
        equation: { terms: [daily, SECONDS_PER_DAY], operator: "÷", result: average },
        note: `Spread over the ${SECONDS_PER_DAY} seconds of a day, that's ${average} requests a second on average.`,
      },
      {
        kind: "peak",
        key: true,
        pointers: {},
        equation: { terms: [average, estimate.peakFactor], operator: "×", result: peak },
        note: `Traffic isn't even: at the busiest hour it's about ${estimate.peakFactor} times the average, ${peak} requests a second.`,
      },
    );
  }

  // The grown system: the largest replay's components. Those the first replay doesn't have are added after the
  // component it measured saturated.
  const most = scenarios.reduce((a, b) => (b.servers > a.servers ? b : a));
  const start = capacityTopology(scenarios[0].servers);
  const grown = capacityTopology(most.servers);
  const runs = scenarios.map((s) => simulateCapacity(s));
  const bottleneck = runs[0].windows.find((w) => w.saturated.length > 0)?.saturated[0] ?? "server-1";
  const startIds = new Set(start.nodes.map((n) => n.id));
  const system: TraceSystem = {
    nodes: grown.nodes.map((n) => (startIds.has(n.id) ? n : { ...n, addedAfter: bottleneck })),
    edges: grown.edges,
  };

  const chart: TraceLoadWindow[] = [];
  const limits: (number | undefined)[] = [];
  scenarios.forEach((s, run) => {
    const topology = capacityTopology(s.servers);
    let firstSaturated = true;
    let atPeak = true;
    runs[run].windows.forEach((w, k) => {
      const server = w.servers[0];
      chart.push({
        label: String(w.offered),
        group: s.label,
        offered: w.offered,
        served: rps(w.served),
        p95: w.p95,
        p99: w.p99,
        errors: w.errors,
        saturated: w.saturated,
        utilization: [
          ...w.servers.map((v) => ({ id: v.id, value: Math.round(v.utilization * 100) / 100 })),
          { id: "db", value: Math.round(w.db.utilization * 100) / 100 },
        ],
      });
      const saturated = w.saturated.length > 0;
      // The beats: where each replay starts, where it first saturates, and (after the first) the estimated peak.
      const key =
        (run === 0 && k === 0) ||
        (saturated && firstSaturated) ||
        (run > 0 && peak !== undefined && w.offered >= peak && atPeak && !saturated);
      if (saturated) firstSaturated = false;
      if (run > 0 && peak !== undefined && w.offered >= peak) atPeak = false;
      const servers = s.servers === 1 ? "the server" : `each of the ${s.servers} servers`;
      const note = saturated
        ? `At ${w.offered} requests a second, ${servers} has all ${s.workers} workers busy and its queue grew to ${server.queueEnd}: it's saturated, serving only ${rps(w.served)} a second, with p99 at ${formatMs(w.p99)}${w.errors ? ` and ${w.errors} requests turned away` : ""}; the database is ${Math.round(w.db.utilization * 100)}% busy.`
        : `At ${w.offered} requests a second, ${servers} is ${Math.round(server.utilization * 100)}% busy and keeps up: ${rps(w.served)} served a second, p99 ${formatMs(w.p99)}.`;
      steps.push({
        kind: saturated ? "saturated" : "window",
        key,
        pointers: {},
        note,
        sim: {
          run,
          runLabel: s.label,
          t: (k + 1) * s.windowMs,
          nodes: windowNodes(s, w),
          tokens: [],
          rows: [],
          tables: [],
          metrics: [
            { id: "offered", label: "offered", value: `${w.offered}/s` },
            { id: "served", label: "served", value: `${rps(w.served)}/s` },
            { id: "p99", label: "p99", value: formatMs(w.p99) },
            { id: "errors", label: "errors", value: String(w.errors) },
            { id: "busy", label: "busy", value: `${server.busy}/${s.workers}` },
            { id: "queue", label: "queue", value: String(server.queueEnd) },
          ],
          violations: [],
          ...(!sameTopology(topology, system) && { topology }),
          load: { windows: chart.map((c) => ({ ...c })), current: chart.length - 1 },
        },
      });
    });
    limits.push(measuredLimit(runs[run].windows));
  });

  const shown = scenarios.map((s, k) =>
    limits[k] !== undefined ? `${limits[k]}` : `≥ ${Math.max(...runs[k].windows.map((w) => rps(w.served)))}`,
  );
  const last = steps.at(-1)!.sim!;
  steps.push({
    kind: "summary",
    key: true,
    pointers: {},
    note: `Measured limits: ${scenarios.map((s, k) => `${s.label} ${shown[k]} requests a second`).join(", ")}${peak !== undefined ? `, against an estimated peak of ${peak}` : ""}.`,
    sim: {
      ...last,
      run: scenarios.length,
      runLabel: "measured limits",
      nodes: system.nodes.map((n) => ({ id: n.id, state: "idle" as const })),
      metrics: [
        ...(peak !== undefined ? [{ id: "peak", label: "peak", value: `${peak}/s` }] : []),
        ...scenarios.map((s, k) => ({ id: `limit-${k}`, label: s.label, value: `${shown[k]}/s` })),
      ],
      topology: undefined,
      load: { windows: chart.map((c) => ({ ...c })) },
    },
  });
  delete steps.at(-1)!.sim!.topology;

  return {
    problem: "estimates/one-server",
    row: { values: system.nodes.map((n) => n.label), display: "system" },
    system,
    ...(!sameTopology(start, system) && { systemStart: start }),
    pointerNames: [],
    steps,
    answer: { limits: shown },
    answerDisplay: `${shown.join(" → ")} req/s`,
  };
}

export const oneServerTrace: TraceDefinition<z.infer<typeof args>> = {
  problem: "estimates/one-server",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args,
  run: oneServer,
};
