import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getLesson, getLessonStoryboard } from "@/lib/catalog/repository";
import { buildQuickChecks, validateQuickChecks } from "@/lib/quickcheck";
import { simulateBalancing, type BalancingScenarioInput } from "@/lib/sim/balancing";
import {
  buildBalancingReplay,
  DEFAULT_BALANCING_CHOICES,
  FACTORS,
  HEALTH,
  POLICIES,
  TRAFFIC,
  WORKERS,
} from "@/lib/sim/balancing-scenario";
import { validateStoryboard, type Storyboard } from "@/lib/storyboard";
import { runTrace } from "@/lib/traces";
import { ruleRuns } from "@/lib/traces/system-design/slow-server";
import { buildStepContext } from "@/lib/tutor/context";
import { sceneFitProblems } from "@/video/fit/scene";
import { textMetrics } from "@/video/text";

const KEY = "load-balancing/slow-server";
const lesson = getLesson("load-balancing", "slow-server")!;
const storyboard = getLessonStoryboard(lesson)!;
const [replays, range] = lesson.replays[0].args as [
  BalancingScenarioInput[],
  { seeds: [number, number]; factors: number[] },
];
const trace = runTrace(KEY, lesson.replays[0].args);
const base: BalancingScenarioInput = {
  label: "test",
  seed: 3,
  policy: "round-robin",
  workers: 4,
  serviceMs: 80,
  rps: 40,
  degrade: { atMs: 3000, factor: 6, recoverAtMs: 9000 },
  health: null,
  followAtMs: 3500,
};
const fix = { policy: "least-outstanding" as const, health: { intervalMs: 1000 } };

