import { describe, expect, it } from "vitest";

import { storyboards } from "@/content/storyboards";
import { getPatternListing, getProblem, hasVideo, problemHref } from "@/lib/catalog/repository";
import {
  resolveStoryboard,
  sceneSchema,
  validateStoryboard,
  type Element,
  type LinkedListElement,
  type PointerElement,
  type Storyboard,
} from "@/lib/storyboard";
import { runTrace, type Trace } from "@/lib/traces";
import { layoutScene } from "@/video/layout";
import { textMetrics } from "@/video/text";

const SLUGS = [
  "reverse-linked-list",
  "merge-two-sorted-lists",
  "remove-nth-node-from-end",
  "reorder-list",
  "merge-k-sorted-lists",
] as const;

const byProblem = (slug: string) => storyboards.find((sb) => sb.trace?.problem === `linked-list/${slug}`)!;
const sceneOf = (sb: Storyboard, id: string) => sb.scenes.find((s) => s.id === id)!;
const listOf = (sb: Storyboard, sceneId: string) =>
  sceneOf(sb, sceneId).elements.find((e): e is LinkedListElement => e.type === "linked-list")!;
const messages = (sb: Storyboard) => validateStoryboard(sb).issues.map((i) => i.message);

/** A copy with one scene's elements of one type changed. */
function mutate(sb: Storyboard, sceneId: string, type: Element["type"], change: (el: Element) => Element) {
  const copy = structuredClone(sb);
  const scene = copy.scenes.find((s) => s.id === sceneId)!;
  scene.elements = scene.elements.map((el) => (el.type === type ? change(el) : el));
  return copy;
}

/** Each node's value → the next node's value (or null), from a step's links. */
const links = (trace: Trace, step: number) =>
  Object.fromEntries(
    trace.steps[step].links!.nodes.map((n) => [
      String(n.value) + (n.dummy ? "" : `#${n.id}`),
      n.next === null ? null : trace.row.values[n.next],
    ]),
  );

