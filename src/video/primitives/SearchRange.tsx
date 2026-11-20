import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { SearchRangeElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS, sizes, type RowLayout } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO } from "../theme";
import { edges } from "./Window";

const TICK = 12;
const STROKE = 4;
const NOTCH = 10;

const inRange = (i: number, r: { from: number; to: number }) => i >= r.from && i <= r.to;

/** A pill above the bracket, centered on `x` and kept on the stage. */
function Pill({ x, top, text: label, color }: { x: number; top: number; text: string; color: string }) {
  const { palette, text } = useScene();
  const size = text.size(TEXT.windowLabel);
  const width = text.width(label, size, "mono") + 28;
  const center = Math.min(CANVAS.width - 8 - width / 2, Math.max(8 + width / 2, x));
  return (
    <div
      style={{
        position: "absolute",
        left: center,
        top,
        transform: "translateX(-50%)",
        padding: "5px 14px",
        borderRadius: 999,
        border: `2px solid ${color}`,
        background: palette.surface,
        color: palette.text,
        fontFamily: FONT_MONO,
        fontSize: size,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}

/**
 * Binary search over a row: a bracket above the cards still in play (with a notch over the one just checked),
 * and every dropped card dimmed behind a dashed outline with ✕. The bracket shrinks from the previous scene's range
 * and newly dropped cards fade out, so each halving is visible. A rotated list's sorted half gets a green tint, a
 * line under its cards, and "✓ sorted". An empty range becomes a marker in the gap where the answer goes. Shape and
 * glyphs carry every state: dashed + ✕ (dropped), bracket (in play), tint + line + ✓ (sorted).
 */
export function SearchRange({ element }: { element: SearchRangeElement }) {
  const { rows, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout: RowLayout | undefined = rows[element.rowId];
  if (!layout) return null;

  const n = layout.lefts.length;
  const empty = element.to < element.from;
  const [toLeft, toRight] = edges(layout, element);
  const [fromLeft, fromRight] = element.fromRange ? edges(layout, element.fromRange) : [toLeft, toRight];
  const travel = reducedMotion
    ? 1
    : spring({ frame: frame - 4, fps, config: { damping: 20, stiffness: 90, mass: 0.8 } });
  const left = interpolate(travel, [0, 1], [fromLeft, toLeft]);
  const right = interpolate(travel, [0, 1], [fromRight, toRight]);
  const appear = enterProgress(frame, fps, reducedMotion);
  // Cards dropped by this step fade out as the bracket shrinks; ones dropped earlier are already dim.
  const fade = element.fromRange ? travel : appear;

  const bracketTop = layout.top - sizes.tagRoom(text) - TICK - 4;
  const pillTop = bracketTop - text.size(TEXT.windowLabel) - 14 - 6;
  const tagSize = text.size(TEXT.tag);

  const sorted = element.sorted;
  const sortedLeft = sorted ? layout.lefts[sorted.from] - 6 : 0;
  const sortedRight = sorted ? layout.lefts[sorted.to] + layout.cardWidth + 6 : 0;
  const pill = sorted
    ? { x: (sortedLeft + sortedRight) / 2, text: "✓ sorted", color: palette.success }
    : element.label
      ? { x: (left + right) / 2, text: element.label, color: palette.primary }
      : undefined;

  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        if (inRange(i, element)) return null;
        const wasIn = element.fromRange ? inRange(i, element.fromRange) : true;
        const opacity = wasIn ? fade : 1;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: layout.lefts[i] - 2,
              top: layout.top - 2,
              width: layout.cardWidth + 4,
              height: layout.cardHeight + 4,
              boxSizing: "border-box",
              borderRadius: 16,
              border: `2px dashed ${palette.textMuted}`,
              background: `${palette.background}b3`,
              opacity,
            }}
          >
            {!text.compact ? (
              <div
                style={{
                  position: "absolute",
                  right: 8,
                  top: 6,
                  fontSize: tagSize,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: palette.textMuted,
                }}
              >
                ✕
              </div>
            ) : null}
          </div>
        );
      })}

      {sorted ? (
        <div style={{ opacity: appear }}>
          <div
            style={{
              position: "absolute",
              left: sortedLeft,
              width: sortedRight - sortedLeft,
              top: layout.top - 4,
              height: layout.cardHeight + 8,
              borderRadius: 14,
              background: `${palette.success}24`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: sortedLeft,
              width: sortedRight - sortedLeft,
              top: layout.top + layout.cardHeight + 2,
              height: 4,
              borderRadius: 2,
              background: palette.success,
            }}
          />
        </div>
      ) : null}

      {empty ? (
        // Nothing left in play: a bar in the gap where the answer goes.
        <div
          style={{
            position: "absolute",
            left: left - STROKE / 2 - 1,
            width: STROKE + 2,
            top: bracketTop,
            height: layout.top + layout.cardHeight + 6 - bracketTop,
            borderRadius: 3,
            background: palette.primary,
            opacity: appear,
          }}
        />
      ) : (
        <div style={{ opacity: element.fromRange ? 1 : appear }}>
          <div
            style={{
              position: "absolute",
              left,
              width: Math.max(STROKE, right - left),
              top: bracketTop,
              height: TICK,
              borderTop: `${STROKE}px solid ${palette.primary}`,
              borderLeft: `${STROKE}px solid ${palette.primary}`,
              borderRight: `${STROKE}px solid ${palette.primary}`,
              borderRadius: "4px 4px 0 0",
            }}
          />
          {element.mid !== undefined ? (
            // A notch on the bracket over the card just checked (even when that card was just dropped).
            <div
              style={{
                position: "absolute",
                left: layout.centers[element.mid] - NOTCH,
                top: bracketTop + (inRange(element.mid, element) ? STROKE : -NOTCH - 2),
                width: 0,
                height: 0,
                borderLeft: `${NOTCH}px solid transparent`,
                borderRight: `${NOTCH}px solid transparent`,
                borderTop: `${NOTCH}px solid ${palette.primary}`,
              }}
            />
          ) : null}
        </div>
      )}

      {pill ? (
        <div style={{ opacity: appear }}>
          <Pill x={pill.x} top={pillTop} text={pill.text} color={pill.color} />
        </div>
      ) : null}
    </>
  );
}
