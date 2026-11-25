import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { storyboards } from "@/content/storyboards";
import { getLesson, getLessonStoryboard } from "@/lib/catalog/repository";
import { buildQuickChecks, validateQuickChecks } from "@/lib/quickcheck";
import { simulateReplication, START_VERSION, type ReplicationScenarioInput } from "@/lib/sim/replication";
import {
  buildReplicationReplay,
  DEFAULT_REPLICATION_CHOICES,
  LAGS,
  READ_AFTER,
} from "@/lib/sim/replication-scenario";
import { validateStoryboard, type Storyboard } from "@/lib/storyboard";
import { runTrace } from "@/lib/traces";
import { readRuleRuns, type ReadProofRange } from "@/lib/traces/system-design/vanished-comment";
import { describeStep } from "@/lib/traces/describe";
import { buildStepContext } from "@/lib/tutor/context";
import { sceneFitProblems } from "@/video/fit/scene";
import { textMetrics } from "@/video/text";

const KEY = "replication/vanished-comment";
const lesson = getLesson("replication", "vanished-comment")!;
const storyboard = getLessonStoryboard(lesson)!;
const [replays, range] = lesson.replays[0].args as [ReplicationScenarioInput[], ReadProofRange];
const trace = runTrace(KEY, lesson.replays[0].args);
const base: ReplicationScenarioInput = {
  label: "test",
  seed: 7,
  fix: "none",
  lagMs: 100,
  spike: { atMs: 3000, durationMs: 3000, lagMs: 2000 },
  readAfterMs: 300,
  follow: { atMs: 3500 },
};
const fix = { fix: "read-your-writes" as const };
const followed = (s: Partial<ReplicationScenarioInput>) =>
  simulateReplication({ ...base, ...s }).events.map((e) =>
    e.kind === "read"
      ? `read:${e.read.store}:v${e.read.returned}${e.read.stale ? ":stale" : ""}`
      : `${e.kind}`,
  );

