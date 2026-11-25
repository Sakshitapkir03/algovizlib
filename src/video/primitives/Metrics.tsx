import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import type { MetricsElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { layoutMetrics, metricDelta } from "../system-layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/** A row of numbers from the simulation ("charges 2 +1", "time 3229 ms"); this step's change pops in after the row. */
export function Metrics({ element }: { element: MetricsElement }) {
  const { palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterProgress(frame, fps, reducedMotion);
  const pop = enterProgress(frame, fps, reducedMotion, 14);
  const scale = reducedMotion ? 1 : interpolate(pop, [0, 0.6, 1], [0.6, 1.15, 1]);
  const shape = layoutMetrics(element, text);

  return (
    <div
      style={{
        position: "relative",
        width: shape.width,
        height: shape.height,
        opacity: p,
        transform: `translateY(${motion((1 - p) * 10, reducedMotion)}px)`,
      }}
    >
      {element.items.map((item, k) => {
        const delta = metricDelta(item.delta);
        return (
          <div
            key={item.id}
            style={{
              position: "absolute",
              left: shape.items[k].x,
              width: shape.items[k].w,
              height: shape.height,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              borderRadius: 12,
              border: `2px solid ${delta ? palette.primary : palette.border}`,
              background: palette.surface,
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                fontFamily: FONT_SANS,
                fontSize: text.size(TEXT.metricLabel),
                color: palette.textMuted,
              }}
            >
              {item.label}
            </span>
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: text.size(TEXT.metricValue),
                fontWeight: 800,
                color: palette.text,
              }}
            >
              {item.value}
            </span>
            {delta ? (
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: text.size(TEXT.metricLabel),
                  fontWeight: 800,
                  color: palette.primary,
                  opacity: pop,
                  transform: `scale(${scale})`,
                }}
              >
                {delta}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
