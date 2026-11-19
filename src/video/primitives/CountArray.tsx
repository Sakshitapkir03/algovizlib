import { useCurrentFrame, useVideoConfig } from "remotion";

import type { CountArrayElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { firstFitting } from "../labels";
import { CANVAS, sizes } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

const CELL_WIDTH = 64;
const GAP = 8;

/**
 * A tally panel: one cell per key with its count, the key written above. The cell that just changed gets a thick
 * accent border and a "▲" marker under it, so it never depends on color alone. The layout shortens the bars
 * whenever a scene has a count-array, leaving room for this panel under the pointers.
 */
export function CountArray({ element }: { element: CountArrayElement }) {
  const { palette, reducedMotion, rows, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterProgress(frame, fps, reducedMotion);
  const n = element.keys.length;
  const total = n * CELL_WIDTH + (n - 1) * GAP;
  const start = (CANVAS.width - total) / 2;
  // The panel sits under the (single) bar-row's pointers; the layout reserved its height.
  const panelTop = Object.values(rows)[0]?.panelTop ?? 416;
  const keySize = text.size(TEXT.countKey);
  const cellSize = text.size(TEXT.countCell);
  const cellHeight = sizes.cell(text);
  const cellTop = panelTop + sizes.countKeys(text);
  const label = firstFitting([element.label], text.size(TEXT.panelLabel), start - 18 - 16, text);

  return (
    <div style={{ opacity: p }}>
      <div
        style={{
          display: label ? undefined : "none",
          position: "absolute",
          right: CANVAS.width - start + 18,
          top: cellTop + (cellHeight - text.size(TEXT.panelLabel)) / 2,
          fontFamily: FONT_SANS,
          fontSize: text.size(TEXT.panelLabel),
          fontWeight: 700,
          color: palette.textMuted,
          whiteSpace: "nowrap",
        }}
      >
        {element.label}
      </div>
      {element.keys.map((key, k) => {
        const left = start + k * (CELL_WIDTH + GAP);
        const active = element.active === k;
        return (
          <div key={k}>
            <div
              style={{
                position: "absolute",
                left,
                width: CELL_WIDTH,
                top: panelTop,
                textAlign: "center",
                fontFamily: FONT_MONO,
                fontSize: keySize,
                lineHeight: 1,
                color: active ? palette.text : palette.textMuted,
                fontWeight: active ? 700 : 400,
              }}
            >
              {key}
            </div>
            <div
              style={{
                position: "absolute",
                left,
                width: CELL_WIDTH,
                top: cellTop,
                height: cellHeight,
                borderRadius: 8,
                border: active ? `3px solid ${palette.primary}` : `2px solid ${palette.border}`,
                background: active ? `${palette.primary}1f` : palette.surface,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_MONO,
                fontSize: cellSize,
                fontWeight: 700,
                color: element.counts[k] === 0 ? palette.textMuted : palette.text,
              }}
            >
              {element.counts[k]}
            </div>
            {active && !text.compact ? (
              <div
                style={{
                  position: "absolute",
                  left,
                  width: CELL_WIDTH,
                  top: cellTop + cellHeight + 2,
                  textAlign: "center",
                  fontSize: text.size(TEXT.marker),
                  lineHeight: 1,
                  color: palette.primary,
                }}
              >
                ▲
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
