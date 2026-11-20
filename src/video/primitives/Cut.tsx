import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { CutElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CUT_OVERHANG, type RowLayout } from "../layout";

const STROKE = 6;

/** x of a cut with `at` values on its left: in the gap before card `at` (or past either end). */
function cutX(layout: RowLayout, at: number): number {
  const n = layout.lefts.length;
  if (at <= 0) return layout.lefts[0] - 10;
  if (at >= n) return layout.lefts[n - 1] + layout.cardWidth + 10;
  return (layout.lefts[at - 1] + layout.cardWidth + layout.lefts[at]) / 2;
}

/**
 * A partition cut through a row of cards: a thick divider that reaches past the cards, with the left side shaded.
 * It slides from where the previous bound scene left it. No text: the divider's position and the shading carry it.
 */
export function Cut({ element }: { element: CutElement }) {
  const { rows, palette, reducedMotion } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = rows[element.rowId];
  if (!layout) return null;

  const to = cutX(layout, element.at);
  const from = cutX(layout, element.fromAt ?? element.at);
  const travel = reducedMotion
    ? 1
    : spring({ frame: frame - 4, fps, config: { damping: 20, stiffness: 90, mass: 0.8 } });
  const x = interpolate(travel, [0, 1], [from, to]);
  const opacity = element.fromAt === undefined ? enterProgress(frame, fps, reducedMotion) : 1;
  const start = layout.lefts[0] - 6;

  return (
    <div style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: start,
          width: Math.max(0, x - start - STROKE / 2),
          top: layout.top - 4,
          height: layout.cardHeight + 8,
          borderRadius: 14,
          background: `${palette.primary}26`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x - STROKE / 2,
          width: STROKE,
          top: layout.top - CUT_OVERHANG,
          height: layout.cardHeight + 2 * CUT_OVERHANG,
          borderRadius: 3,
          background: palette.primary,
        }}
      />
    </div>
  );
}
