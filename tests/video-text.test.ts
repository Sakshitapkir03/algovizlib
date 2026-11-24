import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { storyboards } from "@/content/storyboards";
import { primitiveRegistry } from "@/video/primitives/registry";
import { layoutScene } from "@/video/layout";
import { sceneFitProblems } from "@/video/fit/scene";

import { bitsProblems } from "@/video/fit/bits";
import { dpProblems } from "@/video/fit/dp";
import { greedyProblems } from "@/video/fit/greedy";
import { prefixProblems } from "@/video/fit/prefix";
import { timelineProblems } from "@/video/fit/timeline";
import { trieProblems } from "@/video/fit/trie";
import { forestProblems, networkProblems } from "@/video/fit/graph";
import { backtrackProblems } from "@/video/fit/backtrack";
import { stackProblems } from "@/video/fit/stack";
import { opLogProblems } from "@/video/fit/oplog";
import { heapProblems } from "@/video/fit/heap";
import { searchProblems } from "@/video/fit/search";
import { treeProblems } from "@/video/fit/tree";
import { MIN_TEXT_PX, PHONE_PLAYER_WIDTH, TEXT, textMetrics } from "@/video/text";

const phone = textMetrics(PHONE_PLAYER_WIDTH);
const rendered = (size: number) => size * phone.scale;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

