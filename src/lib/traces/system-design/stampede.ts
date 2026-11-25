import { z } from "zod";

import { formatMs } from "@/lib/sim/capacity";
import {
  keyName,
  rule2Holds,
  simulateStampede,
  stampedeScenarioSchema,
  type DbSnapshot,
  type StampedeEvent,
  type StampedeScenario,
  type StampedeScenarioInput,
} from "@/lib/sim/stampede";

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
 * "Everything fell over when the cache expired" as a trace: each scenario is a replay of the moment a deploy's keys
 * expire, with or without single-flight and TTL jitter. Its steps interleave the deploy, the followed requests for
 * "trending" (their misses, fetches, waits, and pages), and the measured windows around the expiry. The last replay
 * adds two measurements: how many keys single-flight alone can take (with and without jitter), and the cost (waiting
 * requests take as long as the fetch; coalescing is per app node). The last step checks both rules over the range.
 */
export const stampedeRangeSchema = z.object({
  seeds: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  rps: z.array(z.number().int().min(10).max(2000)).min(1).max(3),
  keys: z.array(z.number().int().min(1).max(32)).min(1).max(4),
});
export type StampedeRange = z.infer<typeof stampedeRangeSchema>;

/** Key counts for the "how many keys can single-flight take" sweep, and the jitter it compares with. */
export const KEY_SWEEP = [8, 16, 24, 32] as const;
export const SWEEP_JITTER = 0.2;

const args = z.tuple([z.array(stampedeScenarioSchema).min(1).max(3), stampedeRangeSchema]);

type RowInput = TraceSimRow extends infer R ? (R extends TraceSimRow ? Omit<R, "id"> : never) : never;

export const stampedeTopology = (): TraceSystem => ({
  nodes: [
    { id: "client", label: "Shoppers", kind: "client", x: 0, y: 0 },
    { id: "app", label: "App", kind: "server", x: 1, y: 0 },
    { id: "cache", label: "Cache", kind: "store", x: 2, y: 0 },
    { id: "db", label: "Database", kind: "store", x: 2, y: 1 },
  ],
  edges: [
    { from: "client", to: "app" },
    { from: "app", to: "cache" },
    { from: "app", to: "db" },
  ],
  lanes: ["client", "app", "cache", "db"],
});

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The proof's setups: each fix alone, both, and neither. */
export const SETUPS = [
  { name: "no fix", singleFlight: false, jitter: 0 },
  { name: "single-flight", singleFlight: true, jitter: 0 },
  { name: "jitter", singleFlight: false, jitter: SWEEP_JITTER },
  { name: "both", singleFlight: true, jitter: SWEEP_JITTER },
] as const;

/** Both rules over the range for one setup (one app node; traffic from just before the earliest expiry). */
const memo = new Map<string, unknown>();
/** Deterministic and pure, so a repeated range (a learner's scenario, the tests) is computed once. */
function memoized<T>(key: unknown, make: () => T): T {
  const k = JSON.stringify(key);
  if (!memo.has(k)) memo.set(k, make());
  return memo.get(k) as T;
}

export function stampedeRuns(
  base: StampedeScenario,
  setup: { singleFlight: boolean; jitter: number },
  range: StampedeRange,
) {
  let runs = 0;
  let rule1 = 0;
  let rule2 = 0;
  let broken = 0;
  for (let seed = range.seeds[0]; seed <= range.seeds[1]; seed++)
    for (const rps of range.rps)
      for (const keys of range.keys) {
        runs++;
        const r = simulateStampede({
          ...base,
          ...setup,
          seed,
          rps,
          keys,
          nodes: 1,
          record: false,
          // Nothing expires before the earliest jittered TTL, so traffic starts just before it.
          trafficFromMs: Math.max(0, Math.round(base.ttlMs * (1 - SWEEP_JITTER)) - 500),
        });
        const one = r.duplicateFetches > 0;
        const two = !rule2Holds(r, base.workers);
        if (one) rule1++;
        if (two) rule2++;
        if (one || two) broken++;
      }
  return { runs, rule1, rule2, broken };
}

