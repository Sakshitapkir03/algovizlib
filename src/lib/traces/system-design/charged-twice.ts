import { z } from "zod";

import {
  PAYMENT_SYSTEM,
  paymentScenarioSchema,
  proveAgainstLostMessages,
  simulatePayment,
  type PaymentScenario,
} from "@/lib/sim/payments";

import type { Trace, TraceDefinition, TraceStep } from "../types";

/**
 * "Why was the customer charged twice?" as a trace: each scenario is one replay of the simulation (the bug, then the
 * fix under different failures), and their steps run one after another. The last step is the proof: the last replay's
 * safeguards, checked against every single and paired lost message on both hops under each replay's timings.
 */
const args = z.tuple([z.array(paymentScenarioSchema).min(1).max(4)]);

/** What the safeguards add up to, in words, for the proof's note. */
export function safeguardWords(s: Pick<PaymentScenario, "key" | "forwardKey" | "inProgress">): string {
  if (!s.key) return "no idempotency key";
  const parts = ["an idempotency key"];
  if (s.inProgress) parts.push("an in-progress record");
  if (s.forwardKey) parts.push("the key forwarded to the provider");
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export function chargedTwice(scenarios: PaymentScenario[]): Trace {
  const steps: TraceStep[] = [];
  scenarios.forEach((scenario, run) => {
    for (const step of simulatePayment(scenario, { run }).steps) steps.push({ ...step, pointers: {} });
  });

  const fix = scenarios.at(-1)!;
  const timings = new Map<string, PaymentScenario>();
  for (const sc of scenarios) {
    const base = { ...sc, key: fix.key, forwardKey: fix.forwardKey, inProgress: fix.inProgress, lose: [] };
    const { label: _label, ...rest } = base;
    void _label;
    timings.set(JSON.stringify(rest), base);
  }
  let singles = 0;
  let pairs = 0;
  let doubleCharges = 0;
  for (const base of timings.values()) {
    const proof = proveAgainstLostMessages(base);
    singles += proof.singles;
    pairs += proof.pairs;
    doubleCharges += proof.doubleCharges;
  }
  const runs = singles + pairs;
  const last = steps.at(-1)!.sim!;
  steps.push({
    kind: "proof",
    key: true,
    pointers: {},
    note: `With ${safeguardWords(fix)}, every run that loses one or two messages on either hop (${singles} with one lost message, ${pairs} with two) ends with ${doubleCharges === 0 ? "at most one charge" : `a double charge in ${doubleCharges} of them`}. This covers lost messages only, not crashes.`,
    sim: {
      run: scenarios.length,
      runLabel: "every single and double lost message",
      t: last.t,
      nodes: PAYMENT_SYSTEM.nodes.map((n) => ({ id: n.id, state: "idle" as const })),
      tokens: [],
      rows: [],
      tables: last.tables.map((t) => ({ ...t, rows: t.rows.map(({ cells }) => ({ cells })) })),
      metrics: [
        { id: "runs", label: "runs checked", value: String(runs) },
        { id: "double", label: "double charges", value: String(doubleCharges) },
      ],
      violations: [],
      proof: { singles, pairs, runs, doubleCharges },
    },
  });

  return {
    problem: "idempotency/charged-twice",
    row: { values: PAYMENT_SYSTEM.nodes.map((n) => n.label), display: "system" },
    system: PAYMENT_SYSTEM,
    pointerNames: [],
    steps,
    answer: { runs, doubleCharges },
    answerDisplay: `${doubleCharges} of ${runs}`,
  };
}

export const chargedTwiceTrace: TraceDefinition<z.infer<typeof args>> = {
  problem: "idempotency/charged-twice",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args,
  run: chargedTwice,
};
