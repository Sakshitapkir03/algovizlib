import { useCurrentFrame, useVideoConfig } from "remotion";

import type { SortedRegionElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { firstFitting } from "../labels";
import { CANVAS } from "../layout";
import { TEXT } from "../text";
import { FONT_SANS } from "../theme";

/** Consecutive positions grouped into runs, e.g. [0, 1, 4] → [[0, 1], [4, 4]]. */
export function runsOf(indices: readonly number[]): [number, number][] {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const i of sorted) {
    const last = runs.at(-1);
    if (last && i === last[1] + 1) last[1] = i;
    else runs.push([i, i]);
  }
  return runs;
}

/**
 * Positions already in their final order: a shaded band behind each run of those bars with a solid baseline
 * segment, and one "✓ sorted" label beside the row, on the left for a sorted prefix and on the right otherwise, so
 * it never collides with pointers or highlights. Scattered positions (quick sort's placed pivots) get one band each.
 * Glyph + word, never color alone; when the word doesn't fit beside the row, the glyph stays.
 */
export function SortedRegion({ element }: { element: SortedRegionElement }) {
  const { rows, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = rows[element.rowId];
  if (!layout) return null;

  const p = enterProgress(frame, fps, reducedMotion);
  const n = layout.lefts.length;
  const runs = runsOf(element.indices);
  const baseline = layout.top + layout.cardHeight;
  const onLeft = runs[0][0] === 0 && runs.at(-1)![1] < n - 1;
  const size = text.size(TEXT.regionLabel);
  const room = onLeft
    ? layout.lefts[0] - 20 - 16
    : layout.rightLimit - (layout.lefts[n - 1] + layout.cardWidth + 20);
  const label = firstFitting([`✓ ${element.label}`, "✓"], size, room - 32, text) ?? "✓";

  return (
    <>
      {runs.map(([from, to]) => {
        const left = layout.lefts[from] - 8;
        const right = layout.lefts[to] + layout.cardWidth + 8;
        return (
          <div
            key={from}
            style={{
              position: "absolute",
              left,
              width: right - left,
              top: layout.top - 4,
              height: layout.cardHeight + 4,
              borderRadius: "10px 10px 0 0",
              background: `${palette.success}14`,
              borderBottom: `6px solid ${palette.success}`,
              opacity: p,
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          top: baseline - size - 26,
          ...(onLeft
            ? { right: CANVAS.width - (layout.lefts[0] - 20) }
            : { left: layout.lefts[n - 1] + layout.cardWidth + 20 }),
          padding: "6px 14px",
          borderRadius: 999,
          border: `2px solid ${palette.success}`,
          background: palette.surface,
          color: palette.success,
          fontFamily: FONT_SANS,
          fontSize: size,
          fontWeight: 700,
          whiteSpace: "nowrap",
          opacity: p,
          transform: `translateX(${motion((1 - p) * (onLeft ? 10 : -10), reducedMotion)}px)`,
        }}
      >
        {label}
      </div>
    </>
  );
}
