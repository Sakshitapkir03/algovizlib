import { useCurrentFrame, useVideoConfig } from "remotion";

import type { NumberLineElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { NUMBER_GAP, sizes } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * Binary search on the answer: one cell per candidate. Candidates below `low` are ruled out (dashed, struck
 * through, ✕ above), candidates from `high` up are known to work (solid green border, ✓ above), the rest are still
 * possible (plain), and the candidate just tested has a thick accent border and "▲ mid" under it. Border style and
 * glyphs carry each state, never color alone. The label is dropped if the cells need the whole width.
 */
export function NumberLine({ element }: { element: NumberLineElement }) {
  const { palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterProgress(frame, fps, reducedMotion);
  const values = Array.from({ length: element.max - element.min + 1 }, (_, k) => element.min + k);
  const keySize = text.size(TEXT.countKey);
  const cellHeight = sizes.cell(text);
  const cellWidth = sizes.numberCell(text, values);
  const labelSize = text.size(TEXT.panelLabel);
  const cellsWidth = values.length * cellWidth + (values.length - 1) * NUMBER_GAP;
  const showLabel = cellsWidth + 16 + text.width(element.label, labelSize) <= 1280 - 32;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        opacity: p,
        transform: `translateY(${motion((1 - p) * 10, reducedMotion)}px)`,
      }}
    >
      {showLabel ? (
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: labelSize,
            fontWeight: 700,
            color: palette.textMuted,
            height: cellHeight,
            // Line up with the cells: skip the glyph row above them and the marker row below.
            marginTop: keySize + 4,
            marginBottom: text.compact ? 0 : sizes.marker(text),
            display: "flex",
            alignItems: "center",
            whiteSpace: "nowrap",
          }}
        >
          {element.label}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: NUMBER_GAP }}>
        {values.map((v) => {
          const out = v < element.low;
          const works = v >= element.high;
          const mid = v === element.mid;
          return (
            <div key={v} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  fontSize: keySize,
                  lineHeight: 1,
                  fontWeight: 700,
                  color: works ? palette.success : palette.textMuted,
                  visibility: out || works ? "visible" : "hidden",
                }}
              >
                {works ? "✓" : "✕"}
              </div>
              <div
                style={{
                  width: cellWidth,
                  height: cellHeight,
                  boxSizing: "border-box",
                  borderRadius: 8,
                  border: mid
                    ? `4px solid ${palette.primary}`
                    : out
                      ? `2px dashed ${palette.textMuted}`
                      : `2px solid ${works ? palette.success : palette.border}`,
                  background: mid ? `${palette.primary}1f` : works ? `${palette.success}1a` : palette.surface,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT_MONO,
                  fontSize: text.size(TEXT.countCell),
                  fontWeight: 700,
                  color: out ? palette.textMuted : palette.text,
                  textDecoration: out ? "line-through" : undefined,
                }}
              >
                {v}
              </div>
              {!text.compact ? (
                <div
                  style={{
                    height: sizes.marker(text) - 4,
                    fontSize: text.size(TEXT.marker),
                    lineHeight: 1,
                    color: palette.primary,
                    whiteSpace: "nowrap",
                    visibility: mid ? "visible" : "hidden",
                  }}
                >
                  ▲ mid
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
