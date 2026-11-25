import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { storyboards } from "@/content/storyboards";
import { getLesson, getLessonStoryboard } from "@/lib/catalog/repository";
import { buildQuickChecks, validateQuickChecks } from "@/lib/quickcheck";
import {
  rule2Holds,
  simulateStampede,
  stampedeScenarioSchema,
  type StampedeScenarioInput,
} from "@/lib/sim/stampede";
import {
  buildStampedeReplay,
  DEFAULT_STAMPEDE_CHOICES,
  KEY_COUNTS,
  RATES,
} from "@/lib/sim/stampede-scenario";
import { validateStoryboard, type Storyboard } from "@/lib/storyboard";
import { runTrace } from "@/lib/traces";
import { describeStep } from "@/lib/traces/describe";
import { SETUPS, stampedeRuns, type StampedeRange } from "@/lib/traces/system-design/stampede";
import { buildStepContext } from "@/lib/tutor/context";
import { sceneFitProblems } from "@/video/fit/scene";
import { textMetrics } from "@/video/text";

const KEY = "caching/stampede";
const lesson = getLesson("caching", "stampede")!;
const storyboard = getLessonStoryboard(lesson)!;
const [replays, range] = lesson.replays[0].args as [StampedeScenarioInput[], StampedeRange];
const trace = runTrace(KEY, lesson.replays[0].args);
const base: StampedeScenarioInput = {
  label: "test",
  seed: 1,
  singleFlight: false,
  jitter: 0,
  keys: 4,
  rps: 500,
  trafficFromMs: 7500,
};
const followed = (s: Partial<StampedeScenarioInput>) =>
  simulateStampede({ ...base, ...s }).events.flatMap((e) =>
    e.kind === "miss" ? [`${e.request} ${e.action}`] : [],
  );

