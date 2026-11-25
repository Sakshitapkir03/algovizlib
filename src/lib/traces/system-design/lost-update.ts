import { z } from "zod";

import {
  concurrencyScenarioSchema,
  editWords,
  enumerateSchedules,
  formatValue,
  simulateConcurrency,
  type ConcurrencyEvent,
  type ConcurrencyScenario,
  type ConcurrencyScenarioInput,
  type RowState,
} from "@/lib/sim/concurrency";

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
 * "Two edits, one lost" as a trace: each scenario is a replay of the same moment (two or three editors read, change,
 * and write one row) with blind writes or compare-and-set. Its steps follow every read and write; then a sweep reruns
 * the setup with 2, 4, 8, and 16 editors starting within the same 10 ms over seeds 1–20 (blind: how many edits were
 * lost; compare-and-set: retries per editor, average and maximum, and how many gave up). The last step enumerates every
 * schedule of the editors' reads and writes for each count in the range.
 */
export const interleavingRangeSchema = z.object({
  editors: z.array(z.number().int().min(2).max(3)).min(1).max(2),
});
export type InterleavingRange = z.infer<typeof interleavingRangeSchema>;

/** The contention sweep's editor counts, and its seeds. */
export const CONTENTION = [2, 4, 8, 16] as const;
export const SWEEP_SEEDS: [number, number] = [1, 20];

const args = z.tuple([z.array(concurrencyScenarioSchema).min(1).max(2), interleavingRangeSchema]);

type RowInput = TraceSimRow extends infer R ? (R extends TraceSimRow ? Omit<R, "id"> : never) : never;

const id = (name: string) => name.toLowerCase();
export const editorTopology = (names: string[]): TraceSystem => ({
  nodes: [
    ...names.map((n, k) => ({ id: id(n), label: n, kind: "client" as const, x: 0, y: k })),
    { id: "db", label: "Database", kind: "store" as const, x: 1, y: Math.floor((names.length - 1) / 2) },
  ],
  edges: names.map((n) => ({ from: id(n), to: "db" })),
  lanes: [...names.map(id), "db"],
});

export const versionLabel = (v: number) => `v${v}`;

/** One sweep point: `n` editors, each a small change, starting within the same 10 ms. */
const crowd = (s: ConcurrencyScenario, n: number, seed: number): ConcurrencyScenarioInput => ({
  ...s,
  seed,
  record: false,
  editors: Array.from({ length: n }, (_, k) => ({
    name: `u${k + 1}`,
    startMs: (k * 7 + seed) % 10,
    delta: k % 2 ? 2 : -1,
    tag: `t${k + 1}`,
  })),
});

/** The sweep over the stated seeds for one setup and editor count. */
export function contention(s: ConcurrencyScenario, n: number) {
  let edits = 0;
  let lost = 0;
  let retries = 0;
  let max = 0;
  let gaveUp = 0;
  for (let seed = SWEEP_SEEDS[0]; seed <= SWEEP_SEEDS[1]; seed++) {
    const r = simulateConcurrency(crowd(s, n, seed));
    edits += n;
    lost += r.lost.length;
    for (const e of r.editors) {
      retries += e.retries;
      max = Math.max(max, e.retries);
      if (!e.acknowledged) gaveUp++;
    }
  }
  return { n, edits, lost, avg: Math.round((retries / edits) * 10) / 10, max, gaveUp };
}

