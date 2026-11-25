import { describe, expect, it } from "vitest";

import { currentPrompts } from "@/lib/generation/prompts";
import { systemDesignPromptV1 } from "@/lib/generation/prompts/system-design-v1";
import {
  getLesson,
  getLessons,
  getLessonStoryboard,
  getPatterns,
  getProgressIndex,
  getProgressKeys,
  getTopicLessons,
  getTopics,
  lessonKey,
} from "@/lib/catalog/repository";
import { buildQuickChecks, validateQuickChecks } from "@/lib/quickcheck";
import { EventLoop } from "@/lib/sim/events";
import { LINKS, proveAgainstLostMessages, simulatePayment, type PaymentScenario } from "@/lib/sim/payments";
import { mulberry32, streams } from "@/lib/sim/random";
import { buildScenarioReplay, DEFAULT_CHOICES, LOSSES, type ScenarioChoices } from "@/lib/sim/scenario";
import { validateStoryboard, type Storyboard } from "@/lib/storyboard";
import { runTrace } from "@/lib/traces";
import { buildStepContext } from "@/lib/tutor/context";
import { sceneFitProblems } from "@/video/fit/scene";
import { textMetrics } from "@/video/text";

const KEY = "idempotency/charged-twice";
const base: PaymentScenario = {
  label: "test",
  seed: 7,
  key: false,
  forwardKey: false,
  inProgress: false,
  clientTimeoutMs: 2000,
  clientRetries: 2,
  retryBackoffMs: 300,
  providerTimeoutMs: 3000,
  providerRetries: 1,
  providerWorkMs: 800,
  lose: [],
};
const fix = { key: true, forwardKey: true, inProgress: true };
const lostAnswer = [{ link: "api→client" as const, nth: 1 }];
const lostProviderAnswer = [{ link: "provider→api" as const, nth: 1 }];

