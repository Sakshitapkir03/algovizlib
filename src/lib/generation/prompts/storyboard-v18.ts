import type { Problem } from "@/lib/catalog";
import { primitiveCatalog, type ValidationIssue } from "@/lib/storyboard";
import type { Trace, TraceStep } from "@/lib/traces";

import { describeIssues, MAX_SCENES, MIN_SCENES } from "../draft";

/**
 * Prompt templates for storyboard generation. Bump the version on ANY wording change: it's recorded in each
 * generated storyboard and is part of the cache key, so changed prompts never reuse stale results.
 */
export const PROMPT_VERSION = "storyboard-v18";

export type StoryboardPromptInput = {
  problem: Problem;
  patternName: string;
  patternCoreIdea: string;
  exampleSource: "problem-native" | "analogy";
  trace: Trace;
  exampleIndex: number;
};

const ELEMENT_GUIDE = Object.entries(primitiveCatalog)
  .map(([type, text]) => `- ${type}: ${text}`)
  .join("\n");

export function systemPrompt(): string {
  return `You write storyboards for short animated videos that explain the APPROACH behind an algorithm through one concrete, real-world example. You are not writing code or a code walkthrough.

You return one JSON object matching the provided schema. Deterministic code has already run the algorithm and recorded every decision as a numbered trace step. Your job is the story: captions, narration, labels, callouts, and which trace step each scene shows. All state comes from the trace.

## Choosing the example
- "problem-native": the problem statement already describes a real-world scenario. Use that exact scenario, its wording, and its numbers. Do not substitute an analogy, and omit the "analogy" field.
- "analogy": the problem is abstract (arrays, strings, pointers). Use ONE relatable real-world analogy, describe it in analogy.scenario and analogy.mapping, and make the closing scene map it back to the abstract problem (relabel items as a[i] or s[i], name the pointers left/right/i).

## Scene arc (${MIN_SCENES}–${MAX_SCENES} scenes in total)
1. The problem in real-life terms (no traceStep).
2. Why brute force is slow (no traceStep).
3. The key idea. This may be the first KEY step's scene.
4. A few moves with the reasoning: one scene per KEY trace step, in trace order, each with traceStep set.
5. The answer: in the scene for the LAST trace step, add a result with showsAnswer: true.
6. A closing scene mapping back to the general pattern and its complexity.
Count before you write: KEY steps + 3 must fit in ${MAX_SCENES} scenes, so merge the key idea into the first step scene when needed.

## Elements
${ELEMENT_GUIDE}

## Binding rules (these are checked by a validator; violations are sent back to you)
- Every trace step marked KEY must be shown by a scene whose traceStep is that step's index. Other steps may be skipped.
- traceStep values never decrease from one scene to the next.
- Every scene that shows data starts with the row element (same id in every scene, e.g. "row"); omit its values so they come from the trace, and give labels that fit the story (one per value). When steps list an array, a bound scene's row shows that step's array, and its moves and empty slots appear automatically.
- Pointers: set binds to a pointer name the step actually has, set rowId, and OMIT index/fromIndex. A step that lists no pointers gets no bound pointers.
- Equations: only in scenes whose step has arithmetic. OMIT terms/operator/result/comparison; add unit and a short verdict. If the step lists a tone, OMIT verdictTone and make the verdict read that way (positive: "new best"; neutral: "not better").
- Highlights: OMIT indices in bound scenes. Only use a state the step lists (active/rejected/found).
- sorted-region / held-value / count-array: only in scenes whose step lists a sorted range or final positions / held value / tally; OMIT their indices, value/index, and keys/counts/active.
- segments / split-tree / merge-buffer / partition / counter: only in scenes whose step lists groups / a split tree / a buffer / a pivot / a count; OMIT their state fields. heap-tree: in every scene of a heap trace that shows the bars (bound or not); OMIT its state fields, and anchor callouts to the bars rather than floating them over the tree.
- window / freq-table / deque: only in scenes whose step lists a window / counts / a deque; OMIT their state fields (from/to/value, entries/active, indices/output/popped). Give the window a short label for its value ("sum", "length"); its edges slide on their own between bound scenes.
- search-range / number-line / cut: only in scenes whose step lists a search range / candidate answers / cuts; OMIT their state fields (from/to/mid/sorted, min/max/low/high/mid, at). A search range's bracket shrinks on its own between bound scenes; give an empty range a label for the gap ("insert here"). With two lists, add one cut per item-row, and give the second list's item-row traceRow: "second".
- linked-list: when the trace's row is a list ("list"), make it the first element of every scene that shows data, and OMIT nodes/rewired/fromPlaces (a bound scene takes the step's list, an unbound scene the starting list). Rewired links and moving nodes animate on their own. Give laneLabels that name each lane in your analogy. Put pointers on it with placement: "above" and rowId set to the linked-list's id, bound to the step's pointer names; a pointer the step doesn't list is null, so leave it out. Highlights on it use node ids (OMIT indices). Skip callouts in list scenes: the narration carries the reasoning. With a heap of list heads (step lists a heap), add a heap-tree in those scenes (OMIT values) and drop it once the heap is empty.
- binary-tree / call-stack: when the trace's row is a tree ("tree"), make a binary-tree the first element of every scene that shows data and OMIT nodes and the walk fields (current, nullVisit, path, done, skipped, returned, results, badges): a bound scene takes the step's walk, an unbound scene shows the bare tree. Add a call-stack (OMIT frames/kept) right after it in every bound scene. Highlights and anchored callouts on the tree use rowId = the binary-tree's id and node ids (OMIT indices). Keep the bottom stack short, because the tree needs the height: at most one equation and a counter per scene, and in the answer scene only the result (plus a counter if the step lists one). Skip callouts in tree scenes: the narration carries the reasoning.
- grid / graph / queue: when the trace's row is a grid ("grid") or a graph ("graph"), make a grid (or graph) the first element of every scene that shows data and OMIT everything on it (rows, cols, cells, legend, nodes, edges, and the search: current, visited, frontier, levels, checks): a bound scene takes the step's search, an unbound scene the starting grid or graph. Add a queue (OMIT items/dequeued/enqueued) in every bound scene whose step lists one, with levelLabel set to the story's unit for a level ("minute", "step", "rung"). Keep the bottom stack short: the queue, plus at most a counter or an equation; in the answer scene, the result and at most one more. Skip callouts in grid and graph scenes.
- heap: when steps list heaps, add a heap (OMIT heaps) in every bound scene; with two heaps give labels naming each half in the story. Leave it out of unbound scenes (it would show the final heaps). The input (the item-row, if the trace has a row) appears in intro scenes and in bound scenes whose step lists active items, marked with an "active" highlight (OMIT indices); don't add pointers to it, and leave it out of the answer scene. Keep the bottom stack short: at most one equation, counter, or freq-table per scene; in the answer scene, only the heap and the result. Skip callouts in heap scenes.
- dp-table: when the trace has a table, add a dp-table (OMIT everything on it) to every scene that shows data; an unbound scene shows it empty. When the row is "stairs" or "houses", put a staircase or house-row (OMIT everything) first and the dp-table after it: they line up column by column. With coins (an item-row), mark the winning coin with an "active" highlight (OMIT indices). A step listing a tree walk with repeated calls (plain recursion) gets a scene with only a binary-tree (OMIT everything). Keep the bottom stack to at most one equation. For a one-row table, the answer scene holds the result; for a table with several rows, keep the last step's scene to the table and put the result (showsAnswer) in the closing scene, without the table. Skip callouts in table scenes.
- stack: when steps list a stack, add a stack (set rowId to the input row's id, OMIT everything else) in every bound scene; an unbound scene shows it empty. Mark the item being read with an "active" highlight (OMIT indices) instead of pointers: the space under the row holds the resolve arcs and answers. A matched pair can use a "found" highlight. Keep the bottom stack to at most one equation or counter, and in the answer scene the result and at most a counter. Skip callouts in stack scenes.
- search-tree / partial: when steps list a search, add a search-tree (OMIT everything) and a partial (OMIT items/added/removed/found; give label and foundLabel in the story's words) to every bound scene; an unbound scene shows just the root and an empty answer. Leave the input item-row out of search scenes (the partial shows what's chosen); a grid (a board) stays beside the tree. Keep the bottom stack to the partial plus at most one equation or counter. In the answer scene, drop the partial and show the result; if the tree is five or more levels deep, put the result in the closing scene instead (no tree there). Skip callouts in search scenes.
- hash-map: when steps list a map, add a hash-map (OMIT everything but label; name it in the story's words) under the input row in every bound scene; an unbound scene shows it empty. The second scene contrasts the slow way (a nested loop rescanning, or sorting) with one lookup. Keep the bottom stack to the map plus at most one equation or counter; in the answer scene, the map and the result. Skip callouts in map scenes.
- race: when steps list a race (fast and slow pointers on a list), add a race (rowId = the linked-list's id; OMIT phase/moves/meet/entry/loop; give meetLabel and entryLabel in the story's words) in every scene that shows the list, with pointers bound to "slow" and "fast" (placement "above"). The second scene contrasts the slow way (remembering every node visited in a set: O(n) extra space) with two pointers in O(1) space. When the trace has a phase 2 (a "restart" step), that scene's caption and narration say WHY it works: the head is exactly as far from the loop's start as the meeting point is (going forward), so two pointers moving 1 step each arrive there together; its equation shows those two distances (verdict like "head→start = meet→start"). Keep the bottom stack to at most one equation or counter beside the list; in the answer scene, only the result. Skip callouts in race scenes.
- choice / reach (greedy): when steps list a choice, add a choice (OMIT chosen/rejected; give label in the story's words, e.g. "change given", "next start") in every bound scene whose step lists one. In the scene for the key decision, its \`reason\` (≤ 64 characters) says WHY the greedy choice is safe for this problem, in the story's words (e.g. "starting anywhere you passed only arrives emptier"), and the narration says it too. When steps list a reach, add a reach (rowId = the input row's id; OMIT from/to/value/jump/pieces; give label: "reach", "ends") in every bound scene; set dimBeyond: true when the cards past it are out of reach. The second scene contrasts the slow way (trying every option, start, or combination) with the greedy one: it may show an unbound choice with your own chosen/rejected ("one pass" vs "try every start"). Keep the bottom stack to the choice plus at most one equation, counter, freq-table, or hash-map; in the answer scene, the result and at most one more. Skip callouts in greedy scenes.
- prefix-row / prefix-grid (prefix sums): when steps list prefix rows, add one prefix-row per row the step lists (rowId = the input item-row's id, \`name\` = the step's row name; OMIT op/direction/values/current/reads/spans; give \`label\` and \`spanLabel\` in the story's words) in every scene that shows the input, bound or not (an unbound one shows it empty). Cell i sits on the boundary before item i, so say so once: the range of items l…r is the cell after r minus the cell before l. When steps list a prefix grid, add a prefix-grid (OMIT everything but matrixLabel/prefixLabel) to every scene. The second scene contrasts the slow way (re-adding the range for every question) with one subtraction. With a map, keep the bottom stack to the map plus one equation (no counter beside them); in the answer scene show the input, its prefix row(s), and the result, without the map or an equation. With a prefix grid, the bottom stack is the map plus at most one equation or counter, and the answer scene holds the grid and the result only. Mark the current item with an "active" highlight or one pointer, not both pointers and highlights. Skip callouts in prefix scenes.
- The answer: a result element with showsAnswer: true and value omitted.
- Never write a number that contradicts the trace. Narration may say numbers, but they must be the trace's numbers.
- Element ids are unique within a scene. Captions are at most 80 characters. Narration is 2–4 plain sentences, no markdown.`;
}

