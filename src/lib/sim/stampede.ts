import { z } from "zod";

import { percentile } from "./capacity";
import { EventLoop } from "./events";
import { streams } from "./random";

/**
 * "Everything fell over when the cache expired": a home page built from several cached entries (trending, deals,
 * banner, categories, …) in front of a database with a few workers and a bounded queue. A deploy fills every key at
 * once with the same TTL (or with jittered TTLs: each ±`jitter` of the TTL, so they expire apart). Every page view
 * reads every key, cache-aside: a hit returns at once; a miss queries the database and stores the result with a fresh
 * TTL. With `singleFlight`, a miss for a key that's already being fetched on the same app node waits for that fetch's
 * result instead of querying the database again (coalescing is per node: `nodes` app nodes share the cache, and page
 * views are spread over them in turn).
 *
 * The database runs at most `workers` queries at once; more wait in a queue of at most `queueLimit` (one more is
 * turned away, and the pages waiting on it fail). A page whose last entry arrives after `timeoutMs` counts as timed
 * out (the work still finishes). The cache and the hops are fast; query times are illustrative.
 *
 * Rule 1: within one app node, the database never runs more than one fetch per key at a time. Rule 2: the database's
 * queue never holds more requests than it has workers, and no page is turned away or times out.
 */

export const KEY_NAMES = ["trending", "deals", "banner", "categories"] as const;
export const keyName = (k: number) => KEY_NAMES[k] ?? `key ${k + 1}`;

export const stampedeScenarioSchema = z.object({
  label: z.string().trim().min(1).max(12),
  seed: z.number().int().min(0).max(999_999),
  singleFlight: z.boolean(),
  /** TTL spread: each TTL is drawn in [1 − jitter, 1 + jitter] × the TTL (0: all the same). */
  jitter: z.number().min(0).max(0.5),
  keys: z.number().int().min(1).max(32),
  nodes: z.number().int().min(1).max(4).default(1),
  rps: z.number().int().min(10).max(2000),
  ttlMs: z.number().int().min(1000).max(60_000).default(10_000),
  workers: z.number().int().min(1).max(32).default(8),
  queueLimit: z.number().int().min(4).max(500).default(64),
  /** A database query's mean time (75–125% of it). */
  queryMs: z.number().int().min(5).max(500).default(50),
  timeoutMs: z.number().int().min(100).max(5000).default(500),
  durationMs: z.number().int().min(2000).max(60_000).default(13_000),
  /** Page views start here (nothing expires before the earliest TTL, so the proof skips the quiet part). */
  trafficFromMs: z.number().int().nonnegative().default(0),
  /** Measured windows: `count` windows of `windowMs` from `fromMs`. */
  windows: z
    .object({
      fromMs: z.number().int().nonnegative(),
      windowMs: z.number().int().min(100),
      count: z.number().int().min(1).max(8),
    })
    .default({ fromMs: 8000, windowMs: 500, count: 8 }),
  /** Follow this key's first misses after its first expiry: how many page views to follow. */
  follow: z.number().int().min(0).max(4).default(3),
  record: z.boolean().default(true),
});
export type StampedeScenario = z.infer<typeof stampedeScenarioSchema>;
export type StampedeScenarioInput = z.input<typeof stampedeScenarioSchema>;

/** The database's state at a moment. */
export type DbSnapshot = { busy: number; queue: number; workers: number; fetching: Record<string, number> };

export type StampedeEvent = (
  | { kind: "deploy"; t: number; expires: { key: string; at: number }[] }
  | { kind: "expire"; t: number; key: string; together: string[] }
  | {
      kind: "miss";
      t: number;
      request: string;
      key: string;
      node: number;
      action: "fetch" | "wait";
      /** Fetches for this key already running on this node, and in the whole database, when this miss arrived. */
      inflightNode: number;
      inflightAll: number;
    }
  | {
      kind: "fetched";
      t: number;
      request: string;
      key: string;
      waiters: number;
      queryMs: number;
      waitedMs: number;
    }
  | {
      kind: "done";
      t: number;
      request: string;
      latency: number;
      timedOut: boolean;
      failed: boolean;
      waitedOn?: string;
    }
) & { db: DbSnapshot };
type EventBody = StampedeEvent extends infer E ? (E extends StampedeEvent ? Omit<E, "db"> : never) : never;

