import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { TimelineBar, TimelineElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";
import { barText, layoutTimeline } from "../timeline-layout";

/**
 * Intervals on a number line, one bar per lane. A bar's state reads from its fill, border, and glyph (never color
 * alone): waiting is dashed on a plain surface, active solid, current filled in the accent with a thick border, done faded,
 * absorbed dashed in the accent and fading (it merged into another bar), removed dashed and struck with ✕, result
 * green with ✓. Bars slide from `fromLane` (a sort); a bar that grew slides its ends out from its old extent (a merge:
 * two bars becoming one); the overlap between this scene's two intervals is a shaded band across the lanes; the sweep
 * marker is a dashed vertical line with its label above the lanes.
 */
export function Timeline({ element }: { element: TimelineElement }) {
  const { bottomTop, elements, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shape = layoutTimeline(element, elements, text, bottomTop);
  const p = enterProgress(frame, fps, reducedMotion);
  const later = enterProgress(frame, fps, reducedMotion, 12);
  const travel = reducedMotion
    ? 1
    : spring({ frame: frame - 6, fps, config: { damping: 20, stiffness: 80, mass: 0.9 } });
  const labelSize = text.size(TEXT.timelineLabel);
  const tickSize = text.size(TEXT.timelineTick);

  const style = (bar: TimelineBar): React.CSSProperties => {
    switch (bar.state) {
      case "waiting":
        return {
          background: palette.surface,
          border: `2px dashed ${palette.textMuted}`,
          color: palette.textMuted,
        };
      case "active":
        return { background: palette.surface, border: `2px solid ${palette.textMuted}`, color: palette.text };
      case "current":
        return {
          background: `${palette.primary}33`,
          border: `4px solid ${palette.primary}`,
          color: palette.text,
        };
      case "done":
        return {
          background: palette.surface,
          border: `2px solid ${palette.border}`,
          color: palette.textMuted,
          opacity: 0.55,
        };
      case "absorbed":
        return {
          background: "transparent",
          border: `3px dashed ${palette.primary}`,
          color: palette.textMuted,
          opacity: interpolate(later, [0, 1], [1, 0.5]),
        };
      case "removed":
        return {
          background: "transparent",
          border: `3px dashed ${palette.danger}`,
          color: palette.danger,
          textDecoration: "line-through",
        };
      case "result":
        return {
          background: `${palette.success}26`,
          border: `3px solid ${palette.success}`,
          color: palette.success,
        };
    }
  };

  const overlap = element.overlap;
  const sweep = element.sweep;
  return (
    // A full-stage box, so its fading layer has real bounds (see LinkedList).
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      {overlap ? (
        <div
          style={{
            position: "absolute",
            left: shape.x(overlap.start) - (overlap.start === overlap.end ? 4 : 0),
            width: Math.max(8, shape.x(overlap.end) - shape.x(overlap.start)),
            top: shape.lanesTop - 4,
            height: shape.lanesBottom - shape.lanesTop + 8,
            boxSizing: "border-box",
            borderLeft: `2px dashed ${palette.primary}`,
            borderRight: `2px dashed ${palette.primary}`,
            background: `repeating-linear-gradient(135deg, ${palette.primary}2e 0 6px, transparent 6px 12px)`,
            opacity: later,
          }}
        />
      ) : null}
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        <line
          x1={shape.x(element.min)}
          x2={shape.x(element.max)}
          y1={shape.axisY}
          y2={shape.axisY}
          stroke={palette.textMuted}
          strokeWidth={2}
        />
        {shape.ticks.map((tick) => (
          <line
            key={tick.v}
            x1={tick.x}
            x2={tick.x}
            y1={shape.axisY - (tick.label ? 6 : 3)}
            y2={shape.axisY + (tick.label ? 6 : 3)}
            stroke={palette.textMuted}
            strokeWidth={2}
          />
        ))}
        {sweep ? (
          <line
            x1={shape.x(sweep.at)}
            x2={shape.x(sweep.at)}
            y1={shape.lanesTop - 8}
            y2={shape.axisY}
            stroke={palette.info}
            strokeWidth={3}
            strokeDasharray="8 6"
            opacity={later}
          />
        ) : null}
      </svg>
      {shape.ticks.map((tick) =>
        tick.label ? (
          <div
            key={`t-${tick.v}`}
            style={{
              position: "absolute",
              left: tick.label.x - 4,
              top: tick.label.y,
              width: tick.label.w + 8,
              textAlign: "center",
              fontFamily: FONT_MONO,
              fontSize: tickSize,
              fontWeight: 700,
              color: palette.textMuted,
            }}
          >
            {tick.label.text}
          </div>
        ) : null,
      )}
      {shape.laneLabels.map((l, k) => (
        <div
          key={`l-${k}`}
          style={{
            position: "absolute",
            left: l.x,
            top: l.y,
            width: l.w,
            textAlign: "right",
            fontFamily: FONT_SANS,
            fontSize: text.size(TEXT.laneLabel),
            fontWeight: 700,
            color: palette.textMuted,
            whiteSpace: "nowrap",
          }}
        >
          {l.text}
        </div>
      ))}
      {element.bars.map((bar) => {
        const from = {
          start: element.grow?.id === bar.id ? element.grow.start : bar.start,
          end: element.grow?.id === bar.id ? element.grow.end : bar.end,
          lane: bar.fromLane ?? bar.lane,
        };
        const a = shape.barBox(from);
        const b = shape.barBox(bar);
        const at = (u: number, v: number) => interpolate(travel, [0, 1], [u, v]);
        const box = { x: at(a.x, b.x), y: at(a.y, b.y), w: at(a.w, b.w) };
        const label = shape.barLabel({ ...bar, text: barText(bar) });
        const st = style(bar);
        return (
          <div key={bar.id}>
            <div
              style={{
                position: "absolute",
                left: box.x,
                top: box.y,
                width: box.w,
                height: shape.barHeight,
                boxSizing: "border-box",
                borderRadius: 8,
                ...st,
                textDecoration: undefined,
              }}
            />
            {label ? (
              <div
                style={{
                  position: "absolute",
                  left: label.x + (box.x - b.x),
                  top: box.y,
                  width: label.w,
                  height: shape.barHeight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT_MONO,
                  fontSize: labelSize,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  color: st.color,
                  opacity: st.opacity,
                  textDecoration: st.textDecoration,
                }}
              >
                {label.text}
              </div>
            ) : null}
          </div>
        );
      })}
      {sweep ? (
        <div
          style={{
            position: "absolute",
            left: shape.x(sweep.at),
            top: shape.sweepLabelY,
            transform: "translateX(-50%)",
            padding: "4px 12px",
            borderRadius: 999,
            border: `2px solid ${palette.info}`,
            background: palette.surface,
            color: palette.text,
            fontFamily: FONT_MONO,
            fontSize: text.size(TEXT.windowLabel),
            fontWeight: 700,
            lineHeight: 1,
            whiteSpace: "nowrap",
            opacity: later,
          }}
        >
          {sweep.label}
        </div>
      ) : null}
    </div>
  );
}
