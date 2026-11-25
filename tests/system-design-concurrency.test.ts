import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { storyboards } from "@/content/storyboards";
import { getLesson, getLessonStoryboard, getLessons } from "@/lib/catalog/repository";
import { buildQuickChecks, validateQuickChecks } from "@/lib/quickcheck";
import {
  enumerateSchedules,
  formatValue,
  Row,
  simulateConcurrency,
  type ConcurrencyScenarioInput,
} from "@/lib/sim/concurrency";
import {
  buildConcurrencyReplay,
  DEFAULT_CONCURRENCY_CHOICES,
  EDITOR_COUNTS,
  GAPS,
  KINDS,
} from "@/lib/sim/concurrency-scenario";
import { validateStoryboard, type Storyboard } from "@/lib/storyboard";
import { runTrace } from "@/lib/traces";
import { describeStep } from "@/lib/traces/describe";
import { contention, type InterleavingRange } from "@/lib/traces/system-design/lost-update";
import { buildStepContext } from "@/lib/tutor/context";
import { sceneFitProblems } from "@/video/fit/scene";
import { textMetrics } from "@/video/text";

const KEY = "consistency/lost-update";
const lesson = getLesson("consistency", "lost-update")!;
const storyboard = getLessonStoryboard(lesson)!;
const [replays, range] = lesson.replays[0].args as [ConcurrencyScenarioInput[], InterleavingRange];
const trace = runTrace(KEY, lesson.replays[0].args);
const base: ConcurrencyScenarioInput = {
  label: "test",
  seed: 2,
  mode: "blind",
  kind: "stock",
  editors: [
    { name: "Bo", startMs: 0, delta: -3 },
    { name: "Cy", startMs: 10, delta: 5 },
  ],
};
const steps = (s: Partial<ConcurrencyScenarioInput>) =>
  simulateConcurrency({ ...base, ...s }).events.map((e) =>
    e.kind === "read"
      ? `read ${e.editor} v${e.version}`
      : `write ${e.editor} ${e.outcome} v${e.row.version}=${formatValue(e.row.value)}`,
  );

