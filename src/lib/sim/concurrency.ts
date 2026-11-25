import { z } from "zod";

import { EventLoop } from "./events";
import { jitter, streams } from "./random";

/**
 * "Two edits, one lost": one database row with a version (it goes up on every write) and editors that each read the
 * row, work out their change from what they read, and write the result back. Writes are blind (always applied) or
 * compare-and-set (applied only if the row is still at the version the editor read; compare and write happen in one
 * atomic step, so nothing slips in between). A rejected editor reads again and retries its change on top of the new
 * value, up to `maxRetries` times in the timed replay (the exhaustive proof retries until the write applies).
 *
 * Edits are composable, so "reflected in the final value" is exact: a stock change (`delta`, the final stock must be
 * the starting stock plus every acknowledged change) or adding a tag to a shared document (every acknowledged tag must
 * be in the final list). The row tracks which edits each version contains (the version an editor read, plus its own
 * edit), so a write computed from a stale read that replaces a newer version is caught as it happens: the edits it
 * drops are overwritten.
 *
 * The rule: every acknowledged edit is reflected in the final value (no lost update). It depends on one database
 * applying compare-and-set atomically, on comparing the version (not the value: a change and its reversal would look
 * like no change), on edits recomputed from the value just read, and on editors retrying until their write applies.
 * Latencies are illustrative.
 */

export const EDIT_KINDS = ["stock", "tags"] as const;
export type EditKind = (typeof EDIT_KINDS)[number];

const editorSchema = z.object({
  name: z.string().trim().min(1).max(8),
  startMs: z.number().int().nonnegative().max(5000),
  /** Stock: the change (−3 sells three). Tags: the tag to add. */
  delta: z.number().int().min(-99).max(99).default(0),
  tag: z.string().trim().min(1).max(4).default("x"),
});

export const concurrencyScenarioSchema = z.object({
  label: z.string().trim().min(1).max(12),
  seed: z.number().int().min(0).max(999_999),
  mode: z.enum(["blind", "compare-and-set"]),
  kind: z.enum(EDIT_KINDS),
  /** The row before anyone edits it. */
  startVersion: z.number().int().min(1).max(99).default(7),
  startStock: z.number().int().min(0).max(999).default(20),
  startTags: z.array(z.string().trim().min(1).max(4)).max(2).default(["new"]),
  editors: z.array(editorSchema).min(1).max(16),
  /** Mean time an editor spends between reading and writing (ms). */
  thinkMs: z.number().int().min(5).max(500).default(40),
  maxRetries: z.number().int().min(1).max(20).default(10),
  /** Record each editor's steps (the lesson's few editors), or only count (the contention sweep). */
  record: z.boolean().default(true),
});
export type ConcurrencyScenario = z.infer<typeof concurrencyScenarioSchema>;
export type ConcurrencyScenarioInput = z.input<typeof concurrencyScenarioSchema>;

/** A row's value: the stock count, or the document's tags. */
export type RowValue = number | string[];

/** The row: its version, value, and which editors' edits that value contains. */
export type RowState = { version: number; value: RowValue; includes: string[] };

/** What the row held at each version (history), for drawing. */
export type RowHistory = { version: number; value: RowValue; by?: string }[];

export const formatValue = (v: RowValue) => (typeof v === "number" ? String(v) : v.join("·"));

/** The edit as drawn: "sell 3", "receive 5", "+q3". */
export function editWords(kind: EditKind, e: { delta: number; tag: string }) {
  if (kind === "tags") return `+${e.tag}`;
  return e.delta < 0 ? `sell ${-e.delta}` : `receive ${e.delta}`;
}

/** Apply one edit to a value read from the row. */
export function applyEdit(kind: EditKind, value: RowValue, e: { delta: number; tag: string }): RowValue {
  if (kind === "stock") return (value as number) + e.delta;
  const tags = value as string[];
  return tags.includes(e.tag) ? [...tags] : [...tags, e.tag];
}

