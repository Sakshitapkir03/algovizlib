import { useCurrentFrame, useVideoConfig } from "remotion";

import type { HeldValueElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { sizes } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * A value lifted out of the row (insertion sort's key), floating in the strip above its gap with a dashed line
 * down to the empty slot. The layout reserves that strip whenever a scene has a held value.
 */
export function HeldValue({ element }: { element: HeldValueElement }) {
  const { rows, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = rows[element.rowId];
  if (!layout) return null;

  const p = enterProgress(frame, fps, reducedMotion);
  const CARD_HEIGHT = sizes.heldCard(text);
  const valueSize = text.size(TEXT.heldValue);
  const width = Math.max(
    layout.cardWidth,
    88,
    text.width(String(element.value), valueSize, "mono") + 24,
    text.compact ? 0 : text.width(`↑ ${element.label}`, text.size(TEXT.heldLabel)) + 20,
  );
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
        <span style={{ fontFamily: FONT_MONO, fontSize: valueSize, fontWeight: 700, color: palette.text }}>
          {element.value}
        </span>
        {text.compact ? null : (
          <span
            style={{
              fontFamily: FONT_SANS,
              fontSize: text.size(TEXT.heldLabel),
              fontWeight: 700,
              color: palette.primary,
            }}
          >
            ↑ {element.label}
          </span>
        )}
      </div>
    </>
  );
}