describe("the replication simulation", () => {
  it("replays a scenario exactly", () => {
    const run = () => simulateReplication({ ...base, ...fix });
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("traffic has its own streams: the fix doesn't change who writes when or how long replication takes", () => {
    const applies = (s: Partial<ReplicationScenarioInput>) =>
      simulateReplication({ ...base, ...s }).events.filter((e) => e.kind !== "read");
    expect(JSON.stringify(applies(fix))).toBe(JSON.stringify(applies({})));
  });

  it("follows Ana: her comment vanishes for two reloads, then comes back once the replica applies it", () => {
    expect(followed({})).toEqual([
      "spike",
      "write",
      "ack",
      "read:replica:v49:stale",
      "read:replica:v49:stale",
      "apply",
      "read:replica:v51",
    ]);
    // With read-your-writes her first reload goes to the primary, which has her version.
    expect(followed(fix)).toEqual(["spike", "write", "ack", "read:primary:v51", "apply"]);
  });

  it("versions start from the thread's existing comments, the replica applies them in order and never goes back", () => {
    const r = simulateReplication({ ...base, follow: null, lagMs: 500 });
    expect(r.writes).toBeGreaterThan(10);
    const reads = simulateReplication({ ...base, ...fix });
    expect(reads.events[0].stores.primary).toBeGreaterThanOrEqual(START_VERSION);
    let last = 0;
    for (const e of reads.events) {
      expect(e.stores.replica).toBeGreaterThanOrEqual(last);
      expect(e.stores.replica).toBeLessThanOrEqual(e.stores.primary);
      last = e.stores.replica;
    }
  });

  it("stale reloads grow with the lag; read-your-writes moves reads to the primary instead, more as lag grows", () => {
    const at = (lagMs: number, s: Partial<ReplicationScenarioInput> = {}) =>
      simulateReplication({ ...base, spike: null, follow: null, lagMs, ...s }, { record: false });
    const stale = LAGS.map((lag) => at(lag).staleReloads);
    expect(stale).toEqual([...stale].sort((a, b) => a - b));
    expect(stale[0]).toBe(0);
    expect(stale.at(-1)).toBe(at(1000).reloadsAfterWrite);
    const primary = LAGS.map((lag) => at(lag, fix).primaryReads);
    expect(primary).toEqual([...primary].sort((a, b) => a - b));
    expect(primary.at(-1)).toBeGreaterThan(primary[0] * 5);
    // Without the fix the primary serves no reads at all.
    expect(at(1000).primaryReads).toBe(0);
  });
});

describe("the rule over the stated range (seeds 1–20 × lags 50/200/500/1000 ms × spike off/on × reload 100/300/1000 ms)", () => {
  const setup = (s: Partial<ReplicationScenarioInput>) =>
    ({ ...base, ...s }) as Parameters<typeof readRuleRuns>[0];

  it("is the range the lesson states", () => {
    expect(range).toEqual({
      seeds: [1, 20],
      lags: [50, 200, 500, 1000],
      spikes: [false, true],
      readAfter: [100, 300, 1000],
    });
    expect(replays.map((r) => r.fix)).toEqual(["none", "read-your-writes"]);
  });

  it("reading from the replica records violations; read-your-writes none, in every run", () => {
    expect(readRuleRuns(setup({}), range)).toEqual({ runs: 480, broken: 469 });
    expect(readRuleRuns(setup(fix), range)).toEqual({ runs: 480, broken: 0 });
  });

  it("with the fix, every lag level and spike setting is covered separately (none hides another)", () => {
    for (const lag of range.lags)
      for (const spiked of range.spikes)
        expect(
          readRuleRuns(setup(fix), { ...range, lags: [lag], spikes: [spiked] }).broken,
          `${lag} ms, spike ${spiked}`,
        ).toBe(0);
    // And without it, each lag level breaks the rule somewhere.
    for (const lag of range.lags)
      expect(readRuleRuns(setup({}), { ...range, lags: [lag] }).broken).toBeGreaterThan(0);
  });

  it("the stated condition: a second device without the token sees the comment vanish again", () => {
    const r = simulateReplication({ ...base, ...fix, deviceSwitch: true });
    const ana = r.events.flatMap((e) => (e.kind === "read" ? [e.read] : []));
    expect(ana[0]).toMatchObject({ store: "replica", token: 0, stale: true });
    expect(r.violations.some((v) => v.user === "Ana")).toBe(true);
  });

  it("only reads issued after the confirmation count: a read already on its way is concurrent", () => {
    // Every recorded violation is a read older than the version its user had confirmed when the read was issued.
    const r = simulateReplication({ ...base, lagMs: 1000, follow: null }, { record: false });
    expect(r.violations.length).toBeGreaterThan(0);
    for (const v of r.violations) expect(v.returned).toBeLessThan(v.token);
  });

  it("the lesson's trace ends with that proof, stated with its conditions", () => {
    const last = trace.steps.at(-1)!;
    expect(last.sim!.readProof).toEqual({
      runs: 480,
      seeds: [1, 20],
      lags: [50, 200, 500, 1000],
      spikes: [false, true],
      spike: { lagMs: 2000, durationMs: 3000 },
      readAfter: [100, 300, 1000],
      baseline: 469,
      fixed: 0,
    });
    expect(trace.answerDisplay).toBe("0 of 480");
    expect(last.note).toMatch(/one primary taking every write in order/);
    expect(last.note).toMatch(/token sent with every read/);
    expect(last.note).toMatch(/no failover/);
  });
});

describe("the lesson", () => {
  it("keys the story's beats", () => {
    expect(trace.steps.flatMap((s, i) => (s.key ? [`${i}:${s.kind}`] : []))).toEqual([
      "2:ack",
      "3:stale-read",
      "6:read",
      "7:sweep",
      "11:read",
      "13:sweep",
      "14:cost",
      "15:proof",
    ]);
  });

  it("records which store served each followed read and the version it returned", () => {
    expect(trace.steps.flatMap((s) => (s.sim?.read ? [s.sim.read] : []))).toEqual([
      { user: "Ana", store: "replica", returned: 49, token: 51, replicaAt: 49, fix: false },
      { user: "Ana", store: "replica", returned: 49, token: 51, replicaAt: 49, fix: false },
      { user: "Ana", store: "replica", returned: 51, token: 51, replicaAt: 51, fix: false },
      { user: "Ana", store: "primary", returned: 51, token: 51, replicaAt: 49, fix: true },
    ]);
  });

  it("shows both stores side by side with versions, and the stream carrying Ana's version", () => {
    const posted = storyboard.scenes.find((s) => s.id === "posted")!;
    const diagram = posted.elements.find((e) => e.type === "system-diagram");
    expect(diagram?.type === "system-diagram" && diagram.tokens).toEqual([
      { id: "stream", label: "v51", from: "primary", to: "replica", status: "moving" },
    ]);
    const tables = posted.elements.find((e) => e.type === "data-table");
    expect(
      tables?.type === "data-table" && tables.tables.map((t) => t.rows.map((r) => r.cells.join(" "))),
    ).toEqual([
      ["v50 comment by u16", "v51 Ana's comment"],
      ["v48 comment by u13", "v49 comment by u15"],
    ]);
    const seq = storyboard.scenes
      .find((s) => s.id === "vanished")!
      .elements.find((e) => e.type === "sequence");
    expect(seq?.type === "sequence" && seq.lanes.map((l) => l.label)).toEqual([
      "Ana",
      "App",
      "Primary",
      "Replica",
    ]);
  });

  it("measures how often it happens as lag grows, and what the fix costs the primary", () => {
    const chart = (step: number) =>
      trace.steps[step].sim!.load!.windows.map((w) => `${w.group} ${w.label}: ${w.served}/${w.offered}`);
    expect(chart(7)).toEqual([
      "no fix 50: 9/18",
      "no fix 200: 11/18",
      "no fix 500: 17/18",
      "no fix 1000: 18/18",
    ]);
    expect(chart(13).slice(4)).toEqual([
      "the fix 50: 0/18",
      "the fix 200: 0/18",
      "the fix 500: 0/18",
      "the fix 1000: 0/18",
    ]);
    expect(trace.steps[14].sim!.tables[0].rows.map((r) => r.cells.join(" "))).toEqual([
      "50 ms 3.7/s · 11%",
      "200 ms 4.1/s · 13%",
      "500 ms 5.6/s · 17%",
      "1000 ms 6.4/s · 20%",
    ]);
    // The cost scene's chart: reads a second to the primary (bar) out of all reads a second (outline).
    expect(trace.steps[14].sim!.load!.windows.map((w) => `${w.label}: ${w.served}/${w.offered}`)).toEqual([
      "50: 3.7/32.8",
      "200: 4.1/32.8",
      "500: 5.6/32.8",
      "1000: 6.4/32.8",
    ]);
  });

  it("has a storyboard that passes the validator and fits every player size", () => {
    expect(validateStoryboard(storyboard)).toEqual({ ok: true, issues: [] });
    for (const width of [343, 500, 640, 1280])
      for (const scene of storyboard.scenes)
        expect(sceneFitProblems(scene.elements, textMetrics(width)), `${scene.id} at ${width}`).toEqual([]);
  });

  it("states the proof's range on screen, and says latencies are illustrative", () => {
    const closing = storyboard.scenes.at(-1)!;
    const card = closing.elements.find((e) => e.type === "result");
    expect(card?.type === "result" && card.detail).toBe(
      "Seeds 1–20 × 4 lags × spike on/off × 3 reload delays",
    );
    expect(closing.narration).toMatch(/seeds 1 to 20, mean lags of 50, 200, 500, and 1000 milliseconds/);
    expect(closing.narration).toMatch(/one primary taking every write in order/);
    expect(lesson.proofScope).toMatch(/Latencies are illustrative/);
    expect(lesson.proofScope).toMatch(/seeds 1–20/);
  });

  it("asks the three replication quick checks, each proven from the recorded read", () => {
    const checks = buildQuickChecks(storyboard, trace);
    expect(checks.map((c) => `${c.claim.kind}:${c.options[c.answer]}`)).toEqual([
      "replica-version:v49",
      "caught-up:Yes",
      "read-route:Primary",
    ]);
    expect(checks.map((c) => c.prompt)).toEqual([
      "Ana reloads, and the app reads from the replica. Which version does the replica return here?",
      "Ana reloads again. Has the replica caught up to her write, v51, yet?",
      "Ana reloads carrying her token, v51. Where does this read go with read-your-writes?",
    ]);
    expect(validateQuickChecks(storyboard, trace, checks)).toEqual([]);
    const wrong = checks.map((c) => ({ ...c, answer: (c.answer + 1) % c.options.length }));
    const issues = validateQuickChecks(storyboard, trace, wrong).join("\n");
    for (const c of checks) expect(issues).toContain(`quick check "${c.id}": the answer`);
  });

  it("the read-route validator recomputes the rule: a read recorded at the wrong store is caught", () => {
    const checks = buildQuickChecks(storyboard, trace);
    const broken = structuredClone(trace);
    broken.steps[11].sim!.read!.store = "replica";
    expect(validateQuickChecks(storyboard, broken, checks).join("\n")).toMatch(
      /didn't go where read-your-writes sends it/,
    );
  });

  it("grounds the tutor in the read: the store, the version, and the token", () => {
    const scene = storyboard.scenes.find((s) => s.traceStep === 11)!;
    const ctx = buildStepContext(KEY, scene.id)!;
    expect(ctx.text).toContain("I posted a comment and it vanished");
    expect(ctx.text).toContain(
      "read by Ana (read-your-writes on): token v51, replica at v49 when the app decided, served by the primary, returned v51",
    );
    expect(describeStep(trace.steps[7], 7)).toContain(
      "no fix 50 ms: 9 of 18 reloads right after the user's own write came back without it",
    );
  });

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

  it("the stale read drawn as served by the primary, or as returning Ana's version", () => {
    type Seq = { rows: { kind: string; to?: string; label?: string }[] };
    expect(
      mutate((sb) => {
        const row = el<Seq>(sb, "vanished", "sequence").rows.find((r) => r.label === "read → v49")!;
        row.to = "primary";
      }),
    ).toMatch(/sequence doesn't match/);
    expect(
      mutate((sb) => {
        const row = el<Seq>(sb, "vanished", "sequence").rows.find((r) => r.label === "read → v49")!;
        row.label = "read → v51";
      }),
    ).toMatch(/sequence doesn't match/);
  });

  it("a replica drawn caught up, a wrong stored comment, and the stream drawn as delivered", () => {
    expect(
      mutate((sb) => {
        el<{ items: { value: string }[] }>(sb, "vanished", "metrics").items[1].value = "v51";
      }),
    ).toMatch(/Metric "replica" doesn't match/);
    expect(
      mutate((sb) => {
        const t = el<{ tables: { rows: { cells: string[] }[] }[] }>(sb, "posted", "data-table");
        t.tables[1].rows[1].cells = ["v51", "Ana's comment"];
      }),
    ).toMatch(/doesn't match/);
    expect(
      mutate((sb) => {
        el<{ tokens: { status: string }[] }>(sb, "posted", "system-diagram").tokens[0].status = "arrived";
      }),
    ).toMatch(/messages on the diagram don't match/);
  });

  it("a sweep with fewer stale reloads, a proof claiming a different count, and a skipped beat", () => {
    expect(
      mutate((sb) => {
        el<{ windows: { served: number }[] }>(sb, "how-often", "load-chart").windows[3].served = 2;
      }),
    ).toMatch(/load chart doesn't match/);
    expect(
      mutate((sb) => {
        el<{ value: string }>(sb, "proof", "result").value = "0 of 100";
      }),
    ).toMatch(/must display exactly "0 of 480"/);
    expect(mutate((sb) => void (sb.scenes = sb.scenes.filter((s) => s.id !== "cost")))).toMatch(
      /Key trace step 14 \(cost\) is not shown/,
    );
  });
});

describe("your own scenario", () => {
  it("every combination of lag, spike, fix, and reload delay builds a checked replay that fits a phone", () => {
    let n = 0;
    for (const lagMs of LAGS)
      for (const spike of [false, true])
        for (const on of [false, true])
          for (const readAfterMs of READ_AFTER) {
            n++;
            const choices = { ...DEFAULT_REPLICATION_CHOICES, lagMs, spike, fix: on, readAfterMs };
            const r = buildReplicationReplay(choices);
            expect(r.ok, JSON.stringify(choices)).toBe(true);
            if (!r.ok) continue;
            for (const width of [343, 500, 640, 1280])
              for (const scene of r.storyboard.scenes)
                expect(sceneFitProblems(scene.elements, textMetrics(width))).toEqual([]);
            const t = runTrace(KEY, r.storyboard.trace!.args);
            expect(validateQuickChecks(r.storyboard, t, r.checks)).toEqual([]);
            expect(r.checks.length).toBeGreaterThan(0);
            // Read-your-writes never breaks the rule, at any lag, spike, or reload delay; reading the replica does.
            if (on) expect(r.summary.broken).toBe(0);
            else expect(r.summary.broken).toBeGreaterThan(0);
          }
    expect(n).toBe(48);
  }, 60_000);
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
    // Later lessons add their own files (each pins the rest in its own test).
    const later = [`replication${path.sep}vanished-comment`, `consistency${path.sep}lost-update`];
    const existing = files.filter((f) => !later.some((l) => f.includes(l))).sort();
    const h = createHash("sha256");
    for (const f of existing) h.update(f).update(readFileSync(f));
    expect([existing.length, h.digest("hex").slice(0, 16)]).toEqual([105, "22c95cfb6c55b1d2"]);
  });

  it("every existing video resolves to exactly the same storyboard", () => {
    const h = createHash("sha256");
    const ids = storyboards
      .map((s) => s.id)
      .filter((id) => id !== "replication-vanished-comment" && id !== "consistency-lost-update")
      .sort();
    for (const id of ids) h.update(id).update(JSON.stringify(storyboards.find((s) => s.id === id)));
    expect([ids.length, h.digest("hex").slice(0, 16)]).toEqual([106, "c1a0c91c9c5013f8"]);
  });

  it("the three earlier lessons' traces are byte-identical", () => {
    const hash = (topic: string, slug: string) =>
      createHash("sha256")
        .update(JSON.stringify(runTrace(`${topic}/${slug}`, getLesson(topic, slug)!.replays[0].args)))
        .digest("hex")
        .slice(0, 16);
    expect(hash("idempotency", "charged-twice")).toBe("a9629989cdea67d3");
    expect(hash("estimates", "one-server")).toBe("23fe936ce8c1da31");
    expect(hash("load-balancing", "slow-server")).toBe("fe0066504d944a98");
  });
});
