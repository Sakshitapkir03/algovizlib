import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { RecordedMap } from "./shared";

/**
 * Anagrams share their letters, so a word's letters in alphabetical order ("stop" → "opst") are a key every anagram of
 * it shares (the reference counts letters instead: the same grouping). One lookup per word finds its group or starts a
 * new one, instead of comparing it with every group so far. Key steps: the first word, the first word that finds its
 * group, a word starting a second group, and the end.
 */
export function groupAnagrams(words: string[]): Trace {
  const groups = new RecordedMap("map", "rows");
  const lists = new Map<string, string[]>();
  const steps: TraceStep[] = [];
  let firstJoin = true;
  words.forEach((word, i) => {
    const key = [...word].sort().join("") || "∅";
    const found = groups.has(key);
    const list = [...(lists.get(key) ?? []), word];
    lists.set(key, list);
    groups.set(key, list.join(", "));
    const join = found && firstJoin;
    if (join) firstJoin = false;
    steps.push({
      kind: found ? "join" : "new-group",
      key: i === 0 || join || (!found && lists.size === 2),
      pointers: { i },
      active: [i],
      note: found
        ? `"${word}" sorted is "${key}": that key is already in the map, so "${word}" joins ${list
            .slice(0, -1)
            .map((w) => `"${w}"`)
            .join(" and ")}.`
        : `"${word}" sorted is "${key}". No group has that key yet: start one.`,
      map: groups.snapshot(),
    });
  });
  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    note: `Every word is in its group: ${lists.size} ${lists.size === 1 ? "group" : "groups"}.`,
    map: groups.snapshot(),
  });
  const answer = [...lists.values()];
  return {
    problem: "arrays-hashing/group-anagrams",
    row: { values: words, display: "cards" },
    pointerNames: ["i"],
    steps,
    answer,
    answerDisplay: `${lists.size} groups`,
  };
}

export const groupAnagramsTrace: TraceDefinition<[string[]]> = {
  problem: "arrays-hashing/group-anagrams",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([
    z
      .array(z.string().regex(/^[a-z]{0,5}$/))
      .min(1)
      .max(6),
  ]),
  run: groupAnagrams,
};
