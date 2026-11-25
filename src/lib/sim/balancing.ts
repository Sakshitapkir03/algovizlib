import { z } from "zod";

import { EventLoop } from "./events";
import { percentile } from "./capacity";
import { streams } from "./random";

/**
 * "One slow server takes everyone down": clients send requests at a steady rate to a load balancer in front of two
 * app servers (each a pool of workers with a bounded queue, the same number of workers on both); at a set time one
 * server degrades (its work takes `factor` times longer; 50× stands for a server that's effectively hanging) and
 * later recovers. Clients give up on a request after `clientTimeoutMs` (the server still finishes the work).
 *
 * Routing: round robin (each healthy server in turn) or least-outstanding (the healthy server with the fewest
 * requests sent and not yet finished; ties go to the lower number). Health checks (optional): every `intervalMs` the
 * balancer probes each server; a probe is a small request that waits for a worker like any other and fails if it
 * doesn't finish within `timeoutMs`; `unhealthyAfter` failures in a row mark a server unhealthy (no new requests), and
 * `healthyAfter` passes in a row mark it healthy again.
 *
 * Outstanding counts are exact at the balancer: a request (or probe) counts from the moment it's routed, so requests
 * still travelling to a server are included, and it stops counting the moment the server finishes it (the balancer is
 * next to the servers; `completionLagMs` exists only so a test can show what a late count would break).
 *
 * Rule 1, checked at every routing decision: the balancer never sends a request to a server with no free worker while
 * another healthy server has one (counting requests on their way, and health checks). It's about the decision, so a
 * worker that frees up after the request was routed (while it travels or waits) doesn't count: no balancer could have
 * known. With the same number of workers on both servers, least-outstanding can't break it: a server's free workers
 * are its workers minus its requests in progress, so the one with the fewest in progress has a free worker whenever
 * any server does. Rule 2: a server marked unhealthy gets no requests until it's marked healthy again. Latencies are
 * illustrative.
 */

export const balancingScenarioSchema = z.object({
  label: z.string().trim().min(1).max(20),
  seed: z.number().int().min(0).max(999_999),
  policy: z.enum(["round-robin", "least-outstanding"]),
  /** Workers per server; both servers have the same number (rule 1's guarantee depends on it). */
  workers: z.number().int().min(1).max(8),
  serviceMs: z.number().int().min(20).max(200),
  dbQueryMs: z.number().int().min(2).max(40).default(10),
  dbConnections: z.number().int().min(1).max(50).default(20),
  queueLimit: z.number().int().min(5).max(200).default(100),
  rps: z.number().int().min(5).max(120),
  windowMs: z.number().int().min(1000).max(10_000).default(3000),
  windows: z.number().int().min(1).max(6).default(4),
  clientTimeoutMs: z.number().int().min(200).max(5000).default(1000),
  /** A user request slower than this counts as affected (or one that timed out). */
  sloMs: z.number().int().min(50).max(5000).default(500),
  degrade: z.object({
    server: z.enum(["server-1", "server-2"]).default("server-2"),
    atMs: z.number().int().nonnegative(),
    factor: z.number().int().min(2).max(50),
    recoverAtMs: z.number().int().positive().optional(),
  }),
  health: z
    .object({
      intervalMs: z.number().int().min(200).max(5000),
      timeoutMs: z.number().int().min(50).max(2000).default(200),
      /** A probe's own work (before the slowdown). */
      probeMs: z.number().int().min(5).max(200).default(40),
      unhealthyAfter: z.number().int().min(1).max(5).default(2),
      healthyAfter: z.number().int().min(1).max(5).default(2),
    })
    .nullable(),
  /** The first request arriving at or after this time and the one after it are followed in full. */
  followAtMs: z.number().int().nonnegative().optional(),
  /** Test only: how long after a server finishes the balancer's count drops (0 = at once, as balancers do). */
  completionLagMs: z.number().int().min(0).max(100).default(0),
});
export type BalancingScenario = z.infer<typeof balancingScenarioSchema>;
export type BalancingScenarioInput = z.input<typeof balancingScenarioSchema>;

export const SERVER_IDS = ["server-1", "server-2"] as const;
export type ServerId = (typeof SERVER_IDS)[number];

export type ServerSnapshot = {
  id: ServerId;
  busy: number;
  queue: number;
  outstanding: number;
  healthy: boolean;
  factor: number;
};

