import { useCurrentFrame, useVideoConfig } from "remotion";

import type { SortedRegionElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { CANVAS } from "../layout";
import { FONT_SANS } from "../theme";

/**
 * Positions already in their final order: a shaded band behind those bars with a solid baseline segment, and a
 * "✓ sorted" label beside the row on the side the region touches (left for a sorted prefix, right otherwise), so
 * it never collides with pointers or highlights. Glyph + word, never color alone.
 */
export function SortedRegion({ element }: { element: SortedRegionElement }) {
  const { rows, palette, reducedMotion } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = rows[element.rowId];
  if (!layout) return null;

  const p = enterProgress(frame, fps, reducedMotion);
  const n = layout.lefts.length;
  const left = layout.lefts[element.from] - 8;
  const right = layout.lefts[element.to] + layout.cardWidth + 8;
  const baseline = layout.top + layout.cardHeight;
  const onLeft = element.from === 0 && element.to < n - 1;

  return (
    <>
      <div
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
      <div
        style={{
          position: "absolute",
          top: baseline - 44,
          ...(onLeft
            ? { right: CANVAS.width - (layout.lefts[0] - 20) }
            : { left: layout.lefts[n - 1] + layout.cardWidth + 20 }),
          padding: "6px 14px",
          borderRadius: 999,
          border: `2px solid ${palette.success}`,
          background: palette.surface,
          color: palette.success,
          fontFamily: FONT_SANS,
          fontSize: 18,
          fontWeight: 700,
          whiteSpace: "nowrap",
          opacity: p,
          transform: `translateX(${motion((1 - p) * (onLeft ? 10 : -10), reducedMotion)}px)`,
        }}
      >
        ✓ {element.label}
      </div>
    </>
  );
}
