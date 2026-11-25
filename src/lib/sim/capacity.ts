import { z } from "zod";

import type { TraceSim, TraceSystem } from "@/lib/traces/types";

import { EventLoop } from "./events";
import { streams } from "./random";

/**
 * "Is one server enough?": clients send requests at a rate that rises in steps (one measured window per step); a
 * round-robin load balancer (when there's more than one server) spreads them over app servers, each a pool of workers
 * with a bounded queue (a request that finds it full is turned away: an error); each request holds its worker for
 * its service time, part of which is a query on a shared database (a pool of connections, with its own queue).
 *
 * Every window is measured over simulated time: offered and served requests per second, latency percentiles (of the
 * requests that finished in the window), errors, and each component's utilization (time-averaged busy workers or
 * connections over capacity) and queue. A component is saturated in a window when its utilization is at least 95%
 * and its queue grew, or it turned requests away. Latencies are illustrative (chosen service times, not
 * measurements of real hardware), and nothing here models the network beyond a millisecond per hop.
 */

export const capacityScenarioSchema = z.object({
  /** What this replay is called on screen ("one server", "two servers"). */
  label: z.string().trim().min(1).max(20),
  seed: z.number().int().min(0).max(999_999),
  servers: z.number().int().min(1).max(3),
  /** Workers per server: requests one server handles at the same time. */
  workers: z.number().int().min(1).max(8),
  /** Mean service time per request (each one takes 75–125% of it), including its database query. */
  serviceMs: z.number().int().min(40).max(200),
  dbQueryMs: z.number().int().min(2).max(40).default(10),
  dbConnections: z.number().int().min(1).max(50).default(20),
  /** Requests a server holds waiting for a worker; one more is turned away. */
  queueLimit: z.number().int().min(5).max(200).default(100),
  windowMs: z.number().int().min(2000).max(20_000).default(10_000),
  /** The offered load of each window, in requests per second. */
  steps: z.array(z.number().int().min(5).max(300)).min(1).max(6),
});
export type CapacityScenario = z.infer<typeof capacityScenarioSchema>;
export type CapacityScenarioInput = z.input<typeof capacityScenarioSchema>;

/** Utilization (busy over capacity, time-averaged) at or above this, with a growing queue or errors, is saturation. */
export const SATURATION_UTILIZATION = 0.95;
const QUEUE_GROWTH = 5;

/** Where each component sits on the diagram's grid (the same spot whatever the topology, so growth doesn't jump). */
const SPOTS: Record<string, { x: number; y: number }> = {
  client: { x: 0, y: 0 },
  lb: { x: 1, y: 0 },
  "server-1": { x: 2, y: 0 },
  "server-2": { x: 2, y: 1 },
  "server-3": { x: 2, y: 2 },
  db: { x: 3, y: 0 },
};

/** The components and links for `servers` app servers (a load balancer in front when there's more than one). */
export function capacityTopology(servers: number): TraceSystem {
  const ids = Array.from({ length: servers }, (_, k) => `server-${k + 1}`);
  const nodes: TraceSystem["nodes"] = [
    { id: "client", label: "Clients", kind: "client", ...SPOTS.client },
    ...(servers > 1 ? [{ id: "lb", label: "Balancer", kind: "server" as const, ...SPOTS.lb }] : []),
    ...ids.map((id, k) => ({ id, label: `Server ${k + 1}`, kind: "server" as const, ...SPOTS[id] })),
    { id: "db", label: "Database", kind: "store", ...SPOTS.db },
  ];
  const edges: TraceSystem["edges"] = [
    ...(servers > 1
      ? [{ from: "client", to: "lb" }, ...ids.map((to) => ({ from: "lb", to }))]
      : [{ from: "client", to: ids[0] }]),
    ...ids.map((from) => ({ from, to: "db" })),
  ];
  return { nodes, edges };
}

export type CapacityWindow = {
  index: number;
  offered: number;
  /** Requests finished in the window, per second. */
  served: number;
  p50: number;
  p95: number;
  p99: number;
  /** Mean latency of the requests finished in the window (ms). */
  meanLatency: number;
  /** Requests turned away (their arrival was in the window). */
  errors: number;
  arrivals: number;
  completions: number;
  /** Time-averaged requests in the system (in service or waiting): Little's law's L. */
  inSystem: number;
  /** Per server: utilization, busy workers and queue at the window's end, the queue at its start, errors. */
  servers: {
    id: string;
    utilization: number;
    busy: number;
    queueStart: number;
    queueEnd: number;
    errors: number;
  }[];
  db: { utilization: number; busy: number; queueStart: number; queueEnd: number };
  saturated: string[];
};

export type CapacityRun = { windows: CapacityWindow[]; capacity: number };

type Req = { arrive: number; window: number };
type Server = {
  id: string;
  busy: number;
  queue: Req[];
  busyArea: number;
  errors: number;
};

/** A percentile of sorted values (nearest rank). */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

