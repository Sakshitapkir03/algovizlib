import type { Problem } from "@/lib/catalog";
import { primitiveCatalog, type ValidationIssue } from "@/lib/storyboard";
import type { Trace } from "@/lib/traces";
import { describeStep } from "@/lib/traces/describe";

import { describeIssues, MAX_SCENES, MIN_SCENES } from "../draft";

/**
 * Prompt templates for storyboard generation. Bump the version on ANY wording change: it's recorded in each
 * generated storyboard and is part of the cache key, so changed prompts never reuse stale results.
 */
export const PROMPT_VERSION = "storyboard-v23";

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
- timeline (intervals): when steps list a timeline, make a timeline the first element of every scene (OMIT everything but \`laneLabels\`; give lane names in the story's words, e.g. "sorted", "merged", or none). There's no item-row: the bars are the intervals. A sort step slides the bars into sorted lanes; say what they're sorted by. The second scene contrasts the slow way (comparing every pair, O(n²)) with sorting and one pass. When steps list a choice (a greedy decision), add a choice (OMIT chosen/rejected) whose \`reason\` says in a few words why the choice is safe. With a heap (it sits right of the timeline), add a heap (OMIT heaps) and a partial (OMIT items; label the answers) in every bound scene. Keep the bottom stack to at most two of an equation, a choice, and a counter; in the answer scene, the result and at most one more. Skip callouts in timeline scenes.
- bits (bit manipulation): when steps list bits, add a bits panel (OMIT width/rows; give \`rowLabels\`, one short name per row in the story's words, and for a mask \`bitLabels\`, what each bit means) in every bound scene; it needs a traceStep, so intro scenes show only the input. Keep the input row (if the trace has one) above it, marked with one pointer or an "active" highlight. The second scene contrasts the slow way (a hash map of counts, converting to strings, looping over every bit, or extra memory) with the bit trick. Where the trick isn't obvious, one scene's narration says in one short sentence why it works (x ^ x = 0 so pairs cancel; shifting right drops the last bit; AND marks the carries). Keep the bottom stack to the bits panel plus at most one equation or counter, and with an input row (or a table) above it, put the answer's result in the closing scene instead (without the bits), so the panel keeps its room on a phone. Skip callouts in bits scenes.
- trie: when steps list a trie, add a trie (OMIT everything) to every scene that shows the data (an unbound scene shows the empty trie). With an input row (the words), keep it above the trie and mark the current word with an "active" highlight, not a pointer; with a board (a grid), the board sits left of the trie. The second scene contrasts the slow way (comparing against every word, or searching the board once per word) with sharing prefixes. Say when a node exists but isn't a word's end (only a prefix), and when a child is missing. Use a partial for answers or output being built (OMIT items; \`showFound: false\`). The trie needs the height: keep the bottom stack to at most the partial, and put the answer's result in the closing scene (without the trie). Skip callouts in trie scenes.
- digraph (topological sort, Dijkstra): when steps list a network, make a digraph the first element of every scene that shows the graph (OMIT directed/nodes/edges; an unbound scene shows the graph as given). With an input row (Alien Dictionary's words), keep it above the graph and mark the pair being compared with an "active" highlight, no pointers. For topological sort, add a queue (OMIT items/dequeued/enqueued; levelLabel "round") and a partial for the order built so far (OMIT items; \`showFound: false\`) in every bound scene whose step lists them; say once what a badge means (how many arrows still point into the node) and, if nodes end up stuck, that they wait on each other in a cycle. For Dijkstra, add a heap (OMIT heaps; it sits right of the graph) and a hash-map of best-known distances (OMIT everything but \`label\`) in every bound scene, plus the step's equation when it has one; say why the popped node can be settled for good (every other route is already at least as long, since weights are never negative), and that a popped entry for a settled node is stale. The second scene contrasts the slow way (trying every order, or every route) with the algorithm's one pass. Keep the bottom stack to two panels plus at most one equation; put the answer's result in the closing scene (without the graph) when the bottom stack is full. Skip callouts in graph scenes.
- union-find: when steps list a forest, add a union-find (OMIT labels/parents and the step's work; give \`rootLabel\`, the story's word for a root) to every scene that shows the groups (an unbound scene shows every element alone). Keep the edges as an item-row above it, marking the current edge with an "active" highlight (the redundant one "rejected"), no pointers. The second scene contrasts the slow way (a fresh search for every question) with keeping one root per group. Say what a find does (follow the arrows up to the root), that two elements are joined exactly when their roots match, and, when the trace compresses a path or unions by size, what that buys (short trees). Keep the bottom stack to at most one equation, and put the answer's result in the closing scene (without the trees). Skip callouts in union-find scenes.
- op-log (data structure design): when the trace lists calls, make an op-log (OMIT calls/current/shown) the first element of EVERY scene, bound or not (an unbound one shows the calls before any runs). There's no input row unless the trace has one. Put the design's internal structures beside it in every bound scene whose step lists them, each with everything OMITTED: a stack (OMIT items; \`label\` in the story's words) for a stack, and a second stack with \`traceStack: "second"\` when the step lists two (give each a label: "in", "out"); a linked-list (OMIT nodes; \`laneLabels\` in the story's words, e.g. ["recent → old"] or one per use count, ["×1", "×2", "×3"]) when the step lists lanes, with a highlight on it (rowId = the linked-list's id, OMIT indices) for each state the step lists (active: the node just used, rejected: the node being evicted, found); a hash-map (OMIT everything but label) when the step lists a map; a counter (OMIT value/delta; label in the story's words, e.g. "fewest uses") when the step lists a count; and with a row (a key's history), the item-row (labels: the value stored at each timestamp, in order) with a search-range (OMIT from/to/mid; label e.g. "answer") and an "active" highlight (and "found" when listed) in the scenes whose step lists a search; leave the row out of scenes before the history is complete. No pointers. The second scene contrasts a simpler design (one plain list where some call is O(n): a scan for the minimum, shifting every value, searching for the oldest key) with the combined structures that make every call fast; one sentence says why the combination works (e.g. "the hash map finds the node instantly, and the linked list moves it in constant time"). Say why each key step is fast (a get that moves a node to the front changes a few links, an eviction takes the back node, a min that stays right after a pop was stored with the pair underneath, a pour happens once per value). Keep the bottom stack to at most a hash-map and one counter or equation. The op-log with every output filled in IS the answer (the last call's scene, or an unbound closing scene with \`shown\` set to the number of calls), so don't add a showsAnswer result: the list of outputs is too long for a card on a phone; a short info result in the closing scene is fine. Skip callouts in design scenes.
- The answer: a result element with showsAnswer: true and value omitted.
- Never write a number that contradicts the trace. Narration may say numbers, but they must be the trace's numbers.
- Element ids are unique within a scene. Captions are at most 80 characters. Narration is 2–4 plain sentences, no markdown.`;
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
          : trace.row.display === "network"
            ? `Graph (use one digraph), as given: ${(trace.network?.nodes ?? []).map((n) => n.label).join(", ")}; ${trace.network?.directed ? "arrows" : "edges"} ${(trace.network?.edges ?? []).map((e) => `${trace.network!.nodes[e.from].label}${trace.network!.directed ? "→" : "–"}${trace.network!.nodes[e.to].label}${e.weight !== undefined ? ` (${e.weight})` : ""}`).join(", ") || "none yet"}. No row: don't add an item-row`
            : trace.row.display === "stairs"
              ? "Steps (use one staircase), step: number"
              : trace.row.display === "houses"
                ? "Houses (use one house-row), house: cash"
                : trace.row.values.length === 0
                  ? `No row: don't add an item-row${trace.timeline ? `: intervals as given, ${trace.timeline.input.map((b) => `#${b.id} [${b.start}, ${b.end}]`).join(", ")}; axis ${trace.timeline.min}–${trace.timeline.max}` : ""}${trace.matrix ? `. Matrix (use a prefix-grid): ${trace.matrix.map((row) => `[${row.join(", ")}]`).join(" ")}` : trace.dp || trace.timeline ? "" : " (the input is a stream of operations)"}`
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
    trace.network && trace.row.display !== "network"
      ? `Graph (use one digraph under the row): nodes ${trace.network.nodes.map((n) => n.label).join(", ")}; the steps add its edges\n`
      : ""
  }${
    trace.tree && trace.row.display !== "tree"
      ? `Recursion tree (for the scenes whose step lists a tree walk), id: call\n${trace.tree.nodes.map((n) => `  #${n.id}: call on ${n.value}`).join("\n")}\n`
      : ""
  }${
    trace.searchTree
      ? `Decision tree (use one search-tree), id: state (choice from parent)\n${trace.searchTree.nodes.map((n) => `  #${n.id}: ${n.pruned ? `pruned, ${n.pruned}` : n.label}${n.edge ? ` (${n.edge} from #${n.parent})` : ""}`).join("\n")}\n`
      : ""
  }${
    trace.ops
      ? `Calls (use one op-log; # · call → output)\n${trace.ops.map((c, k) => `  #${k}: ${c.call} → ${c.output}`).join("\n")}\n`
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

export const storyboardPromptV23 = { version: PROMPT_VERSION, systemPrompt, generatePrompt, repairPrompt };
