import { describe, expect, it } from "vitest";

import { getProblem } from "@/lib/catalog/repository";
import { assembleStoryboard, evaluateDraft, type GenerationContext } from "@/lib/generation/draft";
import { resolveStoryboard, storyboardSourceSchema, validateStoryboard } from "@/lib/storyboard";
import { getTraceDefinition, type TraceTrie } from "@/lib/traces";
import { layoutScene } from "@/video/layout";
import { PHONE_PLAYER_WIDTH, textMetrics } from "@/video/text";

import { buildDraft, traceFor } from "./fixtures/drafts";
import { searchProblems } from "@/video/fit/search";
import { trieProblems } from "@/video/fit/trie";

const TRIES = [
  "trie/longest-common-prefix",
  "trie/implement-trie",
  "trie/design-add-and-search-words",
  "trie/replace-words",
  "trie/word-search-ii",
];

const spell = (trie: TraceTrie, id: number) => {
  let out = "";
  for (
    let n = trie.nodes.find((m) => m.id === id);
    n && n.parent !== null;
    n = trie.nodes.find((m) => m.id === n!.parent)
  )
    out = n.letter + out;
  return out;
};

describe("trie traces", () => {
  it.each(TRIES)("%s: fits a 10-scene video, and every walk follows real edges", (key) => {
    const { trace } = traceFor(key);
    expect(trace.steps.filter((s) => s.key).length + 3).toBeLessThanOrEqual(10);
    expect(trace.steps.at(-1)!.key).toBe(true);
    for (const step of trace.steps) {
      const trie = step.trie!;
      const parent = new Map(trie.nodes.map((n) => [n.id, n.parent]));
      expect(trie.path[0]).toBe(0);
      trie.path.slice(1).forEach((id, k) => expect(parent.get(id)).toBe(trie.path[k]));
      if (trie.missing)
        expect(
          trie.nodes.some((n) => n.parent === trie.missing!.parent && n.letter === trie.missing!.letter),
        ).toBe(false);
      // Small enough to read on a phone.
      expect(trie.nodes.length).toBeLessThanOrEqual(10);
    }
  });

  it("Longest Common Prefix shares t and r, then stops where the words branch", () => {
    const { trace } = traceFor("trie/longest-common-prefix");
    expect(trace.steps.slice(0, 3).map((s) => s.trie!.created!.length)).toEqual([4, 1, 2]);
    const stop = trace.steps.at(-1)!.trie!;
    expect(spell(stop, stop.path.at(-1)!)).toBe("tr");
    expect(stop.branches!.map((id) => stop.nodes.find((n) => n.id === id)!.letter)).toEqual(["a", "e"]);
    expect(trace.answer).toBe("tr");
  });

  it("Implement Trie tells a prefix from a word, and stops at a missing child", () => {
    const { trace } = traceFor("trie/implement-trie");
    const [, , car, cab, cap] = trace.steps;
    expect(car.trie!.hits).toBeUndefined();
    expect(spell(car.trie!, car.trie!.path.at(-1)!)).toBe("car");
    expect(cab.trie!.hits).toHaveLength(1);
    expect(cap.trie!.missing!.letter).toBe("p");
    expect(trace.answer).toEqual([null, null, null, false, true, false]);
  });

  it("Design Add and Search Words branches on '.', with a dead branch beside the match", () => {
    const { trace } = traceFor("trie/design-add-and-search-words");
    const bL = trace.steps[2].trie!;
    expect(spell(bL, bL.hits![0])).toBe("ball");
    expect(bL.missing).toMatchObject({ letter: "l" });
    expect(spell(bL, bL.missing!.parent)).toBe("bat");
    expect(trace.steps[5].trie!.missing).toEqual({ parent: 0, letter: "c" });
    expect(trace.answer).toEqual([null, null, null, true, false, true, false]);
  });

  it("Replace Words stops at the first root's end: format becomes for, not form", () => {
    const { trace } = traceFor("trie/replace-words");
    const format = trace.steps.find((s) => s.pointers.w === 3)!;
    expect(format.trie!.hits!.map((id) => spell(format.trie!, id))).toEqual(["for"]);
    expect(trace.steps.find((s) => s.pointers.w === 0)!.trie!.missing).toEqual({ parent: 0, letter: "t" });
    expect(trace.answer).toBe("they re the for un");
  });

  it("Word Search II walks the board and the trie together, prunes finished branches, and misses cot", () => {
    const { trace } = traceFor("trie/word-search-ii");
    const found = trace.steps.filter((s) => s.kind === "found");
    expect(found.map((s) => s.partial!.added)).toEqual(["car", "care", "cat"]);
    for (const s of found) {
      // The board path and the trie path have the same length: one cell per letter.
      const cells = s.bfs!.frontier.length + 1;
      expect(s.trie!.path.length - 1).toBe(cells);
    }
    expect(trace.steps.some((s) => (s.trie!.pruned ?? []).length > 0)).toBe(true);
    const dead = trace.steps.find((s) => s.kind === "dead-end")!;
    expect(spell(dead.trie!, dead.trie!.path.at(-1)!)).toBe("co");
    expect(trace.answer).toEqual(["car", "care", "cat"]);
  });
});

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
    patternName: "Trie",
    definition: getTraceDefinition(key)!,
    args: traceFor(key).args,
  };
}

