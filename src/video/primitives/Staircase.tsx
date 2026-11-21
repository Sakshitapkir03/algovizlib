import { useCurrentFrame, useVideoConfig } from "remotion";

import type { StaircaseElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";
import { arrowHead } from "./Grid";

/** Room over the top step for the climber and the hop arcs. */
const HEADROOM = 104;
const CLIMBER = 40;

/**
 * Climbing Stairs' staircase: numbered steps rising left to right, step i directly over table cell i. The climber
 * stands on the step being counted, and the two ways onto it, a 1-step hop from the step below and a 2-step hop from
 * two below, are drawn as arcs labeled "+1" and "+2". Step 0 is the ground.
 */
export function Staircase({ element }: { element: StaircaseElement }) {
  const { dp, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!dp?.story) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  const hops = enterProgress(frame, fps, reducedMotion, 10);
  const { top, bottom } = dp.story;
  const n = element.steps;
  const base = 18;
  const rise = Math.max(6, (bottom - top - HEADROOM - base) / Math.max(1, n - 1));
  const stepTop = (k: number) => bottom - base - k * rise;
  const numberSize = text.size(TEXT.stepNumber);
  const labelSize = text.size(TEXT.dpLabel);
  // Steps touch: each spans its column's full pitch.
  const stepLeft = (k: number) => dp.colX(k) - (dp.pitch - dp.cellWidth) / 2;
  const mid = (k: number) => dp.colX(k) + dp.cellWidth / 2;

  const arcs = (element.hops ?? []).map((hop, k) => {
    const a = { x: mid(hop.from) + 6, y: stepTop(hop.from) - 4 };
    const b = { x: mid(hop.to) - 8, y: stepTop(hop.to) - CLIMBER * (element.at === hop.to ? 0.2 : 0) - 4 };
    const apex = Math.min(a.y, b.y) - 26 - (hop.to - hop.from) * 22;
    const label = `+${hop.to - hop.from}`;
    return (
      <g key={`hop-${k}`} opacity={hops}>
        <path
          d={`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${apex - 14}, ${b.x} ${b.y}`}
          fill="none"
          stroke={palette.primary}
          strokeWidth={4}
          strokeDasharray={hop.to - hop.from === 2 ? "10 6" : undefined}
        />
        {arrowHead(b.x, b.y, Math.PI / 2 - 0.6, 12, palette.primary)}
        <text
          x={(a.x + b.x) / 2}
          y={apex - 4}
          textAnchor="middle"
          fontFamily={FONT_SANS}
          fontSize={labelSize}
          fontWeight={700}
          fill={palette.primary}
          stroke={palette.background}
          strokeWidth={5}
          paintOrder="stroke"
        >
          {label}
        </text>
      </g>
    );
  });

  const at = element.at;
  return (
    // A full-stage box, so its fading layer has real bounds (see LinkedList).
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      {Array.from({ length: n }, (_, k) => (
        <div
          key={k}
          style={{
            position: "absolute",
            left: stepLeft(k),
            top: stepTop(k),
            width: dp.pitch,
            height: bottom - stepTop(k),
            boxSizing: "border-box",
            background: k === at ? `${palette.primary}26` : palette.surfaceMuted,
            borderTop: `4px solid ${k === at ? palette.primary : palette.textMuted}`,
            borderRight: k < n - 1 ? `1px solid ${palette.border}` : undefined,
            display: "flex",
            justifyContent: "center",
            paddingTop: 6,
            fontFamily: FONT_MONO,
            fontSize: numberSize,
            fontWeight: 700,
            color: palette.textMuted,
          }}
        >
          {bottom - stepTop(k) >= numberSize + 10 ? k : ""}
        </div>
      ))}
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {arcs}
        {at !== undefined ? (
          // The climber: a head and a body, standing on its step.
          <g>
            <circle cx={mid(at)} cy={stepTop(at) - CLIMBER + 8} r={8} fill={palette.primary} />
            <rect
              x={mid(at) - 8}
              y={stepTop(at) - CLIMBER + 18}
              width={16}
              height={CLIMBER - 20}
              rx={7}
              fill={palette.primary}
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}