export type StampedeWindow = {
  index: number;
  fromMs: number;
  offered: number;
  /** Pages answered within the timeout, per second. */
  served: number;
  p50: number;
  p95: number;
  p99: number;
  timeouts: number;
  rejected: number;
  queries: number;
  maxQueue: number;
  /** Most fetches for one key at once on one node, in this window. */
  maxPerKey: number;
  utilization: number;
  /** Rule 2 broken in this window: the queue went past the worker count, or a page failed or timed out. */
  saturated: boolean;
};

export type StampedeRun = {
  events: StampedeEvent[];
  windows: StampedeWindow[];
  queries: number;
  pages: number;
  /** Rule 1: moments a fetch started while another for the same key ran on the same node. */
  duplicateFetches: number;
  /** Most fetches for one key at once: on one node, and in the whole database. */
  maxPerKeyNode: number;
  maxPerKeyAll: number;
  /** Rule 2. */
  maxQueue: number;
  timeouts: number;
  rejected: number;
  /** Latency of reads that hit, and of reads that waited on another request's fetch (ms, p99). */
  hitP99: number;
  waitP99: number;
  /** When each key first expired. */
  expiries: { key: string; at: number }[];
};

type Fetch = {
  key: string;
  node: number;
  waiters: ((ok: boolean) => void)[];
  started: number;
  request: string;
};