describe("trie storyboards", () => {
  it.each(TRIES)("%s: a fixture draft passes and fits at phone and full size", (key) => {
    const result = evaluateDraft(buildDraft(key), context(key), META);
    expect(result.issues).toEqual([]);
    if (!result.ok) return;
    for (const width of [PHONE_PLAYER_WIDTH, 1280])
      for (const scene of result.storyboard.scenes) {
        const t = textMetrics(width);
        expect(trieProblems(scene.elements, t), `${scene.id} at ${width}`).toEqual([]);
        if (scene.elements.some((e) => e.type === "grid"))
          expect(searchProblems(scene.elements, t, "grid"), `${scene.id} at ${width}`).toEqual([]);
      }
  });

  it("a board beside a trie takes the left of the stage", () => {
    const key = "trie/word-search-ii";
    const result = evaluateDraft(buildDraft(key), context(key), META);
    if (!result.ok) throw new Error("fixture invalid");
    const scene = result.storyboard.scenes.find((s) => s.traceStep === 4)!;
    for (const width of [PHONE_PLAYER_WIDTH, 1280]) {
      const layout = layoutScene(scene.elements, textMetrics(width));
      const right = layout.grid!.left + layout.grid!.cols * layout.grid!.cell;
      expect(layout.trie!.region.x).toBeGreaterThan(right);
    }
  });

  type Source = ReturnType<typeof assembleStoryboard>;
  const source = (key: string): Source =>
    structuredClone(assembleStoryboard(buildDraft(key), context(key), META));
  const issues = (sb: Source) => {
    const { storyboard, issues } = resolveStoryboard(storyboardSourceSchema.parse(sb));
    return [...issues, ...(storyboard ? validateStoryboard(storyboard).issues : [])]
      .map((i) => i.message)
      .join("\n");
  };
  const IMPL = "trie/implement-trie";
  const mutate = (step: number, change: (t: TraceTrie) => void) => {
    const sb = source(IMPL);
    const scene = sb.scenes.find((s) => s.traceStep === step)!;
    const el = scene.elements.find((e) => e.type === "trie") as Record<string, unknown>;
    const t = structuredClone(traceFor(IMPL).trace.steps[step].trie!);
    change(t);
    Object.assign(el, t);
    return issues(sb);
  };

  it("the fixture sources resolve and validate", () => {
    for (const key of TRIES) expect(issues(source(key)), key).toBe("");
  });

  it("rejects a wrong end marker, path, created node, or missing child", () => {
    expect(mutate(2, () => {})).toBe("");
    // search("car") is false because "car" isn't marked; marking it is wrong.
    expect(mutate(2, (t) => (t.nodes.find((n) => n.letter === "r")!.end = true))).toMatch(
      /trie's nodes doesn't match/,
    );
    expect(mutate(2, (t) => (t.path = t.path.slice(0, 2)))).toMatch(/trie's path doesn't match/);
    expect(mutate(1, (t) => (t.created = [1]))).toMatch(/trie's created doesn't match/);
    expect(mutate(4, (t) => (t.missing = { parent: t.missing!.parent, letter: "q" }))).toMatch(
      /trie's missing doesn't match/,
    );
  });

  it("schema: the path follows edges, siblings don't share letters, a missing child really is missing", () => {
    expect(mutate(2, (t) => (t.path = [0, t.path[2]]))).toMatch(
      /the path runs from the root, child by child/,
    );
    expect(mutate(2, (t) => t.nodes.push({ id: 99, parent: 0, letter: "c", end: false }))).toMatch(
      /two children of one node can't share a letter/,
    );
    expect(mutate(2, (t) => (t.missing = { parent: 0, letter: "c" }))).toMatch(/the child really isn't/);
  });

  it("an unbound trie is empty (or the final trie)", () => {
    const sb = source(IMPL);
    sb.scenes[0].elements.push({ id: "t", type: "trie", enterAt: 0 } as never);
    expect(issues(sb)).toBe("");
    (sb.scenes[0].elements.at(-1) as Record<string, unknown>).path = [0];
    (sb.scenes[0].elements.at(-1) as Record<string, unknown>).nodes =
      traceFor(IMPL).trace.steps[0].trie!.nodes;
    expect(issues(sb)).toMatch(/Without a traceStep, the trie is empty/);
  });
});
