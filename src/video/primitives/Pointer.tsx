import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { PointerElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { PILL_PADDING, pointerLabel } from "../labels";
import { TEXT } from "../text";
import { FONT_SANS } from "../theme";

const ARROW = 14;

export function Pointer({ element }: { element: PointerElement }) {
  const { rows, palette, reducedMotion, text, elements } = useScene();
  const pointers = elements.filter((el): el is PointerElement => el.type === "pointer");
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = rows[element.rowId];
  if (!layout) return null;
  const fontSize = text.size(TEXT.pointer);
  const labelHeight = fontSize + 18;

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
  const top = below ? layout.pointerTop : layout.top - 8 - ARROW - labelHeight;

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
        height: labelHeight,
        padding: `0 ${PILL_PADDING / 2}px`,
        borderRadius: 999,
        background: color,
        color: textColor,
        fontFamily: FONT_SANS,
        fontSize,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        whiteSpace: "nowrap",
      }}
    >
      {pointerLabel(element, layout, text, pointers)}
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
