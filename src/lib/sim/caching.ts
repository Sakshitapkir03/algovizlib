import { z } from "zod";

import { EventLoop } from "./events";
import { jitter, streams } from "./random";

/**
 * "The price changed but users see the old one": a product page reads one price through a cache, cache-aside (get
 * from the cache; on a miss read the database and store what it read). The database holds the price with a version
 * that goes up on every write. An admin updates the price; then, depending on `invalidation`, the cache isn't told
 * ("none"), the entry is deleted after the database write ("delete"), or it's deleted leaving a version marker
 * ("versioned": the cache remembers the newest version it was told about, and a store is kept only if its version is
 * at least that, so a slow reader can't put an older price back). The update is acknowledged once the invalidation
 * is done.
 *
 * Entries expire after `ttlMs`; a version marker after `markerTtlMs` (default the TTL; a test shows a marker that
 * expires during a slow read lets the old price back in). Readers: one followed slow shopper ("Ben") whose page
 * stalls `stallMs` between reading the database and storing into the cache (a pause, say), one followed shopper
 * ("Ana") who reloads after the update until she sees the new price, and background shoppers at `readsPerSec`.
 *
 * The rule: once a price update is acknowledged, no read that starts after that returns an older price. It depends on
 * the database confirming the write before the invalidation, the invalidation finishing before the acknowledgement,
 * the cache applying a versioned store atomically, and the version marker outliving any read. Latencies are
 * illustrative.
 */

export const INVALIDATIONS = ["none", "delete", "versioned"] as const;
export type Invalidation = (typeof INVALIDATIONS)[number];

export const cacheScenarioSchema = z.object({
  label: z.string().trim().min(1).max(12),
  seed: z.number().int().min(0).max(999_999),
  invalidation: z.enum(INVALIDATIONS),
  ttlMs: z.number().int().min(500).max(60_000),
  /** How long a version marker is kept (default: the TTL). */
  markerTtlMs: z.number().int().min(10).max(60_000).optional(),
  startPrice: z.number().int().min(1).max(999).default(49),
  newPrice: z.number().int().min(1).max(999).default(39),
  startVersion: z.number().int().min(1).max(99).default(7),
  /** The cache starts holding the old price, expiring at this time. */
  warmUntilMs: z.number().int().nonnegative().default(2000),
  /** When the admin changes the price. */
  updateAtMs: z.number().int().nonnegative().default(2030),
  /** The slow shopper: starts at `atMs` and pauses `stallMs` between the database read and the cache store. */
  slow: z
    .object({ atMs: z.number().int().nonnegative(), stallMs: z.number().int().min(0).max(2000) })
    .nullable(),
  /** Ana reloads `firstReadMs` after the update is acknowledged, then every `retryEveryMs` until she sees it. */
  follow: z
    .object({
      firstReadMs: z.number().int().min(10).max(5000),
      retryEveryMs: z.number().int().min(200).max(20_000),
    })
    .nullable()
    .default({ firstReadMs: 300, retryEveryMs: 2000 }),
  maxReloads: z.number().int().min(1).max(12).default(10),
  readsPerSec: z.number().min(0).max(200).default(20),
  /** Price changes after the first (the cost sweep): one every `everyMs`, alternating prices. */
  repeat: z
    .object({ everyMs: z.number().int().min(200).max(60_000) })
    .nullable()
    .default(null),
  durationMs: z.number().int().min(1000).max(120_000).default(30_000),
  record: z.boolean().default(true),
});
export type CacheScenario = z.infer<typeof cacheScenarioSchema>;
export type CacheScenarioInput = z.input<typeof cacheScenarioSchema>;

/** The cache's state for the price key: the entry (if any) and the newest version it was told about. */
export type CacheState = {
  entry?: { price: number; version: number; expiresAt: number };
  marker?: { version: number; expiresAt: number };
};
export type DbState = { price: number; version: number };

/**
 * The cache, shared by the timed replay and the exhaustive proof. `get` returns the entry if it hasn't expired; `set`
 * stores (plain), or stores only if the version is at least the newest the cache knows (versioned: one atomic step);
 * `invalidate` deletes the entry, and in versioned mode leaves a marker with the new version.
 */
export class PriceCache {
  state: CacheState = {};
  constructor(
    readonly versioned: boolean,
    readonly ttlMs: number,
    readonly markerTtlMs: number,
  ) {}
  /** The newest version the cache knows for the key (entry or marker), at `now`. */
  known(now: number): number | undefined {
    const e = this.state.entry && this.state.entry.expiresAt > now ? this.state.entry.version : undefined;
    const m = this.state.marker && this.state.marker.expiresAt > now ? this.state.marker.version : undefined;
    return e === undefined ? m : m === undefined ? e : Math.max(e, m);
  }
  get(now: number): { price: number; version: number } | undefined {
    const e = this.state.entry;
    return e && e.expiresAt > now ? { price: e.price, version: e.version } : undefined;
  }
  set(now: number, price: number, version: number): "stored" | "rejected" {
    if (this.versioned) {
      const known = this.known(now);
      if (known !== undefined && version < known) return "rejected";
    }
    this.state = { ...this.state, entry: { price, version, expiresAt: now + this.ttlMs } };
    return "stored";
  }
  invalidate(now: number, version: number) {
    this.state = this.versioned
      ? { marker: { version: Math.max(version, this.known(now) ?? 0), expiresAt: now + this.markerTtlMs } }
      : {};
  }
  snapshot(): CacheState {
    return {
      ...(this.state.entry && { entry: { ...this.state.entry } }),
      ...(this.state.marker && { marker: { ...this.state.marker } }),
    };
  }
}

