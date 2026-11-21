import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { Pile } from "./shared";

const frameLabel = (prefix: string, count: number) => `"${prefix}" ×${count}`;

/**
 * Build the text left to right. Digits build a repeat count. "[" saves what's built so far and the count on the stack
 * and starts fresh; "]" pops that frame and sets the text to the saved part plus the inner text repeated. Letters are
 * appended. Key steps: the first "[", a nested "[", every "]", and the end.
 */
export function decodeString(s: string): Trace {
  const pile = new Pile();
  const chars = [...s];
  const steps: TraceStep[] = [];
  const frames: { prefix: string; count: number }[] = [];
  let current = "";
  let count = 0;
  const text = () => ({ label: "building", value: current });
  chars.forEach((ch, i) => {
    if (ch >= "0" && ch <= "9") {
      count = count * 10 + Number(ch);
      steps.push({
        kind: "count",
        key: false,
        pointers: { i },
        active: [i],
        note: `${ch} is a repeat count: ${count}.`,
        pile: pile.snapshot(text()),
      });
    } else if (ch === "[") {
      frames.push({ prefix: current, count });
      pile.push({ label: frameLabel(current, count), ref: i });
      const note =
        frames.length === 1
          ? `"[" starts a repeat of ${count}: save what's built so far ("${current}") with the count, and start fresh.`
          : `Another "[" inside: save "${current}" with the count ${count}, and start fresh again.`;
      current = "";
      count = 0;
      steps.push({
        kind: "open",
        key: true,
        pointers: { i },
        active: [i],
        note,
        pile: pile.snapshot(text()),
      });
    } else if (ch === "]") {
      const frame = frames.pop()!;
      pile.pop();
      const inner = current;
      current = frame.prefix + inner.repeat(frame.count);
      steps.push({
        kind: "close",
        key: true,
        pointers: { i },
        active: [i],
        note: `"]" pops "${frame.prefix}" ×${frame.count}: "${frame.prefix}" + "${inner}" ${frame.count} times = "${current}".`,
        pile: pile.snapshot(text()),
      });
    } else {
      current += ch;
      steps.push({
        kind: "letter",
        key: false,
        pointers: { i },
        active: [i],
        note: `"${ch}" is a letter: append it. Building "${current}".`,
        pile: pile.snapshot(text()),
      });
    }
  });
  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    note: `The whole string is read: "${current}".`,
    pile: pile.snapshot(text()),
  });
  return {
    problem: "stack/decode-string",
    row: { values: chars, display: "cards" },
    pointerNames: ["i"],
    steps,
    answer: current,
    answerDisplay: `"${current}"`,
  };
}

export const decodeStringTrace: TraceDefinition<[string]> = {
  problem: "stack/decode-string",
  exampleIndex: 1,
  exampleSource: "analogy",
  // The input fits as cards, and the decoded text fits in its strip.
  args: z.tuple([
    z
      .string()
      .regex(/^[a-z0-9[\]]{1,10}$/)
      .refine((s) => !/\d\d/.test(s), "single-digit counts"),
  ]),
  run: decodeString,
};
