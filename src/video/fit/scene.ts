import type { Element } from "@/lib/storyboard";
import { PILL_PADDING, pointerLabel } from "@/video/labels";
import { layoutScene, NUMBER_GAP, pointerRoom, sizes } from "@/video/layout";
import { PHONE_PLAYER_WIDTH, TEXT, type TextMetrics, textMetrics } from "@/video/text";

import { backtrackProblems } from "./backtrack";
import { bitsProblems } from "./bits";
import { dpProblems } from "./dp";
import { forestProblems, networkProblems } from "./graph";
import { greedyProblems } from "./greedy";
import { heapProblems } from "./heap";
import { opLogProblems } from "./oplog";
import { prefixProblems } from "./prefix";
import { raceProblems } from "./race";
import { searchProblems } from "./search";
import { stackProblems } from "./stack";
import { systemProblems } from "./system";
import { timelineProblems } from "./timeline";
import { treeProblems } from "./tree";
import { trieProblems } from "./trie";

/** The text metrics of a phone-sized (343px) player: what every scene must fit. */
export const PHONE_TEXT = textMetrics(PHONE_PLAYER_WIDTH);

/**
 * Everything in one scene that doesn't fit on a phone-sized player (values wider than their bars, cells, and nodes,
 * pointers running off the stage or into each other, panels wider than the stage, anything running into the caption
 * or the bottom stack), as readable problems; empty when the scene fits. Shared by the video-text test (every
 * committed video) and "Try your own input" (a walkthrough built in the browser is refused if a scene doesn't fit),
 * so both use one set of rules. Loaded lazily in the browser, with the traces.
 */
