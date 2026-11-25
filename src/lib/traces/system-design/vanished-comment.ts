import { z } from "zod";

import {
  FOLLOWED,
  replicationScenarioSchema,
  simulateReplication,
  type ReadRecord,
  type ReplicationEvent,
  type ReplicationScenario,
  type ReplicationScenarioInput,
  type StoresSnapshot,
} from "@/lib/sim/replication";

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
 * "I posted a comment and it vanished" as a trace: each scenario is a replay of the same moment (Ana posts a comment
 * during a lag spike, then reloads) with or without read-your-writes. Its steps follow Ana's write, the confirmation,
 * her reloads, and the replica applying her version; then a sweep reruns the replay's setup at four mean lags and
 * counts the reloads right after a write that came back without the writer's own comment, and (with the fix) a step
 * measures the reads it sent to the primary. The last step checks the rule over the stated range with the first
 * replay's setup and with the last's.
 */
export const readProofRangeSchema = z.object({
  seeds: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  lags: z.array(z.number().int().min(0).max(3000)).min(1).max(4),
  spikes: z.array(z.boolean()).min(1).max(2),
  readAfter: z.array(z.number().int().min(20).max(3000)).min(1).max(3),
});
export type ReadProofRange = z.infer<typeof readProofRangeSchema>;

/** The mean lags the sweep compares (and the chart's columns). */
export const LAG_LEVELS = [50, 200, 500, 1000] as const;
/** The lag spike the proof and "Your scenario" use: 3 seconds from 3 s in, versions taking about 2 s. */
export const PROOF_SPIKE = { atMs: 3000, durationMs: 3000, lagMs: 2000 } as const;

/** What the sweep's columns measure. */
const SWEEP = {
  setting: "mean lag",
  unit: "ms",
  counted: "reloads right after the user's own write",
  hit: "came back without it",
} as const;

/** What the cost step's columns measure: reads a second sent to the primary, out of all reads a second. */
const PRIMARY_SWEEP = {
  setting: "mean lag",
  unit: "ms",
  counted: "reads a second",
  hit: "went to the primary",
} as const;

const args = z.tuple([z.array(replicationScenarioSchema).min(1).max(2), readProofRangeSchema]);

type RowInput = TraceSimRow extends infer R ? (R extends TraceSimRow ? Omit<R, "id"> : never) : never;

export const replicationTopology = (): TraceSystem => ({
  nodes: [
    { id: "client", label: FOLLOWED, kind: "client", x: 0, y: 0 },
    { id: "app", label: "App", kind: "server", x: 1, y: 0 },
    { id: "primary", label: "Primary", kind: "store", x: 2, y: 0 },
    { id: "replica", label: "Replica", kind: "store", x: 2, y: 1 },
  ],
  edges: [
    { from: "client", to: "app" },
    { from: "app", to: "primary" },
    { from: "app", to: "replica" },
    { from: "primary", to: "replica" },
  ],
  lanes: ["client", "app", "primary", "replica"],
});

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
/** A version as drawn: "v42". */
export const versionLabel = (v: number) => `v${v}`;
const comment = (author: string) => (author === FOLLOWED ? `${FOLLOWED}'s comment` : `comment by ${author}`);

/** A setup's rule over the range: how many runs had a read older than its session's own confirmed write. */
export function readRuleRuns(setup: ReplicationScenario, range: ReadProofRange) {
  let runs = 0;
  let broken = 0;
  for (let seed = range.seeds[0]; seed <= range.seeds[1]; seed++)
    for (const lagMs of range.lags)
      for (const spiked of range.spikes)
        for (const readAfterMs of range.readAfter) {
          runs++;
          const r = simulateReplication(
            { ...setup, seed, lagMs, readAfterMs, spike: spiked ? PROOF_SPIKE : null, follow: null },
            { record: false },
          );
          if (r.violations.length > 0) broken++;
        }
  return { runs, broken };
}