export type WriteOutcome = "applied" | "rejected";

/**
 * The database row, shared by the timed replay and the exhaustive proof. `read` returns a snapshot; `write` applies a
 * value computed from a snapshot, blind or only if the row is still at the snapshot's version, in one atomic step.
 */
export class Row {
  state: RowState;
  history: RowHistory;
  constructor(version: number, value: RowValue) {
    this.state = { version, value, includes: [] };
    this.history = [{ version, value }];
  }
  read(): RowState {
    return { ...this.state, value: copy(this.state.value), includes: [...this.state.includes] };
  }
  /** Returns the outcome and, when applied, the edits this write dropped (they were in the row, not in its read). */
  write(
    editor: string,
    from: RowState,
    value: RowValue,
    cas: boolean,
  ): { outcome: WriteOutcome; before: number; overwrote: string[] } {
    const before = this.state.version;
    if (cas && before !== from.version) return { outcome: "rejected", before, overwrote: [] };
    const includes = [...new Set([...from.includes, editor])];
    const overwrote = this.state.includes.filter((x) => !includes.includes(x));
    this.state = { version: before + 1, value: copy(value), includes };
    this.history.push({ version: before + 1, value: copy(value), by: editor });
    return { outcome: "applied", before, overwrote };
  }
}
const copy = (v: RowValue): RowValue => (typeof v === "number" ? v : [...v]);

export type ConcurrencyEvent = (
  | { kind: "read"; t: number; editor: string; version: number; value: RowValue; attempt: number }
  | {
      kind: "write";
      t: number;
      editor: string;
      /** The version the write was computed from (what compare-and-set expects). */
      expected: number;
      /** The value it read, and the value it writes. */
      read: RowValue;
      local: RowValue;
      outcome: WriteOutcome;
      /** The row's version when the write arrived. */
      rowVersion: number;
      overwrote: string[];
      attempt: number;
    }
) & { row: RowState; history: RowHistory };

type EventBody = ConcurrencyEvent extends infer E
  ? E extends ConcurrencyEvent
    ? Omit<E, "row" | "history">
    : never
  : never;

export type EditorResult = { name: string; acknowledged: boolean; retries: number; doneMs?: number };

export type ConcurrencyRun = {
  events: ConcurrencyEvent[];
  editors: EditorResult[];
  final: RowState;
  /** Acknowledged edits missing from the final value. */
  lost: string[];
  /** Whether the final value is exactly the start with every acknowledged edit applied (stock: the sum). */
  valueCorrect: boolean;
};

const HOP = { base: 2, spread: 4 };

