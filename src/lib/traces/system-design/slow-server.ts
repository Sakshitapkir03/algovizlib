import { z } from "zod";

import {
  balancingScenarioSchema,
  simulateBalancing,
  type BalancingEvent,
  type BalancingScenario,
  type BalancingScenarioInput,
  type ServerSnapshot,
} from "@/lib/sim/balancing";
import { capacityTopology, formatMs, rps } from "@/lib/sim/capacity";

import type { Trace, TraceDefinition, TraceLoadWindow, TraceSim, TraceSimRow, TraceStep } from "../types";

/**
 * "One slow server takes everyone down" as a trace: each scenario is a replay of the same incident (server 2 slows
 * down, later recovers) with its routing and health checks; its steps interleave the followed requests' events, the
 * health checks, and the measured windows, in time order. The last step checks rule 1 over the stated range (seeds ×
 * slowdowns at the replays' traffic and workers) with the first replay's setup and with the last's.
 */
export const proofRangeSchema = z.object({
  seeds: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  factors: z.array(z.number().int().min(2).max(50)).min(1).max(6),
});
export type ProofRange = z.infer<typeof proofRangeSchema>;

const args = z.tuple([z.array(balancingScenarioSchema).min(1).max(3), proofRangeSchema]);

/** A row before it's numbered (each kind of row without its id). */
type RowInput = TraceSimRow extends infer R ? (R extends TraceSimRow ? Omit<R, "id"> : never) : never;

const NAME: Record<string, string> = { "server-1": "Server 1", "server-2": "Server 2" };
const POLICY: Record<BalancingScenario["policy"], string> = {
  "round-robin": "round robin",
  "least-outstanding": "least outstanding",
};

/** "6× slower", or "hanging" for the 50× stand-in. */
export const slowdownWords = (factor: number) => (factor >= 50 ? "hanging" : `${factor}× slower`);

/** Rule 1 over the range for one setup: how many runs broke it (and, for the record, routed to an unhealthy server). */
export function ruleRuns(setup: BalancingScenario, range: ProofRange) {
  let broken = 0;
  let runs = 0;
  let unhealthyRoutes = 0;
  for (let seed = range.seeds[0]; seed <= range.seeds[1]; seed++)
    for (const factor of range.factors) {
      runs++;
      const r = simulateBalancing(
        { ...setup, seed, degrade: { ...setup.degrade, factor }, followAtMs: undefined },
        { record: false },
      );
      if (r.violations.length > 0) broken++;
      unhealthyRoutes += r.unhealthyRoutes;
    }
  return { runs, broken, unhealthyRoutes };
}