/** One event of a followed request, or of the system (degradation, health), in time order. */
export type BalancingEvent = (
  | { kind: "route"; t: number; request: string; to: ServerId }
  | { kind: "queued"; t: number; request: string; at: ServerId; ahead: number; violation: boolean }
  | { kind: "done"; t: number; request: string; at: ServerId; latency: number; late: boolean }
  | { kind: "timeout"; t: number; request: string }
  | { kind: "degrade"; t: number; server: ServerId; factor: number }
  | { kind: "recover"; t: number; server: ServerId }
  | { kind: "probe"; t: number; server: ServerId; ok: boolean; streak: number }
  | { kind: "health"; t: number; server: ServerId; healthy: boolean }
) & {
  /** Both servers at the event (for a route: just before it, what the balancer chose from). */
  servers: ServerSnapshot[];
};
type EventBody = BalancingEvent extends infer E
  ? E extends BalancingEvent
    ? Omit<E, "servers">
    : never
  : never;

export type BalancingWindow = {
  index: number;
  offered: number;
  /** Requests answered within the client's timeout, per second. */
  served: number;
  /** The users' view: latency capped at the timeout (a timed-out request counts as the timeout). */
  p95: number;
  p99: number;
  timeouts: number;
  rejected: number;
  arrivals: number;
  /** Requests slower than the SLO or timed out, as a share of the window's finished-or-abandoned requests (0–100). */
  affected: number;
  violations: number;
  servers: (ServerSnapshot & { utilization: number; routed: number; queueStart: number })[];
  saturated: string[];
};

export type BalancingRun = {
  windows: BalancingWindow[];
  events: BalancingEvent[];
  /** Every rule-1 violation (a request queued while another healthy server had a free worker). */
  violations: { t: number; request: string; at: ServerId }[];
  /** Rule 2: requests routed to a server while it was marked unhealthy (always 0 by design; checked anyway). */
  unhealthyRoutes: number;
};

type Job = {
  id: number;
  probe?: ServerId;
  arrive: number;
  window: number;
  followed: boolean;
  settled: boolean;
  /** Rule 1 broken when this request was routed. */
  violation?: boolean;
};
type Server = {
  id: ServerId;
  busy: number;
  queue: Job[];
  inTransit: number;
  outstanding: number;
  healthy: boolean;
  fails: number;
  passes: number;
  factor: number;
  busyArea: number;
  routed: number;
};

export const requestLabel = (id: number) => `R${id}`;

