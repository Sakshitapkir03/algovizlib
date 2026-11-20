import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { WindowElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS, sizes, type RowLayout } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO } from "../theme";

const TICK = 12;
const STROKE = 4;
const PAD = 6;

/** Left and right x of a window's bracket. An empty window collapses to a point just before `from`. */
function edges(layout: RowLayout, range: { from: number; to: number }): [number, number] {
  const n = layout.lefts.length;
  if (range.to < range.from) {
    const x = range.from < n ? layout.lefts[range.from] - 8 : layout.lefts[n - 1] + layout.cardWidth + 8;
    return [x, x];
  }
  return [layout.lefts[range.from] - PAD, layout.lefts[range.to] + layout.cardWidth + PAD];
}

/**
 * The sliding window: a thick bracket above the cards it covers, a faint band behind them, and a label pill above
 * the bracket ("sum 13"; none while the step gives no value). When the scene follows another bound scene, each edge slides from where it was, so the
 * window visibly grows on the right and shrinks on the left. The bracket's shape carries the meaning; the label is
 * dropped only if even the value alone can't fit the stage.
 */
export function Window({ element }: { element: WindowElement }) {
  const { rows, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = rows[element.rowId];
  if (!layout) return null;

  const [toLeft, toRight] = edges(layout, element);
  const [fromLeft, fromRight] = element.fromRange ? edges(layout, element.fromRange) : [toLeft, toRight];
  const travel = reducedMotion
    ? 1
    : spring({ frame: frame - 4, fps, config: { damping: 20, stiffness: 90, mass: 0.8 } });
  const left = interpolate(travel, [0, 1], [fromLeft, toLeft]);
  const right = interpolate(travel, [0, 1], [fromRight, toRight]);
  const opacity = element.fromRange ? 1 : enterProgress(frame, fps, reducedMotion);

  const labelSize = text.size(TEXT.windowLabel);
  const bracketTop = layout.top - sizes.tagRoom(text) - TICK - 4;
  const value = element.value === undefined ? undefined : String(element.value);
  // No value yet (e.g. a window that isn't full): the bracket alone.
  const candidates = value === undefined ? [] : [[element.label, value].filter(Boolean).join(" "), value];
  const label = candidates.find((c) => text.width(c, labelSize, "mono") + 28 <= CANVAS.width - 16);
  const labelWidth = label ? text.width(label, labelSize, "mono") + 28 : 0;
  const center = Math.min(
    CANVAS.width - 8 - labelWidth / 2,
    Math.max(8 + labelWidth / 2, (left + right) / 2),
  );

  return (
    <div style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: left - 2,
          width: Math.max(0, right - left + 4),
          top: bracketTop,
          height: layout.top + layout.cardHeight + 8 - bracketTop,
          borderRadius: 12,
          background: `${palette.primary}14`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left,
          width: Math.max(STROKE, right - left),
          top: bracketTop,
          height: TICK,
          borderTop: `${STROKE}px solid ${palette.primary}`,
          borderLeft: `${STROKE}px solid ${palette.primary}`,
          borderRight: `${STROKE}px solid ${palette.primary}`,
          borderRadius: "4px 4px 0 0",
        }}
      />
      {label ? (
        <div
          style={{
            position: "absolute",
            left: center,
            top: bracketTop - labelSize - 14 - 6,
            transform: "translateX(-50%)",
            padding: "5px 14px",
            borderRadius: 999,
            border: `2px solid ${palette.primary}`,
            background: palette.surface,
            color: palette.text,
            fontFamily: FONT_MONO,
            fontSize: labelSize,
            fontWeight: 700,
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
}