export function slowServer(input: BalancingScenarioInput[], range: ProofRange): Trace {
  const scenarios = input.map((s) => balancingScenarioSchema.parse(s));
  const system = capacityTopology(2);
  const steps: TraceStep[] = [];
  const chart: TraceLoadWindow[] = [];
  const windowLabel = (s: BalancingScenario, k: number) =>
    `${(k * s.windowMs) / 1000}–${((k + 1) * s.windowMs) / 1000}s`;

  scenarios.forEach((s, run) => {
    const result = simulateBalancing(s);
    const rows: TraceSimRow[] = [];
    let rowSeq = 0;
    let broken = 0;
    let degradedNow = 1;
    const health = new Map<string, boolean>([
      ["server-1", true],
      ["server-2", true],
    ]);
    const addRow = (row: RowInput) => {
      const id = `r${++rowSeq}`;
      rows.push({ ...row, id } as TraceSimRow);
      return id;
    };
    const tables = (servers: ServerSnapshot[]): TraceSim["tables"] => [
      {
        id: "servers",
        title: "Servers",
        columns: ["server", "load"],
        rows: servers.map((v) => ({ cells: [NAME[v.id], `${v.busy}/${s.workers} · queue ${v.queue}`] })),
      },
      {
        id: "outstanding",
        title: "In progress",
        columns: ["server", "requests"],
        rows: servers.map((v) => ({ cells: [NAME[v.id], `${v.outstanding} in progress`] })),
      },
      {
        id: "health",
        title: "Health",
        columns: ["server", "state"],
        rows: servers.map((v) => ({ cells: [NAME[v.id], health.get(v.id) ? "✓ healthy" : "✕ unhealthy"] })),
      },
    ];
    const nodes = (servers: ServerSnapshot[]): TraceSim["nodes"] => [
      { id: "client", state: "idle", badge: `${s.rps} req/s` },
      { id: "lb", state: "idle", badge: POLICY[s.policy] },
      ...servers.map((v) => ({
        id: v.id,
        state: (!health.get(v.id) ? "waiting" : v.queue > 0 ? "busy" : "idle") as "busy" | "waiting" | "idle",
        badge: !health.get(v.id)
          ? "✕ unhealthy"
          : v.factor > 1
            ? slowdownWords(v.factor)
            : `${v.busy}/${s.workers} busy`,
      })),
      { id: "db", state: "idle" },
    ];
    const metrics = (servers: ServerSnapshot[]): TraceSim["metrics"] => [
      ...servers.map((v, k) => ({
        id: `in-${k + 1}`,
        label: `S${k + 1} in progress`,
        value: String(v.outstanding),
      })),
      { id: "health-2", label: "S2 health", value: health.get("server-2") ? "✓ healthy" : "✕ unhealthy" },
      { id: "slowdown", label: "server 2", value: degradedNow > 1 ? slowdownWords(degradedNow) : "normal" },
      { id: "broken", label: "rule breaks", value: String(broken) },
    ];
    const push = (
      step: Omit<TraceStep, "pointers" | "sim">,
      t: number,
      servers: ServerSnapshot[],
      extra: Partial<TraceSim> = {},
    ) => {
      steps.push({
        ...step,
        pointers: {},
        sim: {
          run,
          runLabel: s.label,
          t,
          nodes: nodes(servers),
          tokens: [],
          rows: rows.map((r) => ({ ...r })),
          tables: tables(servers),
          metrics: metrics(servers),
          violations: broken ? ["a request waited while the other server had a free worker"] : [],
          health: [...health].map(([id, healthy]) => ({ id, healthy })),
          load: { windows: chart.map((c) => ({ ...c })) },
          ...extra,
        },
      });
    };

    // Interleave events and window closes, in time order (a window closes once its requests had the full timeout).
    type Item = { t: number; event?: BalancingEvent; window?: number };
    const items: Item[] = [
      ...result.events.map((event) => ({ t: event.t, event })),
      ...result.windows.map((w) => ({ t: (w.index + 1) * s.windowMs + s.clientTimeoutMs, window: w.index })),
    ].sort((a, b) => a.t - b.t);
    let firstViolationShown = false;
    const secondFollowed = result.events.filter((x) => x.kind === "route")[1]?.request;
    let sawUnhealthy = false;

    for (const item of items) {
      if (item.window !== undefined) {
        const w = result.windows[item.window];
        broken = result.violations.filter((v) => v.t < item.t).length;
        chart.push({
          label: windowLabel(s, w.index),
          group: s.label,
          offered: w.offered,
          served: rps(w.served),
          p95: w.p95,
          p99: w.p99,
          errors: w.timeouts + w.rejected,
          saturated: w.saturated,
          utilization: w.servers.map((v) => ({ id: v.id, value: Math.round(v.utilization * 100) / 100 })),
        });
        const degradedWindow = w.servers.some((v) => v.factor > 1);
        // The beats: round robin's first degraded window (the damage), and the fix's first window after the slow
        // server was taken out (the result).
        const key =
          (run === 0 && degradedWindow && item.window === 1) ||
          (run > 0 && sawUnhealthy && item.window === 2);
        const s1 = w.servers[0];
        steps.push({
          kind: "window",
          key,
          pointers: {},
          note: `From ${windowLabel(s, w.index).replace("–", " to ").replace("s", " seconds")}: p99 ${formatMs(w.p99)}, ${w.timeouts} timeouts, ${w.affected}% of requests slower than ${formatMs(s.sloMs)} or timed out, ${w.violations} waited while the other server had a free worker; server 1 was ${Math.round(s1.utilization * 100)}% busy.`,
          sim: {
            run,
            runLabel: s.label,
            t: item.t,
            nodes: nodes(w.servers),
            tokens: [],
            rows: rows.map((r) => ({ ...r })),
            tables: tables(w.servers),
            metrics: [
              { id: "p99", label: "p99", value: formatMs(w.p99) },
              { id: "timeouts", label: "timeouts", value: String(w.timeouts) },
              { id: "affected", label: "affected", value: `${w.affected}%` },
              { id: "broken", label: "rule breaks", value: String(w.violations) },
            ],
            violations: w.violations ? ["a request waited while the other server had a free worker"] : [],
            health: [...health].map(([id, healthy]) => ({ id, healthy })),
            load: { windows: chart.map((c) => ({ ...c })), current: chart.length - 1 },
          },
        });
        continue;
      }
      const e = item.event!;
      switch (e.kind) {
        case "degrade": {
          degradedNow = e.factor;
          const current = addRow({
            kind: "note",
            lane: e.server,
            text: `⚠ ${slowdownWords(e.factor)}`,
            at: e.t,
            tone: "negative",
          });
          const servers = e.servers.map((v) => (v.id === e.server ? { ...v, factor: e.factor } : v));
          push(
            {
              kind: "degrade",
              key: false,
              note: `At ${e.t} ms ${NAME[e.server]}'s work starts taking ${e.factor >= 50 ? "so long it's effectively hanging" : `${e.factor} times longer`}.`,
            },
            e.t,
            servers,
            { current },
          );
          break;
        }
        case "route": {
          addRow({
            kind: "message",
            from: "client",
            to: "lb",
            label: e.request,
            at: e.t,
            status: "delivered",
          });
          const current = addRow({
            kind: "message",
            from: "lb",
            to: e.to,
            label: e.request,
            at: e.t,
            status: "delivered",
          });
          const outstanding = e.servers.map((v) => ({ id: v.id, n: v.outstanding }));
          const why =
            s.policy === "round-robin"
              ? `round robin sends it to ${NAME[e.to]}, whose turn it is`
              : `least outstanding sends it to ${NAME[e.to]}, which has ${outstanding.find((o) => o.id === e.to)!.n} in progress against ${outstanding
                  .filter((o) => o.id !== e.to)
                  .map((o) => o.n)
                  .join(", ")}`;
          push(
            // The second followed request is the beat: the first sets up the turn (and its outcome to compare with).
            {
              kind: "route",
              key: e.request === secondFollowed,
              note: `${e.request} arrives at the balancer: ${why}.`,
            },
            e.t,
            e.servers,
            { current, route: { request: e.request, policy: s.policy, outstanding, chosen: e.to } },
          );
          break;
        }
        case "queued": {
          const current = addRow({
            kind: "note",
            lane: e.at,
            text: `${e.request} waits behind ${e.ahead}`,
            at: e.t,
            tone: e.violation ? "negative" : "neutral",
          });
          if (e.violation) broken++;
          const key = e.violation && !firstViolationShown;
          if (key) firstViolationShown = true;
          // What the balancer saw when it routed this request: the other server's free workers then.
          const routed = result.events.find((x) => x.kind === "route" && x.request === e.request);
          const other = (routed ?? e).servers.find((v) => v.id !== e.at)!;
          const freeThen = s.workers - other.outstanding;
          push(
            {
              kind: e.violation ? "violation" : "queued",
              key,
              note: e.violation
                ? `${e.request} has to wait behind ${e.ahead} requests on ${NAME[e.at]}: when it was routed, ${NAME[other.id]} had ${freeThen} free ${freeThen === 1 ? "worker" : "workers"}, so rule 1 is broken.`
                : `${e.request} waits behind ${e.ahead} requests on ${NAME[e.at]}.`,
            },
            e.t,
            e.servers,
            { current },
          );
          break;
        }
        case "done": {
          const current = addRow({
            kind: "message",
            from: e.at,
            to: "lb",
            label: `done ${formatMs(e.latency)}`,
            at: e.t,
            status: e.late ? "ignored" : "delivered",
          });
          push(
            {
              kind: "done",
              key: false,
              note: e.late
                ? `${NAME[e.at]} finishes ${e.request} after ${formatMs(e.latency)}, too late: the client had already given up.`
                : `${NAME[e.at]} finishes ${e.request} in ${formatMs(e.latency)}.`,
            },
            e.t,
            e.servers,
            { current },
          );
          break;
        }
        case "timeout": {
          const current = addRow({
            kind: "note",
            lane: "client",
            text: `⏱ ${e.request} timed out`,
            at: e.t,
            tone: "negative",
          });
          push(
            {
              kind: "timeout",
              key: false,
              note: `The client gives up on ${e.request} after ${formatMs(s.clientTimeoutMs)}.`,
            },
            e.t,
            e.servers,
            { current },
          );
          break;
        }
        case "probe": {
          // Only the checks that change something: failures while healthy, passes while unhealthy.
          const relevant = (!e.ok && health.get(e.server)) || (e.ok && !health.get(e.server));
          if (!relevant) break;
          const current = addRow({
            kind: "note",
            lane: "lb",
            text: `${e.ok ? "✓" : "✕"} check ${NAME[e.server]} (${e.streak})`,
            at: e.t,
            tone: e.ok ? "positive" : "negative",
          });
          push(
            {
              kind: "probe",
              key: false,
              note: `The health check on ${NAME[e.server]} ${e.ok ? "passes" : `doesn't answer within ${s.health?.timeoutMs} ms`} (${e.streak} in a row).`,
            },
            e.t,
            e.servers,
            { current },
          );
          break;
        }
        case "health": {
          health.set(e.server, e.healthy);
          if (!e.healthy) sawUnhealthy = true;
          const current = addRow({
            kind: "note",
            lane: "lb",
            text: e.healthy ? `${NAME[e.server]} ✓ healthy` : `${NAME[e.server]} ✕ unhealthy`,
            at: e.t,
            tone: e.healthy ? "positive" : "negative",
          });
          push(
            {
              kind: e.healthy ? "healthy" : "unhealthy",
              key: true,
              note: e.healthy
                ? `${NAME[e.server]} passes ${s.health?.healthyAfter} checks in a row: the balancer marks it healthy and sends it requests again.`
                : `${NAME[e.server]} fails ${s.health?.unhealthyAfter} checks in a row: the balancer marks it unhealthy and stops sending it requests.`,
            },
            e.t,
            e.servers,
            { current },
          );
          break;
        }
        case "recover": {
          degradedNow = 1;
          const current = addRow({
            kind: "note",
            lane: e.server,
            text: "✓ back to normal",
            at: e.t,
            tone: "positive",
          });
          push(
            { kind: "recover", key: false, note: `At ${e.t} ms ${NAME[e.server]} is back to normal speed.` },
            e.t,
            e.servers.map((v) => (v.id === e.server ? { ...v, factor: 1 } : v)),
            { current },
          );
          break;
        }
      }
    }
  });

  // The proof: rule 1 over the stated range with the first replay's setup and with the last's.
  const first = scenarios[0];
  const fix = scenarios.at(-1)!;
  const baseline = ruleRuns(first, range);
  const fixed = ruleRuns(fix, range);
  const factors = range.factors.map(slowdownWords).join(", ");
  const last = steps.at(-1)!.sim!;
  steps.push({
    kind: "proof",
    key: true,
    pointers: {},
    note: `Over seeds ${range.seeds[0]}–${range.seeds[1]} and slowdowns ${factors} at ${first.rps} requests a second, with both servers at ${first.workers} workers: ${first.label} broke rule 1 in ${baseline.broken} of ${baseline.runs} runs; ${fix.label} in ${fixed.broken} of ${fixed.runs}${fixed.unhealthyRoutes === 0 ? ", and never sent a request to a server marked unhealthy" : ""}. The guarantee needs both servers to have the same number of workers.`,
    sim: {
      ...last,
      run: scenarios.length,
      runLabel: "every seed and slowdown",
      nodes: system.nodes.map((n) => ({ id: n.id, state: "idle" as const })),
      rows: [],
      current: undefined,
      metrics: [
        { id: "baseline", label: first.label, value: `${baseline.broken} of ${baseline.runs}` },
        { id: "fixed", label: fix.label, value: `${fixed.broken} of ${fixed.runs}` },
      ],
      violations: [],
      load: { windows: chart.map((c) => ({ ...c })) },
      ruleProof: {
        runs: fixed.runs,
        seeds: range.seeds,
        factors: range.factors,
        rps: first.rps,
        workers: first.workers,
        baseline: baseline.broken,
        fixed: fixed.broken,
      },
    },
  });
  delete steps.at(-1)!.sim!.current;
  delete steps.at(-1)!.sim!.route;

  return {
    problem: "load-balancing/slow-server",
    row: { values: system.nodes.map((n) => n.label), display: "system" },
    system,
    pointerNames: [],
    steps,
    answer: { baseline: baseline.broken, fixed: fixed.broken, runs: fixed.runs },
    answerDisplay: `${fixed.broken} of ${fixed.runs}`,
  };
}

export const slowServerTrace: TraceDefinition<z.infer<typeof args>> = {
  problem: "load-balancing/slow-server",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args,
  run: slowServer,
};
