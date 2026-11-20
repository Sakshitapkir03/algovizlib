import { useCurrentFrame, useVideoConfig } from "remotion";

import type { FreqTableElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { sizes } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * Character counts in the window: one cell per letter with its count ("2"), or have/need for a target ("1/1",
 * with a ✓ once it's met). The letter that just changed gets a thick accent border and a ▲ under it; a met need
 * gets a ✓. Shape and glyphs carry the state, never color alone.
 */
export function FreqTable({ element }: { element: FreqTableElement }) {
  const { palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterProgress(frame, fps, reducedMotion);
  const keySize = text.size(TEXT.countKey);
  const cellSize = text.size(TEXT.countCell);
  const cellHeight = sizes.cell(text);
  const cellWidth = sizes.freqCell(text, element.entries);

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
      <div
        style={{
          fontFamily: FONT_SANS,
          fontSize: text.size(TEXT.panelLabel),
          fontWeight: 700,
          color: palette.textMuted,
          height: cellHeight,
          // Line up with the cells: skip the key row above them and the ▲ row below.
          marginTop: keySize + 4,
          marginBottom: text.compact ? 0 : sizes.marker(text),
          display: "flex",
          alignItems: "center",
          whiteSpace: "nowrap",
        }}
      >
        {element.label}
      </div>
      {element.entries.map((entry) => {
        const active = element.active === entry.key;
        const met = entry.need !== undefined && entry.count >= entry.need;
        return (
          <div
            key={entry.key}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
          >
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: keySize,
                lineHeight: 1,
                color: active ? palette.text : palette.textMuted,
                fontWeight: active ? 700 : 400,
                whiteSpace: "nowrap",
              }}
            >
              {entry.key}
              {met ? " ✓" : ""}
            </div>
            <div
              style={{
                width: cellWidth,
                height: cellHeight,
                boxSizing: "border-box",
                borderRadius: 8,
                border: active
                  ? `4px solid ${palette.primary}`
                  : `2px solid ${met ? palette.success : palette.border}`,
                background: active ? `${palette.primary}1f` : palette.surface,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_MONO,
                fontSize: cellSize,
                fontWeight: 700,
                color: entry.count === 0 ? palette.textMuted : palette.text,
              }}
            >
              {entry.need !== undefined ? `${entry.count}/${entry.need}` : entry.count}
            </div>
            {!text.compact ? (
              <div
                style={{
                  height: sizes.marker(text) - 4,
                  fontSize: text.size(TEXT.marker),
                  lineHeight: 1,
                  color: palette.primary,
                  visibility: active ? "visible" : "hidden",
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