export function lostUpdate(input: ConcurrencyScenarioInput[], range: InterleavingRange): Trace {
  const scenarios = input.map((s) => concurrencyScenarioSchema.parse(s));
  const names = scenarios[0].editors.map((e) => e.name);
  const system = editorTopology(names);
  const steps: TraceStep[] = [];

  scenarios.forEach((s, run) => {
    const cas = s.mode === "compare-and-set";
    const stock = s.kind === "stock";
    const result = simulateConcurrency(s);
    const rows: TraceSimRow[] = [];
    let rowSeq = 0;
    const copies = new Map<string, { version: number; local: string } | undefined>();
    const lost = new Set<string>();
    let retries = 0;
    let firstWrite = true;
    const retried = new Set<string>();
    const lastStart = Math.max(...s.editors.map((e) => e.startMs));
    const lastStarter = s.editors.find((e) => e.startMs === lastStart)!.name;
    let lastStarterRead = false;
    const expectedFinal = formatValue(
      s.editors.reduce(
        (v, e) =>
          stock ? (v as number) + e.delta : (v as string[]).includes(e.tag) ? v : [...(v as string[]), e.tag],
        stock ? (s.startStock as number | string[]) : [...s.startTags],
      ),
    );
    const editOf = (name: string) => s.editors.find((e) => e.name === name)!;
    const addRow = (row: RowInput) => {
      const rid = `r${++rowSeq}`;
      rows.push({ ...row, id: rid } as TraceSimRow);
      return rid;
    };
    const short = (name: string, version: number, local: string) =>
      stock
        ? `${versionLabel(version)} → ${local}`
        : `${versionLabel(version)} ${editWords("tags", editOf(name))}`;
    const tables = (e: ConcurrencyEvent): TraceSim["tables"] => {
      const history = e.history.slice(-2);
      return [
        {
          id: "row",
          title: "Row",
          columns: ["version", stock ? "stock" : "tags"],
          rows: history.map((h) => ({
            cells: [versionLabel(h.version), formatValue(h.value)],
            ...(e.kind === "write" &&
              e.outcome === "applied" &&
              h.version === e.row.version && { mark: "new" as const }),
          })),
        },
        {
          id: "copies",
          title: "Local copies",
          columns: ["clerk", "copy"],
          rows: names.map((n) => {
            const c = copies.get(n);
            const mark =
              lost.has(n) || (e.kind === "write" && e.editor === n && e.outcome === "rejected")
                ? ("duplicate" as const)
                : e.editor === n
                  ? ("new" as const)
                  : undefined;
            return { cells: [n, c ? short(n, c.version, c.local) : "—"], ...(mark && { mark }) };
          }),
        },
      ];
    };
    const metrics = (row: RowState): TraceSim["metrics"] => [
      { id: "version", label: "row version", value: versionLabel(row.version) },
      {
        id: "value",
        label: stock ? "stock" : "tags",
        value: stock ? formatValue(row.value) : `${(row.value as string[]).length} tags`,
      },
      {
        id: "expected",
        label: "should end at",
        value: stock ? expectedFinal : `${expectedFinal.split("·").length} tags`,
      },
      { id: "lost", label: "lost edits", value: String(lost.size) },
      { id: "retries", label: "retries", value: String(retries) },
    ];
    const nodes = (e: ConcurrencyEvent): TraceSim["nodes"] => [
      ...names.map((n) => ({
        id: id(n),
        state: (n === e.editor ? "busy" : "idle") as "busy" | "idle",
        badge: editWords(s.kind, editOf(n)),
      })),
      {
        id: "db",
        state: "idle" as const,
        badge: `${versionLabel(e.row.version)} · ${cas ? "compare-and-set" : "blind writes"}`,
      },
    ];

    for (const e of result.events) {
      const edit = editOf(e.editor);
      let current: string;
      let key = false;
      let note: string;
      if (e.kind === "read") {
        copies.set(e.editor, {
          version: e.version,
          local: formatValue(stock ? (e.value as number) + edit.delta : [...(e.value as string[]), edit.tag]),
        });
        current = addRow({
          kind: "message",
          from: id(e.editor),
          to: "db",
          label: stock
            ? `read → ${versionLabel(e.version)}: ${formatValue(e.value)}`
            : `read → ${versionLabel(e.version)}`,
          at: e.t,
          status: "delivered",
        });
        const local = copies.get(e.editor)!.local;
        if (run === 0 && e.editor === lastStarter && !lastStarterRead) key = true;
        if (e.editor === lastStarter) lastStarterRead = true;
        note =
          e.attempt > 0
            ? `${e.editor} reads again at ${e.t} ms: version ${e.version}, ${stock ? `stock ${formatValue(e.value)}` : `tags ${formatValue(e.value)}`}, and redoes the change on top of it: ${editWords(s.kind, edit)} gives ${local}.`
            : `${e.editor} reads the row at ${e.t} ms: version ${e.version}, ${stock ? `stock ${formatValue(e.value)}` : `tags ${formatValue(e.value)}`}. To ${editWords(s.kind, edit)}, ${e.editor} will write ${local}.`;
      } else {
        addRow({
          kind: "message",
          from: id(e.editor),
          to: "db",
          label: cas
            ? `write ${stock ? formatValue(e.local) : `+${edit.tag}`} if ${versionLabel(e.expected)}`
            : `write ${stock ? formatValue(e.local) : `+${edit.tag}`}`,
          at: e.t,
          status: "delivered",
        });
        if (e.outcome === "rejected") retries++;
        for (const o of e.overwrote) lost.add(o);
        current = addRow({
          kind: "note",
          lane: "db",
          text:
            e.outcome === "rejected"
              ? `✕ rejected: row at ${versionLabel(e.rowVersion)}`
              : e.overwrote.length
                ? `✓ ${versionLabel(e.row.version)} = ${stock ? formatValue(e.row.value) : `+${edit.tag}`} · ${e.overwrote.length === 1 ? `${e.overwrote[0]}'s edit` : `${e.overwrote.length} edits`} lost`
                : `✓ ${versionLabel(e.row.version)} = ${stock ? formatValue(e.row.value) : `+${edit.tag}`}`,
          at: e.t,
          tone: e.outcome === "rejected" ? "neutral" : e.overwrote.length ? "negative" : "positive",
        });
        const isRetry = e.attempt > 0 && e.outcome === "applied" && !retried.has(e.editor);
        if (isRetry) retried.add(e.editor);
        key = e.outcome === "rejected" || e.overwrote.length > 0 || (run === 0 && firstWrite) || isRetry;
        firstWrite = false;
        const writes = stock ? `stock ${formatValue(e.local)}` : `the tags with ${edit.tag} added`;
        note =
          e.outcome === "rejected"
            ? `${e.editor}'s write arrives at ${e.t} ms expecting version ${e.expected}, but the row is at version ${e.rowVersion}: someone changed it since ${e.editor} read it, so compare-and-set rejects the write and nothing is lost.`
            : e.overwrote.length
              ? `${e.editor}'s write arrives at ${e.t} ms and replaces the row with ${writes}, computed from version ${e.expected}. The row was at version ${e.rowVersion}, which held ${e.overwrote.join(" and ")}'s edit, so that edit is lost, and nobody sees an error.`
              : `${e.editor}'s write arrives at ${e.t} ms${cas ? `, expecting version ${e.expected}, and the row is still at version ${e.rowVersion}` : ""}: it applies as version ${e.row.version}, ${writes}.`;
      }
      steps.push({
        kind:
          e.kind === "read"
            ? "read"
            : e.outcome === "rejected"
              ? "rejected"
              : e.overwrote.length
                ? "overwrite"
                : "applied",
        key,
        pointers: {},
        note,
        sim: {
          run,
          runLabel: s.label,
          t: e.t,
          nodes: nodes(e),
          tokens: [],
          rows: rows.map((r) => ({ ...r })),
          current,
          tables: tables(e),
          metrics: metrics(e.row),
          violations: lost.size ? [`${[...lost].join(", ")}'s edit was lost`] : [],
          edit: {
            editor: e.editor,
            op: e.kind,
            cas,
            expected: e.kind === "read" ? e.version : e.expected,
            rowVersion: e.kind === "read" ? e.version : e.rowVersion,
            read: formatValue(e.kind === "read" ? e.value : e.read),
            ...(e.kind === "write" && { local: formatValue(e.local), outcome: e.outcome }),
            overwrote: e.kind === "write" ? e.overwrote : [],
            after: formatValue(e.row.value),
            kind: s.kind,
            ...(stock ? { delta: edit.delta } : { tag: edit.tag }),
          },
        },
      });
    }

    // The sweep: the same kind of edit with 2–16 editors starting within the same 10 ms, over the stated seeds.
    const sweep = CONTENTION.map((n) => contention(s, n));
    const last = result.events.at(-1)!;
    const windows: TraceLoadWindow[] = sweep.map((c) => ({
      label: String(c.n),
      group: s.label,
      // Blind: edits (outline) and edits lost (bar). Compare-and-set: the most retries any editor needed (outline) and
      // the average (bar).
      offered: cas ? c.max : c.edits,
      served: cas ? c.avg : c.lost,
      p95: 0,
      p99: 0,
      errors: 0,
      saturated: [],
      utilization: [],
    }));
    const worst = sweep.at(-1)!;
    steps.push({
      kind: "sweep",
      key: true,
      pointers: {},
      note: cas
        ? `The cost: with ${CONTENTION.join(", ")} editors starting within the same 10 ms (seeds ${SWEEP_SEEDS[0]}–${SWEEP_SEEDS[1]}), no edit was lost, but a conflicting editor has to retry: ${sweep.map((c) => `${c.avg} retries on average and at most ${c.max} with ${c.n}`).join(", ")}${worst.gaveUp ? `; with ${worst.n}, ${worst.gaveUp} of ${worst.edits} edits gave up after ${s.maxRetries} retries and were never confirmed` : ""}. Compare-and-set prevents lost updates, but it doesn't guarantee every editor finishes quickly: under heavy contention one editor can keep losing the race.`
        : `With ${CONTENTION.join(", ")} editors starting within the same 10 ms (seeds ${SWEEP_SEEDS[0]}–${SWEEP_SEEDS[1]}), blind writes lost ${sweep.map((c) => `${c.lost} of ${c.edits} edits with ${c.n}`).join(", ")}, with no error to anyone.`,
      sim: {
        run,
        runLabel: s.label,
        t: last.t,
        nodes: nodes(last).map((n) => ({ ...n, state: "idle" as const })),
        tokens: [],
        rows: rows.map((r) => ({ ...r })),
        tables: [
          {
            id: "contention",
            title: cas ? "Retries per editor" : "Edits lost",
            columns: ["editors", cas ? "retries" : "lost"],
            rows: sweep.map((c) => ({
              cells: [String(c.n), cas ? `${c.avg} avg · ${c.max} max` : `${c.lost} of ${c.edits}`],
            })),
          },
        ],
        metrics: sweep.flatMap((c) =>
          cas
            ? [
                { id: `avg-${c.n}`, label: `avg at ${c.n}`, value: String(c.avg) },
                { id: `max-${c.n}`, label: `max at ${c.n}`, value: String(c.max) },
                { id: `gaveup-${c.n}`, label: `gave up at ${c.n}`, value: `${c.gaveUp} of ${c.edits}` },
              ]
            : [{ id: `lost-${c.n}`, label: `${c.n} editors`, value: `${c.lost} of ${c.edits}` }],
        ),
        violations: [],
        load: {
          windows,
          current: windows.length - 1,
          sweep: cas
            ? {
                setting: "number of editors",
                unit: "editors",
                counted: "retries at most (any editor)",
                hit: "retries on average",
              }
            : { setting: "number of editors", unit: "editors", counted: "edits", hit: "were lost" },
        },
      },
    });
  });

  // The proof: every schedule of each editor count's reads and writes, blind and with compare-and-set.
  const kind = scenarios[0].kind;
  const cases = range.editors.map((n) => {
    const blind = enumerateSchedules(n, false, kind);
    const cas = enumerateSchedules(n, true, kind);
    return {
      editors: n,
      blind: { schedules: blind.schedules, lost: blind.lost },
      cas: { schedules: cas.schedules, lost: cas.lost },
    };
  });
  const runs = cases.reduce((t, c) => t + c.cas.schedules, 0);
  const fixed = cases.reduce((t, c) => t + c.cas.lost, 0);
  const prev = steps.at(-1)!.sim!;
  steps.push({
    kind: "proof",
    key: true,
    pointers: {},
    note: `Every interleaving of ${cases.map((c) => `${c.editors} editors' reads and writes`).join(" and of ")}: with blind writes, ${cases.map((c) => `${c.blind.lost} of ${c.blind.schedules}`).join(" and ")} lose an edit; with compare-and-set, counting every retry, ${cases.map((c) => `${c.cas.lost} of ${c.cas.schedules}`).join(" and ")} do. The guarantee needs one database applying compare-and-set atomically on the version, each change recomputed from the value just read, and every editor retrying until its write applies.`,
    sim: {
      ...prev,
      run: scenarios.length,
      runLabel: "every interleaving",
      nodes: system.nodes.map((n) => ({ id: n.id, state: "idle" as const })),
      rows: [],
      tables: [],
      metrics: cases.flatMap((c) => [
        {
          id: `blind-${c.editors}`,
          label: `blind, ${c.editors} editors`,
          value: `${c.blind.lost} of ${c.blind.schedules}`,
        },
        {
          id: `cas-${c.editors}`,
          label: `fix, ${c.editors} editors`,
          value: `${c.cas.lost} of ${c.cas.schedules}`,
        },
      ]),
      violations: [],
      load: undefined,
      interleavingProof: { cases, runs, fixed },
    },
  });
  delete steps.at(-1)!.sim!.load;
  delete steps.at(-1)!.sim!.current;

  return {
    problem: "consistency/lost-update",
    row: { values: system.nodes.map((n) => n.label), display: "system" },
    system,
    pointerNames: [],
    steps,
    answer: { fixed, runs },
    answerDisplay: `${fixed} of ${runs}`,
  };
}

export const lostUpdateTrace: TraceDefinition<z.infer<typeof args>> = {
  problem: "consistency/lost-update",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args,
  run: lostUpdate,
};