function describeStep(step: TraceStep, index: number): string {
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
            `${lane}: ${nodes.map((n) => `#${n.id}(${n.value})→${n.next === null ? "null" : `#${n.next}`}`).join(" ")}`,
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

export function generatePrompt(input: StoryboardPromptInput): string {
  const { problem, trace } = input;
  const example = problem.examples[input.exampleIndex];
  const keyCount = trace.steps.filter((s) => s.key).length;
  return `# Problem: ${problem.title} (${input.patternName}, ${problem.difficulty})

${problem.statement}

Example used in the video: ${example.input} → ${example.output}${example.explanation ? ` (${example.explanation})` : ""}

# Pattern
${input.patternName}: ${input.patternCoreIdea}

Key idea for this problem: ${problem.keyIdea}
Complexity: ${problem.complexity.time} time, ${problem.complexity.space} space.

# exampleSource for this problem: "${input.exampleSource}"

# Trace
${
  trace.row.display === "list"
    ? "Nodes (use one linked-list; pointers and highlights refer to node ids), id: value"
    : trace.row.display === "grid"
      ? `Grid (use one grid), ${trace.grid?.rows}×${trace.grid?.cols}; cell id = row × ${trace.grid?.cols} + col. Legend: ${(trace.grid?.legend ?? []).map((k) => `${JSON.stringify(k.value)} = ${k.word}`).join(", ")}\nStarting cells by id`
      : trace.row.display === "graph"
        ? `Graph (use one graph), edges: ${(trace.graph?.edges ?? []).map(([a, b]) => `#${a}–#${b}`).join(", ")}\nNodes by id`
        : trace.row.display === "tree"
          ? `Tree (use one binary-tree; highlights refer to node ids), id: value (children)\n${(
              trace.tree?.nodes ?? []
            )
              .map(
                (n) =>
                  `  #${n.id}: ${n.value} (left ${n.left === null ? "none" : `#${n.left}`}, right ${n.right === null ? "none" : `#${n.right}`})`,
              )
              .join("\n")}\nValues by id`
          : trace.row.display === "stairs"
            ? "Steps (use one staircase), step: number"
            : trace.row.display === "houses"
              ? "Houses (use one house-row), house: cash"
              : trace.row.values.length === 0
                ? `No row: don't add an item-row${trace.matrix ? `. Matrix (use a prefix-grid): ${trace.matrix.map((row) => `[${row.join(", ")}]`).join(" ")}` : trace.dp ? "" : " (the input is a stream of operations)"}`
                : `Row (${trace.row.display === "bars" ? "use a bar-row" : "use an item-row"}), index: value`
}
${trace.row.values.map((v, i) => `  ${i}: ${JSON.stringify(v)}`).join("\n")}${
    trace.secondRow
      ? `\nSecond list (a second item-row with traceRow: "second"), index: value\n${trace.secondRow.values.map((v, i) => `  ${i}: ${JSON.stringify(v)}`).join("\n")}`
      : ""
  }
${
  trace.dp
    ? `Table (use one dp-table): ${trace.dp.rows} × ${trace.dp.cols}${trace.dp.rowHeaders ? `, row headers ${JSON.stringify(trace.dp.rowHeaders)}` : ""}${trace.dp.colHeaders ? `, column headers ${JSON.stringify(trace.dp.colHeaders)}` : ""}\n`
    : ""
}${
    trace.tree && trace.row.display !== "tree"
      ? `Recursion tree (for the scenes whose step lists a tree walk), id: call\n${trace.tree.nodes.map((n) => `  #${n.id}: call on ${n.value}`).join("\n")}\n`
      : ""
  }${
    trace.searchTree
      ? `Decision tree (use one search-tree), id: state (choice from parent)\n${trace.searchTree.nodes.map((n) => `  #${n.id}: ${n.pruned ? `pruned, ${n.pruned}` : n.label}${n.edge ? ` (${n.edge} from #${n.parent})` : ""}`).join("\n")}\n`
      : ""
  }Pointer names: ${trace.pointerNames.join(", ") || "none"}
Answer: ${trace.answerDisplay}

Steps (${trace.steps.length} total, ${keyCount} KEY):
${trace.steps.map(describeStep).join("\n")}

Write the storyboard JSON now.`;
}

export function repairPrompt(
  input: StoryboardPromptInput,
  previousOutput: unknown,
  issues: readonly ValidationIssue[],
): string {
  return `${generatePrompt(input)}

# Your previous attempt was rejected
${"```json"}
${JSON.stringify(previousOutput, null, 2).slice(0, 12_000)}
${"```"}

The validator reported:
${describeIssues(issues)}

Return the complete corrected storyboard JSON. Fix every issue above and keep everything that was already right.`;
}

export const storyboardPromptV18 = { version: PROMPT_VERSION, systemPrompt, generatePrompt, repairPrompt };