describe("linked list traces", () => {
  it("Reverse flips exactly one link per step, toward prev, and ends with the old tail as head", () => {
    const t = runTrace("linked-list/reverse-linked-list", [[3, 7, 1, 9]]);
    const flips = t.steps.filter((s) => s.kind === "flip");
    expect(flips.map((s) => s.links!.rewired)).toEqual([
      [{ node: 0, from: 1, to: null }],
      [{ node: 1, from: 2, to: 0 }],
      [{ node: 2, from: 3, to: 1 }],
      [{ node: 3, from: null, to: 2 }],
    ]);
    // next is saved before the flip, so it still names the rest of the list.
    expect(flips.map((s) => s.pointers.next)).toEqual([1, 2, 3, undefined]);
    expect(t.answer).toEqual([9, 1, 7, 3]);
    expect(t.steps.at(-1)!.pointers).toEqual({ head: 3 });
  });

  it("Merge Two compares heads with neutral tones, takes A's node on a tie, and attaches the rest in one link", () => {
    const t = runTrace("linked-list/merge-two-sorted-lists", [
      [2, 5, 8],
      [1, 5, 6, 10],
    ]);
    const takes = t.steps.filter((s) => s.equation);
    expect(
      takes.map(
        (s) => `${s.equation!.result} ${s.equation!.comparison!.op} ${s.equation!.comparison!.target}`,
      ),
    ).toEqual(["2 > 1", "2 < 5", "5 = 5", "8 > 5", "8 > 6", "8 < 10"]);
    expect(takes.every((s) => s.equation!.tone === "neutral")).toBe(true);
    const tie = t.steps.find((s) => s.kind === "tie")!;
    expect(t.row.values[tie.active![0]]).toBe(5);
    expect(tie.active![0]).toBe(1); // A's 5 (node 1), not B's (node 4)
    const attach = t.steps.at(-1)!;
    expect(attach.links!.rewired).toEqual([{ node: 2, from: null, to: 6 }]); // 8 → 10, one link
    expect(t.answer).toEqual([1, 2, 5, 5, 6, 8, 10]);
    // The dummy starts the merged lane.
    expect(attach.links!.nodes.find((n) => n.dummy)).toMatchObject({ lane: 2, slot: 0 });
  });

  it("Remove Nth keeps a gap of n + 1 and skips the node with one link", () => {
    const t = runTrace("linked-list/remove-nth-node-from-end", [[10, 20, 30, 40, 50], 2]);
    const slot = (id: number | undefined, step: number) =>
      id === undefined ? undefined : t.steps[step].links!.nodes.find((n) => n.id === id)!.slot;
    const gapSteps = t.steps
      .map((s, i) => [s, i] as const)
      .filter(([s]) => s.pointers.fast !== undefined && s.kind !== "start");
    for (const [s, i] of gapSteps) expect(slot(s.pointers.fast, i)! - slot(s.pointers.slow, i)!).toBe(3);
    const unlink = t.steps.find((s) => s.kind === "unlink")!;
    expect(unlink.links!.rewired).toEqual([{ node: 3, from: 4, to: 5 }]); // 30 skips 40
    expect(unlink.rejected).toEqual([4]);
    expect(t.answer).toEqual([10, 20, 30, 50]);
  });

  it("Reorder finds the middle, cuts and reverses the back half, then weaves", () => {
    const t = runTrace("linked-list/reorder-list", [[10, 20, 30, 40, 50]]);
    expect(t.steps.map((s) => s.kind)).toEqual([
      "start",
      "step",
      "middle",
      "cut",
      "reversed",
      "weave",
      "weave",
      "done",
    ]);
    expect(links(t, 3)).toMatchObject({ "30#2": null }); // cut after the middle
    expect(links(t, 4)).toMatchObject({ "50#4": 40, "40#3": null }); // back half reversed
    expect(t.steps[5].links!.rewired).toEqual([
      { node: 0, from: 1, to: 4 },
      { node: 4, from: 3, to: 1 },
    ]);
    expect(t.answer).toEqual([10, 50, 20, 40, 30]);
  });

  it("Merge K keeps a min-heap of at most k heads and takes the smallest each time", () => {
    const t = runTrace("linked-list/merge-k-sorted-lists", [
      [
        [1, 6, 9],
        [2, 3, 11],
        [4, 8],
      ],
    ]);
    for (const s of t.steps) {
      expect(s.heap!.length).toBeLessThanOrEqual(3);
      if (s.heap!.length > 0) expect(s.heap![0]).toBe(Math.min(...s.heap!));
    }
    expect(t.steps.map((s) => s.counter!.value)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(t.steps.at(-1)!.heap).toEqual([]);
    expect(t.answer).toEqual([1, 2, 3, 4, 6, 8, 9, 11]);
  });
});

describe("linked list storyboards", () => {
  it.each(SLUGS)("%s validates with narration around 1,000 characters and its own analogy", (slug) => {
    const sb = byProblem(slug);
    expect(sb, slug).toBeDefined();
    expect(validateStoryboard(sb).issues).toEqual([]);
    const chars = sb.scenes.reduce((sum, s) => sum + s.narration.length, 0);
    expect(chars).toBeGreaterThan(700);
    expect(chars).toBeLessThanOrEqual(1200);
    expect(sb.exampleSource).toBe("analogy");
    expect(sb.analogy?.mapping.length).toBeGreaterThan(0);
    expect(sb.scenes.length).toBeLessThanOrEqual(10);
    expect(sb.generation?.promptVersion).toBe("storyboard-v8");
  });

  it("analogies are new: none reuses another video's scenario", () => {
    const scenarios = storyboards.map((sb) => sb.analogy?.scenario).filter(Boolean);
    expect(new Set(scenarios).size).toBe(scenarios.length);
  });

  it("rejects a drawn link, place, rewire, or slide that doesn't match the trace", () => {
    const sb = byProblem("reorder-list");
    const wrongNext = mutate(sb, "cut", "linked-list", (el) => ({
      ...(el as LinkedListElement),
      nodes: (el as LinkedListElement).nodes.map((n) => (n.id === 2 ? { ...n, next: 3 } : n)), // 30 not cut
    }));
    expect(messages(wrongNext)).toContain("The list's nodes and links don't match trace step 3");

    const wrongLane = mutate(sb, "cut", "linked-list", (el) => ({
      ...(el as LinkedListElement),
      nodes: (el as LinkedListElement).nodes.map((n) => (n.id === 3 ? { ...n, lane: 0, slot: 3 } : n)),
    }));
    expect(messages(wrongLane)).toContain("The list's nodes and links don't match trace step 3");

    const wrongRewire = mutate(sb, "weave", "linked-list", (el) => ({
      ...(el as LinkedListElement),
      rewired: [{ node: 0, from: 1, to: 4 }],
    }));
    expect(messages(wrongRewire)).toContain("Rewired links don't match trace step 5");

    const wrongSlide = mutate(sb, "reverse", "linked-list", (el) => ({
      ...(el as LinkedListElement),
      fromPlaces: [{ id: 4, lane: 0, slot: 0 }],
    }));
    expect(messages(wrongSlide)).toContain("Node #4 should slide from where the previous scene left it");
  });

  it("an unbound scene must show the list as the trace starts or ends", () => {
    const sb = byProblem("reorder-list");
    const middle = listOf(sb, "cut").nodes;
    const wrong = mutate(sb, "slideshow", "linked-list", (el) => ({
      ...(el as LinkedListElement),
      nodes: middle,
    }));
    expect(messages(wrong).join("\n")).toMatch(
      /Without a traceStep, the list must be drawn as the trace starts/,
    );
  });

  it("pointers on a list are node ids, checked against the step", () => {
    const sb = byProblem("reverse-linked-list");
    const wrong = mutate(sb, "flip-7", "pointer", (el) =>
      (el as PointerElement).binds === "prev" ? { ...el, index: 2 } : el,
    );
    expect(messages(wrong)).toContain('Pointer "prev" should be at 0 in trace step 2, not 2');
  });

  it("Merge K's heap-tree shows the step's heap of heads", () => {
    const sb = byProblem("merge-k-sorted-lists");
    const heap = sceneOf(sb, "pop-1").elements.find((e) => e.type === "heap-tree");
    expect(heap).toMatchObject({ values: [2, 4, 6], heapSize: 3 });
    const wrong = mutate(sb, "pop-1", "heap-tree", (el) => ({ ...el, values: [2, 6, 4] }));
    expect(messages(wrong)).toContain("The heap doesn't match trace step 1");
  });

  it("resolves omitted nodes from the step, and slides moved nodes from their previous places", () => {
    const sb = byProblem("merge-two-sorted-lists");
    // take-1 (step 1): node 3 (B's 1) moved from lane 1, slot 0 into the merged lane.
    expect(listOf(sb, "take-1").fromPlaces).toEqual([{ id: 3, lane: 1, slot: 0 }]);
    expect(listOf(sb, "take-1").rewired).toEqual([{ node: 7, from: null, to: 3 }]);
    // The intro (unbound) shows the starting lists with no rewires.
    expect(listOf(sb, "gate").rewired).toBeUndefined();
    const { storyboard, issues } = resolveStoryboard({
      ...structuredClone(sb),
      scenes: sb.scenes.map((s) => ({
        ...s,
        elements: s.elements.map((e) =>
          e.type === "linked-list" ? { id: e.id, type: e.type, enterAt: 0 } : e,
        ),
      })),
    } as never);
    expect(issues).toEqual([]);
    expect(listOf(storyboard!, "take-2").nodes).toEqual(listOf(sb, "take-2").nodes);
  });

  it("schema: distinct node ids, links to real nodes, one node per place, one list per scene", () => {
    const base = { id: "s", narration: "n", caption: "c", durationInFrames: 60 };
    const node = (id: number, next: number | null, slot: number) => ({ id, value: id, next, lane: 0, slot });
    const list = (nodes: unknown[]) => ({ id: "list", type: "linked-list", enterAt: 0, nodes });
    const issues = (elements: unknown[]) =>
      sceneSchema.safeParse({ ...base, elements }).error?.issues.map((i) => i.message) ?? [];
    expect(issues([list([node(0, 1, 0), node(1, null, 1)])])).toEqual([]);
    expect(issues([list([node(0, 1, 0), node(0, null, 1)])])).toContain("node ids must each appear once");
    // A node removed for good (a cache's eviction) leaves its id unused; links must still reach real nodes.
    expect(issues([list([node(0, 5, 0), node(5, null, 1)])])).toEqual([]);
    expect(issues([list([node(0, 1, 0), node(5, null, 1)])])).toContain(
      "node 0 links to 1, which isn't a node",
    );
    expect(issues([list([node(0, 7, 0)])])).toContain("node 0 links to 7, which isn't a node");
    expect(issues([list([node(0, null, 0), node(1, null, 0)])])).toContain("two nodes share a lane and slot");
    expect(issues([list([node(0, null, 0)]), { ...list([node(0, null, 0)]), id: "list2" }])).toContain(
      "A scene can show only one linked-list (use lanes for more lists)",
    );
  });

  it("lays lanes out top to bottom, and with a heap puts the inputs left, the tree right, the merged lane below", () => {
    const sb = byProblem("merge-k-sorted-lists");
    for (const width of [1280, 343]) {
      const { list, heapRegion, rows } = layoutScene(sceneOf(sb, "pop-1").elements, textMetrics(width));
      expect(list!.laneTops).toEqual([...list!.laneTops].sort((a, b) => a - b));
      const merged = list!.laneTops[3];
      expect(heapRegion.bottom).toBeLessThan(merged);
      expect(heapRegion.left).toBeGreaterThan(list!.slotLeft(0, 3));
      // Pointers and highlights find nodes by id, at their lane's height.
      const tail = sceneOf(sb, "pop-1").elements.find((e): e is PointerElement => e.type === "pointer")!;
      expect(rows.list.tops![tail.index]).toBe(merged);
    }
  });
});

describe("cross-listed linked list problems show their videos everywhere they're listed", () => {
  it.each([
    ["merge-k-sorted-lists", "heap"],
    ["merge-two-sorted-lists", "sorting"],
    ["remove-nth-node-from-end", "two-pointers"],
    ["reorder-list", "fast-slow-pointers"],
  ])("%s also appears under %s with its video, linking home", (slug, other) => {
    const problem = getProblem("linked-list", slug)!;
    expect(hasVideo(problem)).toBe(true);
    const home = getPatternListing("linked-list").find((p) => p.slug === slug)!;
    expect(home).toMatchObject({ hasVideo: true, href: problemHref(problem) });
    const related = getPatternListing(other).find((p) => p.slug === slug)!;
    expect(related).toMatchObject({
      hasVideo: true,
      href: problemHref(problem),
      homePatternName: "Linked List",
    });
  });

  it("problems cross-listed into Linked List keep their home pages (no video yet)", () => {
    const related = getPatternListing("linked-list").filter((p) => p.homePatternName);
    expect(related.map((p) => p.slug).sort()).toEqual(
      [
        "linked-list-cycle",
        "linked-list-cycle-ii",
        "lfu-cache",
        "lru-cache",
        "middle-of-the-linked-list",
      ].sort(),
    );
    for (const p of related) expect(p.href).not.toMatch(/^\/dsa\/linked-list\//);
  });
});
