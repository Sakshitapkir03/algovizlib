import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { RecordedTrie } from "./shared";

/**
 * A trie with wildcard search. addWord inserts as usual. search matches letter by letter; "." can't pick a child, so
 * the search tries every child at that depth (depth-first, like the reference): several nodes are in play at once. A
 * branch that runs out (no child for the next letter, or the pattern ends on a node that isn't a word's end) is
 * abandoned; the search succeeds as soon as one branch ends exactly on a word. Each search is shown level by level:
 * the nodes still in play at each depth, and the first failure under a branch. No comparisons, so no tones.
 */
export function designAddAndSearchWords(operations: string[], args: string[][]): Trace {
  let trie = new RecordedTrie();
  const steps: TraceStep[] = [];
  const outputs: (boolean | null)[] = [];
  const answers: string[] = [];
  operations.forEach((op, k) => {
    const word = args[k][0];
    if (op === "WordDictionary") {
      trie = new RecordedTrie();
      outputs.push(null);
      return;
    }
    if (op === "addWord") {
      const { path, created } = trie.insert(word);
      outputs.push(null);
      steps.push({
        kind: "add",
        key: true,
        pointers: {},
        note: `addWord("${word}"): ${path.length - 1 - created.length} letters shared, ${created.length} created; the last node ends a word.`,
        trie: trie.snapshot({ path, created }),
        partial: { items: [...answers], found: [] },
      });
      return;
    }
    // The same answer the reference's depth-first search gives: does some node at depth |pattern| end a word?
    let frontier = [0];
    let missing: { parent: number; letter: string } | undefined;
    const levels: number[][] = [];
    for (const ch of word) {
      const next: number[] = [];
      for (const id of frontier) {
        const kids =
          ch === "."
            ? trie.children(id).map((n) => n.id)
            : [trie.child(id, ch)].filter((x) => x !== undefined);
        if (kids.length === 0 && missing === undefined && ch !== ".") missing = { parent: id, letter: ch };
        next.push(...(kids as number[]));
      }
      frontier = next;
      levels.push(next);
      if (next.length === 0) break;
    }
    const hits = levels.length === word.length ? frontier.filter((id) => trie.node(id).end) : [];
    const found = hits.length > 0;
    outputs.push(found);
    const chip = `${word} ${found ? "✓" : "✗"}`;
    answers.push(chip);
    // One step for the search; a wildcard search shows every node still in play at the deepest level it reached.
    const deepest = frontier.length ? frontier : (levels.at(-2) ?? [0]);
    const pathTo = (id: number) => {
      const out: number[] = [];
      for (let n: number | null = id; n !== null; n = trie.node(n).parent) out.unshift(n);
      return out;
    };
    const lead = found ? hits[0] : deepest[0];
    const wild = word.includes(".");
    steps.push({
      kind: wild ? "wildcard" : "search",
      key: true,
      pointers: {},
      note: found
        ? `search("${word}"): ${wild ? `"." tries every child; ${deepest.length} node${deepest.length === 1 ? "" : "s"} reach the last letter, and ` : ""}"${trie.spell(hits[0])}" ends a word: true.`
        : frontier.length
          ? `search("${word}"): the pattern ends on ${frontier.map((id) => `"${trie.spell(id)}"`).join(", ")}, which ${frontier.length === 1 ? "isn't a word's end" : "aren't words' ends"}: only a prefix, false.`
          : `search("${word}"): ${missing ? `"${trie.spell(missing.parent) || "the root"}" has no child ${missing.letter}` : "no branch has a next letter"}, so nothing matches: false.`,
      trie: trie.snapshot({
        path: pathTo(lead),
        ...(deepest.length > 1 ? { branches: deepest.filter((id) => id !== lead) } : {}),
        // The first dead end, even when another branch goes on (b..l: [bat] has no l; [bal] does).
        ...(missing ? { missing } : {}),
        ...(found ? { hits } : {}),
      }),
      partial: { items: [...answers], added: chip, found: [] },
    });
  });
  return {
    problem: "trie/design-add-and-search-words",
    row: { values: [], display: "cards" },
    pointerNames: [],
    steps,
    answer: outputs,
    answerDisplay: outputs.map((o) => (o === null ? "null" : String(o))).join(", "),
  };
}

export const designAddAndSearchWordsTrace: TraceDefinition<[string[], string[][]]> = {
  problem: "trie/design-add-and-search-words",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([
    z
      .array(z.enum(["WordDictionary", "addWord", "search"]))
      .min(2)
      .max(8),
    z.array(z.array(z.string().regex(/^[a-z.]{1,4}$/)).max(1)),
  ]),
  run: designAddAndSearchWords,
};
