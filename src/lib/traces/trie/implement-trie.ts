import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { RecordedTrie } from "./shared";

/**
 * A prefix tree, one letter per level. insert walks down, creating missing children, and marks the last node as a
 * word's end. search walks the word and answers whether the last node ends a word (a node that exists but isn't
 * marked is only a prefix); startsWith only needs the walk to succeed. A missing child ends the walk at once. No
 * comparisons, so no tones. Every operation is key.
 */
export function implementTrie(operations: string[], args: string[][]): Trace {
  let trie = new RecordedTrie();
  const steps: TraceStep[] = [];
  const outputs: (boolean | null)[] = [];
  const answers: string[] = [];
  operations.forEach((op, k) => {
    const word = args[k][0];
    if (op === "Trie") {
      trie = new RecordedTrie();
      outputs.push(null);
      return;
    }
    if (op === "insert") {
      const { path, created } = trie.insert(word);
      outputs.push(null);
      steps.push({
        kind: "insert",
        key: true,
        pointers: {},
        note: `insert("${word}"): ${created.length ? `${path.length - 1 - created.length} letters found, ${created.length} created` : "every letter is already there"}; the last node is marked as a word's end.`,
        trie: trie.snapshot({ path, created }),
        partial: { items: [...answers], found: [] },
      });
      return;
    }
    // search and startsWith walk the same way.
    let id = 0;
    const path = [0];
    let missing: { parent: number; letter: string } | undefined;
    for (const ch of word) {
      const next = trie.child(id, ch);
      if (next === undefined) {
        missing = { parent: id, letter: ch };
        break;
      }
      id = next;
      path.push(id);
    }
    const found = !missing && (op === "startsWith" || trie.node(id).end);
    outputs.push(found);
    const chip = `${word} ${found ? "✓" : "✗"}`;
    answers.push(chip);
    steps.push({
      kind: op,
      key: true,
      pointers: {},
      note: missing
        ? `${op}("${word}"): "${trie.spell(path.at(-1)!) || "the root"}" has no child ${missing.letter}, so the answer is false.`
        : op === "search"
          ? `search("${word}"): every letter is there, and ${found ? "the last node is marked as a word's end: true" : "the last node isn't a word's end: it's only a prefix, false"}.`
          : `startsWith("${word}"): every letter is there, so some word starts with it: true.`,
      trie: trie.snapshot({
        path,
        ...(missing ? { missing } : {}),
        ...(found && op === "search" ? { hits: [id] } : {}),
      }),
      partial: { items: [...answers], added: chip, found: [] },
    });
  });
  return {
    problem: "trie/implement-trie",
    row: { values: [], display: "cards" },
    pointerNames: [],
    steps,
    answer: outputs,
    answerDisplay: outputs.map((o) => (o === null ? "null" : String(o))).join(", "),
  };
}

export const implementTrieTrace: TraceDefinition<[string[], string[][]]> = {
  problem: "trie/implement-trie",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([
    z
      .array(z.enum(["Trie", "insert", "search", "startsWith"]))
      .min(2)
      .max(8),
    z.array(z.array(z.string().regex(/^[a-z]{1,5}$/)).max(1)),
  ]),
  run: implementTrie,
};
