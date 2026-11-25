import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { storyboards } from "@/content/storyboards";
import { getLesson, getLessonStoryboard } from "@/lib/catalog/repository";
import { buildQuickChecks, validateQuickChecks } from "@/lib/quickcheck";
import {
  enumerateCacheSchedules,
  PriceCache,
  simulateCache,
  type CacheScenarioInput,
} from "@/lib/sim/caching";
import {
  buildCacheReplay,
  DEFAULT_CACHE_CHOICES,
  INVALIDATION_CHOICES,
  STALLS,
  TTLS,
} from "@/lib/sim/cache-scenario";
import { validateStoryboard, type Storyboard } from "@/lib/storyboard";
import { runTrace } from "@/lib/traces";
import { describeStep } from "@/lib/traces/describe";
import { updateCost, type CacheRange } from "@/lib/traces/system-design/stale-price";
import { buildStepContext } from "@/lib/tutor/context";
import { sceneFitProblems } from "@/video/fit/scene";
import { textMetrics } from "@/video/text";

const KEY = "caching/stale-price";
const lesson = getLesson("caching", "stale-price")!;
const storyboard = getLessonStoryboard(lesson)!;
const [replays, range] = lesson.replays[0].args as [CacheScenarioInput[], CacheRange];
const trace = runTrace(KEY, lesson.replays[0].args);
const base: CacheScenarioInput = {
  label: "test",
  seed: 1,
  invalidation: "none",
  ttlMs: 10_000,
  slow: { atMs: 2005, stallMs: 200 },
};
const ben = (s: Partial<CacheScenarioInput>) =>
  simulateCache({ ...base, ...s }).events.flatMap((e) =>
    e.kind === "set" && e.reader === "Ben" ? [`${e.outcome} $${e.price} v${e.version}`] : [],
  );

