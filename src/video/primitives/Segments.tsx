import { useCurrentFrame, useVideoConfig } from "remotion";

import type { SegmentsElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS } from "../layout";
import { FONT_SANS } from "../theme";

const TICK = 10;

/**
 * How the array is split right now: the layout draws each group apart, and a bracket under each group ties its
 * bars together. The active group gets a thick accent bracket, a faint band behind its bars, and a "▶ level d"
 * label left of the row; the others are thin and muted. Weight + label, never color alone.
 */
export function Segments({ element }: { element: SegmentsElement }) {
  const { rows, palette, reducedMotion } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = rows[element.rowId];
  if (!layout) return null;

  const p = enterProgress(frame, fps, reducedMotion);
  const baseline = layout.top + layout.cardHeight;
  const isActive = (g: { from: number; to: number }) =>
    element.active !== undefined && g.from === element.active.from && g.to === element.active.to;
  // The active range may span several groups (a merge in progress): bracket it as one.
  const active = element.active;
  const groups = element.groups.filter(
    (g) => !active || isActive(g) || g.to < active.from || g.from > active.to,
  );
  const bracket = (from: number, to: number, on: boolean) => {
    const left = layout.lefts[from] - 4;
    const width = layout.lefts[to] + layout.cardWidth + 4 - left;
    const color = on ? palette.primary : palette.textMuted;
    const weight = on ? 4 : 2;
    return (
      <div
        key={`${from}-${to}`}
        style={{
          position: "absolute",
          left,
          width,
          top: baseline + 8,
          height: TICK,
          borderLeft: `${weight}px solid ${color}`,
          borderRight: `${weight}px solid ${color}`,
          borderBottom: `${weight}px solid ${color}`,
          borderRadius: "0 0 4px 4px",
          opacity: p,
        }}
      />
    );
  };

  return (
    <>
      {active ? (
        <div
          style={{
            position: "absolute",
            left: layout.lefts[active.from] - 8,
            width: layout.lefts[active.to] + layout.cardWidth + 8 - (layout.lefts[active.from] - 8),
            top: layout.top - 6,
            height: layout.cardHeight + 6,
            borderRadius: "10px 10px 0 0",
            background: `${palette.primary}14`,
            opacity: p,
          }}
        />
      ) : null}
      {groups.map((g) => bracket(g.from, g.to, false))}
      {active ? bracket(active.from, active.to, true) : null}
      {active && element.depth !== undefined ? (
        <div
          style={{
            position: "absolute",
            right: CANVAS.width - (layout.lefts[0] - 20),
            top: baseline - 40,
            padding: "4px 12px",
            borderRadius: 999,
            border: `2px solid ${palette.primary}`,
            background: palette.surface,
            color: palette.text,
            fontFamily: FONT_SANS,
            fontSize: 17,
            fontWeight: 700,
            whiteSpace: "nowrap",
            opacity: p,
          }}
        >
          ▶ level {element.depth}
        </div>
      ) : null}
    </>
  );
}
