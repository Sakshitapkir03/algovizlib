import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import type { ReachElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { type Box, type LabelBox, layoutReach } from "../greedy-layout";
import { CANVAS } from "../layout";
import { arrowHeadPoints } from "../list-links";
import { TEXT } from "../text";
import { FONT_MONO } from "../theme";

/**
 * A stretch of the row the greedy scan has committed to. Under the cards: a band in the accent from `from` to `to`,
 * labeled "reach 5" (inside it, or beside it when it's narrow), and each closed piece as a green bracket with its
 * length and a dashed cut line after it. Over the cards (above the highlight tags): this step's jump, an arc from the
 * current card to the card it reaches, drawing in, labeled "+3" or "last e". Cards past the band can be dashed and
 * dimmed: out of reach. On a phone-sized player the jump's label is dropped (the arc shows it).
 */
export function Reach({ element }: { element: ReachElement }) {
  const { rows, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const row = rows[element.rowId];
  if (!row) return null;
  const shape = layoutReach(element, row, text);
  const p = enterProgress(frame, fps, reducedMotion);
  const draw = reducedMotion
    ? 1
    : interpolate(frame, [8, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const size = text.size(TEXT.reachLabel);
  const jumpSize = text.size(TEXT.jumpLabel);

  const rect = (box: Box, style: React.CSSProperties, key?: string) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        boxSizing: "border-box",
        borderRadius: 8,
        ...style,
      }}
    />
  );
  const label = (box: LabelBox, color: string, fontSize: number, key?: string) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_MONO,
        fontSize,
        fontWeight: 700,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {box.text}
    </div>
  );

  return (
    // A full-stage box, so its fading layer has real bounds (see LinkedList).
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      {shape.beyond.map((box, k) =>
        rect(
          box,
          { border: `3px dashed ${palette.border}`, background: `${palette.background}b3`, borderRadius: 12 },
          `beyond-${k}`,
        ),
      )}
      {shape.pieces.map((piece, k) => (
        <div key={`piece-${k}`}>
          {rect(piece.box, { border: `3px solid ${palette.success}`, background: `${palette.success}1f` })}
          {piece.label ? label(piece.label, palette.success, size) : null}
        </div>
      ))}
      {shape.band
        ? rect(shape.band, { border: `3px solid ${palette.primary}`, background: `${palette.primary}29` })
        : null}
      {shape.label ? label(shape.label, palette.text, size) : null}
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {shape.pieces.map((piece, k) => (
          <line
            key={`cut-${k}`}
            x1={piece.cutX}
            x2={piece.cutX}
            y1={shape.cutTop}
            y2={shape.cutBottom}
            stroke={palette.success}
            strokeWidth={3}
            strokeDasharray="6 5"
          />
        ))}
        {shape.jump ? (
          <g>
            <path
              d={shape.jump.d}
              fill="none"
              stroke={palette.primary}
              strokeWidth={4}
              pathLength={1}
              strokeDasharray={draw < 1 ? `${draw} 1` : undefined}
            />
            {draw > 0.85 ? (
              <polygon
                points={arrowHeadPoints(shape.jump.end, 11)}
                fill={palette.primary}
                opacity={(draw - 0.85) / 0.15}
              />
            ) : null}
          </g>
        ) : null}
      </svg>
      {shape.jump?.label ? (
        <div style={{ opacity: draw }}>{label(shape.jump.label, palette.primary, jumpSize)}</div>
      ) : null}
    </div>
  );
}
