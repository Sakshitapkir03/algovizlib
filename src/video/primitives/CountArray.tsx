import { useCurrentFrame, useVideoConfig } from "remotion";

import type { CountArrayElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS, COUNT_PANEL_TOP } from "../layout";
import { FONT_MONO, FONT_SANS } from "../theme";

const CELL_WIDTH = 64;
const CELL_HEIGHT = 44;
const GAP = 8;

/**
 * A tally panel: one cell per key with its count, the key written above. The cell that just changed gets a thick
 * accent border and a "▲" marker under it, so it never depends on color alone. The layout shortens the bars
 * whenever a scene has a count-array, leaving room for this panel under the pointers.
 */
export function CountArray({ element }: { element: CountArrayElement }) {
  const { palette, reducedMotion } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterProgress(frame, fps, reducedMotion);
  const n = element.keys.length;
  const total = n * CELL_WIDTH + (n - 1) * GAP;
  const start = (CANVAS.width - total) / 2;
  const cellTop = COUNT_PANEL_TOP + 22;

  return (
    <div style={{ opacity: p }}>
      <div
        style={{
          position: "absolute",
          right: CANVAS.width - start + 18,
          top: cellTop + 8,
          fontFamily: FONT_SANS,
          fontSize: 18,
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
                top: COUNT_PANEL_TOP,
                textAlign: "center",
                fontFamily: FONT_MONO,
                fontSize: 15,
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
                height: CELL_HEIGHT,
                borderRadius: 8,
                border: active ? `3px solid ${palette.primary}` : `2px solid ${palette.border}`,
                background: active ? `${palette.primary}1f` : palette.surface,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_MONO,
                fontSize: 24,
                fontWeight: 700,
                color: element.counts[k] === 0 ? palette.textMuted : palette.text,
              }}
            >
              {element.counts[k]}
            </div>
            {active ? (
              <div
                style={{
                  position: "absolute",
                  left,
                  width: CELL_WIDTH,
                  top: cellTop + CELL_HEIGHT + 2,
                  textAlign: "center",
                  fontSize: 14,
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