export function sceneFitProblems(elements: readonly Element[], t: TextMetrics = PHONE_TEXT): string[] {
  const { rows, bottomTop } = layoutScene(elements, t);
  const problems: string[] = [];
  const fail = (what: string) => problems.push(what);

  for (const el of elements) {
    switch (el.type) {
      case "bar-row": {
        const layout = rows[el.id];
        const size = t.size(TEXT.barValue);
        for (const bar of el.bars) {
          const label = `${el.unit}${bar.value}`;
          if (!t.fits(label, size, layout.cardWidth + 12, "mono"))
            fail(`bar value "${label}" is wider than its bar (${Math.round(layout.cardWidth)}px)`);
        }
        if (layout.cardHeight - sizes.barLabel(t) < 24) fail("bars have no room left to grow");
        break;
      }
      case "item-row": {
        const layout = rows[el.id];
        const size = t.size(TEXT.itemValue);
        for (const item of el.items) {
          const label = `${el.unit}${item.value}`;
          if (!t.fits(label, size, layout.cardWidth - 8, "mono"))
            fail(`item value "${label}" is wider than its card`);
        }
        break;
      }
      case "pointer": {
        const layout = rows[el.rowId];
        const pointers = elements.filter((e) => e.type === "pointer");
        const label = pointerLabel(el, layout, t, pointers);
        const half = (t.width(label, t.size(TEXT.pointer)) + PILL_PADDING) / 2;
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
          const otherLabel = pointerLabel(other, layout, t, pointers);
          const otherHalf = (t.width(otherLabel, t.size(TEXT.pointer)) + PILL_PADDING) / 2;
          const gap = Math.abs(layout.centers[other.index] - x) - half - otherHalf;
          if (gap < 0 && label.length > 1) fail(`pointer "${label}" overlaps "${otherLabel}"`);
        }
        if (
          el.placement === "below" &&
          layout.pointerTop + pointerRoom(elements, el.rowId, t) > bottomTop + 2
        )
          fail(`pointer "${label}" runs into the bottom stack`);
        break;
      }
      case "count-array": {
        const size = t.size(TEXT.countCell);
        for (const v of [...el.keys, ...el.counts])
          if (!t.fits(String(v), size, 64 - 8, "mono")) fail(`tally "${v}" is wider than its cell`);
        const panelTop = Object.values(rows)[0].panelTop;
        if (panelTop + sizes.countKeys(t) + sizes.cell(t) > bottomTop + 2)
          fail("the tally runs into the bottom stack");
        break;
      }
      case "merge-buffer": {
        const layout = rows[el.rowId];
        for (const v of el.values)
          if (v !== null && !t.fits(String(v), t.size(TEXT.countCell), layout.cardWidth - 8, "mono"))
            fail(`buffer value ${v} is wider than its slot`);
        if (layout.panelTop + sizes.cell(t) > bottomTop + 2) fail("the buffer runs into the bottom stack");
        break;
      }
      case "split-tree": {
        const values = el.levels[0].flat();
        const cell = sizes.splitCell(t);
        for (const v of values)
          if (!t.fits(String(v), t.size(TEXT.splitValue), cell - 8, "mono"))
            fail(`split value ${v} is wider than its cell`);
        const width = values.length * (cell + 14) - 14;
        if (width > 1280 - 32) fail("the split overview is wider than the stage");
        break;
      }
      case "window": {
        const layout = rows[el.rowId];
        const label = el.value === undefined ? "" : [el.label, el.value].filter((v) => v !== "").join(" ");
        if (!t.fits(label, t.size(TEXT.windowLabel), 1280 - 16 - 28, "mono"))
          fail(`window label "${label}" doesn't fit the stage`);
        const labelTop = layout.top - sizes.window(t);
        const captionBottom = 70 + 2 * Math.ceil(t.size(TEXT.caption) * 1.25);
        if (labelTop < captionBottom) fail(`window label runs into the caption`);
        break;
      }
      case "freq-table": {
        const cell = sizes.freqCell(t, el.entries);
        const width = t.width(el.label, t.size(TEXT.panelLabel)) + el.entries.length * (cell + 16);
        if (width > 1280 - 32) fail("the counts panel is wider than the stage");
        break;
      }
      case "deque": {
        const cell = sizes.dequeCell(t);
        const row = elements.find((e) => e.id === el.rowId);
        const values = row?.type === "item-row" ? row.items.map((i) => String(i.value)) : [];
        for (const v of values)
          if (!t.fits(v, t.size(TEXT.countCell), cell - 8, "mono")) fail(`deque value ${v} overflows`);
        const cells = el.indices.length + (el.poppedBack?.length ?? 0) + (el.poppedFront?.length ?? 0);
        const width =
          t.width(el.label, t.size(TEXT.panelLabel)) +
          Math.max(1, cells) * (cell + 14) +
          32 +
          t.width(el.outputLabel, t.size(TEXT.panelLabel)) +
          14 +
          t.width(el.output.join(" ") || "—", t.size(TEXT.countCell), "mono");
        if (width > 1280 - 32) fail(`the deque panel is wider than the stage (${Math.round(width)})`);
        break;
      }
      case "search-range": {
        const layout = rows[el.rowId];
        const label = el.sorted ? "✓ sorted" : el.label;
        if (label && !t.fits(label, t.size(TEXT.windowLabel), 1280 - 16 - 28, "mono"))
          fail(`search label "${label}" doesn't fit the stage`);
        const captionBottom = 70 + 2 * Math.ceil(t.size(TEXT.caption) * 1.25);
        if (layout.top - sizes.window(t) < captionBottom) fail("search label runs into the caption");
        break;
      }
      case "number-line": {
        const values = Array.from({ length: el.max - el.min + 1 }, (_, k) => el.min + k);
        const cell = sizes.numberCell(t, values);
        for (const v of values)
          if (!t.fits(String(v), t.size(TEXT.countCell), cell - 8, "mono"))
            fail(`candidate ${v} is wider than its cell`);
        if (values.length * cell + (values.length - 1) * NUMBER_GAP > 1280 - 32)
          fail("the number line is wider than the stage");
        break;
      }
      case "cut": {
        const layout = rows[el.rowId];
        if (!layout) fail(`cut on unknown row "${el.rowId}"`);
        else if (layout.cardHeight < 2 * t.size(TEXT.itemValue))
          fail(`row "${el.rowId}" is too short to read under a cut (${Math.round(layout.cardHeight)}px)`);
        break;
      }
      case "linked-list": {
        const { list } = layoutScene(elements, t);
        if (!list) {
          fail("linked list has no layout");
          break;
        }
        const size = t.size(TEXT.listValue);
        for (const node of el.nodes)
          if (!node.dummy && !t.fits(String(node.value), size, list.nodeWidth - 8, "mono"))
            fail(`node value ${node.value} is wider than its box (${Math.round(list.nodeWidth)}px)`);
        if (list.nodeHeight < size + 8) fail(`nodes are too short for their values (${list.nodeHeight}px)`);
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
        for (const problem of treeProblems(elements, t, bottomTop)) fail(problem);
        break;
      case "heap":
        for (const problem of heapProblems(elements, t)) fail(problem);
        break;
      case "dp-table":
        for (const problem of dpProblems(elements, t)) fail(problem);
        break;
      case "stack":
        // Two stacks are checked together, once.
        if (elements.find((e) => e.type === "stack") === el)
          for (const problem of stackProblems(elements, t)) fail(problem);
        break;
      case "op-log":
        for (const problem of opLogProblems(elements, t)) fail(problem);
        break;
      case "hash-map": {
        const cell = (s: string) => t.width(s, t.size(TEXT.countCell), "mono") + 20;
        const width =
          t.width(el.label, t.size(TEXT.panelLabel)) +
          14 +
          (el.display === "rows"
            ? Math.max(
                0,
                ...el.entries.map((e) => cell(e.key) + (el.kind === "map" ? cell(e.value ?? "") + 60 : 0)),
              ) + 160
            : el.entries.reduce(
                (sum, e) => sum + cell(el.kind === "map" ? `${e.key}:${e.value ?? ""}` : e.key) + 10,
                0,
              ) + 120);
        if (width > 1280 - 24) fail(`the map is wider than the stage (${Math.round(width)}px)`);
        break;
      }
      case "race":
        for (const problem of raceProblems(elements, t)) fail(problem);
        break;
      case "trie":
        for (const problem of trieProblems(elements, t)) fail(problem);
        break;
      case "digraph":
        for (const problem of networkProblems(elements, t)) fail(problem);
        break;
      case "union-find":
        for (const problem of forestProblems(elements, t)) fail(problem);
        break;
      case "bits":
        for (const problem of bitsProblems(elements, t)) fail(problem);
        break;
      case "timeline":
        for (const problem of timelineProblems(elements, t)) fail(problem);
        break;
      case "prefix-row":
      case "prefix-grid":
        for (const problem of prefixProblems(elements, t)) fail(problem);
        break;
      case "choice":
      case "reach":
        for (const problem of greedyProblems(elements, t)) fail(problem);
        break;
      case "search-tree":
      case "partial":
        for (const problem of backtrackProblems(elements, t, el.type)) fail(problem);
        break;
      case "grid":
      case "graph":
      case "queue":
        for (const problem of searchProblems(elements, t, el.type)) fail(problem);
        break;
      case "system-diagram":
      case "sequence":
      case "data-table":
      case "metrics":
        for (const problem of systemProblems(elements, t, el.type)) fail(problem);
        break;
      case "heap-tree":
        for (const v of el.values)
          if (!t.fits(String(v), t.size(TEXT.heapNode), 96 - 12, "mono"))
            fail(`heap value ${v} is wider than its node`);
        break;
      default:
        break;
    }
  }
  // Rows start under a two-line caption (captions are at most 80 characters: two lines at 44px).
  const captionBottom = 70 + 2 * Math.ceil(t.size(TEXT.caption) * 1.25);
  for (const layout of Object.values(rows))
    if (layout.reservedTop < captionBottom) fail(`row "${layout.rowId}" starts under the caption`);
  // The bottom stack never climbs into the rows.
  for (const layout of Object.values(rows))
    if (Math.max(layout.top, ...(layout.tops ?? [])) + layout.cardHeight > bottomTop)
      fail(`row "${layout.rowId}" overlaps the bottom stack`);
  return problems;
}