describe("the simulation engine", () => {
  it("runs events in time order, ties in the order they were scheduled", () => {
    const loop = new EventLoop();
    const seen: string[] = [];
    loop.after(10, () => seen.push("b"));
    loop.after(5, () => seen.push("a"));
    loop.after(10, () => seen.push("c"));
    loop.after(10, () => loop.after(0, () => seen.push("d")));
    loop.run();
    expect(seen).toEqual(["a", "b", "c", "d"]);
  });

  it("is seeded: the same seed draws the same numbers, and named streams don't affect each other", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const s1 = streams(7);
    const s2 = streams(7);
    s2("work:provider")(); // drawing from another stream first changes nothing for this one
    expect(s1("latency:client→api")()).toBe(s2("latency:client→api")());
  });

  it("replays a scenario exactly, step for step", () => {
    const run = () => simulatePayment({ ...base, ...fix, lose: lostProviderAnswer });
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("a different seed changes the timings, not the outcome", () => {
    const one = simulatePayment({ ...base, lose: lostAnswer });
    const other = simulatePayment({ ...base, seed: 8, lose: lostAnswer });
    expect(one.steps.map((s) => s.sim.t)).not.toEqual(other.steps.map((s) => s.sim.t));
    expect([one.charges, other.charges]).toEqual([2, 2]);
  });

  it("a slower provider leaves the network's own draws alone", () => {
    const firstArrival = (s: PaymentScenario) =>
      simulatePayment(s).steps.find((x) => x.kind === "arrive")!.sim.t;
    expect(firstArrival({ ...base, providerWorkMs: 2600 })).toBe(firstArrival(base));
  });
});

describe("the four replays, against what should happen", () => {
  it("no key + the API's answer lost: the retry charges again", () => {
    const r = simulatePayment({ ...base, lose: lostAnswer });
    expect(r.charges).toBe(2);
    expect(r.outcome).toBe("paid");
    expect(r.steps.map((s) => s.kind)).toContain("duplicate-charge");
    expect(r.steps.at(-1)!.sim.violations).toEqual(["order 17 charged twice"]);
  });

  it("with the key + the same loss: the retry gets the stored result", () => {
    const r = simulatePayment({ ...base, ...fix, lose: lostAnswer });
    expect(r.charges).toBe(1);
    expect(r.providerCalls).toBe(1);
    expect(r.steps.find((s) => s.kind === "stored-result")?.sim.decision).toEqual({
      actor: "api",
      choice: "stored-result",
    });
  });

  it("with the key + the provider's answer lost: the API retries, and the provider deduplicates by the forwarded key", () => {
    const r = simulatePayment({ ...base, ...fix, clientTimeoutMs: 5000, lose: lostProviderAnswer });
    expect(r.charges).toBe(1);
    expect(r.providerCalls).toBe(2);
    expect(r.steps.some((s) => s.kind === "dedupe")).toBe(true);
    expect(r.outcome).toBe("paid");
  });

  it("with the key + a slow provider: the overlapping retry waits on the in-progress key", () => {
    const r = simulatePayment({ ...base, ...fix, providerWorkMs: 2600 });
    expect(r.charges).toBe(1);
    expect(r.providerCalls).toBe(1);
    const kinds = r.steps.map((s) => s.kind);
    expect(kinds).toContain("wait");
    expect(kinds).toContain("waiter-result");
    expect(kinds).toContain("late"); // the first attempt's answer arrives after the client gave up on it
  });

  it("without the in-progress record, the overlapping retry reaches the provider (the forwarded key still saves it)", () => {
    const r = simulatePayment({
      ...base,
      key: true,
      forwardKey: true,
      inProgress: false,
      providerWorkMs: 2600,
    });
    expect(r.providerCalls).toBe(2);
    expect(r.charges).toBe(1);
  });
});

describe("the proof: every lost message on both hops", () => {
  const timings = [{}, { providerWorkMs: 2600 }, { clientTimeoutMs: 5000 }];

  it("with the full fix, no run double-charges, and every link loses a message somewhere", () => {
    for (const t of timings) {
      const proof = proveAgainstLostMessages({ ...base, ...fix, ...t });
      expect(proof.doubleCharges, JSON.stringify(t)).toBe(0);
      expect(proof.links).toEqual([...LINKS]);
      // Singles: every message of the failure-free run; pairs reach the retries' own messages.
      expect(proof.singles).toBe(simulatePayment({ ...base, ...fix, ...t }).messages.length);
      expect(proof.pairs).toBeGreaterThan(proof.singles);
    }
  });

  it("each safeguard is needed: removing one brings double charges back under some failure", () => {
    const broken = (s: Partial<PaymentScenario>) =>
      timings.reduce((n, t) => n + proveAgainstLostMessages({ ...base, ...s, ...t }).doubleCharges, 0);
    expect(broken({})).toBeGreaterThan(0); // no key at all
    expect(broken({ key: true })).toBeGreaterThan(0); // a key the API keeps after charging, not forwarded
    expect(broken({ key: true, inProgress: true })).toBeGreaterThan(0); // not forwarded: the API's retry charges again
    const failing = proveAgainstLostMessages({ ...base, key: true, inProgress: true }).failing;
    expect(failing.some((plan) => plan.some((l) => l.link === "provider→api"))).toBe(true);
  });

  it("the lesson's trace ends with the proof over every replay's timings", () => {
    const lesson = getLesson("idempotency", "charged-twice")!;
    const trace = runTrace(KEY, lesson.replays[0].args);
    const last = trace.steps.at(-1)!;
    expect(last.kind).toBe("proof");
    expect(last.key).toBe(true);
    expect(last.sim!.proof).toEqual({ singles: 14, pairs: 52, runs: 66, doubleCharges: 0 });
    expect(trace.answerDisplay).toBe("0 of 66");
    expect(last.note).toMatch(/lost messages only, not crashes/);
    expect(trace.steps.filter((s) => s.key).length).toBe(8);
  });
});

describe("the flagship lesson", () => {
  const lesson = getLesson("idempotency", "charged-twice")!;
  const storyboard = getLessonStoryboard(lesson)!;
  const trace = runTrace(KEY, storyboard.trace!.args);

  it("has a storyboard bound to the lesson's replays that passes the validator", () => {
    expect(storyboard.category).toBe("system-design");
    expect(storyboard.trace!.args).toEqual(lesson.replays[0].args);
    expect(storyboard.generation?.provider).toBe("claude-code");
    expect(validateStoryboard(storyboard)).toEqual({ ok: true, issues: [] });
  });

  it("says on screen that the proof covers lost messages, not crashes", () => {
    const closing = storyboard.scenes.at(-1)!;
    expect(closing.traceStep).toBe(trace.steps.length - 1);
    // Exactly what was checked: every single lost message and every pair (66 runs), not crashes.
    expect(closing.caption).toBe("One charge after every single and double lost message (not crashes)");
    const card = closing.elements.find((e) => e.type === "result");
    expect(card?.type === "result" && card.detail).toBe("Every single and double lost message (not crashes)");
    expect(card?.type === "result" && card.value).toBe("0 of 66");
  });

  it("fits a phone-sized player in every scene, and a large one", () => {
    for (const width of [343, 640, 1280])
      for (const scene of storyboard.scenes)
        expect(sceneFitProblems(scene.elements, textMetrics(width)), `${scene.id} at ${width}`).toEqual([]);
  });

  it("asks quick checks built from the simulation's decisions, each proven against it", () => {
    const checks = buildQuickChecks(storyboard, trace);
    expect(checks.length).toBe(3);
    expect(checks.every((c) => c.claim.kind === "decision")).toBe(true);
    expect(validateQuickChecks(storyboard, trace, checks)).toEqual([]);
    const wrong = checks.map((c, i) => (i === 0 ? { ...c, answer: (c.answer + 1) % c.options.length } : c));
    expect(validateQuickChecks(storyboard, trace, wrong).join()).toMatch(/is wrong|is also right/);
  });

  it("grounds the tutor in the lesson and the simulation step", () => {
    const bound = storyboard.scenes.find((s) => s.traceStep === 8)!;
    const ctx = buildStepContext(KEY, bound.id)!;
    expect(ctx.text).toContain("Why was the customer charged twice?");
    expect(ctx.text).toContain("charge ch_2 ✕ duplicate");
    expect(ctx.text).toContain("rules broken: order 17 charged twice");
    const intro = buildStepContext(KEY, storyboard.scenes[0].id)!;
    expect(intro.text).toContain("This scene shows no simulation step");
  });
});

describe("the validator rejects a story that disagrees with the simulation", () => {
  const lesson = getLesson("idempotency", "charged-twice")!;
  const original = getLessonStoryboard(lesson)!;
  type Mutable = Storyboard & {
    scenes: (Storyboard["scenes"][number] & { elements: Record<string, unknown>[] })[];
  };
  const mutate = (change: (sb: Mutable) => void) => {
    const copy = structuredClone(original) as Mutable;
    change(copy);
    return validateStoryboard(copy)
      .issues.map((i) => i.message)
      .join("\n");
  };
  const el = (sb: Mutable, scene: string, id: string): unknown =>
    sb.scenes.find((s) => s.id === scene)!.elements.find((e) => e.id === id);

  it("a lost message drawn as delivered", () => {
    expect(
      mutate((sb) => {
        const seq = el(sb, "answer-lost", "seq") as unknown as { rows: { kind: string; status?: string }[] };
        const lost = seq.rows.find((r) => r.status === "lost")!;
        lost.status = "delivered";
      }),
    ).toMatch(/sequence doesn't match/);
  });

  it("one charge in the ledger where the simulation has two", () => {
    expect(
      mutate((sb) => {
        const seq = sb.scenes.find((s) => s.id === "charged-again")!;
        seq.elements.push({
          id: "data",
          type: "data-table",
          enterAt: 0,
          show: ["ledger"],
          tables: [
            {
              id: "ledger",
              title: "Provider ledger",
              columns: ["charge", "for"],
              rows: [{ cells: ["ch_1", "$40 · order 17"] }],
            },
          ],
        });
      }),
    ).toMatch(/Table "ledger" doesn't match/);
  });

  it("a wrong metric", () => {
    expect(
      mutate((sb) => {
        const m = el(sb, "charged-again", "metrics") as unknown as { items: { value: string }[] };
        m.items[0].value = "1";
      }),
    ).toMatch(/Metric "charges" doesn't match/);
  });

  it("a component shown busy in a scene with no simulation step", () => {
    expect(
      mutate((sb) => {
        const d = el(sb, "report", "system") as unknown as { nodes: { state: string }[] };
        d.nodes[0].state = "busy";
      }),
    ).toMatch(/components at rest/);
  });

  it("a message travelling a link the system doesn't have", () => {
    expect(
      mutate((sb) => {
        const d = el(sb, "report", "system") as unknown as { edges: { from: string; to: string }[] };
        d.edges.push({ from: "client", to: "provider" });
      }),
    ).toMatch(/links don't match/);
  });

  it("a sequence without a simulation step, and a skipped key beat", () => {
    expect(mutate((sb) => void delete sb.scenes.find((s) => s.id === "answer-lost")!.traceStep)).toMatch(
      /sequence needs a traceStep/,
    );
    expect(mutate((sb) => void (sb.scenes = sb.scenes.filter((s) => s.id !== "provider-dedupe")))).toMatch(
      /Key trace step 28 \(dedupe\) is not shown/,
    );
  });

  it("a proof that claims a different number", () => {
    expect(
      mutate((sb) => {
        const r = el(sb, "proof", "answer") as unknown as { value: string };
        r.value = "0 of 100";
      }),
    ).toMatch(/must display exactly "0 of 66"/);
  });
});

describe("your own scenario", () => {
  it("builds the default (no safeguards, the API's answer lost) as a checked replay that double-charges", () => {
    const r = buildScenarioReplay(DEFAULT_CHOICES);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.summary.charges).toBe(2);
    expect(r.summary.doubleCharges).toBeGreaterThan(0);
    expect(validateStoryboard(r.storyboard).ok).toBe(true);
  });

  it("every combination of safeguards, losses, and timings builds a replay that validates and fits a phone", () => {
    const safeguards = [
      { key: false, inProgress: false, forwardKey: false },
      { key: true, inProgress: false, forwardKey: false },
      { key: true, inProgress: true, forwardKey: false },
      { key: true, inProgress: false, forwardKey: true },
      fix,
    ];
    for (const s of safeguards)
      for (const lose of LOSSES)
        for (const slowProvider of [false, true])
          for (const patientClient of [false, true]) {
            const choices: ScenarioChoices = { ...DEFAULT_CHOICES, ...s, lose, slowProvider, patientClient };
            const r = buildScenarioReplay(choices);
            expect(r.ok, JSON.stringify(choices)).toBe(true);
            if (!r.ok) continue;
            for (const scene of r.storyboard.scenes) expect(sceneFitProblems(scene.elements)).toEqual([]);
            if (s === fix) expect(r.summary.doubleCharges).toBe(0);
            expect(
              validateQuickChecks(r.storyboard, runTrace(KEY, r.storyboard.trace!.args), r.checks),
            ).toEqual([]);
          }
  });
});

describe("the catalog", () => {
  it("never reuses a DSA pattern's slug for a topic, and lesson keys are unique", () => {
    const patterns = new Set(getPatterns("dsa").map((p) => p.slug));
    for (const topic of getTopics()) expect(patterns.has(topic.slug), topic.slug).toBe(false);
    const keys = getTopics().flatMap((t) => getTopicLessons(t.slug).map(lessonKey));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every built lesson has a storyboard and a trace; planned lessons have no page", () => {
    for (const lesson of getLessons()) {
      expect(getLessonStoryboard(lesson), lesson.slug).toBeDefined();
      expect(() => runTrace(lessonKey(lesson), lesson.replays[0].args)).not.toThrow();
    }
    expect(getLesson("sharding", "hot-key")).toBeUndefined();
    // Every lesson's trace runs here, some with a proof that takes a second or so the first time.
  }, 60_000);

  it("lessons share progress, quick check, and review keys with problems", () => {
    expect(getProgressKeys().has(KEY)).toBe(true);
    expect(getProgressIndex().problems[KEY]).toMatchObject({
      title: "Why was the customer charged twice?",
      href: "/system-design/idempotency/charged-twice",
      hasVideo: true,
    });
  });

  it("keeps the DSA generator prompt free of system design primitives (it stays unchanged)", () => {
    const dsa = currentPrompts.systemPrompt();
    for (const type of ["system-diagram", "sequence:", "data-table", "metrics:"])
      expect(dsa).not.toContain(`- ${type}`);
    expect(systemDesignPromptV1.systemPrompt()).toContain("- system-diagram");
  });
});
