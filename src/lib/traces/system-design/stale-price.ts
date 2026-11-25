import { z } from "zod";

import {
  cacheScenarioSchema,
  enumerateCacheSchedules,
  FOLLOWED,
  INVALIDATIONS,
  simulateCache,
  SLOW,
  type CacheEvent,
  type CacheScenario,
  type CacheScenarioInput,
  type CacheState,
  type Invalidation,
} from "@/lib/sim/caching";

import type {
  Trace,
  TraceDefinition,
  TraceLoadWindow,
  TraceSim,
  TraceSimRow,
  TraceStep,
  TraceSystem,
} from "../types";

/**
 * "The price changed but users see the old one" as a trace: each scenario is a replay of the same moment (the cache's
 * entry has just expired; Ben's page misses and stalls; the admin changes the price; Ana reloads) with no
 * invalidation, delete-after-write, or versioned invalidation. Its steps follow the admin, Ben, and Ana through the
 * cache and the database; with invalidation, the last replay ends with the cost: database reads at several update
 * rates, with and without invalidation. The last step enumerates every interleaving for each kind of invalidation.
 */
export const cacheRangeSchema = z.object({
  readers: z.array(z.number().int().min(1).max(2)).min(1).max(2),
});
export type CacheRange = z.infer<typeof cacheRangeSchema>;

/** The cost sweep: price updates per minute, over a minute of traffic. */
export const UPDATE_RATES = [1, 6, 30, 60] as const;

const args = z.tuple([z.array(cacheScenarioSchema).min(1).max(3), cacheRangeSchema]);

type RowInput = TraceSimRow extends infer R ? (R extends TraceSimRow ? Omit<R, "id"> : never) : never;

export const cacheTopology = (): TraceSystem => ({
  nodes: [
    { id: "admin", label: "Admin", kind: "client", x: 2, y: 0 },
    { id: "ben", label: SLOW, kind: "client", x: 0, y: 0 },
    { id: "ana", label: FOLLOWED, kind: "client", x: 0, y: 1 },
    { id: "cache", label: "Cache", kind: "store", x: 1, y: 0 },
    { id: "db", label: "Database", kind: "store", x: 1, y: 1 },
  ],
  edges: [
    { from: "admin", to: "db" },
    { from: "admin", to: "cache" },
    { from: "ben", to: "cache" },
    { from: "ben", to: "db" },
    { from: "ana", to: "cache" },
    { from: "ana", to: "db" },
  ],
  lanes: ["admin", "ben", "ana", "cache", "db"],
});

const money = (p: number) => `$${p}`;
const v = (n: number) => `v${n}`;
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const WORDS: Record<Invalidation, string> = {
  none: "no invalidation",
  delete: "delete after write",
  versioned: "versioned invalidation",
};

/** The live entry and the newest version the cache knows, at time t. */
function live(cache: CacheState, t: number) {
  const entry = cache.entry && cache.entry.expiresAt > t ? cache.entry : undefined;
  const marker = cache.marker && cache.marker.expiresAt > t ? cache.marker : undefined;
  const known =
    entry && marker
      ? Math.max(entry.version, marker.version)
      : (entry?.version ?? marker?.version ?? undefined);
  return { entry, marker, known };
}

/** Database reads a second and a minute at each update rate, for one setup (nobody followed, no slow shopper). */
export function updateCost(s: CacheScenario, invalidation: Invalidation) {
  return UPDATE_RATES.map((rate) => {
    const r = simulateCache({
      ...s,
      invalidation,
      slow: null,
      follow: null,
      record: false,
      warmUntilMs: s.ttlMs,
      updateAtMs: 1000,
      repeat: { everyMs: Math.round(60_000 / rate) },
      durationMs: 61_000,
    });
    return { rate, dbReads: r.dbReads, updates: r.updates, reads: r.reads, stale: r.stale.length };
  });
}