export function stampede(input: StampedeScenarioInput[], range: StampedeRange): Trace {
  const scenarios = input.map((s) => stampedeScenarioSchema.parse(s));
  const system = stampedeTopology();
  const steps: TraceStep[] = [];

  scenarios.forEach((s, run) => {
    const result = simulateStampede(s);
    const rows: TraceSimRow[] = [];
    let rowSeq = 0;
    const chart: TraceLoadWindow[] = [];
    const peak = result.windows.reduce((a, b) => (b.queries > a.queries ? b : a), result.windows[0]);
    let duplicateShown = false;
    let waitShown = false;
    const addRow = (row: RowInput) => {
      const id = `r${++rowSeq}`;
      rows.push({ ...row, id } as TraceSimRow);
      return id;
    };
    const keysTable = (): TraceSim["tables"][number] => {
      // Two rows: the followed key, and the rest as a range (so the table fits under the diagram on a phone).
      const [head, ...rest] = result.expiries;
      const range = (xs: { at: number }[]) => {
        const lo = Math.min(...xs.map((e) => e.at));
        const hi = Math.max(...xs.map((e) => e.at));
        return lo === hi ? seconds(lo) : `${(lo / 1000).toFixed(1)}–${seconds(hi)}`;
      };
      return {
        id: "keys",
        title: "Keys expire at",
        columns: ["key", "expires"],
        rows: [
          { cells: [head.key, seconds(head.at)] },
          ...(rest.length ? [{ cells: [`${rest.length} more`, range(rest)] as [string, string] }] : []),
        ],
      };
    };
    const dbTable = (db: DbSnapshot): TraceSim["tables"][number] => ({
      id: "db",
      title: "Database",
      columns: ["what", "now"],
      rows: [
        { cells: ["workers", `${db.busy}/${db.workers} busy`] },
        {
          cells: ["queue", `${db.queue} waiting`],
          ...(db.queue > db.workers && { mark: "duplicate" as const }),
        },
        { cells: [keyName(0), plural(db.fetching[keyName(0)] ?? 0, "fetch", "fetches")] },
      ],
    });
    const metrics = (db: DbSnapshot): TraceSim["metrics"] => [
      { id: "queue", label: "db queue", value: String(db.queue) },
      { id: "busy", label: "db workers", value: `${db.busy}/${db.workers}` },
      { id: "fetches", label: `${keyName(0)} fetches`, value: String(db.fetching[keyName(0)] ?? 0) },
    ];
    const nodes = (db: DbSnapshot): TraceSim["nodes"] => [
      { id: "client", state: "idle", badge: `${s.rps} pages/s` },
      { id: "app", state: "idle", badge: s.singleFlight ? "single-flight" : "every miss fetches" },
      { id: "cache", state: "idle", badge: `${plural(s.keys, "key")}${s.jitter ? " · jittered" : ""}` },
      {
        id: "db",
        state: db.queue > db.workers ? "waiting" : db.busy >= db.workers ? "busy" : "idle",
        badge: `${db.busy}/${db.workers} busy · ${db.queue} queued`,
      },
    ];
    const base = (t: number, db: DbSnapshot, current?: string): TraceSim => ({
      run,
      runLabel: s.label,
      t,
      nodes: nodes(db),
      tokens: [],
      rows: rows.map((r) => ({ ...r })),
      ...(current && { current }),
      tables: [keysTable(), dbTable(db)],
      metrics: metrics(db),
      violations: [],
    });

    type Item = { t: number; event?: StampedeEvent; window?: number };
    const items: Item[] = [
      ...result.events.map((event) => ({ t: event.t, event })),
      ...result.windows.map((w) => ({ t: w.fromMs + s.windows.windowMs + s.timeoutMs, window: w.index })),
    ].sort((a, b) => a.t - b.t);

    for (const item of items) {
      if (item.window !== undefined) {
        const w = result.windows[item.window];
        chart.push({
          label: (w.fromMs / 1000).toFixed(1),
          group: s.label,
          // Offered load is the configured rate (the measured arrivals vary a little window to window).
          offered: s.rps,
          served: w.served,
          p95: w.p95,
          p99: w.p99,
          errors: w.timeouts + w.rejected,
          saturated: w.saturated ? ["db"] : [],
          utilization: [{ id: "db", value: w.utilization }],
        });
        const key = w === peak && s.jitter === 0;
        const db: DbSnapshot = {
          busy: 0,
          queue: w.maxQueue,
          workers: s.workers,
          fetching: { [keyName(0)]: w.maxPerKey },
        };
        steps.push({
          kind: "window",
          key,
          pointers: {},
          note: `From ${seconds(w.fromMs)} to ${seconds(w.fromMs + s.windows.windowMs)}: ${plural(w.queries, "database query", "database queries")}, the queue at most ${w.maxQueue} (${s.workers} workers), p99 ${formatMs(w.p99)}, ${w.timeouts + w.rejected} pages failed or timed out, the most fetches of one key at once ${w.maxPerKey}.`,
          sim: {
            ...base(item.t, db),
            nodes: nodes({ ...db, busy: w.utilization >= 0.95 ? s.workers : 0 }),
            metrics: [
              { id: "queries", label: "db queries", value: String(w.queries) },
              { id: "peak-queue", label: "queue at most", value: String(w.maxQueue) },
              { id: "p99", label: "p99", value: formatMs(w.p99) },
              { id: "errors", label: "failed pages", value: String(w.timeouts + w.rejected) },
            ],
            tables: [keysTable()],
            violations: w.saturated ? ["the database's queue passed its workers, or pages failed"] : [],
            load: { windows: chart.map((c) => ({ ...c })), current: chart.length - 1 },
          },
        });
        continue;
      }
      const e = item.event!;
      switch (e.kind) {
        case "deploy": {
          const together = new Set(e.expires.map((x) => x.at)).size === 1;
          const current = addRow({
            kind: "note",
            lane: "cache",
            text: together
              ? `all ${s.keys} keys: ${seconds(e.expires[0].at)}`
              : `${s.keys} keys, jittered TTLs`,
            at: 0,
            tone: together ? "negative" : "positive",
          });
          const first = Math.min(...e.expires.map((x) => x.at));
          const lastAt = Math.max(...e.expires.map((x) => x.at));
          steps.push({
            kind: "deploy",
            key: s.jitter > 0,
            pointers: {},
            note: together
              ? `A deploy fills all ${plural(s.keys, "key")} at once with the same ${seconds(s.ttlMs)} TTL, so they all expire at ${seconds(first)}.`
              : `A deploy fills all ${plural(s.keys, "key")} at once, but each TTL is drawn within ${Math.round(s.jitter * 100)}% of ${seconds(s.ttlMs)}, so they expire spread between ${seconds(first)} and ${seconds(lastAt)}.`,
            sim: {
              ...base(e.t, e.db, current),
              stampede: {
                event: "deploy",
                singleFlight: s.singleFlight,
                expires: e.expires.map((x) => ({ ...x })),
              },
            },
          });
          break;
        }
        case "expire": {
          const current = addRow({
            kind: "note",
            lane: "cache",
            text: e.together.length > 1 ? `✕ ${e.together.length} keys expire` : `${e.key} expires`,
            at: e.t,
            tone: e.together.length > 1 ? "negative" : "neutral",
          });
          steps.push({
            kind: "expire",
            key: false,
            pointers: {},
            note:
              e.together.length > 1
                ? `At ${seconds(e.t)} ${e.together.length} keys expire at the same moment, ${e.key} among them; every page view in the next instant misses them all.`
                : `At ${seconds(e.t)} ${e.key} expires.`,
            sim: base(e.t, e.db, current),
          });
          break;
        }
        case "miss": {
          addRow({
            kind: "message",
            from: "app",
            to: "cache",
            label: `${e.request}: ${e.key} → miss`,
            at: e.t,
            status: "delivered",
          });
          const current =
            e.action === "fetch"
              ? addRow({
                  kind: "message",
                  from: "app",
                  to: "db",
                  label: `${e.request}: query`,
                  at: e.t,
                  status: "in-flight",
                })
              : addRow({
                  kind: "note",
                  lane: "app",
                  text: `${e.request} waits for ${e.key}`,
                  at: e.t,
                  tone: "positive",
                });
          const duplicate = e.action === "fetch" && e.inflightNode > 0;
          // The jittered replay's beat is the spread expiries; its waits are shown, not keyed (a lone scenario keys them).
          const key =
            (duplicate && !duplicateShown) ||
            (e.action === "wait" && !waitShown && (s.jitter === 0 || scenarios.length === 1));
          if (duplicate) duplicateShown = true;
          if (e.action === "wait") waitShown = true;
          steps.push({
            kind: e.action === "fetch" ? "fetch" : "wait",
            key,
            pointers: {},
            note:
              e.action === "wait"
                ? `${e.request} misses ${e.key} at ${e.t} ms, but a fetch for it is already running on this app node, so ${e.request} waits for that result instead of querying the database.`
                : duplicate
                  ? `${e.request} misses ${e.key} at ${e.t} ms and queries the database too: now ${e.inflightAll + 1} fetches of the same ${e.key} are on their way.`
                  : `${e.request} misses ${e.key} at ${e.t} ms and queries the database for it.`,
            sim: {
              ...base(e.t, e.db, current),
              stampede: {
                event: "miss",
                singleFlight: s.singleFlight,
                request: e.request,
                key: e.key,
                action: e.action,
                inflightNode: e.inflightNode,
                inflightAll: e.inflightAll,
              },
            },
          });
          break;
        }
        case "fetched": {
          // The fetch's answer: mark the query delivered.
          const row = [...rows]
            .reverse()
            .find((r) => r.kind === "message" && r.label === `${e.request}: query`);
          if (row?.kind === "message") row.status = "delivered";
          const current = addRow({
            kind: "message",
            from: "db",
            to: "app",
            label: `${e.key} (${formatMs(e.queryMs + e.waitedMs)})`,
            at: e.t,
            status: "delivered",
          });
          steps.push({
            kind: "fetched",
            key: false,
            pointers: {},
            note: `${e.request}'s query for ${e.key} returns at ${e.t} ms after ${formatMs(e.waitedMs)} in the queue and ${formatMs(e.queryMs)} of work${e.waiters ? `, and its result also answers ${plural(e.waiters, "waiting request")}` : ""}.`,
            sim: base(e.t, e.db, current),
          });
          break;
        }
        case "done": {
          const current = addRow({
            kind: "message",
            from: "app",
            to: "client",
            label: e.failed ? `${e.request}: ✕ error` : `${e.request}: page ${formatMs(e.latency)}`,
            at: e.t,
            status: e.failed ? "lost" : e.timedOut ? "ignored" : "delivered",
          });
          steps.push({
            kind: "done",
            key: false,
            pointers: {},
            note: e.failed
              ? `${e.request}'s page fails: one of its queries was turned away by a full queue.`
              : `${e.request}'s page is ready after ${formatMs(e.latency)}${e.waitedOn ? `, having waited on ${e.waitedOn}'s fetch` : ""}${e.timedOut ? ", past the timeout" : ""}.`,
            sim: base(e.t, e.db, current),
          });
          break;
        }
      }
    }

    // The last replay (or a lone scenario): how many keys single-flight alone can take, and the cost.
    if (run === scenarios.length - 1) {
      const last = steps.at(-1)!.sim!;
      const sweep = memoized(
        { sweep: s.rps, workers: s.workers, queryMs: s.queryMs, seeds: range.seeds },
        () =>
          KEY_SWEEP.map((keys) => {
            let without = 0;
            let withJitter = 0;
            let brokeWithout = 0;
            let brokeWith = 0;
            for (let seed = range.seeds[0]; seed <= range.seeds[1]; seed++) {
              const opts = {
                ...s,
                seed,
                keys,
                singleFlight: true,
                nodes: 1,
                record: false,
                trafficFromMs: 7500,
              };
              const a = simulateStampede({ ...opts, jitter: 0 });
              const b = simulateStampede({ ...opts, jitter: SWEEP_JITTER });
              without = Math.max(without, a.maxQueue);
              withJitter = Math.max(withJitter, b.maxQueue);
              if (!rule2Holds(a, s.workers)) brokeWithout++;
              if (!rule2Holds(b, s.workers)) brokeWith++;
            }
            return { keys, without, withJitter, brokeWithout, brokeWith };
          }),
      );
      const runs = range.seeds[1] - range.seeds[0] + 1;
      steps.push({
        kind: "keys-sweep",
        key: true,
        pointers: {},
        note: `How many keys can single-flight alone take? Every key that expires at the same moment still sends one query, so with ${s.workers} workers the queue grows with the keys: at most ${sweep.map((x) => `${x.without} with ${x.keys}`).join(", ")} keys expiring together (seeds ${range.seeds[0]}–${range.seeds[1]}, ${s.rps} pages a second). Past ${s.workers * 2} keys the queue holds more than the workers in ${sweep.at(-1)!.brokeWithout} of ${runs} runs. With TTLs jittered ${Math.round(SWEEP_JITTER * 100)}%, the queue stays at most ${Math.max(...sweep.map((x) => x.withJitter))}.`,
        sim: {
          ...last,
          rows: rows.map((r) => ({ ...r })),
          current: undefined,
          tables: [
            {
              id: "sweep",
              title: "Queue at most",
              columns: ["keys", "no / with jitter"],
              rows: sweep.map((x) => ({ cells: [String(x.keys), `${x.without} / ${x.withJitter}`] })),
            },
          ],
          metrics: [
            {
              id: `same-${KEY_SWEEP.at(-1)}`,
              label: "queue (same TTL)",
              value: String(sweep.at(-1)!.without),
            },
            {
              id: `jitter-${KEY_SWEEP.at(-1)}`,
              label: "queue (jittered)",
              value: String(sweep.at(-1)!.withJitter),
            },
            { id: "workers", label: "db workers", value: String(s.workers) },
          ],
          violations: [],
          load: {
            windows: sweep.map((x) => ({
              label: String(x.keys),
              group: "same TTL",
              offered: x.without,
              served: x.without,
              p95: 0,
              p99: 0,
              errors: 0,
              saturated: x.without > s.workers ? ["db"] : [],
              utilization: [],
            })),
            current: sweep.length - 1,
            sweep: {
              setting: "number of keys expiring together",
              unit: "keys",
              counted: "requests queued at most (same TTL)",
              hit: "requests queued at most (same TTL)",
            },
          },
        },
      });
      delete steps.at(-1)!.sim!.current;
      if (s.singleFlight) {
        const nodes3 = simulateStampede({ ...s, nodes: 3, record: false });
        steps.push({
          kind: "cost",
          key: true,
          pointers: {},
          note: `The cost: a request that waits takes as long as the fetch it waits on, p99 ${formatMs(result.waitP99)} against ${formatMs(result.hitP99)} for a hit. And single-flight coalesces only within one app node: with 3 app nodes sharing the cache, up to ${nodes3.maxPerKeyAll} fetches of one key reach the database at once (still one per node). Coordinating across nodes takes a lock in the shared cache, or accepting one fetch per node.`,
          sim: {
            ...last,
            rows: rows.map((r) => ({ ...r })),
            tables: [
              {
                id: "cost",
                title: "The cost",
                columns: ["what", "measured"],
                rows: [
                  { cells: ["p99 wait / hit", `${formatMs(result.waitP99)} / ${formatMs(result.hitP99)}`] },
                  { cells: ["3 app nodes", `${nodes3.maxPerKeyAll} fetches/key`] },
                ],
              },
            ],
            metrics: [
              { id: "wait-p99", label: "waiting p99", value: formatMs(result.waitP99) },
              { id: "hit-p99", label: "hit p99", value: formatMs(result.hitP99) },
              { id: "nodes-3", label: "3 nodes: per key", value: `${nodes3.maxPerKeyAll} at once` },
            ],
            violations: [],
          },
        });
        delete steps.at(-1)!.sim!.current;
        delete steps.at(-1)!.sim!.load;
      }
    }
  });

  // The proof: both rules over the range, for each setup.
  const first = scenarios[0];
  const setups = SETUPS.map((x) => ({ ...x, ...stampedeRuns(first, x, range) }));
  // The answer: runs where the last replay's setup broke either rule.
  const fix = scenarios.at(-1)!;
  const mine = stampedeRuns(first, { singleFlight: fix.singleFlight, jitter: fix.jitter }, range);
  const fixed = mine.broken;
  const prev = steps.at(-1)!.sim!;
  const runs = setups[0].runs;
  steps.push({
    kind: "proof",
    key: true,
    pointers: {},
    note: `Over seeds ${range.seeds[0]}–${range.seeds[1]}, ${range.rps.join(", ")} pages a second, and ${range.keys.join(", ")} keys expiring after one deploy, on one app node with ${first.workers} database workers: ${setups.map((x) => `${x.name} broke rule 1 in ${x.rule1} and rule 2 in ${x.rule2} of ${x.runs} runs`).join("; ")}. The guarantee needs one app node (or single-flight coordinated across nodes), a fetch that succeeds (a failed one must hand off to one waiting request), and TTLs jittered by ${Math.round(SWEEP_JITTER * 100)}%.`,
    sim: {
      ...prev,
      run: scenarios.length,
      runLabel: "every seed, rate, and key count",
      nodes: system.nodes.map((n) => ({ id: n.id, state: "idle" as const })),
      rows: [],
      tables: [],
      metrics: setups.map((x) => ({
        id: x.name.replace(/ /g, "-"),
        label: x.name,
        value: `${x.broken} of ${x.runs}`,
      })),
      violations: [],
      stampedeProof: {
        runs,
        seeds: range.seeds,
        rps: range.rps,
        keys: range.keys,
        setups: setups.map(({ name, singleFlight, jitter, rule1, rule2 }) => ({
          name,
          singleFlight,
          jitter,
          rule1,
          rule2,
        })),
        fixed,
      },
    },
  });
  const proof = steps.at(-1)!.sim!;
  delete proof.load;
  delete proof.current;
  delete proof.stampede;

  return {
    problem: "caching/stampede",
    row: { values: system.nodes.map((n) => n.label), display: "system" },
    system,
    pointerNames: [],
    steps,
    answer: { fixed, runs },
    answerDisplay: `${fixed} of ${runs}`,
  };
}

export const stampedeTrace: TraceDefinition<z.infer<typeof args>> = {
  problem: "caching/stampede",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args,
  run: stampede,
};
