import { useCurrentFrame, useVideoConfig } from "remotion";

import type { HouseRowElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * House Robber's street: a house per column (house i over table cell i) with its cash, neighbors joined by a line for
 * their shared alarm. The house being decided is ringed; the best plan so far marks houses "✓ take" (solid accent
 * outline, tinted) or "✕ skip" (dashed outline). On a phone-sized player the words drop and the outlines carry it.
 */
export function HouseRow({ element }: { element: HouseRowElement }) {
  const { dp, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!dp?.story) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  const { top, bottom } = dp.story;
  const cashSize = text.size(TEXT.houseCash);
  const tagSize = text.size(TEXT.dpLabel);
  const tagRoom = text.compact ? 0 : tagSize + 14;
  const w = Math.min(dp.cellWidth, 120);
  const height = Math.min(bottom - top - tagRoom, w * 1.15);
  const roof = height * 0.38;
  const body = height - roof;
  const baseY = bottom - tagRoom;
  const taken = new Set(element.taken);
  const skipped = new Set(element.skipped);
  const mid = (i: number) => dp.colX(i) + dp.cellWidth / 2;

  return (
    // A full-stage box, so its fading layer has real bounds (see LinkedList).
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {element.money.slice(1).map((_, k) => {
          // The shared alarm: a line between neighbors' walls, with a dot at each end.
          const y = baseY - body / 2;
          const [x1, x2] = [mid(k) + w / 2, mid(k + 1) - w / 2];
          return (
            <g key={`link-${k}`}>
              <line x1={x1} y1={y} x2={x2} y2={y} stroke={palette.textMuted} strokeWidth={3} />
              <circle cx={x1} cy={y} r={4} fill={palette.textMuted} />
              <circle cx={x2} cy={y} r={4} fill={palette.textMuted} />
            </g>
          );
        })}
        {element.money.map((cash, i) => {
          const x = mid(i);
          const current = element.current === i;
          const take = taken.has(i);
          const skip = skipped.has(i);
          const stroke = current || take ? palette.primary : palette.textMuted;
          const strokeWidth = current ? 6 : take ? 4 : 2.5;
          const shape = `M ${x - w / 2} ${baseY} L ${x - w / 2} ${baseY - body} L ${x} ${baseY - height} L ${x + w / 2} ${baseY - body} L ${x + w / 2} ${baseY} Z`;
          return (
            <g key={`house-${i}`}>
              <path
                d={shape}
                fill={take ? `${palette.primary}26` : palette.surface}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={skip && !current ? "8 6" : undefined}
                strokeLinejoin="round"
                opacity={skip && !current ? 0.75 : 1}
              />
              <text
                x={x}
                y={baseY - body / 2 + cashSize * 0.36}
                textAnchor="middle"
                fontFamily={FONT_MONO}
                fontSize={cashSize}
                fontWeight={700}
                fill={palette.text}
              >
                {element.unit}
                {cash}
              </text>
            </g>
          );
        })}
      </svg>
      {!text.compact
        ? element.money.map((_, i) =>
            taken.has(i) || skipped.has(i) ? (
              <div
                key={`tag-${i}`}
                style={{
                  position: "absolute",
                  left: mid(i),
                  top: baseY + 6,
                  transform: "translateX(-50%)",
                  fontFamily: FONT_SANS,
                  fontSize: tagSize,
                  fontWeight: 700,
                  color: taken.has(i) ? palette.primary : palette.textMuted,
                  whiteSpace: "nowrap",
                }}
              >
                {taken.has(i) ? "✓ take" : "✕ skip"}
              </div>
            ) : null,
          )
        : null}
    </div>
  );
}
