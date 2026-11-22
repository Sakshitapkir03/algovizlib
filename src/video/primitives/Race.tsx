import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import type { LinkedListElement, RaceElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS } from "../layout";
import { arrowHeadPoints } from "../list-links";
import { type LabelBox, layoutRace } from "../race-layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * Fast and slow pointers over a linked list. Each move this scene is drawn as hop arcs above the pointers, one per
 * link taken, drawing in from where the pointer was; "+1" (slow, in the accent, lower) and "+2" (fast, neutral,
 * higher) sit over the last hop. A refused jump is a dashed rose arc with ✕. The node where the pointers met is
 * ringed (dashed, sky) with "◎ meet" under the lane; the loop's start, once found, gets a solid green ring and "✓ loop
 * start". The link that closes the loop is traced in the accent over the list's own arrow, labeled "↺ loop".
 */
export function Race({ element }: { element: RaceElement }) {
  const { list, elements, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const listEl = elements.find(
    (el): el is LinkedListElement => el.type === "linked-list" && el.id === element.rowId,
  );
  if (!list || !listEl) return null;
  const shape = layoutRace(element, listEl, list, text);
  if (!shape) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  // Hops draw in one after another, slow's first.
  const draw = (k: number) =>
    reducedMotion
      ? interpolate(frame, [2, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : interpolate(frame, [6 + k * 12, 20 + k * 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const ringIn = interpolate(frame, [reducedMotion ? 2 : 30, reducedMotion ? 10 : 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const tagText = (box: LabelBox, color: string, size: number, font: string, opacity = 1) => (
    <text
      x={box.x + box.w / 2}
      y={box.y + box.h / 2 + size * 0.35}
      textAnchor="middle"
      fontFamily={font}
      fontSize={size}
      fontWeight={700}
      fill={color}
      stroke={palette.background}
      strokeWidth={6}
      paintOrder="stroke"
      opacity={opacity}
    >
      {box.text}
    </text>
  );

  const hopSize = text.size(TEXT.hopLabel);
  const markerSize = text.size(TEXT.raceMarker);
  let hop = 0;
  return (
    // A full-stage box, so its fading layer has real bounds (see LinkedList).
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {shape.loop ? (
          <g>
            <path d={shape.loop.d} fill="none" stroke={palette.primary} strokeWidth={4} />
            <polygon points={arrowHeadPoints(shape.loop.end)} fill={palette.primary} />
            {shape.loop.label
              ? tagText(shape.loop.label, palette.primary, text.size(TEXT.hopLabel) * 0.85, FONT_SANS)
              : null}
          </g>
        ) : null}
        {shape.moves.map((move) => {
          const color = move.order === 0 ? palette.primary : palette.textMuted;
          const arcs = move.arcs.map((arc, k) => {
            const progress = draw(hop++);
            const stroke = arc.blocked ? palette.danger : color;
            return (
              <g key={`${move.pointer}-${k}`}>
                <path
                  d={arc.d}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={move.order === 0 ? 4 : 3}
                  strokeDasharray={arc.blocked ? "7 6" : progress < 1 ? `${progress} 1` : undefined}
                  pathLength={arc.blocked ? undefined : 1}
                  opacity={arc.blocked ? progress : 1}
                />
                {progress > 0.85 ? (
                  <polygon
                    points={arrowHeadPoints(arc.end, 10)}
                    fill={stroke}
                    opacity={(progress - 0.85) / 0.15}
                  />
                ) : null}
              </g>
            );
          });
          const shown = draw(hop - 1);
          return (
            <g key={move.pointer}>
              {arcs}
              {move.label ? tagText(move.label, color, hopSize, FONT_MONO, shown) : null}
              {move.refused ? tagText(move.refused, palette.danger, hopSize, FONT_MONO, shown) : null}
            </g>
          );
        })}
      </svg>
      {shape.markers.map((m) => {
        const color = m.kind === "entry" ? palette.success : palette.info;
        return (
          <div key={m.kind} style={{ opacity: ringIn }}>
            <div
              style={{
                position: "absolute",
                left: m.ring.x,
                top: m.ring.y,
                width: m.ring.w,
                height: m.ring.h,
                boxSizing: "border-box",
                borderRadius: 18,
                border: m.kind === "entry" ? `4px solid ${color}` : `4px dashed ${color}`,
              }}
            />
            {m.tag ? (
              <div
                style={{
                  position: "absolute",
                  left: m.tag.x,
                  top: m.tag.y,
                  width: m.tag.w,
                  height: m.tag.h,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT_SANS,
                  fontSize: markerSize,
                  fontWeight: 700,
                  color,
                  whiteSpace: "nowrap",
                }}
              >
                {m.tag.text}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
