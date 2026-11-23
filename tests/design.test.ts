import { describe, expect, it } from "vitest";

import { getStoryboard, storyboards } from "@/content/storyboards";
import { getProblem } from "@/lib/catalog/repository";
import { assembleStoryboard, evaluateDraft, type GenerationContext } from "@/lib/generation/draft";
import { resolveStoryboard, sceneSchema, storyboardSourceSchema, validateStoryboard } from "@/lib/storyboard";
import { getTraceDefinition, type TracePile } from "@/lib/traces";
import { DoublyList } from "@/lib/traces/design/shared";
import { layoutScene } from "@/video/layout";
import { compactCall, opLogForms } from "@/video/oplog-layout";
import { PHONE_PLAYER_WIDTH, textMetrics } from "@/video/text";

import { buildDraft, traceFor } from "./fixtures/drafts";
import { opLogProblems } from "./fixtures/oplog-fit";
import { stackProblems } from "./fixtures/stack-fit";

const DESIGN = [
  "design/implement-queue-using-stacks",
  "design/min-stack",
  "design/lru-cache",
  "design/time-based-key-value-store",
  "design/lfu-cache",
];
const QUEUE = DESIGN[0];
const MIN = DESIGN[1];
const LRU = DESIGN[2];
const TIME = DESIGN[3];
const LFU = DESIGN[4];

const META = {
  promptVersion: "test",
  provider: "fake",
  model: "fake",
  generatedAt: "2026-01-01T00:00:00.000Z",
  repairAttempts: 0,
};

function context(key: string): GenerationContext {
  const [pattern, slug] = key.split("/");
  return {
    problem: getProblem(pattern, slug)!,
    patternName: "Data Structure Design",
    definition: getTraceDefinition(key)!,
    args: traceFor(key).args,
  };
}

describe("design traces", () => {
  it.each(DESIGN)("%s: one op log entry per call, fits a 10-scene video", (key) => {
    const { trace, args } = traceFor(key);
    const [operations] = args as [string[]];
    expect(trace.ops).toHaveLength(operations.length);
    expect(trace.steps.filter((s) => s.key).length + 3).toBeLessThanOrEqual(10);
    // Every step names its call; calls run in order and each returns exactly once.
    let call = -1;
    for (const step of trace.steps) {
      expect(step.op!.current).toBeGreaterThanOrEqual(call);
      call = step.op!.current;
    }
    for (let k = 0; k < operations.length; k++)
      expect(trace.steps.filter((s) => s.op!.current === k && s.op!.returned)).toHaveLength(1);
  });

  it("the op log shows outputs as the problem page does (null as —, strings quoted)", () => {
    const { trace } = traceFor(TIME);
    expect(trace.ops!.slice(0, 4)).toEqual([
      { call: "TimeMap()", output: "—" },
      { call: 'set("color", "red", 2)', output: "—" },
      { call: 'set("color", "blue", 5)', output: "—" },
      { call: 'get("color", 1)', output: '""' },
    ]);
    expect(trace.answerDisplay).toBe('null, null, null, "", "red", "red", "blue"');
  });

  it("LRU Cache: a hit moves the node to the front, and a full cache evicts the back node", () => {
    const { trace } = traceFor(LRU);
    const hit = trace.steps.find((s) => s.kind === "hit")!;
    const front = (s: (typeof trace.steps)[number]) => s.links!.nodes.find((n) => n.slot === 0)!.value;
    expect(front(hit)).toBe("1:10");
    expect(hit.links!.rewired?.length).toBeGreaterThan(0);
    const evict = trace.steps.find((s) => s.kind === "evict")!;
    const back = evict.links!.nodes.find((n) => n.next === null)!;
    expect(back.value).toBe("2:20");
    expect(evict.rejected).toEqual([back.id]);
    // The eviction removes it from the list and the map; its id is never reused.
    const after = trace.steps[trace.steps.indexOf(evict) + 1];
    expect(after.links!.nodes.map((n) => n.id)).not.toContain(back.id);
    expect(after.map!.entries.map((e) => e.key)).toEqual(["1", "3"]);
    expect(after.values).toEqual(["1:10", "3:30"]);
  });

  it("LFU Cache: a use moves a key up a bucket, the minimum rises when its bucket empties, and evicts by it", () => {
    const { trace } = traceFor(LFU);
    const minUp = trace.steps.find((s) => s.kind === "use-min-up")!;
    expect(minUp.counter).toEqual({ value: 2, delta: 1 });
    const evictions = trace.steps.filter((s) => s.kind === "evict");
    const evicted = evictions.map((s) => s.links!.nodes.find((n) => n.id === s.rejected![0])!.value);
    // 7 has the fewest uses; later 9 (2 uses) goes rather than 8 (3 uses).
    expect(evicted).toEqual(["7", "9"]);
    const insert = trace.steps[trace.steps.indexOf(evictions[1]) + 1];
    expect(insert.counter).toEqual({ value: 1, delta: -1 });
    expect(insert.map!.entries).toEqual([
      { key: "8", value: "80 ×3" },
      { key: "10", value: "100 ×1" },
    ]);
  });

  it("Min Stack: each pair stores the minimum below it, so a pop restores the old one", () => {
    const { trace } = traceFor(MIN);
    const labels = (p: TracePile) => p.items.map((i) => i.label);
    expect(labels(trace.steps[3].pile!)).toEqual(["(6, 6)", "(2, 2)", "(8, 2)"]);
    const popMin = trace.steps.find((s) => s.kind === "pop" && s.key)!;
    expect(popMin.pile!.popped!.map((i) => i.label)).toEqual(["(2, 2)"]);
    expect(trace.answer).toEqual([null, null, null, null, 2, null, 2, null, 6]);
  });

  it("Queue: pours only when out is empty, reversing the values so the oldest is on top", () => {
    const { trace } = traceFor(QUEUE);
    const pours = trace.steps.filter((s) => s.kind.endsWith("-pour"));
    expect(pours.map((s) => s.kind)).toEqual(["peek-pour", "pop-pour"]);
    expect(pours[0].pile!.popped!.map((i) => i.label)).toEqual(["7", "4"]);
    expect(pours[0].secondPile!.items.map((i) => i.label)).toEqual(["7", "4"]);
    expect(pours[0].secondPile!.pushed).toBe(2);
    const plainPop = trace.steps.find((s) => s.kind === "pop")!;
    expect(plainPop.pile!.popped).toBeUndefined();
  });

  it("TimeMap: a get binary-searches the sorted history for the last time at or before the query", () => {
    const { trace } = traceFor(TIME);
    expect(trace.row.values).toEqual([2, 5]);
    const get4 = trace.steps.filter((s) => s.op!.current === 5);
    expect(get4.map((s) => s.search)).toEqual([
      { from: 0, to: 1, mid: 0 },
      { from: 1, to: 1, mid: 1 },
      { from: 1, to: 0 },
    ]);
    expect(get4.map((s) => s.equation?.tone)).toEqual(["positive", "neutral", undefined]);
    expect(get4.at(-1)!.found).toEqual([0]);
  });

  it("DoublyList keeps prev and next consistent through unlinks, moves, and removals", () => {
    const list = new DoublyList();
    const [a, b, c] = ["a", "b", "c"].map((v) => list.create(v));
    for (const id of [a, b, c]) list.pushBack(id, 0);
    list.unlink(a);
    list.pushFront(a, 0);
    list.remove(b);
    list.unlink(a);
    list.pushBack(a, 1);
    const { nodes } = list.snapshot();
    expect(nodes.map((n) => [n.id, n.lane, n.slot, n.prev, n.next])).toEqual([
      [a, 1, 0, null, null],
      [c, 0, 0, null, null],
    ]);
  });
});