describe("the balancing simulation", () => {
  it("replays a scenario exactly", () => {
    const run = () => simulateBalancing({ ...base, ...fix });
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("arrivals have their own stream: routing doesn't change who arrives when", () => {
    const arrivals = (s: Partial<BalancingScenarioInput>) =>
      simulateBalancing({ ...base, ...s }).windows.map((w) => w.arrivals);
    expect(arrivals(fix)).toEqual(arrivals({}));
  });

  it("follows individual requests from the balancer to their server and back", () => {
    const events = simulateBalancing(base).events.filter((e) => "request" in e);
    expect(events.map((e) => `${e.kind}:${"request" in e ? e.request : ""}`)).toEqual([
      "route:R139",
      "route:R140",
      "queued:R140",
      "done:R139",
      "timeout:R140",
      "done:R140",
    ]);
    const late = events.find((e) => e.kind === "done" && e.request === "R140");
    expect(late?.kind === "done" && late.late).toBe(true);
  });

  it("measures the damage: round robin times out and affects many requests while server 1 sits half idle", () => {
    const [, degraded] = simulateBalancing(base).windows;
    expect(degraded.timeouts).toBeGreaterThan(20);
    expect(degraded.affected).toBeGreaterThan(30);
    expect(degraded.servers[0].utilization).toBeLessThan(0.5);
    const fixed = simulateBalancing({ ...base, ...fix }).windows[2];
    expect(fixed.timeouts).toBe(0);
    expect(fixed.p99).toBeLessThan(300);
  });

  it("health checks mark the slow server unhealthy, route nothing to it, and bring it back after it recovers", () => {
    const r = simulateBalancing({ ...base, ...fix });
    const health = r.events
      .filter((e) => e.kind === "health")
      .map((e) => (e.kind === "health" ? e.healthy : null));
    expect(health).toEqual([false, true]);
    expect(r.unhealthyRoutes).toBe(0);
    expect(r.windows[2].servers[1].routed).toBe(0);
  });
});

describe("rule 1 over the stated range (seeds 1–20 × 3×, 5×, 8×, hanging at 40 req/s, 4 workers each)", () => {
  const setup = (s: Partial<BalancingScenarioInput>) => ({ ...base, ...s }) as Parameters<typeof ruleRuns>[0];
  it("is the range the lesson states", () => {
    expect(range).toEqual({ seeds: [1, 20], factors: [3, 5, 8, 50] });
    expect(replays.map((r) => [r.workers, r.rps])).toEqual([
      [4, 40],
      [4, 40],
    ]);
  });

  it("round robin breaks it in every run; least outstanding with health checks in none, and never routes to an unhealthy server", () => {
    expect(ruleRuns(setup({}), range)).toEqual({ runs: 80, broken: 80, unhealthyRoutes: 0 });
    expect(ruleRuns(setup(fix), range)).toEqual({ runs: 80, broken: 0, unhealthyRoutes: 0 });
  });

  it("least outstanding alone keeps rule 1 too; health checks alone don't", () => {
    expect(ruleRuns(setup({ policy: "least-outstanding" }), range).broken).toBe(0);
    expect(ruleRuns(setup({ health: { intervalMs: 1000 } }), range).broken).toBeGreaterThan(0);
  });

  it("the edge: requests in transit count, so a burst can't break it; a late completion count would", () => {
    const lor = (s: Partial<BalancingScenarioInput>) =>
      ruleRuns(setup({ policy: "least-outstanding", degrade: { atMs: 3000, factor: 2 }, ...s }), {
        seeds: [1, 20],
        factors: [2],
      }).broken;
    // 120 req/s: many requests are on their way at once, and every one is counted where it's going.
    expect(lor({ rps: 120 })).toBe(0);
    // Counts that drop 20 ms after the server finished would lag behind the servers and break the guarantee.
    expect(lor({ rps: 45, completionLagMs: 20 })).toBeGreaterThan(0);
    expect(lor({ rps: 45, completionLagMs: 0 })).toBe(0);
  });

  it("the lesson's trace ends with that proof, stated with its condition", () => {
    const last = trace.steps.at(-1)!;
    expect(last.sim!.ruleProof).toEqual({
      runs: 80,
      seeds: [1, 20],
      factors: [3, 5, 8, 50],
      rps: 40,
      workers: 4,
      baseline: 80,
      fixed: 0,
    });
    expect(trace.answerDisplay).toBe("0 of 80");
    expect(last.note).toMatch(/both servers at 4 workers/);
    expect(last.note).toMatch(/needs both servers to have the same number of workers/);
  });
});

describe("the lesson", () => {
  it("keys the story's beats", () => {
    expect(trace.steps.flatMap((s, i) => (s.key ? [`${i}:${s.kind}`] : []))).toEqual([
      "2:route",
      "3:violation",
      "8:window",
      "15:route",
      "20:unhealthy",
      "24:window",
      "26:healthy",
      "28:proof",
    ]);
  });

  it("has a storyboard that passes the validator and fits every player size", () => {
    expect(validateStoryboard(storyboard)).toEqual({ ok: true, issues: [] });
    for (const width of [343, 640, 1280])
      for (const scene of storyboard.scenes)
        expect(sceneFitProblems(scene.elements, textMetrics(width)), `${scene.id} at ${width}`).toEqual([]);
  });

  it("states the proof's range and the equal-workers condition on screen", () => {
    const closing = storyboard.scenes.at(-1)!;
    expect(closing.caption).toBe("Rule 1, seeds 1–20 × 4 slowdowns, both servers at 4 workers: fix 0 of 80");
    const card = closing.elements.find((e) => e.type === "result");
    expect(card?.type === "result" && card.detail).toBe(
      "Seeds 1–20 × 3×, 5×, 8×, hanging; 40 req/s; 4 workers each",
    );
    expect(lesson.rules[0]).toMatch(/only when both servers have the same number of workers/);
  });

  it("asks quick checks about routing and health, each proven from the recorded decision", () => {
    const checks = buildQuickChecks(storyboard, trace);
    // Four scenes qualify (two routing decisions, two health verdicts); three are asked, spread over the video.
    expect(checks.map((c) => `${c.claim.kind}:${c.options[c.answer]}`)).toEqual([
      "route:Server 2",
      "health:Yes",
      "health:No",
    ]);
    expect(validateQuickChecks(storyboard, trace, checks)).toEqual([]);
    const wrong = checks.map((c) => ({ ...c, answer: (c.answer + 1) % c.options.length }));
    const issues = validateQuickChecks(storyboard, trace, wrong).join("\n");
    for (const c of checks) expect(issues).toContain(`quick check "${c.id}": the answer`);
  });

  it("grounds the tutor in the routing decision", () => {
    const scene = storyboard.scenes.find((s) => s.traceStep === 15)!;
    const ctx = buildStepContext(KEY, scene.id)!;
    expect(ctx.text).toContain("One slow server takes everyone down");
    expect(ctx.text).toContain(
      "routing R140 (least-outstanding): in progress server-1 2, server-2 4; chose server-1",
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
  const el = (sb: Mutable, scene: string, type: string) =>
    sb.scenes.find((s) => s.id === scene)!.elements.find((e) => e.type === type) as unknown as Record<
      string,
      never
    >;

  it("R140 drawn as sent to the other server", () => {
    expect(
      mutate((sb) => {
        const seq = el(sb, "turn", "sequence") as unknown as {
          rows: { kind: string; to?: string; label?: string }[];
        };
        const row = seq.rows.find((r) => r.kind === "message" && r.label === "R140" && r.to === "server-2")!;
        row.to = "server-1";
      }),
    ).toMatch(/sequence doesn't match/);
  });

  it("a wrong in-progress count, a wrong health state, and a wrong window", () => {
    expect(
      mutate((sb) => {
        const m = el(sb, "least", "metrics") as unknown as { items: { value: string }[] };
        m.items[1].value = "1";
      }),
    ).toMatch(/Metric "in-2" doesn't match/);
    expect(
      mutate((sb) => {
        const m = el(sb, "unhealthy", "metrics") as unknown as { items: { value: string }[] };
        m.items[0].value = "✓ healthy";
      }),
    ).toMatch(/Metric "health-2" doesn't match/);
    expect(
      mutate((sb) => {
        const c = el(sb, "damage", "load-chart") as unknown as { windows: { p99: number }[] };
        c.windows[1].p99 = 300;
      }),
    ).toMatch(/load chart doesn't match/);
  });

  it("a proof claiming a different count, and a skipped beat", () => {
    expect(
      mutate((sb) => {
        const r = el(sb, "proof", "result") as unknown as { value: string };
        r.value = "0 of 100";
      }),
    ).toMatch(/must display exactly "0 of 80"/);
    expect(mutate((sb) => void (sb.scenes = sb.scenes.filter((s) => s.id !== "unhealthy")))).toMatch(
      /Key trace step 20 \(unhealthy\) is not shown/,
    );
  });
});

describe("your own scenario", () => {
  it("keeps both servers equal, as the guarantee needs", () => {
    expect(WORKERS).toBe(4);
  });

  it("every combination of routing, slowdown, health checks, and traffic builds a checked replay that fits a phone", () => {
    for (const { value: policy } of POLICIES)
      for (const factor of FACTORS)
        for (const healthMs of HEALTH)
          for (const rps of TRAFFIC) {
            const choices = { ...DEFAULT_BALANCING_CHOICES, policy, factor, healthMs, rps };
            const r = buildBalancingReplay(choices);
            expect(r.ok, JSON.stringify(choices)).toBe(true);
            if (!r.ok) continue;
            for (const scene of r.storyboard.scenes) expect(sceneFitProblems(scene.elements)).toEqual([]);
            expect(
              validateQuickChecks(r.storyboard, runTrace(KEY, r.storyboard.trace!.args), r.checks),
            ).toEqual([]);
            // Least outstanding never breaks rule 1, with or without health checks, at any slowdown or traffic.
            if (policy === "least-outstanding") expect(r.summary.broken).toBe(0);
          }
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
    // Later lessons add their own files (the replication lesson pins this one's in its own test).
    const later = [
      `load-balancing${path.sep}slow-server`,
      `replication${path.sep}vanished-comment`,
      `consistency${path.sep}lost-update`,
      `caching${path.sep}stale-price`,
    ];
    const existing = files.filter((f) => !later.some((l) => f.includes(l))).sort();
    const h = createHash("sha256");
    for (const f of existing) h.update(f).update(readFileSync(f));
    expect([existing.length, h.digest("hex").slice(0, 16)]).toEqual([104, "628cb6712893e378"]);
  });

  it("the flagship's and the growth story's traces are byte-identical", () => {
    const hash = (key: string, topic: string, slug: string) =>
      createHash("sha256")
        .update(JSON.stringify(runTrace(key, getLesson(topic, slug)!.replays[0].args)))
        .digest("hex")
        .slice(0, 16);
    expect(hash("idempotency/charged-twice", "idempotency", "charged-twice")).toBe("a9629989cdea67d3");
    expect(hash("estimates/one-server", "estimates", "one-server")).toBe("23fe936ce8c1da31");
  });
});