/** Run one scenario's ramp; one measured window per step. */
export function simulateCapacity(input: CapacityScenarioInput): CapacityRun {
  const s = capacityScenarioSchema.parse(input);
  const total = s.steps.length * s.windowMs;
  const loop = new EventLoop(total, 400_000);
  const rng = streams(s.seed);
  const servers: Server[] = Array.from({ length: s.servers }, (_, k) => ({
    id: `server-${k + 1}`,
    busy: 0,
    queue: [],
    busyArea: 0,
    errors: 0,
  }));
  const db = { busy: 0, queue: [] as (() => void)[], busyArea: 0 };
  let rr = 0;
  let inSystem = 0;
  let inSystemArea = 0;
  let last = 0;
  let latencies: number[] = [];
  let arrivals = 0;
  let errors = 0;
  const windows: CapacityWindow[] = [];
  const queueStart = new Map<string, number>(servers.map((sv) => [sv.id, 0]));
  let dbQueueStart = 0;

  /** Integrate every time-weighted quantity up to now. */
  const advance = () => {
    const dt = loop.now - last;
    if (dt <= 0) return;
    for (const sv of servers) sv.busyArea += sv.busy * dt;
    db.busyArea += db.busy * dt;
    inSystemArea += inSystem * dt;
    last = loop.now;
  };

  const windowOf = (t: number) => Math.min(s.steps.length - 1, Math.floor(t / s.windowMs));

  function arrive() {
    advance();
    const req: Req = { arrive: loop.now, window: windowOf(loop.now) };
    arrivals++;
    // Through the balancer (a millisecond) when there's more than one server.
    const target = servers[rr % servers.length];
    rr++;
    loop.after(servers.length > 1 ? 1 : 0, () => toServer(target, req));
    scheduleArrival();
  }

  function scheduleArrival() {
    const rate = s.steps[windowOf(loop.now)];
    const gap = Math.max(0, Math.round((-Math.log(1 - rng("arrivals")()) / rate) * 1000));
    if (loop.now + gap < total) loop.after(gap, arrive);
  }

  function toServer(sv: Server, req: Req) {
    advance();
    if (sv.busy < s.workers) {
      inSystem++;
      start(sv, req);
    } else if (sv.queue.length < s.queueLimit) {
      inSystem++;
      sv.queue.push(req);
    } else {
      sv.errors++;
      errors++;
    }
  }

  function start(sv: Server, req: Req) {
    sv.busy++;
    const service = Math.max(s.dbQueryMs + 1, Math.round(s.serviceMs * (0.75 + 0.5 * rng("work:servers")())));
    loop.after(service - s.dbQueryMs, () => query(sv, req));
  }

  function query(sv: Server, req: Req) {
    advance();
    const run = () => {
      db.busy++;
      loop.after(s.dbQueryMs, () => {
        advance();
        db.busy--;
        const next = db.queue.shift();
        if (next) next();
        finish(sv, req);
      });
    };
    if (db.busy < s.dbConnections) run();
    else
      db.queue.push(() => {
        advance();
        run();
      });
  }

  function finish(sv: Server, req: Req) {
    sv.busy--;
    inSystem--;
    latencies.push(loop.now - req.arrive);
    const next = sv.queue.shift();
    if (next) start(sv, next);
  }

  function closeWindow(w: number) {
    advance();
    const seconds = s.windowMs / 1000;
    const sorted = [...latencies].sort((a, b) => a - b);
    const mean = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
    const serverStats = servers.map((sv) => {
      const stat = {
        id: sv.id,
        utilization: sv.busyArea / (s.workers * s.windowMs),
        busy: sv.busy,
        queueStart: queueStart.get(sv.id)!,
        queueEnd: sv.queue.length,
        errors: sv.errors,
      };
      queueStart.set(sv.id, sv.queue.length);
      sv.busyArea = 0;
      sv.errors = 0;
      return stat;
    });
    const dbStat = {
      utilization: db.busyArea / (s.dbConnections * s.windowMs),
      busy: db.busy,
      queueStart: dbQueueStart,
      queueEnd: db.queue.length,
    };
    dbQueueStart = db.queue.length;
    const saturated = [
      ...serverStats
        .filter(
          (v) =>
            v.utilization >= SATURATION_UTILIZATION &&
            (v.queueEnd > v.queueStart + QUEUE_GROWTH || v.errors > 0),
        )
        .map((v) => v.id),
      ...(dbStat.utilization >= SATURATION_UTILIZATION && dbStat.queueEnd > dbStat.queueStart + QUEUE_GROWTH
        ? ["db"]
        : []),
    ];
    windows.push({
      index: w,
      offered: s.steps[w],
      served: sorted.length / seconds,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      meanLatency: mean,
      errors,
      arrivals,
      completions: sorted.length,
      inSystem: inSystemArea / s.windowMs,
      servers: serverStats,
      db: dbStat,
      saturated,
    });
    db.busyArea = 0;
    inSystemArea = 0;
    latencies = [];
    arrivals = 0;
    errors = 0;
  }

  for (let w = 0; w < s.steps.length; w++) loop.after((w + 1) * s.windowMs, () => closeWindow(w));
  scheduleArrival();
  loop.run();
  return { windows, capacity: (s.servers * s.workers * 1000) / s.serviceMs };
}

// --- Display -------------------------------------------------------------------------------------------------------

/** "120 ms", "1.9 s". */
export function formatMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** Served requests per second, as shown: a whole number. */
export const rps = (n: number) => Math.round(n);

/** Each component's state and note at the end of a window: saturated components are busy, the rest idle. */
export function windowNodes(s: CapacityScenario, w: CapacityWindow): TraceSim["nodes"] {
  const sat = new Set(w.saturated);
  const state = (id: string) => (sat.has(id) ? ("busy" as const) : ("idle" as const));
  return [
    { id: "client", state: "idle", badge: `${w.offered} req/s` },
    ...(s.servers > 1 ? [{ id: "lb", state: "idle" as const, badge: "round robin" }] : []),
    ...w.servers.map((v) => ({
      id: v.id,
      state: state(v.id),
      badge: `${v.busy}/${s.workers} busy · queue ${v.queueEnd}`,
    })),
    { id: "db", state: state("db"), badge: `${Math.round(w.db.utilization * 100)}% busy` },
  ];
}