export function vanishedComment(input: ReplicationScenarioInput[], range: ReadProofRange): Trace {
  const scenarios = input.map((s) => replicationScenarioSchema.parse(s));
  const system = replicationTopology();
  const steps: TraceStep[] = [];
  const chart: TraceLoadWindow[] = [];

  scenarios.forEach((s, run) => {
    const fix = s.fix === "read-your-writes";
    const result = simulateReplication(s);
    const rows: TraceSimRow[] = [];
    let rowSeq = 0;
    let mine = 0;
    let stale = 0;
    let streamRow: string | undefined;
    // Ana's version on the replication stream: moving from the write until the replica applies it (then arrived, for
    // that step only).
    let stream: TraceSim["tokens"][number] | undefined;
    let firstRead = true;
    let sawStale = false;
    const addRow = (row: RowInput) => {
      const id = `r${++rowSeq}`;
      rows.push({ ...row, id } as TraceSimRow);
      return id;
    };
    const table = (
      id: "primary" | "replica",
      stores: StoresSnapshot,
      mark?: { version: number; mark: "new" | "read" },
    ): TraceSim["tables"][number] => {
      const top = id === "primary" ? stores.primary : stores.replica;
      const versions = [top - 1, top].filter((v) => v >= 1);
      return {
        id,
        title: id === "primary" ? "Primary" : "Replica",
        columns: ["version", "comment"],
        rows: versions.map((v) => ({
          cells: [versionLabel(v), comment(stores.authors[v - 1])],
          ...(mark?.version === v && { mark: mark.mark }),
        })),
      };
    };
    const nodes = (stores: StoresSnapshot, busy?: "primary" | "replica"): TraceSim["nodes"] => {
      const behind = stores.primary - stores.replica;
      return [
        { id: "client", state: "idle", ...(fix && mine && { badge: `token ${versionLabel(mine)}` }) },
        { id: "app", state: "idle", badge: fix ? "read-your-writes" : "reads → replica" },
        { id: "primary", state: busy === "primary" ? "busy" : "idle", badge: versionLabel(stores.primary) },
        {
          id: "replica",
          state: busy === "replica" ? "busy" : behind > 0 ? "waiting" : "idle",
          badge:
            behind > 0 ? `${versionLabel(stores.replica)} · ${behind} behind` : versionLabel(stores.replica),
        },
      ];
    };
    const metrics = (stores: StoresSnapshot): TraceSim["metrics"] => [
      { id: "primary", label: "primary", value: versionLabel(stores.primary) },
      { id: "replica", label: "replica", value: versionLabel(stores.replica) },
      {
        id: "behind",
        label: "replica behind",
        value: stores.behindMs ? seconds(stores.behindMs) : "caught up",
      },
      { id: "mine", label: `${FOLLOWED}'s write`, value: mine ? versionLabel(mine) : "—" },
      { id: "stale", label: "stale reads", value: String(stale) },
    ];
    const push = (
      step: Omit<TraceStep, "pointers" | "sim">,
      e: ReplicationEvent,
      extra: {
        tables?: TraceSim["tables"];
        busy?: "primary" | "replica";
        current?: string;
        read?: ReadRecord;
      } = {},
    ) => {
      steps.push({
        ...step,
        pointers: {},
        sim: {
          run,
          runLabel: s.label,
          t: e.t,
          nodes: nodes(e.stores, extra.busy),
          tokens: stream ? [{ ...stream }] : [],
          rows: rows.map((r) => ({ ...r })),
          current: extra.current,
          tables: extra.tables ?? [table("primary", e.stores), table("replica", e.stores)],
          metrics: metrics(e.stores),
          violations: stale ? [`${FOLLOWED} read an older version than her own write`] : [],
          ...(extra.read && {
            read: {
              user: extra.read.user,
              store: extra.read.store,
              returned: extra.read.returned,
              token: extra.read.token,
              replicaAt: extra.read.replicaAt,
              fix,
            },
          }),
        },
      });
      if (extra.current === undefined) delete steps.at(-1)!.sim!.current;
    };

    for (const e of result.events) {
      switch (e.kind) {
        case "spike": {
          const current = addRow({
            kind: "note",
            lane: "replica",
            text: `⚠ lag spike: ${seconds(e.lagMs)}`,
            at: e.t,
            tone: "negative",
          });
          push(
            {
              kind: "spike",
              key: false,
              note: `At ${e.t} ms the replica falls behind: for ${seconds(e.durationMs)}, each new version takes about ${seconds(e.lagMs)} to reach it.`,
            },
            e,
            { current },
          );
          break;
        }
        case "write": {
          addRow({
            kind: "message",
            from: "client",
            to: "app",
            label: "post comment",
            at: e.t,
            status: "delivered",
          });
          const current = addRow({
            kind: "message",
            from: "app",
            to: "primary",
            label: `write → ${versionLabel(e.version)}`,
            at: e.t,
            status: "delivered",
          });
          stream = {
            id: "stream",
            label: versionLabel(e.version),
            from: "primary",
            to: "replica",
            status: "moving",
          };
          streamRow = addRow({
            kind: "message",
            from: "primary",
            to: "replica",
            label: `${versionLabel(e.version)} (${FOLLOWED})`,
            at: e.t,
            status: "in-flight",
          });
          push(
            {
              kind: "write",
              key: false,
              note: `${FOLLOWED} posts a comment at ${e.t} ms: the app writes it to the primary, which stores it as version ${e.version}.`,
            },
            e,
            {
              current,
              busy: "primary",
              tables: [
                table("primary", e.stores, { version: e.version, mark: "new" }),
                table("replica", e.stores),
              ],
            },
          );
          break;
        }
        case "ack": {
          mine = e.version;
          const current = addRow({
            kind: "message",
            from: "app",
            to: "client",
            label: `posted ✓ ${versionLabel(e.version)}`,
            at: e.t,
            status: "delivered",
          });
          push(
            {
              kind: "ack",
              key: run === 0,
              note: `At ${e.t} ms the primary confirms version ${e.version} and ${FOLLOWED} sees "posted". The replication stream is still carrying it to the replica, which has applied up to version ${e.stores.replica}.`,
            },
            e,
            { current },
          );
          break;
        }
        case "apply": {
          const row = rows.find((r) => r.id === streamRow);
          if (row?.kind === "message") row.status = "delivered";
          if (stream) stream.status = "arrived";
          const current = addRow({
            kind: "note",
            lane: "replica",
            text: `applied ${versionLabel(e.version)} (+${seconds(e.delayMs)})`,
            at: e.t,
            tone: "neutral",
          });
          push(
            {
              kind: "apply",
              key: false,
              note: `At ${e.t} ms the replica applies version ${e.version}, ${seconds(e.delayMs)} after the primary committed it.`,
            },
            e,
            {
              current,
              busy: "replica",
              tables: [
                table("primary", e.stores),
                table("replica", e.stores, { version: e.version, mark: "new" }),
              ],
            },
          );
          stream = undefined;
          break;
        }
        case "read": {
          const r = e.read;
          addRow({
            kind: "message",
            from: "client",
            to: "app",
            label: fix && r.token ? `reload (token ${versionLabel(r.token)})` : "reload",
            at: r.t,
            status: "delivered",
          });
          addRow({
            kind: "message",
            from: "app",
            to: r.store,
            label: `read → ${versionLabel(r.returned)}`,
            at: r.t,
            status: "delivered",
          });
          if (r.stale) stale++;
          const current = addRow({
            kind: "note",
            lane: "client",
            text: r.stale
              ? `✕ comment gone (${versionLabel(r.returned)})`
              : `✓ comment there (${versionLabel(r.returned)})`,
            at: r.t,
            tone: r.stale ? "negative" : "positive",
          });
          const reappears = !r.stale && sawStale;
          const key = firstRead || reappears;
          const where =
            r.store === "primary"
              ? `The replica has applied only version ${r.replicaAt}, older than her token, so the app sends the read to the primary`
              : fix
                ? `The replica has applied version ${r.replicaAt}, at least her token, so the replica serves it`
                : `The app reads from the replica, which has applied up to version ${r.replicaAt}`;
          const outcome = r.stale
            ? `the page comes back at version ${r.returned}, without her comment: it seems to have vanished`
            : reappears
              ? `the page comes back at version ${r.returned}, and her comment is back`
              : `the page comes back at version ${r.returned}, with her comment`;
          push(
            {
              kind: r.stale ? "stale-read" : "read",
              key,
              note: `${FOLLOWED} reloads at ${r.t} ms${fix && r.token ? `, carrying her last write's version, ${r.token}` : ""}. ${where}, and ${outcome}.`,
            },
            e,
            {
              current,
              read: r,
              tables: [
                table(
                  "primary",
                  e.stores,
                  r.store === "primary" ? { version: r.returned, mark: "read" } : undefined,
                ),
                table(
                  "replica",
                  e.stores,
                  r.store === "replica" ? { version: r.returned, mark: "read" } : undefined,
                ),
              ],
            },
          );
          firstRead = false;
          if (r.stale) sawStale = true;
          break;
        }
      }
    }

    // The sweep: the same setup (nobody followed) at each mean lag, counting reloads right after a write that came
    // back without the writer's own comment, and the reads sent to the primary.
    const sweep = LAG_LEVELS.map((lagMs) => ({
      lagMs,
      r: simulateReplication({ ...s, lagMs, follow: null }, { record: false }),
    }));
    for (const { lagMs, r } of sweep)
      chart.push({
        label: String(lagMs),
        group: s.label,
        offered: r.reloadsAfterWrite,
        served: r.staleReloads,
        p95: 0,
        p99: 0,
        errors: 0,
        saturated: [],
        utilization: [],
      });
    const lastEvent = result.events.at(-1);
    const stores: StoresSnapshot = lastEvent?.stores ?? { primary: 0, replica: 0, behindMs: 0, authors: [] };
    const t = s.durationMs;
    const spikeWords = s.spike
      ? `, with a ${seconds(s.spike.durationMs)} lag spike to about ${seconds(s.spike.lagMs)}`
      : "";
    const counts = sweep.map(({ lagMs, r }) => `${r.staleReloads} at ${lagMs} ms`).join(", ");
    const sim = (extra: Partial<TraceSim>): TraceSim => ({
      run,
      runLabel: s.label,
      t,
      nodes: nodes(stores),
      tokens: [],
      rows: rows.map((r) => ({ ...r })),
      tables: [table("primary", stores), table("replica", stores)],
      metrics: sweep.map(({ lagMs, r }) => ({
        id: `lag-${lagMs}`,
        label: `${lagMs} ms lag`,
        value: `${r.staleReloads} of ${r.reloadsAfterWrite}`,
      })),
      violations: [],
      ...extra,
    });
    steps.push({
      kind: "sweep",
      key: true,
      pointers: {},
      note: `Over ${seconds(s.durationMs)} of traffic${spikeWords}, ${sweep[0].r.reloadsAfterWrite} posts were followed by their author reloading about ${s.readAfterMs} ms later. ${fix ? "With read-your-writes" : "With every read on the replica"}, the reloads that came back without the user's own comment: ${counts} of mean lag.`,
      sim: sim({ load: { windows: chart.map((c) => ({ ...c })), current: chart.length - 1, sweep: SWEEP } }),
    });
    if (fix) {
      const share = (r: (typeof sweep)[number]["r"]) => Math.round((100 * r.primaryReads) / r.reads);
      const perSec = (r: (typeof sweep)[number]["r"]) => (r.primaryReads / (s.durationMs / 1000)).toFixed(1);
      const worst = sweep.at(-1)!;
      steps.push({
        kind: "cost",
        key: true,
        pointers: {},
        note: `The cost: read-your-writes sent reads to the primary, which otherwise takes only writes (about ${s.writesPerSec} a second): ${sweep.map(({ lagMs, r }) => `${perSec(r)} reads a second (${share(r)}% of reads) at ${lagMs} ms`).join(", ")}. The more the replica lags, the more load moves back to the primary.`,
        sim: sim({
          // Reads a second sent to the primary (the bar) out of all reads a second (the outline), at each mean lag.
          load: {
            windows: sweep.map(({ lagMs, r }) => ({
              label: String(lagMs),
              group: s.label,
              offered: Number(((r.reads * 1000) / s.durationMs).toFixed(1)),
              served: Number(perSec(r)),
              p95: 0,
              p99: 0,
              errors: 0,
              saturated: [],
              utilization: [],
            })),
            current: sweep.length - 1,
            sweep: PRIMARY_SWEEP,
          },
          tables: [
            {
              id: "primary-load",
              title: "Reads to primary",
              columns: ["lag", "reads/s"],
              rows: sweep.map(({ lagMs, r }) => ({
                cells: [`${lagMs} ms`, `${perSec(r)}/s · ${share(r)}%`],
              })),
            },
          ],
          metrics: [
            { id: "writes", label: "primary writes", value: `${s.writesPerSec}/s` },
            { id: "worst", label: `reads at ${worst.lagMs} ms`, value: `+${perSec(worst.r)}/s` },
            { id: "share", label: `share at ${worst.lagMs} ms`, value: `${share(worst.r)}%` },
          ],
        }),
      });
    }
  });

  // The proof: the rule over the stated range with the first replay's setup and with the last's.
  const first = scenarios[0];
  const fixSetup = scenarios.at(-1)!;
  const baseline = readRuleRuns(first, range);
  const fixed = readRuleRuns(fixSetup, range);
  const spikes = range.spikes
    .map((on) =>
      on
        ? `with a ${seconds(PROOF_SPIKE.durationMs)} spike to ${seconds(PROOF_SPIKE.lagMs)}`
        : "without a spike",
    )
    .join(" and ");
  const last = steps.at(-1)!.sim!;
  steps.push({
    kind: "proof",
    key: true,
    pointers: {},
    note: `Over seeds ${range.seeds[0]}–${range.seeds[1]}, mean lags ${range.lags.join(", ")} ms ${spikes}, and reloads ${range.readAfter.join(", ")} ms after writing: ${scenarios.length > 1 ? `${first.label} returned a user an older version than their own write in ${baseline.broken} of ${baseline.runs} runs; ${fixSetup.label} in ${fixed.broken} of ${fixed.runs}` : `${fixSetup.label} returned a user an older version than their own write in ${fixed.broken} of ${fixed.runs} runs`}. The guarantee needs one primary taking every write in order, the session's token sent with every read, and no failover to a replica that lacks a confirmed write.`,
    sim: {
      ...last,
      run: scenarios.length,
      runLabel: "every seed and lag",
      nodes: system.nodes.map((n) => ({ id: n.id, state: "idle" as const })),
      rows: [],
      tables: [],
      metrics: [
        { id: "baseline", label: first.label, value: `${baseline.broken} of ${baseline.runs}` },
        { id: "fixed", label: fixSetup.label, value: `${fixed.broken} of ${fixed.runs}` },
      ],
      violations: [],
      load: { windows: chart.map((c) => ({ ...c })), sweep: SWEEP },
      readProof: {
        runs: fixed.runs,
        seeds: range.seeds,
        lags: range.lags,
        spikes: range.spikes,
        spike: { lagMs: PROOF_SPIKE.lagMs, durationMs: PROOF_SPIKE.durationMs },
        readAfter: range.readAfter,
        baseline: baseline.broken,
        fixed: fixed.broken,
      },
    },
  });
  delete steps.at(-1)!.sim!.current;
  delete steps.at(-1)!.sim!.read;

  return {
    problem: "replication/vanished-comment",
    row: { values: system.nodes.map((n) => n.label), display: "system" },
    system,
    pointerNames: [],
    steps,
    answer: { baseline: baseline.broken, fixed: fixed.broken, runs: fixed.runs },
    answerDisplay: `${fixed.broken} of ${fixed.runs}`,
  };
}

export const vanishedCommentTrace: TraceDefinition<z.infer<typeof args>> = {
  problem: "replication/vanished-comment",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args,
  run: vanishedComment,
};
