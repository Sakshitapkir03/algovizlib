import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { PointerElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { FONT_SANS } from "../theme";

const ARROW = 14;
const LABEL_HEIGHT = 36;

export function Pointer({ element }: { element: PointerElement }) {
  const { rows, palette, reducedMotion } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = rows[element.rowId];
  if (!layout) return null;

  const to = layout.centers[element.index];
  const from = layout.centers[element.fromIndex ?? element.index];
  // Slide between items; under reduced motion, jump straight to the target.
  const travel = reducedMotion
    ? 1
    : spring({ frame: frame - 6, fps, config: { damping: 18, stiffness: 90, mass: 0.8 } });
  const x = interpolate(travel, [0, 1], [from, to]);
  const opacity = element.fromIndex === undefined ? enterProgress(frame, fps, reducedMotion) : 1;

  const color = element.tone === "primary" ? palette.primary : palette.secondary;
  const textColor = element.tone === "primary" ? palette.primaryText : palette.secondaryText;
  const below = element.placement === "below";
  const top = below ? layout.pointerTop : layout.top - 8 - ARROW - LABEL_HEIGHT;

  const arrow = (
    <div
      style={{
        width: 0,
        height: 0,
        borderLeft: `${ARROW}px solid transparent`,
        borderRight: `${ARROW}px solid transparent`,
        ...(below
          ? { borderBottom: `${ARROW}px solid ${color}` }
          : { borderTop: `${ARROW}px solid ${color}` }),
      }}
    />
  );
  const label = (
    <div
      style={{
        height: LABEL_HEIGHT,
        padding: "0 16px",
        borderRadius: 999,
        background: color,
        color: textColor,
        fontFamily: FONT_SANS,
        fontSize: 18,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        whiteSpace: "nowrap",
      }}
    >
      {element.label}
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top,
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity,
      }}
    >
      {below ? arrow : label}
      {below ? label : arrow}
    </div>
  );
}
