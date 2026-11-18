import { useCurrentFrame, useVideoConfig } from "remotion";

import type { BarRowElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * Vertical bars on a shared baseline (walls, terrain). Optional `fill` shades the container between two bars up
 * to a level; optional `water` stacks standing water on each bar. Water is always drawn with a wave pattern and a
 * "water" label, so it never depends on color alone.
 */
export function BarRow({ element }: { element: BarRowElement }) {
  const { rows, palette, reducedMotion } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = rows[element.id];
  if (!layout) return null;

  const max = Math.max(
    1,
    ...element.bars.map((b, i) => b.value + (element.water?.[i] ?? 0)),
    element.fill?.level ?? 0,
  );
  const unitHeight = (layout.cardHeight - 28) / max;
  const baseline = layout.top + layout.cardHeight;
  const waterStyle = {
    background: `repeating-linear-gradient(0deg, ${palette.info}55 0 6px, ${palette.info}33 6px 12px)`,
    border: `2px solid ${palette.info}`,
  };
  const p = enterProgress(frame, fps, reducedMotion);
  const fill = element.fill;

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: layout.lefts[0] - 12,
          width: layout.lefts.at(-1)! + layout.cardWidth - layout.lefts[0] + 24,
          top: baseline,
          height: 3,
          background: palette.border,
        }}
      />
      {element.bars.map((bar, i) => {
        const grow = enterProgress(frame, fps, reducedMotion, i * 2);
        const height = bar.value * unitHeight * grow;
        const water = (element.water?.[i] ?? 0) * unitHeight;
        return (
          <div key={i}>
            {water > 0 ? (
              <div
                style={{
                  position: "absolute",
                  left: layout.lefts[i],
                  width: layout.cardWidth,
                  top: baseline - height - water,
                  height: water,
                  borderRadius: 4,
                  opacity: p,
                  ...waterStyle,
                }}
              />
            ) : null}
            <div
              style={{
                position: "absolute",
                left: layout.lefts[i],
                width: layout.cardWidth,
                top: baseline - height,
                height,
                borderRadius: "6px 6px 0 0",
                background: palette.surfaceMuted,
                border: `2px solid ${palette.textMuted}`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: layout.lefts[i],
                width: layout.cardWidth,
                top: baseline - height - water - 30,
                textAlign: "center",
                fontFamily: FONT_MONO,
                fontSize: 22,
                fontWeight: 700,
                color: palette.text,
                opacity: grow,
              }}
            >
              {element.unit}
              {bar.value}
              {element.water?.[i] ? (
                <span style={{ color: palette.info, fontSize: 16 }}> +{element.water[i]}</span>
              ) : null}
            </div>
          </div>
        );
      })}
      {/* Drawn over the bars (translucent), so one water level reads across the whole container. */}
      {fill ? (
        <div
          style={{
            position: "absolute",
            left: layout.centers[fill.from],
            width: layout.centers[fill.to] - layout.centers[fill.from],
            top: baseline - fill.level * unitHeight,
            height: fill.level * unitHeight,
            borderRadius: 4,
            opacity: p,
            ...waterStyle,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 6,
              left: "50%",
              transform: "translateX(-50%)",
              fontFamily: FONT_SANS,
              fontSize: 16,
              fontWeight: 700,
              color: palette.text,
              background: palette.surface,
              padding: "0 6px",
              borderRadius: 6,
            }}
          >
            water
          </span>
        </div>
      ) : null}
    </>
  );
}