describe("the concurrency simulation", () => {
  it("replays a scenario exactly", () => {
    const run = () => simulateConcurrency({ ...base, mode: "compare-and-set" });
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("blind writes: both read v7, Bo lands, Cy's write overwrites Bo's sale (25, not 22)", () => {
    expect(steps({})).toEqual([
      "read Bo v7",
      "read Cy v7",
      "write Bo applied v8=17",
      "write Cy applied v9=25",
    ]);
    const r = simulateConcurrency(base);
    expect(r.lost).toEqual(["Bo"]);
    expect(r.valueCorrect).toBe(false);
    expect(r.editors.every((e) => e.acknowledged)).toBe(true);
  });

  it("compare-and-set: Cy's write is rejected, re-read, retried on top of 17, and both edits survive (22)", () => {
    expect(steps({ mode: "compare-and-set" })).toEqual([
      "read Bo v7",
      "read Cy v7",
      "write Bo applied v8=17",
      "write Cy rejected v8=17",
      "read Cy v8",
      "write Cy applied v9=22",
    ]);
    const r = simulateConcurrency({ ...base, mode: "compare-and-set" });
    expect(r.lost).toEqual([]);
    expect(r.valueCorrect).toBe(true);
    expect(r.editors.map((e) => e.retries)).toEqual([0, 1]);
  });

  it("the row compares and writes in one step, on the version, and records which edits a value contains", () => {
    const row = new Row(7, 20);
    const a = row.read();
    const b = row.read();
    expect(row.write("Bo", a, 17, true)).toEqual({ outcome: "applied", before: 7, overwrote: [] });
    expect(row.write("Cy", b, 25, true)).toEqual({ outcome: "rejected", before: 8, overwrote: [] });
    expect(row.write("Cy", b, 25, false)).toEqual({ outcome: "applied", before: 8, overwrote: ["Bo"] });
    expect(row.state).toMatchObject({ version: 9, value: 25, includes: ["Cy"] });
  });

  it("tags: every acknowledged tag must survive; blind writes drop one, compare-and-set keeps all", () => {
    const tags = {
      kind: "tags" as const,
      editors: [
        { name: "Bo", startMs: 0, tag: "ui" },
        { name: "Cy", startMs: 10, tag: "q3" },
      ],
    };
    expect(formatValue(simulateConcurrency({ ...base, ...tags }).final.value)).toBe("new·q3");
    expect(formatValue(simulateConcurrency({ ...base, ...tags, mode: "compare-and-set" }).final.value)).toBe(
      "new·ui·q3",
    );
  });

  it("editors who don't overlap lose nothing, even with blind writes", () => {
    const apart = {
      editors: [
        { name: "Bo", startMs: 0, delta: -3 },
        { name: "Cy", startMs: 150, delta: 5 },
      ],
    };
    expect(simulateConcurrency({ ...base, ...apart }).lost).toEqual([]);
  });
});

describe("the proof: every interleaving of two and of three editors' reads and writes", () => {
  it("is the range the lesson states", () => {
    expect(range).toEqual({ editors: [2, 3] });
    expect(replays.map((r) => r.mode)).toEqual(["blind", "compare-and-set"]);
  });

  it("two editors: 6 interleavings, 4 lose an edit blind; with compare-and-set none of the 6 schedules do", () => {
    for (const kind of ["stock", "tags"] as const) {
      expect(enumerateSchedules(2, false, kind)).toEqual({
        schedules: 6,
        lost: 4,
        wrongValue: 4,
        maxSteps: 4,
      });
      expect(enumerateSchedules(2, true, kind)).toEqual({
        schedules: 6,
        lost: 0,
        wrongValue: 0,
        maxSteps: 6,
      });
    }
  });

  it("three editors: 90 interleavings, 84 lose an edit blind; with compare-and-set none of the 498 schedules do", () => {
    for (const kind of ["stock", "tags"] as const) {
      expect(enumerateSchedules(3, false, kind)).toEqual({
        schedules: 90,
        lost: 84,
        wrongValue: 84,
        maxSteps: 6,
      });
      expect(enumerateSchedules(3, true, kind)).toEqual({
        schedules: 498,
        lost: 0,
        wrongValue: 0,
        maxSteps: 12,
      });
    }
  });

  it("the stated condition matters: compare and write as two separate steps loses edits again", () => {
    // A non-atomic check: the editor checks the version, then (as a separate step) writes blind.
    let lost = 0;
    let schedules = 0;
    type Pc = { phase: "read" | "check" | "write" | "done"; snap?: ReturnType<Row["read"]> };
    const walk = (row: Row, pcs: Pc[]) => {
      const live = pcs.flatMap((p, k) => (p.phase === "done" ? [] : [k]));
      if (!live.length) {
        schedules++;
        if (row.state.value !== 22) lost++;
        return;
      }
      for (const k of live) {
        const r = new Row(0, 0);
        r.state = { ...row.state, includes: [...row.state.includes] };
        const next = pcs.map((p) => ({ ...p }));
        const pc = next[k];
        const delta = [-3, 5][k];
        if (pc.phase === "read") {
          pc.snap = r.read();
          pc.phase = "check";
        } else if (pc.phase === "check") {
          pc.phase = r.state.version === pc.snap!.version ? "write" : "read";
        } else {
          r.write(`e${k}`, pc.snap!, (pc.snap!.value as number) + delta, false);
          pc.phase = "done";
        }
        walk(r, next);
      }
    };
    walk(new Row(7, 20), [{ phase: "read" }, { phase: "read" }]);
    expect(lost).toBeGreaterThan(0);
    expect(schedules).toBeGreaterThan(6);
  });

  it("the lesson's trace ends with that proof, stated with its conditions", () => {
    const last = trace.steps.at(-1)!;
    expect(last.sim!.interleavingProof).toEqual({
      cases: [
        { editors: 2, blind: { schedules: 6, lost: 4 }, cas: { schedules: 6, lost: 0 } },
        { editors: 3, blind: { schedules: 90, lost: 84 }, cas: { schedules: 498, lost: 0 } },
      ],
      runs: 504,
      fixed: 0,
    });
    expect(trace.answerDisplay).toBe("0 of 504");
    expect(last.note).toMatch(/one database applying compare-and-set atomically on the version/);
    expect(last.note).toMatch(/every editor retrying until its write applies/);
  });
});

describe("the cost: retries under contention (seeds 1–20, editors starting within the same 10 ms)", () => {
  const cas = { ...base, mode: "compare-and-set" as const } as Parameters<typeof contention>[0];
  it("retries grow with contention: average and maximum per editor; nothing is lost", () => {
    const rows = [2, 4, 8, 16].map((n) => contention(cas, n));
    expect(rows.map((r) => [r.n, r.avg, r.max, r.lost])).toEqual([
      [2, 0.5, 1, 0],
      [4, 1.5, 3, 0],
      [8, 3.4, 7, 0],
      [16, 5.9, 10, 0],
    ]);
  });

  it("starvation: with 16 editors some give up after 10 retries (never acknowledged, so the rule still holds)", () => {
    const crowded = contention(cas, 16);
    expect(crowded.gaveUp).toBe(56);
    expect(crowded.lost).toBe(0);
  });

  it("blind writes lose more edits the more editors overlap", () => {
    const lost = [2, 4, 8, 16].map((n) => contention({ ...cas, mode: "blind" }, n).lost);
    expect(lost).toEqual([20, 60, 140, 300]);
  });

  it("the lesson's replay never comes near the retry cap", () => {
    const r = simulateConcurrency({ ...base, mode: "compare-and-set" });
    expect(Math.max(...r.editors.map((e) => e.retries))).toBeLessThan(10);
  });
});

describe("the lesson", () => {
  it("keys the story's beats", () => {
    expect(trace.steps.flatMap((s, i) => (s.key ? [`${i}:${s.kind}`] : []))).toEqual([
      "1:read",
      "2:applied",
      "3:overwrite",
      "4:sweep",
      "8:rejected",
      "10:applied",
      "11:sweep",
      "12:proof",
    ]);
  });

  it("records each request's read version, local value, outcome, and retries", () => {
    expect(
      trace.steps.flatMap((s) =>
        s.sim?.edit
          ? [
              `${s.sim.edit.editor} ${s.sim.edit.op} v${s.sim.edit.expected} ${s.sim.edit.local ?? s.sim.edit.read} ${s.sim.edit.outcome ?? ""}`.trim(),
            ]
          : [],
      ),
    ).toEqual([
      "Bo read v7 20",
      "Cy read v7 20",
      "Bo write v7 17 applied",
      "Cy write v7 25 applied",
      "Bo read v7 20",
      "Cy read v7 20",
      "Bo write v7 17 applied",
      "Cy write v7 25 rejected",
      "Cy read v8 17",
      "Cy write v8 22 applied",
    ]);
    expect(trace.steps[10].sim!.metrics.find((m) => m.id === "retries")!.value).toBe("1");
  });

  it("shows the row with its version and both local copies", () => {
    const tables = storyboard.scenes
      .find((s) => s.id === "overwrite")!
      .elements.find((e) => e.type === "data-table");
    expect(
      tables?.type === "data-table" &&
        tables.tables.map((t) => t.rows.map((r) => `${r.cells.join(" ")}${r.mark ? ` (${r.mark})` : ""}`)),
    ).toEqual([
      ["v8 17", "v9 25 (new)"],
      ["Bo v7 → 17 (duplicate)", "Cy v7 → 25 (new)"],
    ]);
    const seq = storyboard.scenes
      .find((s) => s.id === "rejected")!
      .elements.find((e) => e.type === "sequence");
    expect(seq?.type === "sequence" && seq.lanes.map((l) => l.label)).toEqual(["Bo", "Cy", "Database"]);
  });

  it("the cost chart shows the average (bar) and the maximum (outline) retries per editor", () => {
    expect(
      trace.steps[11].sim!.load!.windows.map((w) => `${w.label}: avg ${w.served}, max ${w.offered}`),
    ).toEqual(["2: avg 0.5, max 1", "4: avg 1.5, max 3", "8: avg 3.4, max 7", "16: avg 5.9, max 10"]);
    expect(trace.steps[11].note).toMatch(/doesn't guarantee every editor finishes quickly/);
    const scene = storyboard.scenes.find((s) => s.id === "cost")!;
    expect(scene.narration).toMatch(/doesn't guarantee every editor finishes quickly under heavy contention/);
  });

  it("has a storyboard that passes the validator and fits every player size", () => {
    expect(validateStoryboard(storyboard)).toEqual({ ok: true, issues: [] });
    for (const width of [343, 500, 640, 1280])
      for (const scene of storyboard.scenes)
        expect(sceneFitProblems(scene.elements, textMetrics(width)), `${scene.id} at ${width}`).toEqual([]);
  });

  it("states exactly what was enumerated, and the conditions, on screen", () => {
    const closing = storyboard.scenes.at(-1)!;
    expect(closing.caption).toBe(
      "Every interleaving: blind loses edits in 88 of 96, compare-and-set in 0 of 504",
    );
    const card = closing.elements.find((e) => e.type === "result");
    expect(card?.type === "result" && card.detail).toBe(
      "Every interleaving of 2 and 3 editors, retries included",
    );
    expect(closing.narration).toMatch(
      /every interleaving of two editors' reads and writes, and of three editors'/,
    );
    expect(closing.narration).toMatch(/comparing and writing atomically on the version/);
    expect(lesson.proofScope).toMatch(/Latencies are illustrative/);
    expect(lesson.fix).toMatch(/atomic increment/);
    expect(lesson.fix).toMatch(/lock/);
  });

  it("asks the three concurrency quick checks, each proven from the recorded write", () => {
    const checks = buildQuickChecks(storyboard, trace);
    expect(checks.map((c) => `${c.claim.kind}:${c.options[c.answer]}`)).toEqual([
      "final-value:25",
      "write-outcome:It's rejected",
      "cas-expect:v8",
    ]);
    expect(validateQuickChecks(storyboard, trace, checks)).toEqual([]);
    const wrong = checks.map((c) => ({ ...c, answer: (c.answer + 1) % c.options.length }));
    const issues = validateQuickChecks(storyboard, trace, wrong).join("\n");
    for (const c of checks) expect(issues).toContain(`quick check "${c.id}": the answer`);
  });

  it("the validators recompute compare-and-set: a write recorded as applied at the wrong version is caught", () => {
    const checks = buildQuickChecks(storyboard, trace);
    const broken = structuredClone(trace);
    broken.steps[8].sim!.edit!.outcome = "applied";
    expect(validateQuickChecks(storyboard, broken, checks).join("\n")).toMatch(
      /isn't what compare-and-set decides/,
    );
    const stale = structuredClone(trace);
    stale.steps[10].sim!.edit!.expected = 7;
    expect(validateQuickChecks(storyboard, stale, checks).join("\n")).toMatch(
      /doesn't expect the version its editor read/,
    );
  });

  it("grounds the tutor in the write: the version it expected, the row's version, the outcome", () => {
    const scene = storyboard.scenes.find((s) => s.traceStep === 8)!;
    const ctx = buildStepContext(KEY, scene.id)!;
    expect(ctx.text).toContain("Two edits, one lost");
    expect(ctx.text).toContain(
      "Cy writes 25 (computed from version 7, value 20; compare-and-set); the row was at version 8; rejected",
    );
    expect(describeStep(trace.steps[12], 12)).toContain(
      "2 editors: blind 4 of 6 lose an edit, compare-and-set 0 of 6; 3 editors: blind 84 of 90 lose an edit, compare-and-set 0 of 498",
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

  it("the rejected write drawn as applied, and Cy's copy drawn as read from v8", () => {
    type Seq = { rows: { kind: string; text?: string }[] };
    expect(
      mutate((sb) => {
        const note = el<Seq>(sb, "rejected", "sequence").rows.find(
          (r) => r.text === "✕ rejected: row at v8",
        )!;
        note.text = "✓ v9 = 25";
      }),
    ).toMatch(/sequence doesn't match/);
    expect(
      mutate((sb) => {
        el<{ tables: { rows: { cells: string[] }[] }[] }>(
          sb,
          "both-read",
          "data-table",
        ).tables[1].rows[1].cells[1] = "v8 → 22";
      }),
    ).toMatch(/doesn't match/);
  });

  it("a wrong stock, a sweep with fewer retries, a proof claiming a different count, and a skipped beat", () => {
    expect(
      mutate((sb) => {
        el<{ items: { value: string }[] }>(sb, "retry", "metrics").items[0].value = "25";
      }),
    ).toMatch(/Metric "value" doesn't match/);
    expect(
      mutate((sb) => {
        el<{ windows: { offered: number }[] }>(sb, "cost", "load-chart").windows[3].offered = 4;
      }),
    ).toMatch(/load chart doesn't match/);
    expect(
      mutate((sb) => {
        el<{ value: string }>(sb, "proof", "result").value = "0 of 96";
      }),
    ).toMatch(/must display exactly "0 of 504"/);
    expect(mutate((sb) => void (sb.scenes = sb.scenes.filter((s) => s.id !== "rejected")))).toMatch(
      /Key trace step 8 \(rejected\) is not shown/,
    );
  });
});

describe("your own scenario", () => {
  it("every combination of editors, timing, write mode, and kind of edit builds a checked replay that fits a phone", () => {
    let n = 0;
    for (const editors of EDITOR_COUNTS)
      for (const gapMs of GAPS)
        for (const cas of [false, true])
          for (const { value: kind } of KINDS) {
            n++;
            const choices = { ...DEFAULT_CONCURRENCY_CHOICES, editors, gapMs, cas, kind };
            const r = buildConcurrencyReplay(choices);
            expect(r.ok, JSON.stringify(choices)).toBe(true);
            if (!r.ok) continue;
            for (const width of [343, 500, 640, 1280])
              for (const scene of r.storyboard.scenes)
                expect(sceneFitProblems(scene.elements, textMetrics(width))).toEqual([]);
            const t = runTrace(KEY, r.storyboard.trace!.args);
            expect(validateQuickChecks(r.storyboard, t, r.checks)).toEqual([]);
            // Compare-and-set never loses an edit, in the replay or in any interleaving; overlapping blind writes do.
            if (cas) expect([r.summary.lost, r.summary.lostSchedules]).toEqual([0, 0]);
            else expect(r.summary.lostSchedules).toBeGreaterThan(0);
            // Overlapping editors get at least one question; editors that never overlap have nothing to ask about.
            const overlapping = gapMs <= 20;
            if (overlapping) expect(r.checks.length).toBeGreaterThan(0);
            if (overlapping && !cas) expect(r.summary.lost).toBeGreaterThan(0);
          }
    expect(n).toBe(32);
  }, 60_000);
});

describe("every built lesson has its own scenario", () => {
  it('registers a "Your scenario" panel for each built lesson', () => {
    const source = readFileSync("src/components/system-design/lesson-video.tsx", "utf8");
    for (const l of getLessons())
      expect(source, `${l.topicSlug}/${l.slug}`).toContain(`"${l.topicSlug}/${l.slug}":`);
  });
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
    const existing = files.filter((f) => !f.includes(`consistency${path.sep}lost-update`)).sort();
    const h = createHash("sha256");
    for (const f of existing) h.update(f).update(readFileSync(f));
    expect([existing.length, h.digest("hex").slice(0, 16)]).toEqual([106, "a514edd736e27246"]);
  });

  it("every existing video resolves to exactly the same storyboard", () => {
    const h = createHash("sha256");
    const ids = storyboards
      .map((s) => s.id)
      .filter((id) => id !== "consistency-lost-update")
      .sort();
    for (const id of ids) h.update(id).update(JSON.stringify(storyboards.find((s) => s.id === id)));
    expect([ids.length, h.digest("hex").slice(0, 16)]).toEqual([107, "0916c0f0a9962fe4"]);
  });

  it("the four earlier lessons' traces are byte-identical", () => {
    const hash = (topic: string, slug: string) =>
      createHash("sha256")
        .update(JSON.stringify(runTrace(`${topic}/${slug}`, getLesson(topic, slug)!.replays[0].args)))
        .digest("hex")
        .slice(0, 16);
    expect(hash("idempotency", "charged-twice")).toBe("a9629989cdea67d3");
    expect(hash("estimates", "one-server")).toBe("23fe936ce8c1da31");
    expect(hash("load-balancing", "slow-server")).toBe("fe0066504d944a98");
    expect(hash("replication", "vanished-comment")).toBe("3ba57e32b2427a19");
  });
});
