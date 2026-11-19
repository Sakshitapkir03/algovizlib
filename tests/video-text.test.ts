import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { storyboards } from "@/content/storyboards";
import { primitiveRegistry } from "@/video/primitives/registry";
import { PILL_PADDING, pointerLabel } from "@/video/labels";
import { layoutScene, sizes } from "@/video/layout";
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
        "callout",
        "count-array",
        "counter",
        "equation",
        "heap-tree",
        "held-value",
        "highlight",
        "item-row",
        "merge-buffer",
        "partition",
        "pointer",
        "result",
        "segments",
        "sorted-region",
        "split-tree",
      ].sort(),
    );
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
              if (other === el || other.rowId !== el.rowId || other.placement !== el.placement) continue;
              const otherLabel = pointerLabel(other, layout, phone, pointers);
              const otherHalf = (phone.width(otherLabel, phone.size(TEXT.pointer)) + PILL_PADDING) / 2;
              const gap = Math.abs(layout.centers[other.index] - x) - half - otherHalf;
              if (gap < 0 && label.length > 1) fail(`pointer "${label}" overlaps "${otherLabel}"`);
            }
            if (el.placement === "below" && layout.pointerTop + sizes.pointer(phone) > bottomTop + 2)
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
        if (layout.top + layout.cardHeight > bottomTop)
          fail(`row "${layout.rowId}" overlaps the bottom stack`);
      expect(problems).toEqual([]);
    });
  });
});