export function simulateStampede(input: StampedeScenarioInput): StampedeRun {
  const s = stampedeScenarioSchema.parse(input);
  const loop = new EventLoop(s.durationMs + 20_000, 2_000_000);
  const rng = streams(s.seed);
  const keys = Array.from({ length: s.keys }, (_, k) => keyName(k));
  const ttl = () => Math.round(s.ttlMs * (1 + s.jitter * (2 * rng("ttl")() - 1)));
  const expiresAt = new Map<string, number>();
  const inflight = new Map<string, Fetch>(); // `${node}:${key}`
  // Fetches sent to the database and not finished (queued or running): per key, and per node and key.
  const running = new Map<string, number>();
  const runningNode = new Map<string, number>();
  let busy = 0;
  const queue: (() => void)[] = [];
  let last = 0;
  const events: StampedeEvent[] = [];
  const run: StampedeRun = {
    events,
    windows: [],
    queries: 0,
    pages: 0,
    duplicateFetches: 0,
    maxPerKeyNode: 0,
    maxPerKeyAll: 0,
    maxQueue: 0,
    timeouts: 0,
    rejected: 0,
    hitP99: 0,
    waitP99: 0,
    expiries: [],
  };
  // A hit always takes the one hop to the cache (1 ms), so hits are counted, not stored.
  let hits = 0;
  const waitLatencies: number[] = [];
  const W = s.windows;
  const perWindow = Array.from({ length: W.count }, () => ({
    arrivals: 0,
    ok: 0,
    latencies: [] as number[],
    timeouts: 0,
    rejected: 0,
    queries: 0,
    maxQueue: 0,
    maxPerKey: 0,
    busyArea: 0,
  }));
  const windowOf = (t: number) => {
    const w = Math.floor((t - W.fromMs) / W.windowMs);
    return w >= 0 && w < W.count ? perWindow[w] : undefined;
  };
  const snapshot = (): DbSnapshot => ({
    busy,
    queue: queue.length,
    workers: s.workers,
    fetching: Object.fromEntries(keys.map((k) => [k, running.get(k) ?? 0])),
  });
  const log = (e: EventBody) => {
    if (s.record) events.push({ ...e, db: snapshot() } as StampedeEvent);
  };
  const advance = () => {
    const dt = loop.now - last;
    if (dt <= 0) return;
    // Attribute busy time to the windows it falls in.
    for (let t = last; t < loop.now;) {
      const w = Math.floor((t - W.fromMs) / W.windowMs);
      const end = Math.min(loop.now, W.fromMs + (w + 1) * W.windowMs);
      if (w >= 0 && w < W.count) perWindow[w].busyArea += busy * (end - t);
      t = end;
    }
    last = loop.now;
  };
  const noteQueue = () => {
    run.maxQueue = Math.max(run.maxQueue, queue.length);
    const w = windowOf(loop.now);
    if (w) w.maxQueue = Math.max(w.maxQueue, queue.length);
  };

  // The deploy fills every key at once.
  for (const k of keys) {
    const at = ttl();
    expiresAt.set(k, at);
  }
  log({ kind: "deploy", t: 0, expires: keys.map((k) => ({ key: k, at: expiresAt.get(k)! })) });
  const firstExpiry = new Map<string, number>(keys.map((k) => [k, expiresAt.get(k)!]));
  run.expiries = keys.map((k) => ({ key: k, at: firstExpiry.get(k)! }));
  const followKey = keys[0];
  // Log each key's first expiry (with the keys that expire at the same moment).
  const byTime = new Map<number, string[]>();
  for (const k of keys) byTime.set(firstExpiry.get(k)!, [...(byTime.get(firstExpiry.get(k)!) ?? []), k]);
  for (const [at, ks] of [...byTime].sort((a, b) => a[0] - b[0]))
    loop.after(at, () => {
      if (ks.includes(followKey)) log({ kind: "expire", t: loop.now, key: followKey, together: ks });
    });

  /** One database query; `done(ok)` when it finishes (or is turned away). */
  function query(key: string, node: number, done: (ok: boolean, queryMs: number, waitedMs: number) => void) {
    advance();
    const queued = loop.now;
    if (busy >= s.workers && queue.length >= s.queueLimit) {
      done(false, 0, 0);
      return;
    }
    run.queries++;
    const w = windowOf(loop.now);
    if (w) w.queries++;
    // Rule 1 counts every fetch sent to the database, from the moment it's sent until it finishes.
    const nk = `${node}:${key}`;
    running.set(key, (running.get(key) ?? 0) + 1);
    runningNode.set(nk, (runningNode.get(nk) ?? 0) + 1);
    if (runningNode.get(nk)! > 1) run.duplicateFetches++;
    run.maxPerKeyNode = Math.max(run.maxPerKeyNode, runningNode.get(nk)!);
    run.maxPerKeyAll = Math.max(run.maxPerKeyAll, running.get(key)!);
    if (w) w.maxPerKey = Math.max(w.maxPerKey, runningNode.get(nk)!);
    const begin = () => {
      advance();
      busy++;
      const work = Math.round(s.queryMs * (0.75 + 0.5 * rng("query")()));
      loop.after(work, () => {
        advance();
        busy--;
        running.set(key, running.get(key)! - 1);
        runningNode.set(nk, runningNode.get(nk)! - 1);
        const next = queue.shift();
        noteQueue();
        if (next) next();
        done(true, work, loop.now - queued - work);
      });
    };
    if (busy < s.workers) begin();
    else {
      queue.push(begin);
      noteQueue();
    }
  }

  let nextId = 1;
  let followed = 0;
  let rr = 0;
  function page() {
    const id = nextId++;
    const label = `R${id}`;
    const start = loop.now;
    const node = rr;
    rr = (rr + 1) % s.nodes;
    run.pages++;
    const win = windowOf(start);
    if (win) win.arrivals++;
    let pending = keys.length;
    let failed = false;
    let follow = false;
    let waitedOn: string | undefined;
    const finish = () => {
      const latency = loop.now - start;
      const timedOut = latency > s.timeoutMs;
      if (failed) {
        run.rejected++;
        if (win) win.rejected++;
      } else if (timedOut) {
        run.timeouts++;
        if (win) win.timeouts++;
      } else if (win) win.ok++;
      if (win) win.latencies.push(Math.min(latency, s.timeoutMs));
      if (follow)
        log({
          kind: "done",
          t: loop.now,
          request: label,
          latency,
          timedOut,
          failed,
          ...(waitedOn && { waitedOn }),
        });
    };
    const got = (ok: boolean) => {
      if (!ok) failed = true;
      if (--pending === 0) finish();
    };
    loop.after(1, () => {
      for (const k of keys) {
        const t = loop.now;
        if ((expiresAt.get(k) ?? 0) > t) {
          hits++;
          got(true);
          continue;
        }
        const nk = `${node}:${k}`;
        const existing = s.singleFlight ? inflight.get(nk) : undefined;
        const followThis = k === followKey && followed < s.follow && t >= firstExpiry.get(k)!;
        if (followThis) {
          followed++;
          follow = true;
        }
        const inflightNode = runningNode.get(nk) ?? 0;
        const inflightAll = running.get(k) ?? 0;
        if (existing) {
          if (followThis) {
            waitedOn = existing.request;
            log({ kind: "miss", t, request: label, key: k, node, action: "wait", inflightNode, inflightAll });
          }
          existing.waiters.push((ok) => {
            waitLatencies.push(loop.now - t);
            got(ok);
          });
          continue;
        }
        if (followThis)
          log({ kind: "miss", t, request: label, key: k, node, action: "fetch", inflightNode, inflightAll });
        const f: Fetch = { key: k, node, waiters: [], started: t, request: label };
        // Without single-flight every miss is its own fetch; keep a count of them per key for the record.
        const fid = s.singleFlight ? nk : `${nk}:${label}`;
        inflight.set(fid, f);
        query(k, node, (ok, queryMs, waitedMs) => {
          inflight.delete(fid);
          if (ok) expiresAt.set(k, loop.now + ttl());
          if (followThis)
            log({
              kind: "fetched",
              t: loop.now,
              request: label,
              key: k,
              waiters: f.waiters.length,
              queryMs,
              waitedMs,
            });
          for (const w of f.waiters) w(ok);
          got(ok);
        });
      }
    });
  }
  // Whole-ms gaps rounded to the nearest ms (0 allowed): a floor of 1 ms would lower the rate at high traffic.
  const gap = () => Math.max(0, Math.round((-Math.log(1 - rng("arrivals")()) / s.rps) * 1000));
  const arrive = () => {
    page();
    const next = gap();
    if (loop.now + next < s.durationMs) loop.after(next, arrive);
  };
  loop.after(s.trafficFromMs + gap(), arrive);
  loop.run();
  advance();

  run.windows = perWindow.map((w, i) => {
    const sorted = [...w.latencies].sort((a, b) => a - b);
    const util = w.busyArea / (s.workers * W.windowMs);
    return {
      index: i,
      fromMs: W.fromMs + i * W.windowMs,
      offered: Math.round(w.arrivals / (W.windowMs / 1000)),
      served: Math.round(w.ok / (W.windowMs / 1000)),
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      timeouts: w.timeouts,
      rejected: w.rejected,
      queries: w.queries,
      maxQueue: w.maxQueue,
      maxPerKey: w.maxPerKey,
      utilization: Math.round(util * 100) / 100,
      saturated: w.maxQueue > s.workers || w.timeouts > 0 || w.rejected > 0,
    };
  });
  run.hitP99 = hits ? 1 : 0;
  run.waitP99 = percentile(
    [...waitLatencies].sort((a, b) => a - b),
    99,
  );
  return run;
}

/** Rule 2 over a run: the queue never passed the worker count, and no page failed or timed out. */
export const rule2Holds = (r: StampedeRun, workers: number) =>
  r.maxQueue <= workers && r.timeouts === 0 && r.rejected === 0;
