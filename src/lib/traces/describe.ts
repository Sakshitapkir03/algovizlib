import type { TraceStep } from "./types";

/**
 * One trace step as a line of plain text: its index (and KEY), kind, pointers, and every piece of state it carries
 * (equation and tone, highlights, structures), then its note. The storyboard prompt lists every step this way, and
 * the tutor ("Ask about this step") grounds its answers in the same text, so both read a step exactly alike.
 */
export function describeStep(step: TraceStep, index: number): string {
  const parts = [`#${index}${step.key ? " KEY" : ""} ${step.kind}`];
  const pointers = Object.entries(step.pointers);
  parts.push(`pointers: ${pointers.length ? pointers.map(([k, v]) => `${k}=${v}`).join(", ") : "none"}`);
  if (step.equation) {
    const e = step.equation;
    parts.push(
      `equation: ${e.terms.length > 1 ? `${e.terms.join(` ${e.operator} `)} = ${e.result}` : e.result}${e.comparison ? ` ${e.comparison.op} ${e.comparison.target}` : ""}${e.tone ? ` (tone: ${e.tone})` : ""}`,
    );
  }
  for (const state of ["active", "rejected", "found"] as const) {
    if (step[state]?.length) parts.push(`${state}: [${step[state]!.join(", ")}]`);
  }
  if (step.fill) parts.push(`container: bars ${step.fill.from}–${step.fill.to} filled to ${step.fill.level}`);
  if (step.water) parts.push(`water: [${step.water.join(", ")}]`);
  if (step.values) parts.push(`array: [${step.values.join(", ")}]`);
  if (step.moves) parts.push(`moves: ${step.moves.map((m) => `${m.from}→${m.to}`).join(", ")}`);
  if (step.empty) parts.push(`empty slots: [${step.empty.join(", ")}]`);
  if (step.final) parts.push(`final positions: [${step.final.join(", ")}]`);
  else if (step.sorted) parts.push(`sorted: ${step.sorted.from}–${step.sorted.to}`);
  if (step.held) parts.push(`holding ${step.held.value} above slot ${step.held.index}`);
  if (step.range)
    parts.push(
      `range: ${step.range.from}–${step.range.to}${step.depth !== undefined ? ` (level ${step.depth})` : ""}`,
    );
  if (step.segments)
    parts.push(
      `groups: ${step.segments.map((g) => (g.from === g.to ? g.from : `${g.from}–${g.to}`)).join(" | ")}`,
    );
  if (step.splitTree)
    parts.push(
      `split tree: ${step.splitTree.map((level) => level.map((g) => `[${g.join(",")}]`).join(" ")).join(" / ")}`,
    );
  if (step.buffer)
    parts.push(
      `buffer from ${step.buffer.from}: [${step.buffer.values.map((v) => v ?? "_").join(", ")}]${step.buffer.taken !== undefined ? ` (just wrote slot ${step.buffer.taken})` : ""}`,
    );
  if (step.pivot !== undefined)
    parts.push(
      `pivot at ${step.pivot}${step.boundary !== undefined ? `, boundary before ${step.boundary}` : ""}`,
    );
  if (step.heapSize !== undefined) parts.push(`heap size: ${step.heapSize}`);
  if (step.compare) parts.push(`comparing parent ${step.compare[0]} with child ${step.compare[1]}`);
  if (step.counter)
    parts.push(
      `count: ${step.counter.value}${step.counter.delta !== undefined ? ` (+${step.counter.delta})` : ""}`,
    );
  if (step.window)
    parts.push(
      `window: ${step.window.to < step.window.from ? "empty" : `${step.window.from}–${step.window.to}`}${step.window.value !== undefined ? ` (value ${step.window.value})` : ""}`,
    );
  if (step.freq)
    parts.push(
      `counts: ${step.freq.entries.map((e) => `${e.key}:${e.count}${e.need !== undefined ? `/${e.need}` : ""}`).join(" ")}${step.freq.active !== undefined ? ` (changed: ${step.freq.active})` : ""}`,
    );
  if (step.deque)
    parts.push(
      `deque (front→back positions): [${step.deque.indices.join(", ")}]${step.deque.poppedBack?.length ? `, removed from back: [${step.deque.poppedBack.join(", ")}]` : ""}${step.deque.poppedFront?.length ? `, removed from front: [${step.deque.poppedFront.join(", ")}]` : ""}, output: [${step.deque.output.join(", ")}]`,
    );
  if (step.search) {
    const s = step.search;
    parts.push(
      `search range: ${s.to < s.from ? `empty (the gap before ${s.from})` : `${s.from}–${s.to}`}${s.mid !== undefined ? `, mid ${s.mid}` : ""}${s.sorted ? `, sorted half ${s.sorted.from}–${s.sorted.to}` : ""}`,
    );
  }
  if (step.answers) {
    const a = step.answers;
    parts.push(
      `candidate answers ${a.min}–${a.max}: ruled out below ${a.low}, known to work from ${a.high}${a.mid !== undefined ? `, tested ${a.mid}` : ""}`,
    );
  }
  if (step.cuts)
    parts.push(`cuts: first list after ${step.cuts.first}, second list after ${step.cuts.second}`);
  if (step.counts)
    parts.push(
      `tally: ${step.counts.keys.map((k, i) => `${k}:${step.counts!.counts[i]}`).join(" ")}${step.counts.active !== undefined ? ` (changed: ${step.counts.keys[step.counts.active]})` : ""}`,
    );
  if (step.links) {
    // Each lane left to right, following slots: "#4 dummy → #0 …".
    const lanes = new Map<number, typeof step.links.nodes>();
    for (const node of [...step.links.nodes].sort((a, b) => a.slot - b.slot))
      lanes.set(node.lane, [...(lanes.get(node.lane) ?? []), node]);
    parts.push(
      `lanes: ${[...lanes.entries()]
        .sort(([a], [b]) => a - b)
        .map(
          ([lane, nodes]) =>
            `${lane}: ${nodes.map((n) => `#${n.id}(${n.value})→${n.next === null ? "null" : `#${n.next}`}${n.prev !== undefined ? ` ←${n.prev === null ? "null" : `#${n.prev}`}` : ""}`).join(" ")}`,
        )
        .join(" ; ")}`,
    );
    if (step.links.rewired?.length)
      parts.push(
        `rewired: ${step.links.rewired.map((r) => `#${r.node} ${r.from === null ? "null" : `#${r.from}`}⇒${r.to === null ? "null" : `#${r.to}`}`).join(", ")}`,
      );
  }
  if (step.heap) parts.push(`heap: [${step.heap.join(", ")}]`);
  if (step.tree) {
    const w = step.tree;
    const ids = (list: readonly number[] | undefined) => `[${(list ?? []).join(", ")}]`;
    const walk = [
      w.current !== undefined ? `running: #${w.current}` : "",
      w.nullVisit ? `visiting #${w.nullVisit.parent}'s missing ${w.nullVisit.side} child` : "",
      `open path: ${ids(w.path)}`,
      `finished: ${ids(w.done)}`,
      w.skipped?.length ? `skipped: ${ids(w.skipped)}` : "",
      w.returned ? `hands ${w.returned.value} up to #${w.returned.to} (from its ${w.returned.side})` : "",
      w.results?.length ? `returned: ${w.results.map((r) => `#${r.node}=${r.value}`).join(" ")}` : "",
      w.badges?.length ? `carried: ${w.badges.map((b) => `#${b.node} ${b.text}`).join(", ")}` : "",
      w.repeats?.length ? `repeated calls: [${w.repeats.join(", ")}]` : "",
    ];
    parts.push(walk.filter(Boolean).join("; "));
  }
  if (step.race) {
    const r = step.race;
    const at = (id: number | null) => (id === null ? "null" : `#${id}`);
    parts.push(
      [
        `race phase ${r.phase}`,
        ...r.moves.map(
          (m) =>
            `${m.pointer} ${[m.from, ...m.path, m.to].map(at).join("→")} (+${m.hops})${m.blocked !== undefined ? ` refused ${at(m.blocked)}` : ""}`,
        ),
        r.meet !== undefined ? `met at ${at(r.meet)}` : "",
        r.entry !== undefined ? `loop starts at ${at(r.entry)}` : "",
        r.loop ? `loop link ${at(r.loop.from)}→${at(r.loop.to)}` : "",
      ]
        .filter(Boolean)
        .join("; "),
    );
  }
  if (step.trie) {
    const tr = step.trie;
    const word = (id: number) => {
      let out = "";
      for (
        let n = tr.nodes.find((m) => m.id === id);
        n && n.parent !== null;
        n = tr.nodes.find((m) => m.id === n!.parent)
      )
        out = n.letter + out;
      return out || "root";
    };
    parts.push(
      [
        `trie: ${
          tr.nodes
            .filter((n) => n.parent !== null)
            .map(
              (n) =>
                `#${n.id} "${word(n.id)}"${n.end ? " (word end)" : ""}${n.note ? ` note ${n.note}` : ""}`,
            )
            .join(", ") || "empty"
        }`,
        `path to "${word(tr.path.at(-1)!)}"`,
        tr.created?.length ? `created ${tr.created.map(word).join(", ")}` : "",
        tr.missing ? `no child ${tr.missing.letter} under "${word(tr.missing.parent)}"` : "",
        tr.branches?.length ? `also trying ${tr.branches.map(word).join(", ")}` : "",
        tr.hits?.length ? `word ends at ${tr.hits.map(word).join(", ")}` : "",
        tr.pruned?.length ? `removed ${tr.pruned.length} node(s)` : "",
      ]
        .filter(Boolean)
        .join("; "),
    );
  }
  if (step.network) {
    const g = step.network;
    const name = (id: number) => g.nodes.find((n) => n.id === id)?.label ?? `#${id}`;
    parts.push(
      [
        `graph: ${g.nodes.map((n) => `${n.label}${n.state !== "idle" ? ` ${n.state}` : ""}${n.badge ? ` (${n.badge})` : ""}`).join(", ")}`,
        `edges ${
          g.edges
            .map(
              (e) =>
                `${name(e.from)}${g.directed ? "→" : "–"}${name(e.to)}${e.weight !== undefined ? ` w${e.weight}` : ""}${e.state !== "idle" ? ` ${e.state}` : ""}`,
            )
            .join(", ") || "none"
        }`,
      ].join("; "),
    );
  }
  if (step.forest) {
    const f = step.forest;
    const name = (i: number) => f.labels[i];
    parts.push(
      [
        `union-find parents: ${f.labels.map((l, i) => (f.parents[i] === i ? `${l} root${f.sizes ? ` (size ${f.sizes[i]})` : ""}` : `${l}→${name(f.parents[i])}`)).join(", ")}`,
        ...(f.finds ?? []).map((x) => `find ${x.path.map(name).join("→")}`),
        ...(f.compressed ?? []).map((c) => `compressed ${name(c.node)}: ${name(c.from)}→${name(c.to)}`),
        f.union ? `union: root ${name(f.union.child)} now points at ${name(f.union.parent)}` : "",
        f.same !== undefined ? `already joined under root ${name(f.same)}` : "",
      ]
        .filter(Boolean)
        .join("; "),
    );
  }
  if (step.bits) {
    const b = step.bits;
    const bin = (v: number) =>
      Array.from({ length: b.width }, (_, k) => (v >> (b.width - 1 - k)) & 1).join("");
    parts.push(
      `bits (${b.width}${b.bitLabels ? `, bits mean ${b.bitLabels.join(" ")}` : ""}): ${b.rows
        .map(
          (r) =>
            `${r.rule ? "── " : ""}${r.op ? `${r.op} ` : ""}${r.name} ${bin(r.value)} (${r.value})${r.changed?.length ? ` changed bits ${r.changed.join(",")}` : ""}${r.from ? ` slid ${r.from.shift > 0 ? "left" : "right"} from ${bin(r.from.value)}` : ""}`,
        )
        .join("; ")}`,
    );
  }
  if (step.timeline) {
    const tl = step.timeline;
    parts.push(
      [
        `timeline: ${tl.bars.map((b) => `#${b.id} [${b.start}, ${b.end}] lane ${b.lane}${b.fromLane !== undefined ? ` (from lane ${b.fromLane})` : ""} ${b.state}`).join("; ")}`,
        tl.overlap ? `overlap ${tl.overlap.start}–${tl.overlap.end}` : "",
        tl.grow ? `#${tl.grow.id} grew from [${tl.grow.start}, ${tl.grow.end}]` : "",
        tl.sweep ? `marker at ${tl.sweep.at} "${tl.sweep.label}"` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    );
  }
  if (step.prefix)
    for (const row of step.prefix)
      parts.push(
        [
          `${row.name} (${row.direction}, ${row.op}): [${row.values.map((v) => (v === null ? "·" : v)).join(", ")}]`,
          row.current !== undefined ? `built cell ${row.current}` : "",
          row.reads?.length ? `reads cells ${row.reads.join(", ")}` : "",
          ...(row.spans ?? []).map(
            (sp) =>
              `span cells ${sp.from}→${sp.to} (${sp.to > sp.from ? `items ${sp.from}…${sp.to - 1}` : "no items"}) = ${sp.value}`,
          ),
        ]
          .filter(Boolean)
          .join("; "),
      );
  if (step.prefixGrid) {
    const g = step.prefixGrid;
    const rect = (r: { r1: number; c1: number; r2: number; c2: number }) =>
      `rows ${r.r1}–${r.r2} × cols ${r.c1}–${r.c2}`;
    parts.push(
      [
        `prefix grid: ${g.prefix.map((row) => `[${row.map((v) => (v === null ? "·" : v)).join(" ")}]`).join(" ")}`,
        g.current ? `current cell [${g.current.join(",")}]` : "",
        ...g.rects.map((r) => `${r.sign} ${rect(r)}`),
        g.found ? `found ${rect(g.found)}` : "",
      ]
        .filter(Boolean)
        .join("; "),
    );
  }
  if (step.choice)
    parts.push(
      `greedy choice: took "${step.choice.chosen}"${step.choice.rejected ? `, turned down "${step.choice.rejected}"` : ""}`,
    );
  if (step.reach) {
    const r = step.reach;
    parts.push(
      [
        r.to >= r.from
          ? `covers ${r.from}–${r.to}${r.value !== undefined ? ` (${r.value})` : ""}`
          : "covers nothing (just cut)",
        r.jump ? `jump ${r.jump.from}→${r.jump.to} "${r.jump.label}"` : "",
        r.pieces?.length ? `closed pieces: ${r.pieces.map((p) => `${p.from}–${p.to}`).join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("; "),
    );
  }
  if (step.map) {
    const m = step.map;
    parts.push(
      [
        `${m.kind}: ${m.entries.map((e) => (e.value !== undefined ? `${e.key}→${e.value}` : e.key)).join(", ") || "empty"}`,
        m.lookup ? `looked up ${m.lookup.key}: ${m.lookup.found ? "found" : "not found"}` : "",
        m.inserted ? `added ${m.inserted}` : "",
        m.updated ? `changed ${m.updated.key} (was ${m.updated.from})` : "",
      ]
        .filter(Boolean)
        .join("; "),
    );
  }
  if (step.explore) {
    const x = step.explore;
    const ids = (list?: readonly number[]) => `[${(list ?? []).join(", ")}]`;
    parts.push(
      [
        `search: at #${x.current}, path ${ids(x.path)}, reached ${x.reached.length} nodes`,
        x.undone !== undefined ? `stepped back from #${x.undone}` : "",
        x.dead.length ? `dead ends ${ids(x.dead)}` : "",
        x.solutions.length ? `solutions ${ids(x.solutions)}` : "",
      ]
        .filter(Boolean)
        .join("; "),
    );
  }
  if (step.partial) {
    const p = step.partial;
    parts.push(
      `building [${p.items.join(", ")}]${p.added ? ` (+${p.added})` : ""}${p.removed ? ` (took back ${p.removed})` : ""}; found ${p.found.length ? p.found.join(" ") : "none"}`,
    );
  }
  if (step.op) parts.push(`call #${step.op.current}${step.op.returned ? " (returned)" : " (running)"}`);
  if (step.sim) {
    const s = step.sim;
    const current = s.rows.find((r) => r.id === s.current);
    parts.push(
      [
        `replay ${s.run} "${s.runLabel}" at t=${s.t} ms`,
        current
          ? current.kind === "message"
            ? `this step: message ${current.id} "${current.label}" ${current.from}→${current.to} (${current.status})`
            : `this step: note ${current.id} on ${current.lane} "${current.text}"`
          : "",
        s.decision ? `decision: ${s.decision.actor} ${s.decision.choice}` : "",
        `components: ${s.nodes.map((n) => `${n.id} ${n.state}${n.badge ? ` (${n.badge})` : ""}`).join(", ")}`,
        s.tokens.length
          ? `messages on links: ${s.tokens.map((t) => `"${t.label}" ${t.from}→${t.to} ${t.status}`).join(", ")}`
          : "",
        `tables: ${s.tables.map((t) => `${t.id} [${t.rows.map((r) => `${r.cells.join(" ")}${r.mark ? ` (${r.mark})` : ""}`).join("; ") || "empty"}]`).join(", ")}`,
        `metrics: ${s.metrics.map((m) => `${m.id}=${m.value}${m.delta ? ` (+${m.delta})` : ""}`).join(", ")}`,
        s.violations.length ? `rules broken: ${s.violations.join("; ")}` : "",
        s.load && s.load.current !== undefined
          ? (() => {
              const w = s.load.windows[s.load.current];
              return `measured window "${w.label}" (${w.group}): offered ${w.offered}/s, served ${w.served}/s, p95 ${w.p95} ms, p99 ${w.p99} ms, errors ${w.errors}, utilization ${w.utilization.map((u) => `${u.id} ${Math.round(u.value * 100)}%`).join(", ")}, saturated ${w.saturated.length ? w.saturated.join(", ") : "none"}`;
            })()
          : s.load
            ? `measured windows: ${s.load.windows.map((w) => `${w.group} ${w.label}/s→${w.served}/s p99 ${w.p99} ms${w.saturated.length ? " (saturated)" : ""}`).join("; ")}`
            : "",
        s.topology ? `components present: ${s.topology.nodes.map((n) => n.id).join(", ")}` : "",
        s.proof
          ? `proof: ${s.proof.runs} runs (${s.proof.singles} single, ${s.proof.pairs} paired lost messages), ${s.proof.doubleCharges} double charges`
          : "",
      ]
        .filter(Boolean)
        .join("; "),
    );
  }
  if (step.secondPile) {
    const p = step.secondPile;
    parts.push(
      `second stack (bottom→top): [${p.items.map((i) => i.label).join(", ")}]${p.popped?.length ? `; popped ${p.popped.map((i) => i.label).join(", ")}` : ""}${p.pushed ? `; pushed ${p.pushed}` : ""}`,
    );
  }
  if (step.pile) {
    const p = step.pile;
    parts.push(
      [
        `stack (bottom→top): [${p.items.map((i) => i.label).join(", ")}]${p.order ? ` (${p.order})` : ""}`,
        p.popped?.length ? `popped ${p.popped.map((i) => i.label).join(", ")}` : "",
        p.pushed ? `pushed ${p.pushed}` : "",
        p.links?.length ? `resolved ${p.links.map((l) => `${l.from}→${l.to} "${l.label}"`).join(", ")}` : "",
        p.text ? `${p.text.label}: "${p.text.value}"` : "",
      ]
        .filter(Boolean)
        .join("; "),
    );
  }
  if (step.table) {
    const t = step.table;
    const at = (c: readonly number[]) => `[${c.join(",")}]`;
    parts.push(
      [
        `table: ${t.cells.map((row) => row.map((v) => (v === null ? "_" : v)).join(" ")).join(" / ")}`,
        t.current ? `computing ${at(t.current)}` : "",
        t.reads?.length ? `reads ${t.reads.map((r) => `${r.label} ${at(r.at)}`).join(", ")}` : "",
        t.choice ? `wins: ${t.choice}` : "",
        t.answer ? `answer cell ${at(t.answer)}` : "",
      ]
        .filter(Boolean)
        .join("; "),
    );
  }
  if (step.climb)
    parts.push(
      `climber on step ${step.climb.at}${step.climb.hops?.length ? `, hops ${step.climb.hops.map((h) => `${h.from}→${h.to}`).join(" ")}` : ""}`,
    );
  if (step.houses)
    parts.push(
      `street: ${step.houses.current !== undefined ? `deciding house ${step.houses.current}, ` : ""}take [${step.houses.taken.join(", ")}], skip [${step.houses.skipped.join(", ")}]`,
    );
  if (step.heaps)
    parts.push(
      step.heaps
        .map(
          (h, k) =>
            `heap ${k + 1} (${h.kind}${h.capacity !== undefined ? `, capacity ${h.capacity}` : ""}): [${h.items.map((i) => i.label).join(", ")}]${h.pushed ? `, pushed ${h.pushed.label}` : ""}${h.popped ? `, popped ${h.popped.label}` : ""}${h.swaps?.length ? `, ${h.swaps.length} swap${h.swaps.length === 1 ? "" : "s"}` : ""}`,
        )
        .join(" ; "),
    );
  if (step.cells) parts.push(`cells: ${JSON.stringify(step.cells)}`);
  if (step.bfs) {
    const b = step.bfs;
    const ids = (list: readonly number[] | undefined) => `[${(list ?? []).join(", ")}]`;
    parts.push(
      [
        b.current !== undefined ? `processing: #${b.current}` : "",
        `seen: ${ids(b.visited)}`,
        b.levels?.length ? `levels: ${b.levels.map((l) => `#${l.id}=${l.level}`).join(" ")}` : "",
        b.checks?.length
          ? `checks: ${b.checks.map((c) => `${c.to !== undefined ? `#${c.to}` : `off-grid ${JSON.stringify(c.dir)}`} ${c.result}`).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("; "),
    );
  }
  if (step.queue) {
    const q = step.queue;
    parts.push(
      `queue (front→back): ${q.items.map((i) => `${i.label}@${i.level}`).join(" ") || "empty"}${q.dequeued ? ` | took ${q.dequeued.label}` : ""}${q.enqueued?.length ? ` | added ${q.enqueued.length}` : ""}`,
    );
  }
  if (step.stack)
    parts.push(
      `stack (bottom→top): ${
        step.stack
          .map(
            (f) =>
              `${f.label}${f.waiting ? ` waits ${f.waiting}` : ""}${f.returns !== undefined ? ` returns ${f.returns}` : ""}`,
          )
          .join(" | ") || "empty"
      }`,
    );
  return `${parts.join(" | ")}\n   ${step.note}`;
}
