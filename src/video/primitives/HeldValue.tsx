import { useCurrentFrame, useVideoConfig } from "remotion";

import type { HeldValueElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { FONT_MONO, FONT_SANS } from "../theme";

const CARD_HEIGHT = 58;

/**
 * A value lifted out of the row (insertion sort's key), floating in the strip above its gap with a dashed line
 * down to the empty slot. The layout reserves that strip whenever a scene has a held value.
 */
export function HeldValue({ element }: { element: HeldValueElement }) {
  const { rows, palette, reducedMotion } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = rows[element.rowId];
  if (!layout) return null;

  const p = enterProgress(frame, fps, reducedMotion);
  const width = Math.max(layout.cardWidth, 88);
  const left = layout.centers[element.index] - width / 2;
  const top = layout.reservedTop + 2;

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: layout.centers[element.index] - 1,
          top: top + CARD_HEIGHT,
          height: layout.top + layout.cardHeight - 40 - (top + CARD_HEIGHT),
          borderLeft: `2px dashed ${palette.primary}`,
          opacity: p,
        }}
      />
      <div
        style={{
          position: "absolute",
          left,
          width,
          top,
          height: CARD_HEIGHT,
          borderRadius: 12,
          border: `3px solid ${palette.primary}`,
          background: palette.surface,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1.05,
          opacity: p,
          transform: `translateY(${motion((1 - p) * 16, reducedMotion)}px)`,
          boxShadow: `0 6px 16px ${palette.text}22`,
        }}
      >
        <span style={{ fontFamily: FONT_MONO, fontSize: 26, fontWeight: 700, color: palette.text }}>
          {element.value}
        </span>
        <span style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 700, color: palette.primary }}>
          ↑ {element.label}
        </span>
      </div>
    </>
  );
}