/** One read through the cache. */
export type ReadRecord = {
  reader: string;
  start: number;
  t: number;
  hit: boolean;
  price: number;
  version: number;
  /** On a miss: whether the store was kept. */
  set?: "stored" | "rejected";
  /** Started after an acknowledged update and returned an older version. */
  stale: boolean;
};

export type CacheEvent = (
  | { kind: "write"; t: number; price: number; version: number }
  | { kind: "invalidate"; t: number; version: number }
  | { kind: "ack"; t: number; version: number }
  | { kind: "get"; t: number; reader: string; hit: boolean; price?: number; version?: number }
  | { kind: "db-read"; t: number; reader: string; price: number; version: number }
  | {
      kind: "set";
      t: number;
      reader: string;
      price: number;
      version: number;
      outcome: "stored" | "rejected";
      /** The newest version the cache knew, and its live entry, just before this store. */
      known?: number;
      replaced?: { price: number; version: number };
    }
  | { kind: "done"; t: number; read: ReadRecord }
) & { cache: CacheState; db: DbState };
type EventBody = CacheEvent extends infer E
  ? E extends CacheEvent
    ? Omit<E, "cache" | "db">
    : never
  : never;

export type CacheRun = {
  events: CacheEvent[];
  reads: number;
  hits: number;
  dbReads: number;
  /** Reads started after an acknowledged update that returned an older version. */
  stale: ReadRecord[];
  /** From the first acknowledgement to the end of the last stale read (0 if none). */
  staleForMs: number;
  updates: number;
  acks: { t: number; version: number }[];
};

export const SLOW = "Ben";
export const FOLLOWED = "Ana";
const HOP = { base: 1, spread: 3 };

export function simulateCache(input: CacheScenarioInput): CacheRun {
  const s = cacheScenarioSchema.parse(input);
  const loop = new EventLoop(s.durationMs + 60_000, 400_000);
  const rng = streams(s.seed);
  const hop = (kind: string) => jitter(rng(`net:${kind}`), HOP.base, HOP.spread);
  const cache = new PriceCache(s.invalidation === "versioned", s.ttlMs, s.markerTtlMs ?? s.ttlMs);
  const db: DbState = { price: s.startPrice, version: s.startVersion };
  cache.state = { entry: { price: s.startPrice, version: s.startVersion, expiresAt: s.warmUntilMs } };
  let acked = 0;
  let firstAck: number | undefined;
  const events: CacheEvent[] = [];
  const run: CacheRun = {
    events,
    reads: 0,
    hits: 0,
    dbReads: 0,
    stale: [],
    staleForMs: 0,
    updates: 0,
    acks: [],
  };
  const log = (e: EventBody, followed: boolean) => {
    if (s.record && followed) events.push({ ...e, cache: cache.snapshot(), db: { ...db } } as CacheEvent);
  };

  function read(reader: string, followed: boolean, stallMs: number, then?: (r: ReadRecord) => void) {
    const start = loop.now;
    const ackedAtStart = acked;
    const finish = (r: Omit<ReadRecord, "stale" | "start" | "reader" | "t">) => {
      const record: ReadRecord = { reader, start, t: loop.now, ...r, stale: r.version < ackedAtStart };
      run.reads++;
      if (record.hit) run.hits++;
      if (record.stale) {
        run.stale.push(record);
        run.staleForMs = Math.max(run.staleForMs, loop.now - (firstAck ?? loop.now));
      }
      log({ kind: "done", t: loop.now, read: record }, followed);
      then?.(record);
    };
    loop.after(hop("read"), () => {
      const got = cache.get(loop.now);
      log(
        {
          kind: "get",
          t: loop.now,
          reader,
          hit: !!got,
          ...(got && { price: got.price, version: got.version }),
        },
        followed,
      );
      if (got) {
        loop.after(hop("read"), () => finish({ hit: true, price: got.price, version: got.version }));
        return;
      }
      loop.after(hop("read"), () => {
        const value = { ...db };
        run.dbReads++;
        log({ kind: "db-read", t: loop.now, reader, price: value.price, version: value.version }, followed);
        loop.after(hop("read") + stallMs, () => {
          const known = cache.known(loop.now);
          const replaced = cache.get(loop.now);
          const outcome = cache.set(loop.now, value.price, value.version);
          log(
            {
              kind: "set",
              t: loop.now,
              reader,
              price: value.price,
              version: value.version,
              outcome,
              ...(known !== undefined && { known }),
              ...(replaced && { replaced }),
            },
            followed,
          );
          loop.after(hop("read"), () =>
            finish({ hit: false, price: value.price, version: value.version, set: outcome }),
          );
        });
      });
    });
  }

  function update(price: number, followed: boolean) {
    loop.after(hop("write"), () => {
      db.price = price;
      db.version++;
      const version = db.version;
      run.updates++;
      log({ kind: "write", t: loop.now, price, version }, followed);
      const ack = () =>
        loop.after(hop("write"), () => {
          acked = Math.max(acked, version);
          firstAck ??= loop.now;
          run.acks.push({ t: loop.now, version });
          log({ kind: "ack", t: loop.now, version }, followed);
          if (followed && s.follow) {
            const f = s.follow;
            let reloads = 0;
            const reload = () => {
              reloads++;
              read(FOLLOWED, true, 0, (r) => {
                if (r.version < version && reloads < s.maxReloads) loop.after(f.retryEveryMs, reload);
              });
            };
            loop.after(f.firstReadMs, reload);
          }
        });
      if (s.invalidation === "none") return ack();
      loop.after(hop("write"), () => {
        cache.invalidate(loop.now, version);
        log({ kind: "invalidate", t: loop.now, version }, followed);
        ack();
      });
    });
  }

  // Background shoppers.
  const gap = () => Math.max(1, Math.round((-Math.log(1 - rng("reads")()) / s.readsPerSec) * 1000));
  const browse = () => {
    read("shopper", false, 0);
    const next = gap();
    if (loop.now + next < s.durationMs) loop.after(next, browse);
  };
  if (s.readsPerSec > 0) loop.after(gap(), browse);
  if (s.slow) {
    const slow = s.slow;
    loop.after(slow.atMs, () => read(SLOW, true, slow.stallMs));
  }
  loop.after(s.updateAtMs, () => update(s.newPrice, true));
  if (s.repeat) {
    const every = s.repeat.everyMs;
    let k = 1;
    for (let t = s.updateAtMs + every; t < s.durationMs; t += every, k++) {
      const price = k % 2 ? s.startPrice : s.newPrice;
      loop.after(t, () => update(price, false));
    }
  }
  loop.run();
  return run;
}

