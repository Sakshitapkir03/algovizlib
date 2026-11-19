import { useCurrentFrame, useVideoConfig } from "remotion";

import type { HighlightElement, HighlightState } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import type { VideoPalette } from "../theme";
import { TEXT } from "../text";
import { FONT_SANS } from "../theme";

/**
 * Every state has a glyph + word, so state never depends on color alone. On a phone-sized player the tag is
 * dropped and the border style alone carries the state: solid (active), dashed over hatching (rejected), or double
 * (found).
 */
const STATE_STYLE: Record<
  HighlightState,
  { glyph: string; word: string; color: (p: VideoPalette) => string }
> = {
  active: { glyph: "●", word: "Checking", color: (p) => p.active },
  rejected: { glyph: "✕", word: "Ruled out", color: (p) => p.textMuted },
  found: { glyph: "✓", word: "Match", color: (p) => p.success },
};

export function Highlight({ element }: { element: HighlightElement }) {
  const { rows, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = rows[element.rowId];
  if (!layout) return null;

  const p = enterProgress(frame, fps, reducedMotion);
  const style = STATE_STYLE[element.state];
  const color = style.color(palette);
  // On narrow cards (the heap scenes' bars) neighboring tags would overlap: spell the word on the first card only
  // and give the rest the glyph, so every card still carries a glyph and the state is named once.
  const tagSize = text.size(TEXT.tag);
  const tagWidth = text.width(`${style.glyph} ${style.word}`, tagSize) + 20;
  const crowded = element.indices.some(
    (idx, k) => k > 0 && Math.abs(layout.centers[idx] - layout.centers[element.indices[k - 1]]) < tagWidth,
  );
  // Neighboring tags can't even fit one word between them (the heap scenes' narrow bars): glyphs only, and the
  // solid border carries the state as on a phone.
  const glyphWidth = text.width(style.glyph, tagSize) + 20;
  const spacing = layout.centers.length > 1 ? layout.centers[1] - layout.centers[0] : Infinity;
  const squeezed = tagWidth / 2 + glyphWidth / 2 + 4 > spacing;
  const border =
    element.state === "rejected"
      ? `2px dashed ${color}`
      : element.state === "found" && text.compact
        ? `7px double ${color}`
        : `4px solid ${color}`;

  return (
    <>
      {element.indices.map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: layout.lefts[i] - 4,
            top: layout.top - 4,
            width: layout.cardWidth + 8,
            height: layout.cardHeight + 8,
            borderRadius: 19,
            border,
            background:
              element.state === "rejected"
                ? `repeating-linear-gradient(135deg, ${palette.background}cc 0 10px, ${palette.background}99 10px 20px)`
                : element.state === "found"
                  ? `${palette.success}1f`
                  : "transparent",
            opacity: p,
            transform: `scale(${1 + motion((1 - p) * 0.06, reducedMotion)})`,
          }}
        >
          <div
            style={{
              display: text.compact ? "none" : undefined,
              position: "absolute",
              top: -tagSize,
              // Centered on the card, but kept on the stage (narrow heap bars sit near the left edge).
              left: (layout.cardWidth + 8) / 2,
              transform: `translateX(calc(-50% + ${Math.max(0, tagWidth / 2 + 4 - layout.centers[i])}px))`,
              padding: "2px 10px",
              borderRadius: 999,
              background: element.state === "rejected" ? palette.surfaceMuted : color,
              color: element.state === "rejected" ? palette.text : palette.background,
              border: element.state === "rejected" ? `1px solid ${palette.border}` : "none",
              fontFamily: FONT_SANS,
              fontSize: tagSize,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {crowded && (squeezed || i !== element.indices[0]) ? style.glyph : `${style.glyph} ${style.word}`}
          </div>
        </div>
      ))}
    </>
  );
}
