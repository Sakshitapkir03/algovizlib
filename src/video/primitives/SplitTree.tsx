import { useCurrentFrame, useVideoConfig } from "remotion";

import type { SplitTreeElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { CANVAS, sizes, SPLIT_ROW_GAP } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

const GROUP_GAP = 14;
const LEVEL_STAGGER = 10;

/**
 * The whole divide pattern at a glance: one line per recursion level, from the full array down to single values,
 * each group a bracketed box of its values. Every value keeps one column on every level, so each box sits right
 * above the boxes it splits into and the halving reads top to bottom. Levels appear one after another; the picture
 * itself is static.
 */
export function SplitTree({ element }: { element: SplitTreeElement }) {
  const { palette, reducedMotion, text } = useScene();
  const CELL = sizes.splitCell(text);
  const ROW_HEIGHT = sizes.splitRow(text);
  const ROW_GAP = SPLIT_ROW_GAP;
  const labelSize = text.size(TEXT.splitLabel);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const deepest = element.levels.length - 1;
  const count = element.levels[0].flat().length;
  const column = (v: number) => v * (CELL + GROUP_GAP);
  const width = column(count - 1) + CELL;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
      <div
        style={{
          // The label sits left of the tree; drop it when the tree is too wide to leave room.
          display: text.fits(element.label, labelSize, (CANVAS.width - width) / 2 - 18 - 16)
            ? undefined
            : "none",
          fontFamily: FONT_SANS,
          fontSize: labelSize,
          fontWeight: 700,
          color: palette.textMuted,
          paddingTop: 7,
          opacity: enterProgress(frame, fps, reducedMotion),
        }}
      >
        {element.label}
      </div>
      <div
        style={{
          position: "relative",
          width,
          height: element.levels.length * (ROW_HEIGHT + ROW_GAP) - ROW_GAP,
        }}
      >
        {element.levels.map((level, d) => {
          const p = enterProgress(frame, fps, reducedMotion, d * LEVEL_STAGGER);
          let first = 0;
          return level.map((group, g) => {
            const start = first;
            first += group.length;
            const single = group.length === 1;
            return (
              <div
                key={`${d}-${g}`}
                style={{
                  position: "absolute",
                  left: column(start),
                  top: d * (ROW_HEIGHT + ROW_GAP),
                  width: column(start + group.length - 1) + CELL - column(start),
                  height: ROW_HEIGHT,
                  borderRadius: 6,
                  border: `2px solid ${d === deepest || single ? palette.textMuted : palette.border}`,
                  background: single ? palette.surfaceMuted : palette.surface,
                  opacity: p,
                  transform: `translateY(${motion((1 - p) * -8, reducedMotion)}px)`,
                }}
              >
                {group.map((v, k) => (
                  <span
                    key={k}
                    style={{
                      position: "absolute",
                      left: column(start + k) - column(start) - 2,
                      width: CELL,
                      textAlign: "center",
                      lineHeight: `${ROW_HEIGHT - 4}px`,
                      fontFamily: FONT_MONO,
                      fontSize: text.size(TEXT.splitValue),
                      fontWeight: 700,
                      color: palette.text,
                    }}
                  >
                    {v}
                  </span>
                ))}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}
