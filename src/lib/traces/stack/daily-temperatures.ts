import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { Pile } from "./shared";

/**
 * Keep the days still waiting for a warmer one on a stack; their temperatures never rise from bottom to top (a
 * decreasing monotonic stack). A new day pops every waiting day that's cooler than it, and each pop resolves that
 * day's wait: the new day minus the popped one. Then the new day waits too. Days left at the end never get a warmer
 * day: 0. Finding a warmer day is good news; a day that isn't warmer than the top is neutral. Key steps: the first
 * day, the first pop, the stack at its deepest, a day that pops several at once, and the end.
 */
export function dailyTemperatures(temps: number[]): Trace {
  const pile = new Pile("decreasing");
  const waits = new Array<number>(temps.length).fill(0);
  const steps: TraceStep[] = [];
  let firstPop = true;
  let deepest = 0;
  let shownMulti = false;
  temps.forEach((t, i) => {
    const top = pile.top();
    const popped: number[] = [];
    while (pile.size > 0 && temps[pile.top()!.ref!] < t) {
      const day = pile.pop().ref!;
      waits[day] = i - day;
      popped.push(day);
      pile.resolve(day, i, `+${i - day}`, String(i - day));
    }
    pile.push({ label: String(t), ref: i, key: t });
    const deeper = pile.size > deepest;
    deepest = Math.max(deepest, pile.size);
    const multi = popped.length > 1 && !shownMulti;
    if (multi) shownMulti = true;
    steps.push({
      kind: popped.length ? "resolve" : "wait",
      key:
        i === 0 ||
        (popped.length > 0 && firstPop) ||
        multi ||
        (deeper && popped.length === 0 && i > 0 && pile.size >= 3),
      pointers: { i },
      active: [i],
      note:
        popped.length > 0
          ? `Day ${i} (${t}°) is warmer than ${popped.map((d) => `day ${d} (${temps[d]}°)`).join(", ")}: ${popped.map((d) => `day ${d} waited ${i - d}`).join(", ")}. Pop ${popped.length === 1 ? "it" : "them"}, then day ${i} waits.`
          : top
            ? `Day ${i} (${t}°) isn't warmer than day ${top.ref} (${temps[top.ref!]}°) on top, so it waits on the stack too.`
            : `Day ${i} (${t}°): nothing is waiting yet, so it waits on the stack.`,
      ...(top
        ? {
            equation: {
              terms: [t],
              operator: "+" as const,
              result: t,
              comparison: {
                op:
                  t < temps[top.ref!]
                    ? ("<" as const)
                    : t > temps[top.ref!]
                      ? (">" as const)
                      : ("=" as const),
                target: temps[top.ref!],
              },
              tone: popped.length ? ("positive" as const) : ("neutral" as const),
            },
          }
        : {}),
      pile: pile.snapshot(),
    });
    if (popped.length) firstPop = false;
  });
  // Days still waiting never see a warmer day.
  for (const item of pile.items) pile.answers.set(item.ref!, "0");
  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    note:
      pile.size > 0
        ? `The forecast ends with ${pile.items.map((item) => `day ${item.ref}`).join(" and ")} still waiting: no warmer day comes, so 0.`
        : "Every day found a warmer one.",
    pile: pile.snapshot(),
  });
  return {
    problem: "stack/daily-temperatures",
    row: { values: temps, display: "cards" },
    pointerNames: ["i"],
    steps,
    answer: waits,
    answerDisplay: `[${waits.join(", ")}]`,
  };
}

export const dailyTemperaturesTrace: TraceDefinition<[number[]]> = {
  problem: "stack/daily-temperatures",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args: z.tuple([z.array(z.number().int().min(-99).max(130)).min(1).max(7)]),
  run: dailyTemperatures,
};
