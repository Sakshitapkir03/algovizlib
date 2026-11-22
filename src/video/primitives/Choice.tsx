import { useCurrentFrame, useVideoConfig } from "remotion";

import type { ChoiceElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { layoutChoice } from "../greedy-layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * A greedy decision: the option taken ("✓ $10 + $5", solid green border) beside the one turned down ("✕ $5 + $5 +
 * $5", dashed, struck through, muted), which fades in a beat later. Under them, the reason the choice is safe, in the
 * story's words. On a phone-sized player the heading and the reason are dropped, and the options stack when they
 * don't fit side by side; the glyphs and border styles carry taken vs. turned down.
 */
export function Choice({ element }: { element: ChoiceElement }) {
  const { palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterProgress(frame, fps, reducedMotion);
  const later = enterProgress(frame, fps, reducedMotion, 12);
  const shape = layoutChoice(element, text);
  const itemSize = text.size(TEXT.choiceItem);

  const pill = (label: string, taken: boolean) => (
    <div
      style={{
        height: shape.pillHeight,
        boxSizing: "border-box",
        padding: "0 14px",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        whiteSpace: "nowrap",
        fontFamily: FONT_MONO,
        fontSize: itemSize,
        fontWeight: 700,
        background: palette.surface,
        border: taken ? `3px solid ${palette.success}` : `2px dashed ${palette.border}`,
        color: taken ? palette.success : palette.textMuted,
        textDecoration: taken ? undefined : "line-through",
        opacity: taken ? 1 : later,
      }}
    >
      {label}
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        opacity: p,
        transform: `translateY(${motion((1 - p) * 10, reducedMotion)}px)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {shape.showLabel ? (
          <span
            style={{
              fontFamily: FONT_SANS,
              fontSize: text.size(TEXT.panelLabel),
              fontWeight: 700,
              color: palette.textMuted,
              whiteSpace: "nowrap",
            }}
          >
            {element.label}
          </span>
        ) : null}
        <div
          style={{
            display: "flex",
            flexDirection: shape.stacked ? "column" : "row",
            alignItems: shape.stacked ? "flex-start" : "center",
            gap: shape.stacked ? 8 : 14,
          }}
        >
          {pill(shape.chosen, true)}
          {shape.rejected ? pill(shape.rejected, false) : null}
        </div>
      </div>
      {shape.showReason ? (
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: text.size(TEXT.choiceReason),
            fontWeight: 600,
            lineHeight: 1.25,
            color: palette.text,
            whiteSpace: "nowrap",
            opacity: later,
          }}
        >
          {element.reason}
        </div>
      ) : null}
    </div>
  );
}