describe("the cache simulation", () => {
  it("replays a scenario exactly", () => {
    const run = () => simulateCache({ ...base, invalidation: "versioned" });
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("not told: reads keep hitting the old price until the entry expires (about the TTL)", () => {
    const r = simulateCache(base);
    expect(r.stale.length).toBeGreaterThan(200);
    expect(r.staleForMs).toBeGreaterThan(9500);
    expect(r.staleForMs).toBeLessThan(10_500);
    expect(r.stale.every((x) => x.hit && x.price === 49)).toBe(true);
  });

  it("delete after write: Ben's slow store puts $49 back, replacing $39, for another TTL", () => {
    expect(ben({ invalidation: "delete" })).toEqual(["stored $49 v7"]);
    const set = simulateCache({ ...base, invalidation: "delete" }).events.find(
      (e) => e.kind === "set" && e.reader === "Ben",
    );
    expect(set?.kind === "set" && set.replaced).toEqual({ price: 39, version: 8 });
    expect(simulateCache({ ...base, invalidation: "delete" }).stale.length).toBeGreaterThan(200);
    // Without the pause there's no race: Ben stores before the update, and the delete removes it.
    expect(
      simulateCache({ ...base, invalidation: "delete", slow: { atMs: 2005, stallMs: 0 } }).stale,
    ).toEqual([]);
  });

  it("versioned: the cache knows v8, so Ben's store of v7 is kept out, and no later read sees $49", () => {
    expect(ben({ invalidation: "versioned" })).toEqual(["rejected $49 v7"]);
    expect(simulateCache({ ...base, invalidation: "versioned" }).stale).toEqual([]);
  });

  it("the cache's rule: a versioned store is kept only if it isn't older than the newest version known", () => {
    const c = new PriceCache(true, 1000, 1000);
    c.invalidate(0, 8);
    expect(c.get(0)).toBeUndefined();
    expect(c.set(1, 49, 7)).toBe("rejected");
    expect(c.set(2, 39, 8)).toBe("stored");
    expect(c.set(3, 49, 7)).toBe("rejected");
    const plain = new PriceCache(false, 1000, 1000);
    plain.invalidate(0, 8);
    expect(plain.set(1, 49, 7)).toBe("stored");
  });

  it("the stated condition: a version marker that expires during a slow read lets the old price back", () => {
    const r = simulateCache({ ...base, invalidation: "versioned", markerTtlMs: 50, readsPerSec: 0 });
    expect(ben({ invalidation: "versioned", markerTtlMs: 50, readsPerSec: 0 })).toEqual(["stored $49 v7"]);
    expect(r.stale.length).toBeGreaterThan(0);
  });
});

describe("the proof: every interleaving of one writer and one or two readers, warm and cold, plus a read after", () => {
  it("is the range the lesson states", () => {
    expect(range).toEqual({ readers: [1, 2] });
    expect(replays.map((r) => r.invalidation)).toEqual(["none", "delete", "versioned"]);
  });

  it("no invalidation violates it; delete after write still does (the race, from a cold cache); versioned never", () => {
    const run = (inv: "none" | "delete" | "versioned") =>
      [1, 2].flatMap((n) => [true, false].map((warm) => enumerateCacheSchedules(inv, n, warm)));
    expect(run("none")).toEqual([
      { schedules: 2, violating: 2 },
      { schedules: 4, violating: 2 },
      { schedules: 6, violating: 6 },
      { schedules: 136, violating: 62 },
    ]);
    expect(run("delete")).toEqual([
      { schedules: 3, violating: 0 },
      { schedules: 10, violating: 1 },
      { schedules: 30, violating: 0 },
      { schedules: 534, violating: 70 },
    ]);
    expect(run("versioned")).toEqual([
      { schedules: 3, violating: 0 },
      { schedules: 10, violating: 0 },
      { schedules: 30, violating: 0 },
      { schedules: 534, violating: 0 },
    ]);
  });

  it("the lesson's trace ends with that proof, stated with its conditions", () => {
    const last = trace.steps.at(-1)!;
    expect(last.sim!.cacheProof!.runs).toBe(577);
    expect(last.sim!.cacheProof!.fixed).toBe(0);
    expect(last.sim!.cacheProof!.cases).toHaveLength(12);
    expect(trace.answerDisplay).toBe("0 of 577");
    expect(last.note).toMatch(
      /no invalidation .* in 72 of 148, delete after write in 71 of 577, versioned invalidation in 0 of 577/,
    );
    expect(last.note).toMatch(/store conditionally in one atomic step/);
    expect(last.note).toMatch(/version marker to outlive any read/);
  });
});

describe("the cost: database reads after each invalidation", () => {
  const s = { ...base, invalidation: "versioned" } as Parameters<typeof updateCost>[0];
  it("about one extra database read per update, measured at several update rates", () => {
    const mine = updateCost(s, "versioned");
    const none = updateCost(s, "none");
    expect(mine.map((m) => [m.rate, m.dbReads, m.updates])).toEqual([
      [1, 7, 1],
      [6, 7, 6],
      [30, 33, 30],
      [60, 66, 60],
    ]);
    expect(none.map((m) => m.dbReads)).toEqual([8, 8, 8, 8]);
    expect(none.at(-1)!.stale).toBe(1100);
    expect(mine.every((m) => m.stale === 0)).toBe(true);
  });
});

describe("the lesson", () => {
  it("keys the story's beats", () => {
    expect(trace.steps.flatMap((s, i) => (s.key ? [`${i}:${s.kind}`] : []))).toEqual([
      "5:stale-read",
      "10:read",
      "12:db-read",
      "16:set",
      "28:set",
      "29:read",
      "30:cost",
      "31:proof",
    ]);
  });

  it("records every followed request's hit or miss, price, version, and store outcome", () => {
    const ops = trace.steps.flatMap((s) => {
      const c = s.sim?.cacheOp;
      if (!c || s.sim!.run !== 1) return [];
      return [
        `${c.actor} ${c.op}${c.hit === undefined ? "" : c.hit ? " hit" : " miss"}${c.price ? ` $${c.price}` : ""}${c.version ? ` v${c.version}` : ""}${c.outcome ? ` ${c.outcome}` : ""}`,
      ];
    });
    expect(ops.slice(0, 7)).toEqual([
      "Ben get miss",
      "Ben db-read $49 v7",
      "Admin write $39 v8",
      "Admin invalidate v8",
      "Admin ack v8",
      "Ben set $49 v7 stored",
      "Ana get hit $49 v7",
    ]);
  });

  it("shows the cache and the database side by side with versions", () => {
    const tables = storyboard.scenes
      .find((s) => s.id === "race-store")!
      .elements.find((e) => e.type === "data-table");
    expect(
      tables?.type === "data-table" && tables.tables.map((t) => t.rows.map((r) => r.cells.join(" "))),
    ).toEqual([["price $49 v7 · 10.0 s"], ["price $39 v8"]]);
    const kept = storyboard.scenes
      .find((s) => s.id === "kept-out")!
      .elements.find((e) => e.type === "data-table");
    expect(kept?.type === "data-table" && kept.tables[0].rows.map((r) => r.cells.join(" "))).toEqual([
      "price $39 v8 · 9.9 s",
      "known v8",
    ]);
  });

  it("has a storyboard that passes the validator and fits every player size", () => {
    expect(validateStoryboard(storyboard)).toEqual({ ok: true, issues: [] });
    for (const width of [343, 500, 640, 1280])
      for (const scene of storyboard.scenes)
        expect(sceneFitProblems(scene.elements, textMetrics(width)), `${scene.id} at ${width}`).toEqual([]);
  });

  it("states what was enumerated and the conditions on screen, and how real caches store conditionally", () => {
    const closing = storyboard.scenes.at(-1)!;
    const card = closing.elements.find((e) => e.type === "result");
    expect(card?.type === "result" && card.detail).toBe(
      "Every interleaving: 1 writer, 1–2 readers, warm and cold",
    );
    expect(closing.narration).toMatch(/every interleaving of one writer and one or two readers/);
    expect(closing.narration).toMatch(
      /conditional store to be atomic and the version marker to outlive any read/,
    );
    expect(lesson.fix).toMatch(/Memcached's `cas` command/);
    expect(lesson.fix).toMatch(/Redis runs a Lua script atomically/);
    expect(lesson.fix).toMatch(/short TTL/);
    expect(lesson.fix).toMatch(/Leases/);
    expect(lesson.proofScope).toMatch(/Latencies are illustrative/);
  });

  it("asks hit or miss, whether the store is kept, and the price, each proven from the cache's state", () => {
    const checks = buildQuickChecks(storyboard, trace);
    expect(checks.map((c) => `${c.claim.kind}:${c.options[c.answer]}`)).toEqual([
      "cache-hit:Hit",
      "set-kept:It's kept out",
      "read-price:$39",
    ]);
    expect(validateQuickChecks(storyboard, trace, checks)).toEqual([]);
    const wrong = checks.map((c) => ({ ...c, answer: (c.answer + 1) % c.options.length }));
    const issues = validateQuickChecks(storyboard, trace, wrong).join("\n");
    for (const c of checks) expect(issues).toContain(`quick check "${c.id}": the answer`);
  });

  it("the validators recompute the cache's rules: a wrongly recorded store or read is caught", () => {
    const checks = buildQuickChecks(storyboard, trace);
    const kept = structuredClone(trace);
    kept.steps[28].sim!.cacheOp!.outcome = "stored";
    expect(validateQuickChecks(storyboard, kept, checks).join("\n")).toMatch(
      /isn't what the cache's rule decides/,
    );
    const read = structuredClone(trace);
    read.steps[29].sim!.cacheOp!.price = 49;
    expect(validateQuickChecks(storyboard, read, checks).join("\n")).toMatch(
      /didn't return what cache-aside returns/,
    );
  });

  it("grounds the tutor in the cache's state at the step", () => {
    const scene = storyboard.scenes.find((s) => s.traceStep === 28)!;
    const ctx = buildStepContext(KEY, scene.id)!;
    expect(ctx.text).toContain("The price changed but users see the old one");
    expect(ctx.text).toContain(
      "Ben set $49 v7 → rejected; cache before: $39 v8, newest known v8; database $39 v8; versioned stores",
    );
    expect(describeStep(trace.steps[31], 31)).toContain(
      "delete, 2 readers, cold cache: 70 of 534 let a later read see the old price",
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

  it("Ben's read drawn as getting $39, and the cache drawn holding $39 after the race", () => {
    type Seq = { rows: { kind: string; label?: string }[] };
    expect(
      mutate((sb) => {
        el<Seq>(sb, "race-read", "sequence").rows.find((r) => r.label === "read → $49 v7")!.label =
          "read → $39 v8";
      }),
    ).toMatch(/sequence doesn't match/);
    expect(
      mutate((sb) => {
        el<{ tables: { rows: { cells: string[] }[] }[] }>(
          sb,
          "race-store",
          "data-table",
        ).tables[0].rows[0].cells[1] = "$39 v8 · 10.0 s";
      }),
    ).toMatch(/doesn't match/);
  });

  it("a wrong cache metric, a cheaper cost, a proof claiming a different count, and a skipped beat", () => {
    expect(
      mutate((sb) => {
        el<{ items: { value: string }[] }>(sb, "fresh", "metrics").items[0].value = "$49 v7";
      }),
    ).toMatch(/Metric "cache" doesn't match/);
    expect(
      mutate((sb) => {
        el<{ windows: { served: number }[] }>(sb, "cost", "load-chart").windows[3].served = 10;
      }),
    ).toMatch(/load chart doesn't match/);
    expect(
      mutate((sb) => {
        el<{ value: string }>(sb, "proof", "result").value = "0 of 148";
      }),
    ).toMatch(/must display exactly "0 of 577"/);
    expect(mutate((sb) => void (sb.scenes = sb.scenes.filter((s) => s.id !== "race-store")))).toMatch(
      /Key trace step 16 \(set\) is not shown/,
    );
  });
});

describe("your own scenario", () => {
  it("every combination of invalidation, TTL, and Ben's pause builds a checked replay that fits every width", () => {
    let n = 0;
    for (const { value: invalidation } of INVALIDATION_CHOICES)
      for (const ttlMs of TTLS)
        for (const stallMs of STALLS) {
          n++;
          const choices = { ...DEFAULT_CACHE_CHOICES, invalidation, ttlMs, stallMs };
          const r = buildCacheReplay(choices);
          expect(r.ok, JSON.stringify(choices)).toBe(true);
          if (!r.ok) continue;
          for (const width of [343, 500, 640, 1280])
            for (const scene of r.storyboard.scenes)
              expect(sceneFitProblems(scene.elements, textMetrics(width))).toEqual([]);
          const t = runTrace(KEY, r.storyboard.trace!.args);
          expect(validateQuickChecks(r.storyboard, t, r.checks)).toEqual([]);
          expect(r.checks.length).toBeGreaterThan(0);
          // Versioned invalidation never shows a stale price; not telling the cache always does for about a TTL.
          if (invalidation === "versioned")
            expect([r.summary.staleReads, r.summary.violating]).toEqual([0, 0]);
          if (invalidation === "none") expect(r.summary.staleForMs).toBeGreaterThan(ttlMs * 0.9);
          if (invalidation === "delete") expect(r.summary.staleReads > 0).toBe(stallMs > 0);
        }
    expect(n).toBe(27);
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
    const existing = files.filter((f) => !f.includes(`caching${path.sep}stale-price`)).sort();
    const h = createHash("sha256");
    for (const f of existing) h.update(f).update(readFileSync(f));
    expect([existing.length, h.digest("hex").slice(0, 16)]).toEqual([107, "7244468425571c1f"]);
  });

  it("every existing video resolves to exactly the same storyboard", () => {
    const h = createHash("sha256");
    const ids = storyboards
      .map((s) => s.id)
      .filter((id) => id !== "caching-stale-price")
      .sort();
    for (const id of ids) h.update(id).update(JSON.stringify(storyboards.find((s) => s.id === id)));
    expect([ids.length, h.digest("hex").slice(0, 16)]).toEqual([108, "84ce5143ffb21a6b"]);
  });

  it("the five earlier lessons' traces are byte-identical", () => {
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
  });
});