export function simulateConcurrency(input: ConcurrencyScenarioInput): ConcurrencyRun {
  const s = concurrencyScenarioSchema.parse(input);
  const cas = s.mode === "compare-and-set";
  const loop = new EventLoop(60_000, 100_000);
  const rng = streams(s.seed);
  const hop = () => jitter(rng("net"), HOP.base, HOP.spread);
  const row = new Row(s.startVersion, s.kind === "stock" ? s.startStock : [...s.startTags]);
  const events: ConcurrencyEvent[] = [];
  const results: EditorResult[] = s.editors.map((e) => ({ name: e.name, acknowledged: false, retries: 0 }));
  const log = (e: EventBody) => {
    if (s.record)
      events.push({ ...e, row: row.read(), history: row.history.map((h) => ({ ...h })) } as ConcurrencyEvent);
  };

  s.editors.forEach((editor, k) => {
    const result = results[k];
    // Each editor's think time has its own stream, so adding an editor never changes the others' timings.
    const think = () => Math.max(1, Math.round(s.thinkMs * (0.5 + rng(`think:${editor.name}`)())));
    const attempt = () => {
      loop.after(hop(), () => {
        const snap = row.read();
        log({
          kind: "read",
          t: loop.now,
          editor: editor.name,
          version: snap.version,
          value: snap.value,
          attempt: result.retries,
        });
        const local = applyEdit(s.kind, snap.value, editor);
        loop.after(hop() + think() + hop(), () => {
          const w = row.write(editor.name, snap, local, cas);
          log({
            kind: "write",
            t: loop.now,
            editor: editor.name,
            expected: snap.version,
            read: snap.value,
            local,
            outcome: w.outcome,
            rowVersion: w.before,
            overwrote: w.overwrote,
            attempt: result.retries,
          });
          loop.after(hop(), () => {
            if (w.outcome === "applied") {
              result.acknowledged = true;
              result.doneMs = loop.now - editor.startMs;
            } else if (result.retries < s.maxRetries) {
              result.retries++;
              attempt();
            }
          });
        });
      });
    };
    loop.after(editor.startMs, attempt);
  });
  loop.run();

  const final = row.read();
  const acknowledged = s.editors.filter((_, k) => results[k].acknowledged);
  const lost = acknowledged.map((e) => e.name).filter((n) => !final.includes.includes(n));
  const expected = acknowledged.reduce<RowValue>(
    (v, e) => applyEdit(s.kind, v, e),
    s.kind === "stock" ? s.startStock : [...s.startTags],
  );
  const valueCorrect =
    typeof expected === "number"
      ? final.value === expected
      : [...expected].sort().join() === [...(final.value as string[])].sort().join();
  return { events, editors: results, final, lost, valueCorrect };
}

/**
 * Every schedule of `editors` editors' atomic steps (each step a read or a write; with compare-and-set a rejected write
 * sends its editor back to read, until its write applies): a depth-first search over "who moves next". Finite with
 * compare-and-set because every rejection means another editor's write applied since the read. Returns how many
 * schedules there are and how many lose an acknowledged edit (by the row's record of which edits it contains, and by
 * the final value).
 */
export function enumerateSchedules(editors: number, cas: boolean, kind: EditKind = "stock") {
  const edits = Array.from({ length: editors }, (_, k) => ({
    name: `e${k + 1}`,
    delta: [-3, 5, -2][k] ?? k + 1,
    tag: ["ui", "q3", "bug"][k] ?? `t${k}`,
  }));
  type Pc = { phase: "read" | "write" | "done"; snap?: RowState; local?: RowValue };
  let schedules = 0;
  let lost = 0;
  let wrongValue = 0;
  let maxSteps = 0;
  const start: RowValue = kind === "stock" ? 20 : ["new"];
  const expected = edits.reduce<RowValue>((v, e) => applyEdit(kind, v, e), start);
  const same = (a: RowValue, b: RowValue) =>
    typeof a === "number" ? a === b : [...a].sort().join() === [...(b as string[])].sort().join();

  const walk = (row: Row, pcs: Pc[], steps: number) => {
    const live = pcs.map((p, k) => (p.phase === "done" ? -1 : k)).filter((k) => k >= 0);
    if (live.length === 0) {
      schedules++;
      maxSteps = Math.max(maxSteps, steps);
      if (edits.some((e) => !row.state.includes.includes(e.name))) lost++;
      if (!same(row.state.value, expected)) wrongValue++;
      return;
    }
    for (const k of live) {
      const nextRow = new Row(0, 0);
      nextRow.state = { ...row.state, value: copy(row.state.value), includes: [...row.state.includes] };
      const next = pcs.map((p) => ({ ...p }));
      const pc = next[k];
      if (pc.phase === "read") {
        pc.snap = nextRow.read();
        pc.local = applyEdit(kind, pc.snap.value, edits[k]);
        pc.phase = "write";
      } else {
        const w = nextRow.write(edits[k].name, pc.snap!, pc.local!, cas);
        pc.phase = w.outcome === "applied" ? "done" : "read";
      }
      walk(nextRow, next, steps + 1);
    }
  };
  walk(
    new Row(7, start),
    edits.map(() => ({ phase: "read" as const })),
    0,
  );
  return { schedules, lost, wrongValue, maxSteps };
}