export function stalePrice(input: CacheScenarioInput[], range: CacheRange): Trace {
  const scenarios = input.map((s) => cacheScenarioSchema.parse(s));
  const system = cacheTopology();
  const steps: TraceStep[] = [];
  const single = scenarios.length === 1;

  scenarios.forEach((s, run) => {
    const versioned = s.invalidation === "versioned";
    const result = simulateCache(s);
    const rows: TraceSimRow[] = [];
    let rowSeq = 0;
    let staleSeen = 0;
    let anaReads = 0;
    let sawStale = false;
    let ackAt: number | undefined;
    const addRow = (row: RowInput) => {
      const id = `r${++rowSeq}`;
      rows.push({ ...row, id } as TraceSimRow);
      return id;
    };
    const tables = (e: CacheEvent): TraceSim["tables"] => {
      const { entry, marker } = live(e.cache, e.t);
      return [
        {
          id: "cache",
          title: "Cache",
          columns: ["key", "entry"],
          rows: [
            {
              cells: [
                "price",
                entry
                  ? `${money(entry.price)} ${v(entry.version)} · ${seconds(entry.expiresAt - e.t)}`
                  : "— empty",
              ],
              ...(e.kind === "set" && e.outcome === "stored" && { mark: "new" as const }),
              ...(e.kind === "get" && e.hit && { mark: "read" as const }),
            },
            ...(versioned && marker
              ? [{ cells: ["known", `${v(marker.version)}`] as [string, string] }]
              : []),
          ],
        },
        {
          id: "db",
          title: "Database",
          columns: ["key", "value"],
          rows: [
            {
              cells: ["price", `${money(e.db.price)} ${v(e.db.version)}`],
              ...(e.kind === "write" && { mark: "new" as const }),
              ...(e.kind === "db-read" && { mark: "read" as const }),
            },
          ],
        },
      ];
    };
    const metrics = (e: CacheEvent): TraceSim["metrics"] => {
      const { entry } = live(e.cache, e.t);
      return [
        { id: "cache", label: "cache", value: entry ? `${money(entry.price)} ${v(entry.version)}` : "empty" },
        { id: "db", label: "database", value: `${money(e.db.price)} ${v(e.db.version)}` },
        { id: "stale", label: "Ana: old price", value: String(staleSeen) },
      ];
    };
    const nodes = (e: CacheEvent, busy?: string): TraceSim["nodes"] => {
      const { entry } = live(e.cache, e.t);
      return [
        { id: "admin", state: busy === "admin" ? "busy" : "idle" },
        { id: "ben", state: busy === "ben" ? "busy" : "idle" },
        { id: "ana", state: busy === "ana" ? "busy" : "idle" },
        {
          id: "cache",
          state: busy === "cache" ? "busy" : "idle",
          badge: entry ? `${money(entry.price)} ${v(entry.version)}` : "empty",
        },
        {
          id: "db",
          state: busy === "db" ? "busy" : "idle",
          badge: `${money(e.db.price)} ${v(e.db.version)}`,
        },
      ];
    };
    const push = (
      step: { kind: string; key: boolean; note: string },
      e: CacheEvent,
      current: string,
      op: Omit<NonNullable<TraceSim["cacheOp"]>, "versioned" | "db">,
      busy?: string,
    ) => {
      steps.push({
        ...step,
        pointers: {},
        sim: {
          run,
          runLabel: s.label,
          t: e.t,
          nodes: nodes(e, busy),
          tokens: [],
          rows: rows.map((r) => ({ ...r })),
          current,
          tables: tables(e),
          metrics: metrics(e),
          violations: staleSeen
            ? [`Ana saw the old price ${staleSeen} times after the update was saved`]
            : [],
          cacheOp: { ...op, versioned, db: { ...e.db } },
        },
      });
    };

    // Ana's get is shown with her result (one step per read); Ben's steps one by one.
    let anaGet: Extract<CacheEvent, { kind: "get" }> | undefined;
    let prev: CacheEvent | undefined;
    for (const e of result.events) {
      const before = prev?.cache ?? e.cache;
      prev = e;
      switch (e.kind) {
        case "write": {
          const current = addRow({
            kind: "message",
            from: "admin",
            to: "db",
            label: `price = ${money(e.price)} → ${v(e.version)}`,
            at: e.t,
            status: "delivered",
          });
          push(
            {
              kind: "write",
              key: false,
              note: `At ${e.t} ms the admin changes the price to ${money(e.price)} in the database: version ${e.version}.`,
            },
            e,
            current,
            { actor: "Admin", op: "write", price: e.price, version: e.version },
            "db",
          );
          break;
        }
        case "invalidate": {
          const current = addRow({
            kind: "message",
            from: "admin",
            to: "cache",
            label: versioned ? `delete price (${v(e.version)})` : "delete price",
            at: e.t,
            status: "delivered",
          });
          push(
            {
              kind: "invalidate",
              key: false,
              note: versioned
                ? `The admin deletes the cache entry and the cache remembers version ${e.version} as the newest it knows.`
                : `The admin deletes the cache entry, so the next read will miss and get ${money(e.db.price)} from the database.`,
            },
            e,
            current,
            { actor: "Admin", op: "invalidate", version: e.version },
            "cache",
          );
          break;
        }
        case "ack": {
          ackAt = e.t;
          const current = addRow({
            kind: "note",
            lane: "admin",
            text: "✓ price saved",
            at: e.t,
            tone: "positive",
          });
          const { entry } = live(e.cache, e.t);
          push(
            {
              kind: "ack",
              key: false,
              note: `At ${e.t} ms the update is saved and acknowledged. ${entry ? `The cache still holds ${money(entry.price)} (version ${entry.version}) for another ${seconds(entry.expiresAt - e.t)}.` : "The cache holds no price."}`,
            },
            e,
            current,
            { actor: "Admin", op: "ack", version: e.version },
          );
          break;
        }
        case "get": {
          if (e.reader === FOLLOWED) {
            anaGet = e;
            break;
          }
          const current = addRow({
            kind: "message",
            from: "ben",
            to: "cache",
            label: e.hit ? `get → ${money(e.price!)} ${v(e.version!)}` : "get → miss",
            at: e.t,
            status: "delivered",
          });
          const lb = live(before, e.t);
          push(
            {
              kind: "get",
              key: false,
              note: e.hit
                ? `${SLOW}'s page asks the cache at ${e.t} ms: hit, ${money(e.price!)}.`
                : `${SLOW}'s page asks the cache at ${e.t} ms: miss (the entry expired at ${s.warmUntilMs} ms), so it will read the database.`,
            },
            e,
            current,
            {
              actor: SLOW,
              op: "get",
              hit: e.hit,
              ...(e.hit && { price: e.price, version: e.version }),
              ...(lb.entry && { entryBefore: { price: lb.entry.price, version: lb.entry.version } }),
              ...(lb.known !== undefined && { knownBefore: lb.known }),
            },
            "ben",
          );
          break;
        }
        case "db-read": {
          if (e.reader === FOLLOWED) break;
          const current = addRow({
            kind: "message",
            from: "ben",
            to: "db",
            label: `read → ${money(e.price)} ${v(e.version)}`,
            at: e.t,
            status: "delivered",
          });
          push(
            {
              kind: "db-read",
              key: s.invalidation === "delete",
              note: `${SLOW}'s page reads the database at ${e.t} ms: ${money(e.price)}, version ${e.version}. Then it pauses for ${s.slow?.stallMs ?? 0} ms before storing that in the cache.`,
            },
            e,
            current,
            { actor: SLOW, op: "db-read", price: e.price, version: e.version },
            "db",
          );
          break;
        }
        case "set": {
          if (e.reader === FOLLOWED) break;
          addRow({
            kind: "message",
            from: "ben",
            to: "cache",
            label: `set ${money(e.price)} ${v(e.version)}`,
            at: e.t,
            status: "delivered",
          });
          const lb = { entry: e.replaced, known: e.known };
          const current = addRow({
            kind: "note",
            lane: "cache",
            text:
              e.outcome === "rejected"
                ? `✕ kept out: knows ${v(lb.known!)}`
                : `stored ${money(e.price)} for ${seconds(s.ttlMs)}`,
            at: e.t,
            tone:
              e.outcome === "rejected"
                ? "positive"
                : ackAt !== undefined && e.version < (e.db.version ?? 0)
                  ? "negative"
                  : "neutral",
          });
          const staleStore = e.outcome === "stored" && e.version < e.db.version;
          push(
            {
              kind: "set",
              key: s.invalidation !== "none" || single,
              note:
                e.outcome === "rejected"
                  ? `At ${e.t} ms ${SLOW}'s page tries to store ${money(e.price)} (version ${e.version}), but the cache knows version ${lb.known}, which is newer, so it keeps the old price out.`
                  : staleStore
                    ? `At ${e.t} ms ${SLOW}'s page stores ${money(e.price)} (version ${e.version}), read before the update, ${lb.entry ? `replacing ${money(lb.entry.price)} (version ${lb.entry.version})` : "into the empty cache"}. The old price now stays for ${seconds(s.ttlMs)}, although the database says ${money(e.db.price)}.`
                    : `At ${e.t} ms ${SLOW}'s page stores ${money(e.price)} (version ${e.version}) for ${seconds(s.ttlMs)}.`,
            },
            e,
            current,
            {
              actor: SLOW,
              op: "set",
              price: e.price,
              version: e.version,
              outcome: e.outcome,
              ...(lb.entry && { entryBefore: { price: lb.entry.price, version: lb.entry.version } }),
              ...(lb.known !== undefined && { knownBefore: lb.known }),
            },
            "cache",
          );
          break;
        }
        case "done": {
          if (e.read.reader !== FOLLOWED || !anaGet) break;
          const r = e.read;
          anaReads++;
          if (r.stale) staleSeen++;
          addRow({
            kind: "message",
            from: "ana",
            to: "cache",
            label: r.hit ? `get → ${money(r.price)} ${v(r.version)}` : "get → miss",
            at: anaGet.t,
            status: "delivered",
          });
          if (!r.hit)
            addRow({
              kind: "message",
              from: "ana",
              to: "db",
              label: `read → ${money(r.price)} ${v(r.version)}`,
              at: r.t,
              status: "delivered",
            });
          const current = addRow({
            kind: "note",
            lane: "ana",
            text: r.stale ? `✕ old price ${money(r.price)}` : `✓ new price ${money(r.price)}`,
            at: r.t,
            tone: r.stale ? "negative" : "positive",
          });
          const fresh = !r.stale && sawStale;
          const first = anaReads === 1;
          const key =
            (first && (s.invalidation !== "delete" || single)) ||
            (fresh && (s.invalidation === "none" || single));
          const since = ackAt !== undefined ? r.start - ackAt : 0;
          const lb = live(anaGet.cache, anaGet.t);
          push(
            {
              kind: r.stale ? "stale-read" : "read",
              key,
              note: `Ana reloads at ${r.start} ms, ${seconds(since)} after the update was saved. ${r.hit ? `The cache has ${money(r.price)} (version ${r.version}): a hit` : `The cache has no price: a miss, so the page reads the database: ${money(r.price)} (version ${r.version})`}, ${r.stale ? "the old price" : fresh ? `the new price at last, ${seconds(r.start - ackAt!)} after it was saved; ${staleSeen} of her reloads saw the old one` : "the new price"}.`,
            },
            e,
            current,
            {
              actor: FOLLOWED,
              op: "get",
              hit: r.hit,
              price: r.price,
              version: r.version,
              ...(lb.entry && { entryBefore: { price: lb.entry.price, version: lb.entry.version } }),
              ...(lb.known !== undefined && { knownBefore: lb.known }),
            },
            "ana",
          );
          if (r.stale) sawStale = true;
          anaGet = undefined;
          break;
        }
      }
    }

    // The cost (the last replay, with invalidation): database reads at several update rates, with and without it.
    if (run === scenarios.length - 1 && s.invalidation !== "none") {
      const mine = updateCost(s, s.invalidation);
      const base = updateCost(s, "none");
      const per = (k: number) =>
        Math.round(((mine[k].dbReads - base[k].dbReads) / Math.max(1, mine[k].updates)) * 10) / 10;
      const windows: TraceLoadWindow[] = mine.map((m, k) => ({
        label: String(m.rate),
        group: s.label,
        // Database reads a minute with invalidation (bar), against the same traffic without it (outline).
        offered: base[k].dbReads,
        served: m.dbReads,
        p95: 0,
        p99: 0,
        errors: 0,
        saturated: [],
        utilization: [],
      }));
      const last = result.events.at(-1)!;
      steps.push({
        kind: "cost",
        key: true,
        pointers: {},
        note: `The cost: every invalidation sends the next reads to the database until one stores the price again. Over a minute of traffic (${s.readsPerSec} reads a second), ${mine.map((m, k) => `${m.rate} ${m.rate === 1 ? "update" : "updates"} a minute meant ${m.dbReads} database reads against ${base[k].dbReads} without invalidation`).join(", ")}: about ${per(mine.length - 1)} extra ${per(mine.length - 1) === 1 ? "read" : "reads"} per update (at low rates the reads after each expiry matter more). Without invalidation, those updates left ${base.at(-1)!.stale} reads with an old price.`,
        sim: {
          run,
          runLabel: s.label,
          t: last.t,
          nodes: nodes(last).map((n) => ({ ...n, state: "idle" as const })),
          tokens: [],
          rows: rows.map((r) => ({ ...r })),
          tables: [
            {
              id: "cost",
              title: "Database reads",
              columns: ["updates", "reads/min"],
              rows: mine.map((m, k) => ({ cells: [`${m.rate}/min`, `${m.dbReads} vs ${base[k].dbReads}`] })),
            },
          ],
          metrics: [
            { id: "extra", label: "extra per update", value: String(per(mine.length - 1)) },
            { id: "at-max", label: `at ${mine.at(-1)!.rate}/min`, value: `${mine.at(-1)!.dbReads} reads` },
            { id: "base-max", label: "without", value: `${base.at(-1)!.dbReads} reads` },
          ],
          violations: [],
          load: {
            windows,
            current: windows.length - 1,
            sweep: {
              setting: "price updates a minute",
              unit: "per minute",
              counted: "database reads a minute without invalidation",
              hit: "database reads a minute with it",
            },
          },
        },
      });
    }
  });

  // The proof: every interleaving, for each kind of invalidation, reader count, and starting cache.
  const cases = INVALIDATIONS.flatMap((invalidation) =>
    range.readers.flatMap((readers) =>
      [true, false].map((warm) => ({
        invalidation,
        readers,
        warm,
        ...enumerateCacheSchedules(invalidation, readers, warm),
      })),
    ),
  );
  const total = (inv: Invalidation) => {
    const c = cases.filter((x) => x.invalidation === inv);
    return {
      schedules: c.reduce((t, x) => t + x.schedules, 0),
      violating: c.reduce((t, x) => t + x.violating, 0),
    };
  };
  const fixed = total("versioned");
  const prev = steps.at(-1)!.sim!;
  steps.push({
    kind: "proof",
    key: true,
    pointers: {},
    note: `Every interleaving of one writer's steps (update the database, invalidate) and ${range.readers.join(" or ")} readers' steps (get; on a miss, read the database and store), from a warm cache and a cold one, with a read after everything: no invalidation lets a read started after the update see the old price in ${total("none").violating} of ${total("none").schedules}, delete after write in ${total("delete").violating} of ${total("delete").schedules}, versioned invalidation in ${fixed.violating} of ${fixed.schedules}. It needs the database to confirm the write before the invalidation, the invalidation to finish before the update is acknowledged, the cache to store conditionally in one atomic step, and the version marker to outlive any read.`,
    sim: {
      ...prev,
      run: scenarios.length,
      runLabel: "every interleaving",
      nodes: system.nodes.map((n) => ({ id: n.id, state: "idle" as const })),
      rows: [],
      tables: [],
      metrics: INVALIDATIONS.map((inv) => ({
        id: inv,
        label: inv === "none" ? "no invalidation" : inv === "delete" ? "delete after" : "versioned",
        value: `${total(inv).violating} of ${total(inv).schedules}`,
      })),
      violations: [],
      cacheProof: { cases, runs: fixed.schedules, fixed: fixed.violating },
    },
  });
  const proof = steps.at(-1)!.sim!;
  delete proof.load;
  delete proof.current;
  delete proof.cacheOp;

  return {
    problem: "caching/stale-price",
    row: { values: system.nodes.map((n) => n.label), display: "system" },
    system,
    pointerNames: [],
    steps,
    answer: { fixed: fixed.violating, runs: fixed.schedules },
    answerDisplay: `${fixed.violating} of ${fixed.schedules}`,
  };
}

export const stalePriceTrace: TraceDefinition<z.infer<typeof args>> = {
  problem: "caching/stale-price",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args,
  run: stalePrice,
};

export { WORDS as INVALIDATION_WORDS };