/**
 * Every interleaving of one writer's steps (write the database, then invalidate; the update is acknowledged after
 * the last) and `readers` readers' steps (get; on a miss, read the database, then store), from a warm cache (holding
 * the old price) or a cold one, followed by a probe read that starts after everything. A read that starts after the
 * acknowledgement and returns the old version breaks the rule. No time passes: nothing expires.
 */
export function enumerateCacheSchedules(invalidation: Invalidation, readers: number, warm: boolean) {
  type Pc = { phase: "get" | "db" | "set" | "done"; startedAfterAck?: boolean; read?: DbState };
  type State = { cache: CacheState; db: DbState; writer: number; acked: boolean; pcs: Pc[] };
  const steps = invalidation === "none" ? 1 : 2;
  let schedules = 0;
  let violating = 0;
  const OLD = 7;
  const NEW = 8;
  const mk = (cache: CacheState) => {
    const c = new PriceCache(invalidation === "versioned", Infinity, Infinity);
    c.state = structuredClone(cache);
    return c;
  };
  const walk = (st: State, broke: boolean) => {
    const live = st.pcs.flatMap((p, k) => (p.phase === "done" ? [] : [k]));
    const writerLive = st.writer < steps;
    if (!live.length && !writerLive) {
      // The probe read, after everything.
      const c = mk(st.cache);
      const got = c.get(0);
      const version = got ? got.version : st.db.version;
      schedules++;
      if (broke || version < NEW) violating++;
      return;
    }
    if (writerLive) {
      const next: State = structuredClone(st);
      if (next.writer === 0) next.db = { price: 39, version: NEW };
      else {
        const c = mk(next.cache);
        c.invalidate(0, NEW);
        next.cache = c.snapshot();
      }
      next.writer++;
      if (next.writer === steps) next.acked = true;
      walk(next, broke);
    }
    for (const k of live) {
      const next: State = structuredClone(st);
      const pc = next.pcs[k];
      const c = mk(next.cache);
      let b = broke;
      if (pc.phase === "get") {
        pc.startedAfterAck = next.acked;
        const got = c.get(0);
        if (got) {
          pc.phase = "done";
          if (pc.startedAfterAck && got.version < NEW) b = true;
        } else pc.phase = "db";
      } else if (pc.phase === "db") {
        pc.read = { ...next.db };
        pc.phase = "set";
      } else {
        c.set(0, pc.read!.price, pc.read!.version);
        next.cache = c.snapshot();
        pc.phase = "done";
        if (pc.startedAfterAck && pc.read!.version < NEW) b = true;
      }
      walk(next, b);
    }
  };
  const cache: CacheState = warm ? { entry: { price: 49, version: OLD, expiresAt: Infinity } } : {};
  walk(
    {
      cache,
      db: { price: 49, version: OLD },
      writer: 0,
      acked: false,
      pcs: Array.from({ length: readers }, () => ({ phase: "get" as const })),
    },
    false,
  );
  return { schedules, violating };
}
