import { describe, expect, it } from "vitest";

import { lessonSchema } from "@/lib/catalog";
import { getLesson, getLessonStoryboard } from "@/lib/catalog/repository";
import { buildQuickChecks, validateQuickChecks } from "@/lib/quickcheck";
import { simulateCapacity, type CapacityScenarioInput } from "@/lib/sim/capacity";
import {
  buildCapacityReplay,
  DEFAULT_CAPACITY_CHOICES,
  PEAKS,
  SERVERS,
  SERVICE_TIMES,
  WORKERS,
} from "@/lib/sim/capacity-scenario";
import { validateStoryboard, type Storyboard } from "@/lib/storyboard";
import { runTrace } from "@/lib/traces";
import { estimateSchema } from "@/lib/traces/system-design/one-server";
import { buildStepContext } from "@/lib/tutor/context";
import { sceneFitProblems } from "@/video/fit/scene";
import { textMetrics } from "@/video/text";

const KEY = "estimates/one-server";
const base: CapacityScenarioInput = {
  label: "test",
  seed: 11,
  servers: 1,
  workers: 4,
  serviceMs: 80,
  steps: [25],
};
const lesson = getLesson("estimates", "one-server")!;
const storyboard = getLessonStoryboard(lesson)!;
const trace = runTrace(KEY, storyboard.trace!.args);

