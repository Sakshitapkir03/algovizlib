import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { RecordedTrie } from "./shared";

/**
 * Insert every word into a trie; the common prefix is then the path from the root that never branches: walk down while
 * the node has exactly one child and no word ends there. Shared letters are found (not created) when a later word
 * reuses them. No comparisons, so no tones. Every step is key.
 */
export function longestCommonPrefix(words: string[]): Trace {
  const trie = new RecordedTrie();
  const steps: TraceStep[] = words.map((word, w) => {
    const { path, created } = trie.insert(word);
    const shared = path.length - 1 - created.length;
    return {
      kind: "insert",
      key: true,
      pointers: { w },
      active: [w],
      note: `Insert "${word}": ${shared ? `the first ${shared} letter${shared === 1 ? "" : "s"} already exist${shared === 1 ? "s" : ""}, ` : ""}${created.length} new node${created.length === 1 ? "" : "s"}, and the last is marked as a word's end.`,
      trie: trie.snapshot({ path, created }),
    };
  });
  let id = 0;
  const path = [0];
  let prefix = "";
  for (;;) {
    const node = trie.node(id);
    const kids = trie.children(id);
    if (node.end || kids.length !== 1) {
      steps.push({
        kind: "stop",
        key: true,
        pointers: {},
        note: node.end
          ? `A word ends at "${prefix}": the prefix can't be longer than that word. The answer is "${prefix}".`
          : `${kids.length ? `"${prefix}" branches into ${kids.map((k) => k.letter).join(" and ")}: the words disagree on the next letter` : "No more letters"}. The answer is "${prefix}".`,
        trie: trie.snapshot({
          path: [...path],
          ...(kids.length > 1 ? { branches: kids.map((k) => k.id) } : {}),
        }),
        partial: { items: [...prefix], found: [] },
      });
      break;
    }
    id = kids[0].id;
    path.push(id);
    prefix += kids[0].letter;
    steps.push({
      kind: "follow",
      key: true,
      pointers: {},
      note: `"${prefix.slice(0, -1) || "the root"}" has one child, ${kids[0].letter}, and no word ends there: every word continues with ${kids[0].letter}. Prefix "${prefix}".`,
      trie: trie.snapshot({ path: [...path] }),
      partial: { items: [...prefix], added: kids[0].letter, found: [] },
    });
  }
  return {
    problem: "trie/longest-common-prefix",
    row: { values: words, display: "cards" },
    pointerNames: ["w"],
    steps,
    answer: prefix,
    answerDisplay: JSON.stringify(prefix),
  };
}

export const longestCommonPrefixTrace: TraceDefinition<[string[]]> = {
  problem: "trie/longest-common-prefix",
  exampleIndex: 0,
  exampleSource: "analogy",
  // A trie that stays readable on a phone: up to 4 words of up to 4 letters, sharing at least a letter or two.
  args: z.tuple([
    z
      .array(z.string().regex(/^[a-z]{1,4}$/))
      .min(1)
      .max(4)
      .refine((ws) => new Set(ws.join("")).size <= 9, "too many different letters"),
  ]),
  run: longestCommonPrefix,
};