describe("design storyboards", () => {
  it.each(DESIGN)("%s: a fixture draft passes and fits at phone and full size", (key) => {
    const result = evaluateDraft(buildDraft(key), context(key), META);
    expect(result.issues).toEqual([]);
    if (!result.ok) return;
    for (const width of [PHONE_PLAYER_WIDTH, 1280])
      for (const scene of result.storyboard.scenes) {
        const t = textMetrics(width);
        expect(opLogProblems(scene.elements, t), `${scene.id} at ${width}`).toEqual([]);
        expect(stackProblems(scene.elements, t), `${scene.id} at ${width}`).toEqual([]);
      }
  });

  it.each(DESIGN)(
    "%s: the saved video validates, ends with every output shown, and needs no answer card",
    (key) => {
      const storyboard = getStoryboard(key.replace("/", "-"))!;
      expect(storyboard, key).toBeDefined();
      expect(validateStoryboard(storyboard).issues).toEqual([]);
      const last = storyboard.scenes.at(-1)!.elements.find((e) => e.type === "op-log");
      expect(last?.type === "op-log" && last.shown).toBe(traceFor(key).trace.ops!.length);
      expect(storyboard.scenes[0].elements[0].type).toBe("op-log");
    },
  );

  type Source = ReturnType<typeof assembleStoryboard>;
  const source = (key: string): Source =>
    structuredClone(assembleStoryboard(buildDraft(key), context(key), META));
  const issues = (sb: Source) => {
    const { storyboard, issues } = resolveStoryboard(storyboardSourceSchema.parse(sb));
    return [...issues, ...(storyboard ? validateStoryboard(storyboard).issues : [])]
      .map((i) => i.message)
      .join("\n");
  };
  const element = (sb: Source, step: number, type: string, pick = 0) =>
    sb.scenes.find((s) => s.traceStep === step)!.elements.filter((e) => e.type === type)[pick] as Record<
      string,
      unknown
    >;

  it("the fixture sources resolve and validate", () => {
    for (const key of DESIGN) expect(issues(source(key)), key).toBe("");
  });

  it("rejects a wrong call, output, running call, or outputs shown", () => {
    const step = traceFor(LRU).trace.steps.findIndex((s) => s.key);
    const ops = structuredClone(traceFor(LRU).trace.ops!);
    let sb = source(LRU);
    Object.assign(element(sb, step, "op-log"), {
      calls: ops.map((c, k) => (k === 3 ? { ...c, output: "20" } : c)),
    });
    expect(issues(sb)).toMatch(/op log's calls and outputs don't match the trace/);
    sb = source(LRU);
    Object.assign(element(sb, step, "op-log"), { current: 1, shown: 2 });
    expect(issues(sb)).toMatch(/running call doesn't match trace step/);
    sb = source(LRU);
    Object.assign(element(sb, step, "op-log"), { shown: 2 });
    expect(issues(sb)).toMatch(/outputs? known/);
  });

  it("schema: shown is the running call or the one after it; one op log per scene", () => {
    const base = { id: "s", narration: "n", caption: "c", durationInFrames: 60 };
    const log = (extra: object) => ({
      id: "log",
      type: "op-log",
      enterAt: 0,
      calls: [
        { call: "A()", output: "—" },
        { call: "f()", output: "1" },
      ],
      ...extra,
    });
    const messages = (elements: unknown[]) =>
      sceneSchema.safeParse({ ...base, elements }).error?.issues.map((i) => i.message) ?? [];
    expect(messages([log({ current: 1, shown: 2 })])).toEqual([]);
    expect(messages([log({ current: 1, shown: 0 })])).toContain(
      "shown must be the current call (before it returns) or the one after it",
    );
    expect(messages([log({ shown: 3 })])).toContain("shown can't exceed the 2 calls");
    expect(messages([log({ shown: 0 }), { ...log({ shown: 0 }), id: "log2" }])).toContain(
      "A scene can show only one op-log",
    );
  });

  it("an unbound op log shows no outputs or all of them", () => {
    const sb = source(MIN);
    Object.assign(sb.scenes[0].elements[0] as Record<string, unknown>, { shown: 3 });
    expect(issues(sb)).toMatch(/shows no outputs or all of them/);
  });

  it("rejects a wrong second stack, and needs traceStack for two stacks", () => {
    const step = traceFor(QUEUE).trace.steps.findIndex((s) => s.kind === "peek-pour");
    let sb = source(QUEUE);
    Object.assign(element(sb, step, "stack", 1), { items: [{ label: "4" }, { label: "7" }] });
    expect(issues(sb)).toMatch(/stack's items doesn't match trace step/);
    sb = source(QUEUE);
    delete element(sb, step, "stack", 1).traceStack;
    expect(issues(sb)).toMatch(/only one stack/);
  });

  it("schema: a doubly linked list's prev must be the node that links to it", () => {
    const step = traceFor(LRU).trace.steps.findIndex((s) => s.kind === "hit");
    const sb = source(LRU);
    const nodes = structuredClone(traceFor(LRU).trace.steps[step].links!.nodes);
    nodes[0].prev = nodes[0].prev === null ? nodes[1].id : null;
    Object.assign(element(sb, step, "linked-list"), { nodes });
    expect(issues(sb)).toMatch(/prev .* isn't the node that links to it/);
  });

  it("the op log takes the left of the stage, and the structures move right of it", () => {
    for (const key of DESIGN) {
      const sb = getStoryboard(key.replace("/", "-"))!;
      for (const width of [PHONE_PLAYER_WIDTH, 1280])
        for (const scene of sb.scenes) {
          const layout = layoutScene(scene.elements, textMetrics(width));
          expect(layout.opLog, `${key} ${scene.id}`).toBeDefined();
          for (const pile of Object.values(layout.piles ?? {}))
            expect(pile.left).toBeGreaterThan(layout.opLog!.right);
        }
    }
  });

  it("a long call shortens on a phone: no spaces or quotes, then without a key every call shares", () => {
    expect(compactCall('set("color", "red", 2)')).toBe("set(color,red,2)");
    const forms = opLogForms(traceFor(TIME).trace.ops!);
    expect(forms.at(-1)!.labels.slice(0, 4)).toEqual(["TimeMap()", "set(red,2)", "set(blue,5)", "get(1)"]);
    expect(forms.at(-1)!.outputs.slice(3)).toEqual(['""', "red", "red", "blue"]);
    // Without a shared key (a cache's numeric keys), there is no third form.
    expect(opLogForms(traceFor(LRU).trace.ops!)).toHaveLength(2);
  });

  it("earlier videos have no op log (their layouts don't change)", () => {
    for (const sb of storyboards)
      if (!sb.trace?.problem.startsWith("design/"))
        for (const scene of sb.scenes) expect(layoutScene(scene.elements).opLog).toBeUndefined();
  });
});
