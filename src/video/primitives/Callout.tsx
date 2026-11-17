import { useCurrentFrame, useVideoConfig } from "remotion";

import type { CalloutElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { CANVAS } from "../layout";
import { FONT_SANS } from "../theme";

const MAX_WIDTH = 360;
const FLOATING_TOP = 158;
const EDGE = 24;

export function Callout({ element }: { element: CalloutElement }) {
  const { rows, palette, reducedMotion } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterProgress(frame, fps, reducedMotion);

  const layout = element.anchor ? rows[element.anchor.rowId] : undefined;
  const anchorX = layout && element.anchor ? layout.centers[element.anchor.index] : CANVAS.width / 2;
  // Keep the bubble on-canvas; the tail still points at the anchor.
  const left = Math.min(Math.max(anchorX - MAX_WIDTH / 2, EDGE), CANVAS.width - MAX_WIDTH - EDGE);
  const anchored = layout !== undefined;

  const bubble = (
    <div
      style={{
        background: palette.surface,
        border: `2px solid ${palette.border}`,
        borderRadius: 18,
        padding: "12px 18px",
        color: palette.text,
        fontFamily: FONT_SANS,
        fontSize: 21,
        fontWeight: 500,
        lineHeight: 1.3,
        textAlign: "center",
        boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
      }}
    >
      {element.speaker ? (
        <div style={{ fontSize: 14, fontWeight: 700, color: palette.textMuted, marginBottom: 2 }}>
          {element.speaker}
        </div>
      ) : null}
      {element.text}
    </div>
  );

  if (!anchored) {
    return (
      <div
        style={{
          position: "absolute",
          top: FLOATING_TOP,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: p,
          transform: `translateY(${motion((1 - p) * 10, reducedMotion)}px)`,
        }}
      >
        <div style={{ maxWidth: 760 }}>{bubble}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        left,
        width: MAX_WIDTH,
        bottom: CANVAS.height - (layout.top - 26),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: p,
        transform: `translateY(${motion((1 - p) * 10, reducedMotion)}px) scale(${1 - motion((1 - p) * 0.05, reducedMotion)})`,
        transformOrigin: `${anchorX - left}px 100%`,
      }}
    >
      {bubble}
      {/* tail */}
      <div
        style={{
          alignSelf: "flex-start",
          marginLeft: anchorX - left - 10,
          width: 0,
          height: 0,
          borderLeft: "10px solid transparent",
          borderRight: "10px solid transparent",
          borderTop: `12px solid ${palette.border}`,
        }}
      />
    </div>
  );
}
