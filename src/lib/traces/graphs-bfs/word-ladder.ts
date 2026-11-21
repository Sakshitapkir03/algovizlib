import { z } from "zod";

import type { BfsCheck, Trace, TraceDefinition } from "../types";
import { Bfs } from "./shared";

/** Words one letter apart, in the order the reference solution generates them (by position, then letter). */
function oneApart(a: string, b: string): number | undefined {
  if (a.length !== b.length) return undefined;
  let at: number | undefined;
  for (let i = 0; i < a.length; i++)
    if (a[i] !== b[i]) {
      if (at !== undefined) return undefined;
      at = i;
    }
  return at === undefined ? undefined : at * 26 + (b.charCodeAt(at) - 97);
}

/**
 * The words are a graph: an edge joins two words one letter apart. BFS from the start word, one level per extra
 * word in the ladder (the start is level 1). Taking a word off the queue checks its neighbors: a word not used yet
 * joins the queue at the next level; one already used is skipped (a shorter ladder reached it first). The first time
 * the goal comes off the queue, its level is the shortest ladder. Key steps: the start, the first two levels, the first word
 * whose neighbor another ladder already reached, the step that reaches the goal's level, and the goal coming off the queue.
 */
export function wordLadder(beginWord: string, endWord: string, wordList: string[]): Trace {
  const words = [beginWord, ...wordList.filter((w, i) => w !== beginWord && wordList.indexOf(w) === i)];
  const edges: [number, number][] = [];
  for (let a = 0; a < words.length; a++)
    for (let b = a + 1; b < words.length; b++)
      if (oneApart(words[a], words[b]) !== undefined) edges.push([a, b]);
  const neighbors = (a: number) =>
    words
      .map((_, b) => b)
      .filter((b) => b !== a && oneApart(words[a], words[b]) !== undefined)
      .sort((x, y) => oneApart(words[a], words[x])! - oneApart(words[a], words[y])!);
  const goal = words.indexOf(endWord);
  const bfs = new Bfs((id) => words[id]);
  let answer = 0;

  if (!wordList.includes(endWord)) {
    bfs.record({
      kind: "done",
      key: true,
      note: `"${endWord}" isn't in the dictionary, so no ladder can end there: 0.`,
    });
  } else {
    bfs.enqueue(0, 1);
    bfs.record({
      kind: "start",
      key: true,
      note: `Start with "${beginWord}": a ladder of 1 word. Queue it.`,
    });
    let reachedGoal = false;
    let firstSkip = true;
    while (bfs.queue.length > 0) {
      const item = bfs.dequeue();
      if (item.id === goal) {
        answer = item.level;
        bfs.record(
          {
            kind: "reached",
            key: true,
            note: `"${endWord}" comes off the queue at level ${item.level}: the shortest ladder has ${item.level} words.`,
          },
          { current: item.id },
        );
        break;
      }
      const checks: BfsCheck[] = [];
      const added: string[] = [];
      for (const next of neighbors(item.id)) {
        const result = bfs.has(next) ? "visited" : "added";
        checks.push({ from: item.id, to: next, result });
        if (result === "added") {
          bfs.enqueue(next, item.level + 1);
          added.push(`"${words[next]}"`);
        }
      }
      // A neighbor already used at this level or deeper: another ladder at least as short got there first (the word
      // it came from is always used, so it doesn't count).
      const skipped = checks
        .filter((ch) => ch.result === "visited" && bfs.levelOf(ch.to!) >= item.level)
        .map((ch) => `"${words[ch.to!]}"`);
      const seenSkip = skipped.length > 0 && firstSkip;
      if (seenSkip) firstSkip = false;
      const findsGoal = !reachedGoal && checks.some((ch) => ch.to === goal && ch.result === "added");
      if (findsGoal) reachedGoal = true;
      bfs.record(
        {
          kind: added.length > 0 ? "expand" : "dead-end",
          key: item.level <= 2 || seenSkip || findsGoal,
          note: `Take "${words[item.id]}" (level ${item.level}) off the front. ${
            added.length > 0
              ? `${added.join(" and ")} ${added.length === 1 ? "is" : "are"} one letter away and unused: level ${item.level + 1}.`
              : "Every word one letter away is already used."
          }${skipped.length > 0 ? ` ${skipped.join(" and ")} ${skipped.length === 1 ? "is" : "are"} already used: a ladder at least as short got there first.` : ""}`,
        },
        { current: item.id, checks },
      );
    }
    if (answer === 0)
      bfs.record({ kind: "done", key: true, note: `The queue is empty before "${endWord}": no ladder, 0.` });
  }

  return {
    problem: "graphs-bfs/word-ladder",
    row: { values: words, display: "graph" },
    graph: { nodes: words.map((label, id) => ({ id, label })), edges },
    pointerNames: [],
    steps: bfs.steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const wordLadderTrace: TraceDefinition<[string, string, string[]]> = {
  problem: "graphs-bfs/word-ladder",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([
    z.string().regex(/^[a-z]{1,5}$/),
    z.string().regex(/^[a-z]{1,5}$/),
    z.array(z.string().regex(/^[a-z]{1,5}$/)).max(7),
  ]),
  run: wordLadder,
};