describe("the stampede simulation", () => {
  it("replays a scenario exactly", () => {
    const run = () => simulateStampede({ ...base, singleFlight: true });
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("no fix: four keys expire together, 76 queries for 4 values, the queue fills, pages fail", () => {
    const r = simulateStampede(base);
    expect(r.expiries.map((e) => e.at)).toEqual([10_000, 10_000, 10_000, 10_000]);
    expect(followed({})).toEqual(["R1274 fetch", "R1275 fetch", "R1276 fetch"]);
    expect([r.queries, r.maxQueue, r.rejected]).toEqual([76, 64, 19]);
    expect(r.maxPerKeyNode).toBeGreaterThan(10);
    expect(rule2Holds(r, 8)).toBe(false);
  });

  it("single-flight: one query per key; the others wait and take the fetch's time", () => {
    const r = simulateStampede({ ...base, singleFlight: true });
    expect(followed({ singleFlight: true })).toEqual(["R1274 fetch", "R1275 wait", "R1276 wait"]);
    expect([r.queries, r.maxQueue, r.rejected, r.duplicateFetches]).toEqual([4, 0, 0, 0]);
    expect(r.waitP99).toBeGreaterThan(30);
    expect(r.hitP99).toBe(1);
  });

  it("jittered TTLs spread keys set together over the jitter range", () => {
    const r = simulateStampede({ ...base, keys: 32, jitter: 0.2, singleFlight: true });
    const at = r.expiries.map((e) => e.at);
    expect(new Set(at).size).toBeGreaterThan(28);
    expect(Math.min(...at)).toBeGreaterThanOrEqual(8000);
    expect(Math.max(...at)).toBeLessThanOrEqual(12_000);
    expect(r.maxQueue).toBe(0);
  });

  it("single-flight is per app node: 3 uncoordinated nodes send up to 3 fetches of a key, one per node", () => {
    const r = simulateStampede({ ...base, singleFlight: true, nodes: 3 });
    expect(r.maxPerKeyAll).toBe(3);
    expect(r.maxPerKeyNode).toBe(1);
    expect(r.duplicateFetches).toBe(0);
  });
});

describe("the rules over the stated range (seeds 1–10 × 200/500/1000 pages/s × 1, 4, 16, 32 keys, one node)", () => {
  const first = stampedeScenarioSchema.parse(replays[0]);
  const setup = (singleFlight: boolean, jitter: number) =>
    stampedeRuns(first, { singleFlight, jitter }, range);

  it("is the range the lesson states", () => {
    expect(range).toEqual({ seeds: [1, 10], rps: [200, 500, 1000], keys: [1, 4, 16, 32] });
    expect(replays.map((r) => [r.singleFlight, r.jitter, r.keys])).toEqual([
      [false, 0, 4],
      [true, 0, 4],
      [true, 0.2, 32],
    ]);
  });

  it("no fix breaks both rules; jitter alone still does; single-flight alone breaks rule 2 at 32 keys; both, never", () => {
    expect(setup(false, 0)).toEqual({ runs: 120, rule1: 119, rule2: 108, broken: 119 });
    expect(setup(false, 0.2)).toEqual({ runs: 120, rule1: 120, rule2: 99, broken: 120 });
    expect(setup(true, 0)).toEqual({ runs: 120, rule1: 0, rule2: 30, broken: 30 });
    expect(setup(true, 0.2)).toEqual({ runs: 120, rule1: 0, rule2: 0, broken: 0 });
    // Single-flight alone: every rule-2 break is at 32 keys.
    expect(stampedeRuns(first, { singleFlight: true, jitter: 0 }, { ...range, keys: [1, 4, 16] }).rule2).toBe(
      0,
    );
  });

  it("the lesson's trace ends with that proof for all four setups, stated with its conditions", () => {
    const last = trace.steps.at(-1)!;
    const p = last.sim!.stampedeProof!;
    expect(p.setups.map((x) => [x.name, x.rule1, x.rule2])).toEqual([
      ["no fix", 119, 108],
      ["single-flight", 0, 30],
      ["jitter", 120, 99],
      ["both", 0, 0],
    ]);
    expect(SETUPS.map((x) => x.name)).toEqual(p.setups.map((x) => x.name));
    expect([p.runs, p.fixed, trace.answerDisplay]).toEqual([120, 0, "0 of 120"]);
    expect(last.note).toMatch(/one app node \(or single-flight coordinated across nodes\)/);
    expect(last.note).toMatch(/a failed one must hand off to one waiting request/);
  });
});

describe("the lesson", () => {
  it("keys the story's beats", () => {
    expect(trace.steps.flatMap((s, i) => (s.key ? [`${i}:${s.kind}`] : []))).toEqual([
      "5:fetch",
      "15:window",
      "24:wait",
      "32:window",
      "36:deploy",
      "53:keys-sweep",
      "54:cost",
      "55:proof",
    ]);
  });

  it("measures the pile-up and the calm in the same half second, and the keys single-flight alone can take", () => {
    const w = (step: number) => trace.steps[step].sim!.load!.windows.at(-1)!;
    expect([w(15).p99, w(15).errors, w(15).saturated]).toEqual([447, 19, ["db"]]);
    expect([w(32).p99, w(32).errors, w(32).saturated]).toEqual([57, 0, []]);
    expect(trace.steps[53].sim!.tables[0].rows.map((r) => r.cells.join(" "))).toEqual([
      "8 0 / 0",
      "16 8 / 0",
      "24 16 / 0",
      "32 24 / 0",
    ]);
    expect(trace.steps[54].sim!.tables[0].rows.map((r) => r.cells.join(" "))).toEqual([
      "p99 wait / hit 58 ms / 1 ms",
      "3 app nodes 3 fetches/key",
    ]);
  });

  it("has a storyboard that passes the validator and fits every player size", () => {
    expect(validateStoryboard(storyboard)).toEqual({ ok: true, issues: [] });
    for (const width of [343, 500, 640, 1280])
      for (const scene of storyboard.scenes)
        expect(sceneFitProblems(scene.elements, textMetrics(width)), `${scene.id} at ${width}`).toEqual([]);
  });

  it("states the range and the conditions on screen, and the alternatives in the lesson", () => {
    const closing = storyboard.scenes.at(-1)!;
    const card = closing.elements.find((e) => e.type === "result");
    expect(card?.type === "result" && card.detail).toBe(
      "Seeds 1–10 × 200/500/1000 pages/s × 1, 4, 16, 32 keys",
    );
    expect(closing.narration).toMatch(
      /one app node or coordinated single-flight, a fetch that succeeds, and jittered TTLs/,
    );
    expect(lesson.fix).toMatch(/stale-while-revalidate/);
    expect(lesson.fix).toMatch(/refreshing before expiry/);
    expect(lesson.proofScope).toMatch(/Query times are illustrative/);
  });

  it("asks how many fetches, fetch or wait, and whether keys expire together, each proven from the record", () => {
    const checks = buildQuickChecks(storyboard, trace);
    expect(checks.map((c) => `${c.claim.kind}:${c.options[c.answer]}`)).toEqual([
      "db-count:2",
      "fetch-or-wait:It waits for that fetch",
      "expire-together:No",
    ]);
    expect(validateQuickChecks(storyboard, trace, checks)).toEqual([]);
    const wrong = checks.map((c) => ({ ...c, answer: (c.answer + 1) % c.options.length }));
    const issues = validateQuickChecks(storyboard, trace, wrong).join("\n");
    for (const c of checks) expect(issues).toContain(`quick check "${c.id}": the answer`);
  });

  it("the validators recompute single-flight: a miss recorded as fetching while a fetch ran is caught", () => {
    const checks = buildQuickChecks(storyboard, trace);
    const broken = structuredClone(trace);
    broken.steps[24].sim!.stampede!.action = "fetch";
    expect(validateQuickChecks(storyboard, broken, checks).join("\n")).toMatch(
      /didn't do what single-flight decides/,
    );
  });

  it("the growth story's questions aren't asked of this lesson's time windows", () => {
    const kinds = buildQuickChecks(storyboard, trace).map((c) => c.claim.kind);
    expect(kinds).not.toContain("p99-trend");
    expect(kinds).not.toContain("saturates-first");
  });

  it("grounds the tutor in the miss and the fetches already on their way", () => {
    const scene = storyboard.scenes.find((s) => s.traceStep === 24)!;
    const ctx = buildStepContext(KEY, scene.id)!;
    expect(ctx.text).toContain("Everything fell over when the cache expired");
    expect(ctx.text).toContain(
      "R1275 misses trending and waits for the fetch already running (single-flight on; fetches of this key already sent: 1 from this node, 1 in all)",
    );
    expect(describeStep(trace.steps[55], 55)).toContain(
      "single-flight: rule 1 broken in 0, rule 2 in 30 of 120",
    );
  }, 60_000);

  it("links no DSA pattern", () => {
    expect(lesson.relatedPatterns).toEqual([]);
  });
});

describe("the validator rejects a story that disagrees with the simulation", () => {
  type Mutable = Storyboard & {
    scenes: (Storyboard["scenes"][number] & { elements: Record<string, unknown>[] })[];
  };
  const mutate = (change: (sb: Mutable) => void) => {
    const copy = structuredClone(storyboard) as Mutable;
    change(copy);
    return validateStoryboard(copy)
      .issues.map((i) => i.message)
      .join("\n");
  };
  const el = <T>(sb: Mutable, scene: string, type: string) =>
    sb.scenes.find((s) => s.id === scene)!.elements.find((e) => e.type === type) as unknown as T;

  it("a waiting request drawn as querying, and a calmer pile-up", () => {
    type Seq = { rows: { kind: string; text?: string }[] };
    expect(
      mutate((sb) => {
        el<Seq>(sb, "coalesced", "sequence").rows.find((r) => r.text === "R1275 waits for trending")!.text =
          "R1275: query";
      }),
    ).toMatch(/sequence doesn't match/);
    expect(
      mutate((sb) => {
        el<{ windows: { errors: number }[] }>(sb, "pileup", "load-chart").windows[4].errors = 0;
      }),
    ).toMatch(/load chart doesn't match/);
  }, 60_000);

  it("keys drawn expiring together, a proof claiming a different count, and a skipped beat", () => {
    expect(
      mutate((sb) => {
        el<{ tables: { rows: { cells: string[] }[] }[] }>(
          sb,
          "jitter",
          "data-table",
        ).tables[0].rows[1].cells[1] = "10.0 s";
      }),
    ).toMatch(/doesn't match/);
    expect(
      mutate((sb) => {
        el<{ value: string }>(sb, "proof", "result").value = "0 of 100";
      }),
    ).toMatch(/must display exactly "0 of 120"/);
    expect(mutate((sb) => void (sb.scenes = sb.scenes.filter((s) => s.id !== "cost")))).toMatch(
      /Key trace step 54 \(cost\) is not shown/,
    );
  }, 60_000);
});

describe("your own scenario", () => {
  it("every combination of traffic, single-flight, jitter, and keys builds a checked replay that fits every width", () => {
    let n = 0;
    for (const rps of RATES)
      for (const singleFlight of [false, true])
        for (const jitter of [false, true])
          for (const keys of KEY_COUNTS) {
            n++;
            const choices = { ...DEFAULT_STAMPEDE_CHOICES, rps, singleFlight, jitter, keys };
            const r = buildStampedeReplay(choices);
            expect(r.ok, JSON.stringify(choices)).toBe(true);
            if (!r.ok) continue;
            for (const width of [343, 500, 640, 1280])
              for (const scene of r.storyboard.scenes)
                expect(sceneFitProblems(scene.elements, textMetrics(width))).toEqual([]);
            const t = runTrace(KEY, r.storyboard.trace!.args);
            expect(validateQuickChecks(r.storyboard, t, r.checks)).toEqual([]);
            expect(r.checks.length).toBeGreaterThan(0);
            // Both fixes never break a rule; without single-flight, runs break one.
            if (singleFlight && jitter) expect(r.summary.broken).toBe(0);
            if (!singleFlight) expect(r.summary.broken).toBeGreaterThan(0);
          }
    expect(n).toBe(48);
  }, 180_000);
});

describe("existing lessons and videos are unchanged", () => {
  it("every storyboard file but this lesson's is byte-identical", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = path.join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".json")) files.push(p);
      }
    };
    walk("src/content/storyboards/generated");
    const existing = files.filter((f) => !f.includes(`caching${path.sep}stampede`)).sort();
    const h = createHash("sha256");
    for (const f of existing) h.update(f).update(readFileSync(f));
    expect([existing.length, h.digest("hex").slice(0, 16)]).toEqual([108, "303df91e98c69368"]);
  });

  it("every existing video resolves to exactly the same storyboard", () => {
    const h = createHash("sha256");
    const ids = storyboards
      .map((s) => s.id)
      .filter((id) => id !== "caching-stampede")
      .sort();
    for (const id of ids) h.update(id).update(JSON.stringify(storyboards.find((s) => s.id === id)));
    expect([ids.length, h.digest("hex").slice(0, 16)]).toEqual([109, "2067bd5d251d9c26"]);
  });

  it("the six earlier lessons' traces are byte-identical", () => {
    const hash = (topic: string, slug: string) =>
      createHash("sha256")
        .update(JSON.stringify(runTrace(`${topic}/${slug}`, getLesson(topic, slug)!.replays[0].args)))
        .digest("hex")
        .slice(0, 16);
    expect(hash("idempotency", "charged-twice")).toBe("a9629989cdea67d3");
    expect(hash("estimates", "one-server")).toBe("23fe936ce8c1da31");
    expect(hash("load-balancing", "slow-server")).toBe("fe0066504d944a98");
    expect(hash("replication", "vanished-comment")).toBe("3ba57e32b2427a19");
    expect(hash("consistency", "lost-update")).toBe("0fd36a67832e499e");
    expect(hash("caching", "stale-price")).toBe("8d44bdf4b4609dac");
  });
});
