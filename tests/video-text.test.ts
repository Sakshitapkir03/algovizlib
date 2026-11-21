import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { storyboards } from "@/content/storyboards";
import { primitiveRegistry } from "@/video/primitives/registry";
import { PILL_PADDING, pointerLabel } from "@/video/labels";
import { layoutScene, NUMBER_GAP, pointerRoom, sizes } from "@/video/layout";

import { treeProblems } from "./fixtures/tree-fit";
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
        "call-stack",
        "callout",
        "count-array",
        "counter",
        "cut",
        "deque",
        "equation",
        "freq-table",
        "heap-tree",
        "held-value",
        "highlight",
        "item-row",
        "linked-list",
        "merge-buffer",
        "number-line",
        "partition",
        "pointer",
        "result",
        "search-range",
        "segments",
        "sorted-region",
        "split-tree",
        "window",
      ].sort(),
    );
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
      const { rows, bottomTop } = layoutScene(scene.elements, phone);
      const problems: string[] = [];
      const fail = (what: string) => problems.push(what);

      for (const el of scene.elements) {
        switch (el.type) {
          case "bar-row": {
            const layout = rows[el.id];
            const size = phone.size(TEXT.barValue);
            for (const bar of el.bars) {
              const label = `${el.unit}${bar.value}`;
              if (!phone.fits(label, size, layout.cardWidth + 12, "mono"))
                fail(`bar value "${label}" is wider than its bar (${Math.round(layout.cardWidth)}px)`);
            }
            if (layout.cardHeight - sizes.barLabel(phone) < 24) fail("bars have no room left to grow");
            break;
          }
          case "item-row": {
            const layout = rows[el.id];
            const size = phone.size(TEXT.itemValue);
            for (const item of el.items) {
              const label = `${el.unit}${item.value}`;
              if (!phone.fits(label, size, layout.cardWidth - 8, "mono"))
                fail(`item value "${label}" is wider than its card`);
            }
            break;
          }
          case "pointer": {
            const layout = rows[el.rowId];
            const pointers = scene.elements.filter((e) => e.type === "pointer");
            const label = pointerLabel(el, layout, phone, pointers);
            const half = (phone.width(label, phone.size(TEXT.pointer)) + PILL_PADDING) / 2;
            const x = layout.centers[el.index];
            if (x - half < 0 || x + half > 1280) fail(`pointer "${label}" runs off the stage`);
            for (const other of pointers) {
              // Pointers on the same position stack vertically instead of competing for width.
              if (
                other === el ||
                other.rowId !== el.rowId ||
                other.placement !== el.placement ||
                other.index === el.index ||
                // A linked list's other lanes sit at other heights.
                (layout.tops?.[other.index] ?? 0) !== (layout.tops?.[el.index] ?? 0)
              )
                continue;
              const otherLabel = pointerLabel(other, layout, phone, pointers);
              const otherHalf = (phone.width(otherLabel, phone.size(TEXT.pointer)) + PILL_PADDING) / 2;
              const gap = Math.abs(layout.centers[other.index] - x) - half - otherHalf;
              if (gap < 0 && label.length > 1) fail(`pointer "${label}" overlaps "${otherLabel}"`);
            }
            if (
              el.placement === "below" &&
              layout.pointerTop + pointerRoom(scene.elements, el.rowId, phone) > bottomTop + 2
            )
              fail(`pointer "${label}" runs into the bottom stack`);
            break;
          }
          case "count-array": {
            const size = phone.size(TEXT.countCell);
            for (const v of [...el.keys, ...el.counts])
              if (!phone.fits(String(v), size, 64 - 8, "mono")) fail(`tally "${v}" is wider than its cell`);
            const panelTop = Object.values(rows)[0].panelTop;
            if (panelTop + sizes.countKeys(phone) + sizes.cell(phone) > bottomTop + 2)
              fail("the tally runs into the bottom stack");
            break;
          }
          case "merge-buffer": {
            const layout = rows[el.rowId];
            for (const v of el.values)
              if (
                v !== null &&
                !phone.fits(String(v), phone.size(TEXT.countCell), layout.cardWidth - 8, "mono")
              )
                fail(`buffer value ${v} is wider than its slot`);
            if (layout.panelTop + sizes.cell(phone) > bottomTop + 2)
              fail("the buffer runs into the bottom stack");
            break;
          }
          case "split-tree": {
            const values = el.levels[0].flat();
            const cell = sizes.splitCell(phone);
            for (const v of values)
              if (!phone.fits(String(v), phone.size(TEXT.splitValue), cell - 8, "mono"))
                fail(`split value ${v} is wider than its cell`);
            const width = values.length * (cell + 14) - 14;
            if (width > 1280 - 32) fail("the split overview is wider than the stage");
            break;
          }
          case "window": {
            const layout = rows[el.rowId];
            const label =
              el.value === undefined ? "" : [el.label, el.value].filter((v) => v !== "").join(" ");
            if (!phone.fits(label, phone.size(TEXT.windowLabel), 1280 - 16 - 28, "mono"))
              fail(`window label "${label}" doesn't fit the stage`);
            const labelTop = layout.top - sizes.window(phone);
            const captionBottom = 70 + 2 * Math.ceil(phone.size(TEXT.caption) * 1.25);
            if (labelTop < captionBottom) fail(`window label runs into the caption`);
            break;
          }
          case "freq-table": {
            const cell = sizes.freqCell(phone, el.entries);
            const width =
              phone.width(el.label, phone.size(TEXT.panelLabel)) + el.entries.length * (cell + 16);
            if (width > 1280 - 32) fail("the counts panel is wider than the stage");
            break;
          }
          case "deque": {
            const cell = sizes.dequeCell(phone);
            const row = scene.elements.find((e) => e.id === el.rowId);
            const values = row?.type === "item-row" ? row.items.map((i) => String(i.value)) : [];
            for (const v of values)
              if (!phone.fits(v, phone.size(TEXT.countCell), cell - 8, "mono"))
                fail(`deque value ${v} overflows`);
            const cells = el.indices.length + (el.poppedBack?.length ?? 0) + (el.poppedFront?.length ?? 0);
            const width =
              phone.width(el.label, phone.size(TEXT.panelLabel)) +
              Math.max(1, cells) * (cell + 14) +
              32 +
              phone.width(el.outputLabel, phone.size(TEXT.panelLabel)) +
              14 +
              phone.width(el.output.join(" ") || "—", phone.size(TEXT.countCell), "mono");
            if (width > 1280 - 32) fail(`the deque panel is wider than the stage (${Math.round(width)})`);
            break;
          }
          case "search-range": {
            const layout = rows[el.rowId];
            const label = el.sorted ? "✓ sorted" : el.label;
            if (label && !phone.fits(label, phone.size(TEXT.windowLabel), 1280 - 16 - 28, "mono"))
              fail(`search label "${label}" doesn't fit the stage`);
            const captionBottom = 70 + 2 * Math.ceil(phone.size(TEXT.caption) * 1.25);
            if (layout.top - sizes.window(phone) < captionBottom) fail("search label runs into the caption");
            break;
          }
          case "number-line": {
            const values = Array.from({ length: el.max - el.min + 1 }, (_, k) => el.min + k);
            const cell = sizes.numberCell(phone, values);
            for (const v of values)
              if (!phone.fits(String(v), phone.size(TEXT.countCell), cell - 8, "mono"))
                fail(`candidate ${v} is wider than its cell`);
            if (values.length * cell + (values.length - 1) * NUMBER_GAP > 1280 - 32)
              fail("the number line is wider than the stage");
            break;
          }
          case "cut": {
            const layout = rows[el.rowId];
            if (!layout) fail(`cut on unknown row "${el.rowId}"`);
            else if (layout.cardHeight < 2 * phone.size(TEXT.itemValue))
              fail(`row "${el.rowId}" is too short to read under a cut (${Math.round(layout.cardHeight)}px)`);
            break;
          }
          case "linked-list": {
            const { list } = layoutScene(scene.elements, phone);
            if (!list) {
              fail("linked list has no layout");
              break;
            }
            const size = phone.size(TEXT.listValue);
            for (const node of el.nodes)
              if (!node.dummy && !phone.fits(String(node.value), size, list.nodeWidth - 8, "mono"))
                fail(`node value ${node.value} is wider than its box (${Math.round(list.nodeWidth)}px)`);
            if (list.nodeHeight < size + 8)
              fail(`nodes are too short for their values (${list.nodeHeight}px)`);
            // Every node (and a null end after it) stays on the stage.
            for (const node of el.nodes)
              if (list.slotLeft(node.lane, node.slot + 1) > 1280 - 8)
                fail(`node ${node.value} (lane ${node.lane}, slot ${node.slot}) runs off the stage`);
            // Lanes don't overlap: each lane's pointers start below the previous lane's nodes.
            const lanes = [...new Set(el.nodes.map((n) => n.lane))].sort((a, b) => a - b);
            for (let k = 1; k < lanes.length; k++)
              if (list.laneTops[lanes[k]] - list.laneTops[lanes[k - 1]] < list.nodeHeight + 8)
                fail(`lanes ${lanes[k - 1]} and ${lanes[k]} overlap`);
            if (Math.max(...list.laneTops) + list.nodeHeight > bottomTop + 2)
              fail("the last lane runs into the bottom stack");
            break;
          }
          case "binary-tree":
            for (const problem of treeProblems(scene.elements, phone, bottomTop)) fail(problem);
            break;
          case "heap-tree":
            for (const v of el.values)
              if (!phone.fits(String(v), phone.size(TEXT.heapNode), 96 - 12, "mono"))
                fail(`heap value ${v} is wider than its node`);
            break;
          default:
            break;
        }
      }
      // Rows start under a two-line caption (captions are at most 80 characters: two lines at 44px).
      const captionBottom = 70 + 2 * Math.ceil(phone.size(TEXT.caption) * 1.25);
      for (const layout of Object.values(rows))
        if (layout.reservedTop < captionBottom) fail(`row "${layout.rowId}" starts under the caption`);
      // The bottom stack never climbs into the rows.
      for (const layout of Object.values(rows))
        if (Math.max(layout.top, ...(layout.tops ?? [])) + layout.cardHeight > bottomTop)
          fail(`row "${layout.rowId}" overlaps the bottom stack`);
      expect(problems).toEqual([]);
    });
  });
});