export function simulateBalancing(
  input: BalancingScenarioInput,
  options: { record?: boolean } = {},
): BalancingRun {
  const s = balancingScenarioSchema.parse(input);
  const record = options.record ?? true;
  const total = s.windows * s.windowMs;
  // Run past the last window so late work still finishes (it's measured, not drawn).
  const loop = new EventLoop(total + 20_000, 400_000);
  const rng = streams(s.seed);
  const servers: Server[] = SERVER_IDS.map((id) => ({
    id,
    busy: 0,
    queue: [],
    inTransit: 0,
    outstanding: 0,
    healthy: true,
    fails: 0,
    passes: 0,
    factor: 1,
    busyArea: 0,
    routed: 0,
  }));
  const db = { busy: 0, queue: [] as (() => void)[] };
  const events: BalancingEvent[] = [];
  const violations: BalancingRun["violations"] = [];
  let unhealthyRoutes = 0;
  let nextId = 1;
  let rr = 0;
  let last = 0;
  let followed = 0;
  const windows: BalancingWindow[] = [];
  // Per window: users' latencies (capped), timeouts, rejections, arrivals, violations.
  const perWindow = Array.from({ length: s.windows }, () => ({
    latencies: [] as number[],
    answered: 0,
    timeouts: 0,
    rejected: 0,
    arrivals: 0,
    violations: 0,
  }));
  const queueStart = new Map<ServerId, number>(SERVER_IDS.map((id) => [id, 0]));
  const windowOf = (t: number) => Math.min(s.windows - 1, Math.floor(t / s.windowMs));
  const log = (e: EventBody) => {
    if (record) events.push({ ...e, servers: snapshot() } as BalancingEvent);
  };
  const snapshot = (): ServerSnapshot[] =>
    servers.map((v) => ({
      id: v.id,
      busy: v.busy,
      queue: v.queue.length,
      outstanding: v.outstanding,
      healthy: v.healthy,
      factor: v.factor,
    }));

  const advance = () => {
    const dt = loop.now - last;
    if (dt <= 0) return;
    for (const v of servers) v.busyArea += v.busy * dt;
    last = loop.now;
  };

  /** Free workers, counting requests already on their way. */
  const free = (v: Server) => s.workers - v.busy - v.queue.length - v.inTransit;

  function pick(): Server | undefined {
    const healthy = servers.filter((v) => v.healthy);
    if (healthy.length === 0) return undefined;
    if (s.policy === "round-robin") {
      for (let k = 0; k < servers.length; k++) {
        const v = servers[(rr + k) % servers.length];
        if (v.healthy) {
          rr = (rr + k + 1) % servers.length;
          return v;
        }
      }
      return undefined;
    }
    return healthy.reduce((a, b) => (b.outstanding < a.outstanding ? b : a));
  }

  function send(v: Server, job: Job) {
    v.outstanding++;
    v.inTransit++;
    loop.after(1, () => arriveAt(v, job));
  }

  function arrive() {
    advance();
    const job: Job = {
      id: nextId++,
      arrive: loop.now,
      window: windowOf(loop.now),
      followed: false,
      settled: false,
    };
    perWindow[job.window].arrivals++;
    if (s.followAtMs !== undefined && loop.now >= s.followAtMs && followed < 2) {
      job.followed = true;
      followed++;
    }
    const v = pick();
    if (!v) {
      perWindow[job.window].rejected++;
    } else {
      if (!v.healthy) unhealthyRoutes++;
      // Rule 1, at the decision: sent where there's no free worker while another healthy server has one?
      if (free(v) <= 0 && servers.some((o) => o !== v && o.healthy && free(o) > 0)) {
        job.violation = true;
        perWindow[job.window].violations++;
        violations.push({ t: loop.now, request: requestLabel(job.id), at: v.id });
      }
      v.routed++;
      if (job.followed) log({ kind: "route", t: loop.now, request: requestLabel(job.id), to: v.id });
      send(v, job);
      loop.after(s.clientTimeoutMs, () => {
        if (job.settled) return;
        job.settled = true;
        perWindow[job.window].timeouts++;
        perWindow[job.window].latencies.push(s.clientTimeoutMs);
        if (job.followed) log({ kind: "timeout", t: loop.now, request: requestLabel(job.id) });
      });
    }
    const gap = Math.max(0, Math.round((-Math.log(1 - rng("arrivals")()) / s.rps) * 1000));
    if (loop.now + gap < total) loop.after(gap, arrive);
  }

  function arriveAt(v: Server, job: Job) {
    advance();
    v.inTransit--;
    if (v.busy < s.workers) {
      start(v, job);
      return;
    }
    if (v.queue.length >= s.queueLimit) {
      if (!job.probe) perWindow[job.window].rejected++;
      v.outstanding--;
      return;
    }
    const violation = job.violation === true;
    if (job.followed)
      log({
        kind: "queued",
        t: loop.now,
        request: requestLabel(job.id),
        at: v.id,
        ahead: v.queue.length,
        violation,
      });
    v.queue.push(job);
  }

  function start(v: Server, job: Job) {
    v.busy++;
    if (job.probe) {
      loop.after(Math.max(1, s.health!.probeMs * v.factor), () => finish(v, job));
      return;
    }
    const base = Math.max(s.dbQueryMs + 1, Math.round(s.serviceMs * (0.75 + 0.5 * rng("work:servers")())));
    const work = Math.max(1, Math.round((base - s.dbQueryMs) * v.factor));
    loop.after(work, () => {
      advance();
      const run = () => {
        db.busy++;
        loop.after(s.dbQueryMs, () => {
          db.busy--;
          db.queue.shift()?.();
          finish(v, job);
        });
      };
      if (db.busy < s.dbConnections) run();
      else db.queue.push(run);
    });
  }

  function finish(v: Server, job: Job) {
    advance();
    v.busy--;
    const drop = () => v.outstanding--;
    if (s.completionLagMs > 0) loop.after(s.completionLagMs, drop);
    else drop();
    if (job.probe) probeDone(v, job);
    else {
      const latency = loop.now - job.arrive;
      const late = job.settled;
      if (!job.settled) {
        job.settled = true;
        const w = perWindow[job.window];
        w.answered++;
        w.latencies.push(latency);
      }
      if (job.followed)
        log({ kind: "done", t: loop.now, request: requestLabel(job.id), at: v.id, latency, late });
    }
    const next = v.queue.shift();
    if (next) start(v, next);
  }

  // --- Health checks ---------------------------------------------------------------------------------------------
  function probe(v: Server) {
    const h = s.health!;
    const job: Job = {
      id: 0,
      probe: v.id,
      arrive: loop.now,
      window: windowOf(loop.now),
      followed: false,
      settled: false,
    };
    send(v, job);
    loop.after(h.timeoutMs, () => {
      if (job.settled) return;
      job.settled = true;
      verdict(v, false);
    });
  }
  function probeDone(v: Server, job: Job) {
    if (job.settled) return;
    job.settled = true;
    verdict(v, loop.now - job.arrive <= s.health!.timeoutMs);
  }
  function verdict(v: Server, ok: boolean) {
    const h = s.health!;
    if (ok) {
      v.passes++;
      v.fails = 0;
    } else {
      v.fails++;
      v.passes = 0;
    }
    if (!ok || !v.healthy)
      log({ kind: "probe", t: loop.now, server: v.id, ok, streak: ok ? v.passes : v.fails });
    if (v.healthy && v.fails >= h.unhealthyAfter) {
      v.healthy = false;
      log({ kind: "health", t: loop.now, server: v.id, healthy: false });
    } else if (!v.healthy && v.passes >= h.healthyAfter) {
      v.healthy = true;
      log({ kind: "health", t: loop.now, server: v.id, healthy: true });
    }
  }
  if (s.health) {
    const h = s.health;
    for (let t = h.intervalMs; t < total; t += h.intervalMs) loop.after(t, () => servers.forEach(probe));
  }

  // --- Degradation and windows ---------------------------------------------------------------------------------
  const slow = servers.find((v) => v.id === s.degrade.server)!;
  loop.after(s.degrade.atMs, () => {
    slow.factor = s.degrade.factor;
    log({ kind: "degrade", t: loop.now, server: slow.id, factor: s.degrade.factor });
  });
  if (s.degrade.recoverAtMs !== undefined)
    loop.after(s.degrade.recoverAtMs, () => {
      slow.factor = 1;
      log({ kind: "recover", t: loop.now, server: slow.id });
    });

  // At each window's end, the servers' state over the window; once its requests have had the client's timeout to
  // finish (or be abandoned), the users' view of it.
  const atBoundary: BalancingWindow["servers"][] = [];
  function snapshotWindow(w: number) {
    advance();
    atBoundary[w] = servers.map((v) => {
      const out = {
        id: v.id,
        busy: v.busy,
        queue: v.queue.length,
        outstanding: v.outstanding,
        healthy: v.healthy,
        factor: v.factor,
        utilization: v.busyArea / (s.workers * s.windowMs),
        routed: v.routed,
        queueStart: queueStart.get(v.id)!,
      };
      queueStart.set(v.id, v.queue.length);
      v.busyArea = 0;
      v.routed = 0;
      return out;
    });
  }
  function closeWindow(w: number) {
    const data = perWindow[w];
    const sorted = [...data.latencies].sort((a, b) => a - b);
    const finished = data.latencies.length;
    const affected = finished ? data.latencies.filter((l) => l >= s.sloMs).length / finished : 0;
    const stats = atBoundary[w];
    windows.push({
      index: w,
      offered: s.rps,
      served: data.answered / (s.windowMs / 1000),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      timeouts: data.timeouts,
      rejected: data.rejected,
      arrivals: data.arrivals,
      affected: Math.round(affected * 100),
      violations: data.violations,
      servers: stats,
      saturated: stats.filter((v) => v.utilization >= 0.95 && v.queue > v.queueStart + 5).map((v) => v.id),
    });
  }
  for (let w = 0; w < s.windows; w++) {
    loop.after((w + 1) * s.windowMs, () => snapshotWindow(w));
    loop.after((w + 1) * s.windowMs + s.clientTimeoutMs, () => closeWindow(w));
  }
  const first = Math.max(0, Math.round((-Math.log(1 - rng("arrivals")()) / s.rps) * 1000));
  loop.after(first, arrive);
  loop.run();
  return { windows, events: events.sort((a, b) => a.t - b.t), violations, unhealthyRoutes };
}