describe("the capacity simulation", () => {
  it("replays a scenario exactly", () => {
    const run = () => simulateCapacity({ ...base, steps: [25, 60] });
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("a different seed changes the measurements, not the shape of the story", () => {
    const one = simulateCapacity({ ...base, steps: [25, 75] }).windows;
    const other = simulateCapacity({ ...base, seed: 12, steps: [25, 75] }).windows;
    expect(one.map((w) => w.p99)).not.toEqual(other.map((w) => w.p99));
    expect(one.map((w) => w.saturated.length > 0)).toEqual([false, true]);
    expect(other.map((w) => w.saturated.length > 0)).toEqual([false, true]);
  });

  it("arrivals have their own stream: more servers or workers don't change who arrives when", () => {
    const arrivals = (s: Partial<CapacityScenarioInput>) =>
      simulateCapacity({ ...base, ...s, steps: [40] }).windows[0].arrivals;
    expect(arrivals({ servers: 2 })).toBe(arrivals({}));
    expect(arrivals({ workers: 8 })).toBe(arrivals({}));
  });

  it("obeys Little's law: requests in the system = throughput × mean latency, when it isn't saturated", () => {
    // One long steady window.
    const [w] = simulateCapacity({ ...base, windowMs: 20_000, steps: [30] }).windows;
    const littles = (w.served * w.meanLatency) / 1000;
    expect(Math.abs(w.inSystem - littles) / w.inSystem).toBeLessThan(0.03);
    // And every unsaturated window of the lesson's replays.
    for (const s of lesson.replays[0].args[1] as CapacityScenarioInput[])
      for (const win of simulateCapacity(s).windows.filter((x) => x.saturated.length === 0)) {
        const l = (win.served * win.meanLatency) / 1000;
        expect(Math.abs(win.inSystem - l) / win.inSystem, `${s.label} ${win.offered}`).toBeLessThan(0.05);
      }
  });

  it("saturates where workers ÷ service time says (within 10%), and not well below it", () => {
    for (const servers of [1, 2, 3])
      for (const [workers, serviceMs] of [
        [4, 80],
        [2, 40],
        [8, 160],
      ]) {
        const capacity = (servers * workers * 1000) / serviceMs;
        const run = simulateCapacity({
          ...base,
          servers,
          workers,
          serviceMs,
          steps: [Math.round(capacity * 0.6), Math.round(capacity * 1.4)],
        });
        expect(run.capacity).toBe(capacity);
        const [light, heavy] = run.windows;
        expect(light.saturated, `${servers}×${workers}@${serviceMs}`).toEqual([]);
        expect(heavy.saturated.length).toBeGreaterThan(0);
        expect(
          Math.abs(heavy.served - capacity) / capacity,
          `${servers}×${workers}@${serviceMs}`,
        ).toBeLessThan(0.1);
      }
  });

  it("the app server saturates first; the database stays nearly idle", () => {
    const heavy = simulateCapacity({ ...base, steps: [75] }).windows[0];
    expect(heavy.saturated).toEqual(["server-1"]);
    expect(heavy.db.utilization).toBeLessThan(0.1);
    expect(heavy.errors).toBeGreaterThan(0);
  });
});

describe("the lesson's trace", () => {
  it("estimates the peak with exact arithmetic", () => {
    expect(trace.steps.slice(0, 3).map((s) => s.equation)).toEqual([
      { terms: [40000, 54], operator: "×", result: 2160000 },
      { terms: [2160000, 86400], operator: "÷", result: 25 },
      { terms: [25, 3], operator: "×", result: 75 },
    ]);
    expect(estimateSchema.safeParse({ users: 40001, requestsPerUser: 54, peakFactor: 3 }).success).toBe(
      false,
    );
  });

  it("marks the balancer and the second server as added after server 1 saturates", () => {
    expect(trace.systemStart!.nodes.map((n) => n.id)).toEqual(["client", "server-1", "db"]);
    expect(trace.system!.nodes.filter((n) => n.addedAfter).map((n) => [n.id, n.addedAfter])).toEqual([
      ["lb", "server-1"],
      ["server-2", "server-1"],
    ]);
  });

  it("measures both limits and keys the story's beats", () => {
    expect(trace.answerDisplay).toBe("51 → 101 req/s");
    expect(trace.steps.flatMap((s, i) => (s.key ? [`${i}:${s.kind}`] : []))).toEqual([
      "2:peak",
      "3:window",
      "5:saturated",
      "8:window",
      "9:saturated",
      "11:summary",
    ]);
  });
});

describe("the lesson", () => {
  it("has a storyboard that passes the validator and fits every player size", () => {
    expect(storyboard.category).toBe("system-design");
    expect(validateStoryboard(storyboard)).toEqual({ ok: true, issues: [] });
    for (const width of [343, 640, 1280])
      for (const scene of storyboard.scenes)
        expect(sceneFitProblems(scene.elements, textMetrics(width)), `${scene.id} at ${width}`).toEqual([]);
  });

  it("asks quick checks about saturation and p99, each proven from the measurements", () => {
    const checks = buildQuickChecks(storyboard, trace);
    expect(checks.map((c) => c.claim.kind)).toEqual(["saturates-first", "p99-trend"]);
    expect(checks.map((c) => c.options[c.answer])).toEqual(["An app server's workers", "Climbs sharply"]);
    // 113 → 151 ms at the two-server peak is a 1.34× change, too close to the 1.25 threshold to ask about.
    expect(checks.some((c) => c.step === 8)).toBe(false);
    expect(validateQuickChecks(storyboard, trace, checks)).toEqual([]);
    const wrong = checks.map((c) => ({ ...c, answer: (c.answer + 1) % c.options.length }));
    const issues = validateQuickChecks(storyboard, trace, wrong).join("\n");
    for (const c of checks) expect(issues).toContain(`quick check "${c.id}": the answer`);
  });

  it("grounds the tutor in the measured window", () => {
    const scene = storyboard.scenes.find((s) => s.traceStep === 5)!;
    const ctx = buildStepContext(KEY, scene.id)!;
    expect(ctx.text).toContain("Is one server enough?");
    expect(ctx.text).toMatch(/measured window "60" \(1 server\): offered 60\/s, served 50\/s/);
    expect(ctx.text).toContain("saturated server-1");
  });

  it("links no DSA pattern (none can be justified in a sentence the learner would recognize)", () => {
    expect(lesson.relatedPatterns).toEqual([]);
    const flagship = getLesson("idempotency", "charged-twice")!;
    expect(flagship.relatedPatterns).toEqual([
      {
        slug: "arrays-hashing",
        reason: "The API finds a retry's stored result by looking its key up in a hash map, in one step.",
      },
    ]);
  });

  it("requires a one-sentence reason on every related pattern", () => {
    const withLink = (link: unknown) =>
      lessonSchema.safeParse({ ...lesson, relatedPatterns: [link] }).success;
    expect(withLink({ slug: "heap" })).toBe(false);
    expect(withLink({ slug: "heap", reason: "Two sentences. Not one." })).toBe(false);
    expect(withLink({ slug: "heap", reason: "One sentence that ends properly." })).toBe(true);
  });
});

describe("the growth rule and the load chart reject a story that disagrees with the simulation", () => {
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
  const scene = (sb: Mutable, id: string) => sb.scenes.find((s) => s.id === id)!;

  it("adding the second server before the saturation is shown", () => {
    const msg = mutate((sb) => {
      const grow = scene(sb, "grow");
      sb.scenes = sb.scenes.filter((s) => s.id !== "grow");
      sb.scenes.splice(4, 0, grow); // after "light", before "saturated"
    });
    expect(msg).toMatch(
      /"Balancer" is added before any earlier scene shows the simulation measuring server-1 saturated/,
    );
    expect(msg).toMatch(/"Server 2" is added before/);
  });

  it("adding it in the same scene that first shows the saturation", () => {
    expect(
      mutate((sb) => {
        const grown = scene(sb, "grow").elements.find((e) => e.type === "system-diagram")!;
        const at = sb.scenes.findIndex((s) => s.id === "saturated");
        sb.scenes[at].elements = [grown, ...sb.scenes[at].elements.filter((e) => e.type !== "load-chart")];
      }),
    ).toMatch(/is added before any earlier scene shows/);
  });

  it("the story is fine once the saturation scene comes first (the committed order)", () => {
    expect(mutate(() => {})).toBe("");
  });

  it("a bound scene drawing the grown system before the step grew it", () => {
    expect(
      mutate((sb) => {
        const grown = structuredClone(scene(sb, "grow").elements.find((e) => e.type === "system-diagram")!);
        delete grown.stage;
        scene(sb, "saturated").elements.unshift({ ...grown, id: "system2" });
      }),
    ).toMatch(/components don't match the trace|is added before/);
  });

  it("a wrong throughput, a moved ring, and a chart with no step", () => {
    expect(
      mutate((sb) => {
        const chart = scene(sb, "saturated").elements.find((e) => e.type === "load-chart") as unknown as {
          windows: { served: number }[];
        };
        chart.windows[2].served = 60;
      }),
    ).toMatch(/load chart doesn't match/);
    expect(
      mutate((sb) => {
        const chart = scene(sb, "saturated").elements.find((e) => e.type === "load-chart") as unknown as {
          current: number;
        };
        chart.current = 0;
      }),
    ).toMatch(/ringed window doesn't match/);
    expect(mutate((sb) => void delete scene(sb, "light").traceStep)).toMatch(/load-chart needs a traceStep/);
  });

  it("wrong arithmetic in the estimate, with the new ÷", () => {
    expect(
      mutate((sb) => {
        const eq = scene(sb, "average").elements.find((e) => e.type === "equation") as unknown as {
          result: number;
        };
        eq.result = 24;
      }),
    ).toMatch(/2160000 ÷ 86400 is 25, not 24/);
  });
});

describe("your own scenario", () => {
  it("every combination of traffic, servers, workers, and service time builds a checked replay that fits a phone", () => {
    for (const peak of PEAKS)
      for (const servers of SERVERS)
        for (const workers of WORKERS)
          for (const serviceMs of SERVICE_TIMES) {
            const choices = { ...DEFAULT_CAPACITY_CHOICES, peak, servers, workers, serviceMs };
            const r = buildCapacityReplay(choices);
            expect(r.ok, JSON.stringify(choices)).toBe(true);
            if (!r.ok) continue;
            for (const scene of r.storyboard.scenes) expect(sceneFitProblems(scene.elements)).toEqual([]);
            expect(
              validateQuickChecks(r.storyboard, runTrace(KEY, r.storyboard.trace!.args), r.checks),
            ).toEqual([]);
          }
  });

  it("the default saturates near its theoretical limit", () => {
    const r = buildCapacityReplay(DEFAULT_CAPACITY_CHOICES);
    expect(r.ok && r.summary).toEqual({ limit: "50 req/s", capacity: 50, saturatedAt: 60 });
  });
});
