import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { RecordedTrie } from "./shared";

/**
 * Put the roots in a trie (each root's end node notes the root). Each word of the sentence walks it letter by letter
 * and stops at the first node that ends a root: that's the shortest root it starts with ("format" stops at "for"
 * before reaching "form"). A missing child means no root fits, and the word stays as it is. No comparisons, so no
 * tones. Every step is key.
 */
export function replaceWords(roots: string[], sentence: string): Trace {
  const trie = new RecordedTrie();
  for (const r of roots) trie.insert(r, r);
  const words = sentence.split(" ");
  const out: string[] = [];
  const steps: TraceStep[] = [
    {
      kind: "roots",
      key: true,
      pointers: {},
      note: `Put the roots ${roots.map((r) => `"${r}"`).join(", ")} in a trie; each root's last letter is marked.`,
      trie: trie.snapshot({ path: [0], created: trie.nodes.slice(1).map((n) => n.id) }),
      partial: { items: [], found: [] },
    },
  ];
  words.forEach((word, w) => {
    let id = 0;
    const path = [0];
    let missing: { parent: number; letter: string } | undefined;
    let replaced: string | undefined;
    for (const ch of word) {
      const next = trie.child(id, ch);
      if (next === undefined) {
        missing = { parent: id, letter: ch };
        break;
      }
      id = next;
      path.push(id);
      if (trie.node(id).end) {
        replaced = trie.node(id).note;
        break;
      }
    }
    const result = replaced ?? word;
    out.push(result);
    steps.push({
      kind: replaced ? "shorten" : "keep",
      key: true,
      pointers: { w },
      active: [w],
      note: replaced
        ? `"${word}" walks to "${replaced}", the first node that ends a root: replace it with "${replaced}".`
        : missing
          ? `"${word}": "${trie.spell(missing.parent) || "the root"}" has no child ${missing.letter}, so no root fits: keep "${word}".`
          : `"${word}" runs out of letters before reaching a root's end: keep it.`,
      trie: trie.snapshot({ path, ...(missing ? { missing } : {}), ...(replaced ? { hits: [id] } : {}) }),
      partial: { items: [...out], added: result, found: [] },
    });
  });
  const answer = out.join(" ");
  return {
    problem: "trie/replace-words",
    row: { values: words, display: "cards" },
    pointerNames: ["w"],
    steps,
    answer,
    answerDisplay: JSON.stringify(answer),
  };
}

export const replaceWordsTrace: TraceDefinition<[string[], string]> = {
  problem: "trie/replace-words",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([
    z
      .array(z.string().regex(/^[a-z]{1,4}$/))
      .min(1)
      .max(4),
    z.string().regex(/^[a-z]{1,9}( [a-z]{1,9}){0,5}$/),
  ]),
  run: replaceWords,
};