describe("video text at phone width", () => {
  it("never sets a literal font size: every size goes through text.size()", () => {
    const offenders = sourceFiles("src/video").flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, i) => (/fontSize:\s*[\d"'`]/.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [])),
    );
    expect(offenders).toEqual([]);
  });

  it(`renders every designed size at ${MIN_TEXT_PX}px or more on a ${PHONE_PLAYER_WIDTH}px player`, () => {
    for (const [role, base] of Object.entries(TEXT)) {
      expect(rendered(phone.size(base)), role).toBeGreaterThanOrEqual(MIN_TEXT_PX);
    }
    expect(phone.compact).toBe(true);
    // A desktop-sized player keeps the designed sizes.
    expect(textMetrics(1280).size(TEXT.tag)).toBe(TEXT.tag);
  });

  it("has a text rule for every primitive", () => {
    // A new primitive must be added to the sweep below (and size its text through text.size).
    expect(Object.keys(primitiveRegistry).sort()).toEqual(
      [
        "bar-row",
        "binary-tree",
        "bits",
        "call-stack",
        "callout",
        "choice",
        "count-array",
        "counter",
        "cut",
        "deque",
        "dp-table",
        "equation",
        "freq-table",
        "graph",
        "grid",
        "hash-map",
        "heap",
        "heap-tree",
        "held-value",
        "highlight",
        "house-row",
        "item-row",
        "linked-list",
        "merge-buffer",
        "number-line",
        "partial",
        "partition",
        "pointer",
        "prefix-grid",
        "prefix-row",
        "queue",
        "race",
        "reach",
        "result",
        "search-range",
        "search-tree",
        "segments",
        "sorted-region",
        "staircase",
        "timeline",
        "trie",
        "digraph",
        "union-find",
        "op-log",
        "split-tree",
        "stack",
        "window",
      ].sort(),
    );
  });

  it("search trees and answers being built fit at full size too", () => {
    const full = textMetrics(1280);
    const problems = storyboards.flatMap((storyboard) =>
      storyboard.scenes.flatMap((scene) =>
        (["search-tree", "partial"] as const).flatMap((type) =>
          backtrackProblems(scene.elements, full, type).map((p) => `${storyboard.id} › ${scene.id}: ${p}`),
        ),
      ),
    );
    expect(problems).toEqual([]);
  });

  it("greedy choices and reaches fit at full size too", () => {
    const full = textMetrics(1280);
    const problems = storyboards.flatMap((storyboard) =>
      storyboard.scenes.flatMap((scene) =>
        greedyProblems(scene.elements, full).map((p) => `${storyboard.id} › ${scene.id}: ${p}`),
      ),
    );
    expect(problems).toEqual([]);
  });

  it("prefix rows and grids fit at full size too", () => {
    const full = textMetrics(1280);
    const problems = storyboards.flatMap((storyboard) =>
      storyboard.scenes.flatMap((scene) =>
        prefixProblems(scene.elements, full).map((p) => `${storyboard.id} › ${scene.id}: ${p}`),
      ),
    );
    expect(problems).toEqual([]);
  });

  it("timelines fit at full size too", () => {
    const full = textMetrics(1280);
    const problems = storyboards.flatMap((storyboard) =>
      storyboard.scenes.flatMap((scene) =>
        timelineProblems(scene.elements, full).map((p) => `${storyboard.id} › ${scene.id}: ${p}`),
      ),
    );
    expect(problems).toEqual([]);
  });

  it("bits panels fit at full size too", () => {
    const full = textMetrics(1280);
    const problems = storyboards.flatMap((storyboard) =>
      storyboard.scenes.flatMap((scene) =>
        bitsProblems(scene.elements, full).map((p) => `${storyboard.id} › ${scene.id}: ${p}`),
      ),
    );
    expect(problems).toEqual([]);
  });

  it("tries fit at full size too", () => {
    const full = textMetrics(1280);
    const problems = storyboards.flatMap((storyboard) =>
      storyboard.scenes.flatMap((scene) =>
        trieProblems(scene.elements, full).map((p) => `${storyboard.id} › ${scene.id}: ${p}`),
      ),
    );
    expect(problems).toEqual([]);
  });

  it("digraphs and union-finds fit at full size too", () => {
    const full = textMetrics(1280);
    const problems = storyboards.flatMap((storyboard) =>
      storyboard.scenes.flatMap((scene) =>
        [...networkProblems(scene.elements, full), ...forestProblems(scene.elements, full)].map(
          (p) => `${storyboard.id} › ${scene.id}: ${p}`,
        ),
      ),
    );
    expect(problems).toEqual([]);
  });

  it("op logs fit at full size too", () => {
    const full = textMetrics(1280);
    const problems = storyboards.flatMap((storyboard) =>
      storyboard.scenes.flatMap((scene) =>
        opLogProblems(scene.elements, full).map((p) => `${storyboard.id} › ${scene.id}: ${p}`),
      ),
    );
    expect(problems).toEqual([]);
  });

  it("stacks fit at full size too", () => {
    const full = textMetrics(1280);
    const problems = storyboards.flatMap((storyboard) =>
      storyboard.scenes.flatMap((scene) =>
        stackProblems(scene.elements, full).map((p) => `${storyboard.id} › ${scene.id}: ${p}`),
      ),
    );
    expect(problems).toEqual([]);
  });

  it("DP tables and their stories fit at full size too", () => {
    const full = textMetrics(1280);
    const problems = storyboards.flatMap((storyboard) =>
      storyboard.scenes.flatMap((scene) =>
        dpProblems(scene.elements, full).map((p) => `${storyboard.id} › ${scene.id}: ${p}`),
      ),
    );
    expect(problems).toEqual([]);
  });

  it("heaps fit at full size too", () => {
    const full = textMetrics(1280);
    const problems = storyboards.flatMap((storyboard) =>
      storyboard.scenes.flatMap((scene) =>
        heapProblems(scene.elements, full).map((p) => `${storyboard.id} › ${scene.id}: ${p}`),
      ),
    );
    expect(problems).toEqual([]);
  });

  it("grids, graphs, and queues fit at full size too", () => {
    const full = textMetrics(1280);
    const problems = storyboards.flatMap((storyboard) =>
      storyboard.scenes.flatMap((scene) =>
        (["grid", "graph", "queue"] as const).flatMap((type) =>
          scene.elements.some((e) => e.type === type)
            ? searchProblems(scene.elements, full, type).map((p) => `${storyboard.id} › ${scene.id}: ${p}`)
            : [],
        ),
      ),
    );
    expect(problems).toEqual([]);
  });

  it("trees and call stacks fit at full size too", () => {
    const full = textMetrics(1280);
    const problems = storyboards.flatMap((storyboard) =>
      storyboard.scenes.flatMap((scene) =>
        treeProblems(scene.elements, full, layoutScene(scene.elements, full).bottomTop).map(
          (p) => `${storyboard.id} › ${scene.id}: ${p}`,
        ),
      ),
    );
    expect(problems).toEqual([]);
  });

  it("linked lists fit at full size too (lanes, the bottom stack, and the stage edges)", () => {
    const full = textMetrics(1280);
    const problems: string[] = [];
    for (const storyboard of storyboards)
      for (const scene of storyboard.scenes) {
        const { list, bottomTop } = layoutScene(scene.elements, full);
        const el = scene.elements.find((e) => e.type === "linked-list");
        if (!list || el?.type !== "linked-list") continue;
        const where = `${storyboard.id} › ${scene.id}`;
        if (Math.max(...list.laneTops) + list.nodeHeight > bottomTop + 2)
          problems.push(`${where}: lanes run into the bottom stack`);
        for (const node of el.nodes)
          if (list.slotLeft(node.lane, node.slot + 1) > 1280 - 8)
            problems.push(`${where}: node ${node.value} runs off the stage`);
      }
    expect(problems).toEqual([]);
  });

  describe.each(storyboards.map((s) => [s.id, s] as const))("%s fits at phone width", (_, storyboard) => {
    it.each(storyboard.scenes.map((scene) => [scene.id, scene] as const))("scene %s", (_, scene) => {
      expect(sceneFitProblems(scene.elements, phone)).toEqual([]);
    });
  });
});
