import { useCurrentFrame, useVideoConfig } from "remotion";

import type { MergeBufferElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { firstFitting } from "../labels";
import { CANVAS, sizes } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * A merge in progress: one slot per position of the range being merged, lined up under those bars, filling left
 * to right as values are taken from the fronts of the two halves. Unwritten slots are dashed; the slot written by
 * this step drops in with a thick accent border and a "▲ new" marker, so it never depends on color alone.
 */
export function MergeBuffer({ element }: { element: MergeBufferElement }) {
  const { rows, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = rows[element.rowId];
  if (!layout) return null;

  const p = enterProgress(frame, fps, reducedMotion);
  const drop = enterProgress(frame, fps, reducedMotion, 12);
  const top = layout.panelTop;
  const CELL_HEIGHT = sizes.cell(text);
  const labelSize = text.size(TEXT.panelLabel);
  const label = firstFitting([element.label], labelSize, layout.lefts[element.from] - 18 - 16, text);

  return (
    <div style={{ opacity: p }}>
      <div
        style={{
          display: label ? undefined : "none",
          position: "absolute",
          right: CANVAS.width - (layout.lefts[element.from] - 18),
          top: top + (CELL_HEIGHT - labelSize) / 2,
          fontFamily: FONT_SANS,
          fontSize: labelSize,
          fontWeight: 700,
          color: palette.textMuted,
          whiteSpace: "nowrap",
        }}
      >
        {element.label}
      </div>
      {element.values.map((value, k) => {
        const left = layout.lefts[element.from + k];
        const isNew = element.taken === k;
        const filled = value !== null;
        return (
          <div key={k}>
            <div
              style={{
                position: "absolute",
                left,
                width: layout.cardWidth,
                top,
                height: CELL_HEIGHT,
                borderRadius: 8,
                border: isNew
                  ? `3px solid ${palette.primary}`
                  : filled
                    ? `2px solid ${palette.textMuted}`
                    : `2px dashed ${palette.border}`,
                background: isNew ? `${palette.primary}1f` : filled ? palette.surface : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_MONO,
                fontSize: text.size(TEXT.countCell),
                fontWeight: 700,
                color: palette.text,
                opacity: isNew ? drop : 1,
                transform: isNew ? `translateY(${motion((1 - drop) * -30, reducedMotion)}px)` : undefined,
              }}
            >
              {filled ? value : ""}
            </div>
            {isNew && !text.compact ? (
              <div
                style={{
                  position: "absolute",
                  left: left - 20,
                  width: layout.cardWidth + 40,
                  top: top + CELL_HEIGHT + 2,
                  textAlign: "center",
                  fontFamily: FONT_SANS,
                  fontSize: text.size(TEXT.marker),
                  fontWeight: 700,
                  lineHeight: 1,
                  color: palette.primary,
                  opacity: drop,
                }}
              >
                ▲ new
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
