import { z } from "zod";

import type { Trace, TraceCellKind, TraceDefinition, TraceStep } from "../types";
import { RecordedTrie } from "./shared";

/**
 * One trie of every word, and a backtracking walk from each cell that follows the board and the trie together: a
 * step onto a cell is taken only if the current trie node has that letter as a child, so a whole word list is searched
 * in one walk, and a dead end is noticed after one letter. A word is collected when its end node is reached (the mark
 * is cleared so it isn't found twice); on the way back, trie nodes with no children and no word left are removed, so
 * later walks don't explore finished branches. The path's cells are outlined and the current one ringed. No comparisons, so
 * no tones. Key steps: the trie, the first letter, the first dead end, every word found, and the last step.
 */
export function wordSearchII(board: string[][], words: string[]): Trace {
  const rows = board.length;
  const cols = board[0].length;
  const trie = new RecordedTrie();
  for (const w of words) trie.insert(w, w);
  const letters = [...new Set(board.flat())].sort();
  const legend: TraceCellKind[] = letters.map((l) => ({
    value: l,
    glyph: l,
    word: l,
    tone: "plain" as const,
  }));
  // Cells on the current path (the walk can't reuse them).
  const used = board.map((row) => row.map(() => false));
  const found: string[] = [];
  const steps: TraceStep[] = [
    {
      kind: "trie",
      key: true,
      pointers: {},
      note: `Put every word in one trie: ${words.map((w) => `"${w}"`).join(", ")}. Shared starts share nodes.`,
      trie: trie.snapshot({ path: [0], created: trie.nodes.slice(1).map((n) => n.id) }),
      bfs: { visited: [], frontier: [] },
      partial: { items: [], found: [] },
    },
  ];
  // Nodes removed on the way back, shown fading out in the next step.
  let pruned: ReturnType<RecordedTrie["remove"]>[] = [];
  const takePruned = () => {
    const out = pruned.length ? { pruned } : {};
    pruned = [];
    return out;
  };
  let firstVisit = true;
  let firstDead = true;
  const path: number[] = [0];
  const cellPath: number[] = [];
  const dfs = (r: number, c: number, parent: number) => {
    const ch = board[r][c];
    const id = trie.child(parent, ch);
    if (id === undefined) return;
    path.push(id);
    cellPath.push(r * cols + c);
    used[r][c] = true;
    const node = trie.node(id);
    let hit: string | undefined;
    if (node.end) {
      hit = node.note;
      found.push(hit!);
      node.end = false;
      delete node.note;
    }
    // Which neighbors the trie lets the walk step onto.
    const next: [number, number][] = [];
    let dead: { parent: number; letter: string } | undefined;
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || used[nr][nc]) continue;
      if (trie.child(id, board[nr][nc]) !== undefined) next.push([nr, nc]);
      else if (!dead && trie.children(id).length > 0) dead = { parent: id, letter: board[nr][nc] };
    }
    const deadEnd = !hit && next.length === 0 && trie.children(id).length > 0;
    steps.push({
      kind: hit ? "found" : deadEnd ? "dead-end" : "step",
      key: !!hit || firstVisit || (deadEnd && firstDead),
      pointers: {},
      note: hit
        ? `${ch} completes "${hit}": collect it, and clear its mark so it isn't found twice.`
        : deadEnd
          ? `"${trie.spell(id)}" has children (${trie
              .children(id)
              .map((n) => n.letter)
              .join(", ")}), but no free neighbor has one of those letters: dead end, turn back.`
          : `${ch} is a child of "${trie.spell(parent) || "the root"}": step onto it ("${trie.spell(id)}").`,
      trie: trie.snapshot({
        path: [...path],
        ...(dead && (deadEnd || !hit) ? { missing: dead } : {}),
        ...(hit ? { hits: [id] } : {}),
        ...takePruned(),
      }),
      // The path's earlier cells are outlined (the grid's "frontier" style), the current one ringed.
      bfs: { current: r * cols + c, visited: [], frontier: cellPath.slice(0, -1) },
      partial: { items: [...found], ...(hit ? { added: hit } : {}), found: [] },
    });
    if (firstVisit) firstVisit = false;
    if (deadEnd) firstDead = false;
    for (const [nr, nc] of next) if (!used[nr][nc]) dfs(nr, nc, id);
    used[r][c] = false;
    path.pop();
    cellPath.pop();
    if (trie.children(id).length === 0 && !trie.node(id).end) pruned.push(trie.remove(id));
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) dfs(r, c, 0);
  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    note: `Every cell has been a start. Found: ${found.map((w) => `"${w}"`).join(", ") || "nothing"}${
      trie.nodes.length > 1
        ? `; what's left of the trie (${words
            .filter((w) => !found.includes(w))
            .map((w) => `"${w}"`)
            .join(", ")}) has no path on the board`
        : ""
    }.`,
    trie: trie.snapshot({ path: [0], ...takePruned() }),
    bfs: { visited: [], frontier: [] },
    partial: { items: [...found], found: [] },
  });
  return {
    problem: "trie/word-search-ii",
    row: { values: board.flat(), display: "grid" },
    grid: { rows, cols, cells: board.map((row) => [...row]), legend },
    pointerNames: [],
    steps,
    answer: found,
    answerDisplay: `[${found.map((w) => JSON.stringify(w)).join(", ")}]`,
  };
}

export const wordSearchIITrace: TraceDefinition<[string[][], string[]]> = {
  problem: "trie/word-search-ii",
  exampleIndex: 0,
  exampleSource: "problem-native",
  // A 2 × 3 board and up to four short words: the board and the trie fit side by side on a phone.
  args: z.tuple([
    z
      .array(
        z
          .array(z.string().regex(/^[a-z]$/))
          .min(1)
          .max(3),
      )
      .min(1)
      .max(2),
    z
      .array(z.string().regex(/^[a-z]{1,4}$/))
      .min(1)
      .max(4),
  ]),
  run: wordSearchII,
};
