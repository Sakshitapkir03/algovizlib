import { useCurrentFrame, useVideoConfig } from "remotion";

import type { HighlightElement, HighlightState } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import type { VideoPalette } from "../theme";
import { FONT_SANS } from "../theme";

/** Every state has a glyph + word, so state never depends on color alone. */
const STATE_STYLE: Record<
  HighlightState,
  { glyph: string; word: string; color: (p: VideoPalette) => string }
> = {
  active: { glyph: "●", word: "Checking", color: (p) => p.active },
  rejected: { glyph: "✕", word: "Ruled out", color: (p) => p.textMuted },
  found: { glyph: "✓", word: "Match", color: (p) => p.success },
};

export function Highlight({ element }: { element: HighlightElement }) {
  const { rows, palette, reducedMotion } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = rows[element.rowId];
  if (!layout) return null;

  const p = enterProgress(frame, fps, reducedMotion);
  const style = STATE_STYLE[element.state];
  const color = style.color(palette);

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
            border: `${element.state === "rejected" ? 2 : 4}px ${element.state === "rejected" ? "dashed" : "solid"} ${color}`,
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
              position: "absolute",
              top: -14,
              left: "50%",
              transform: "translateX(-50%)",
              padding: "2px 10px",
              borderRadius: 999,
              background: element.state === "rejected" ? palette.surfaceMuted : color,
              color: element.state === "rejected" ? palette.text : palette.background,
              border: element.state === "rejected" ? `1px solid ${palette.border}` : "none",
              fontFamily: FONT_SANS,
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {style.glyph} {style.word}
          </div>
        </div>
      ))}
    </>
  );
}
