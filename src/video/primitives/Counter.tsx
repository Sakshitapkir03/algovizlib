import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import type { CounterElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * A running total: label, value, and what this step added ("+3"), which pops in after the card. Reusable for any
 * count a trace keeps (inversions, swaps, comparisons, a fuel tank). A zero change is shown as "+0" in muted text,
 * a drop as "−3".
 */
export function Counter({ element }: { element: CounterElement }) {
  const { palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterProgress(frame, fps, reducedMotion);
  const pop = enterProgress(frame, fps, reducedMotion, 14);
  const added = element.delta !== undefined && element.delta !== 0;
  const scale = reducedMotion ? 1 : interpolate(pop, [0, 0.6, 1], [0.6, 1.15, 1]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "8px 22px",
        borderRadius: 14,
        border: `2px solid ${palette.border}`,
        background: palette.surface,
        opacity: p,
        transform: `translateY(${motion((1 - p) * 10, reducedMotion)}px)`,
      }}
    >
      <span
        style={{
          fontFamily: FONT_SANS,
          fontSize: text.size(TEXT.counterLabel),
          fontWeight: 700,
          color: palette.textMuted,
        }}
      >
        {element.label}
      </span>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: text.size(TEXT.counterValue),
          fontWeight: 700,
          color: palette.text,
        }}
      >
        {element.value}
      </span>
      {element.delta !== undefined ? (
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: text.size(TEXT.counterDelta),
            fontWeight: 700,
            padding: "2px 12px",
            borderRadius: 999,
            border: `2px solid ${added ? palette.primary : palette.border}`,
            color: added ? palette.primary : palette.textMuted,
            opacity: pop,
            transform: `scale(${scale})`,
          }}
        >
          {element.delta < 0 ? `−${-element.delta}` : `+${element.delta}`}
        </span>
      ) : null}
    </div>
  );
}
