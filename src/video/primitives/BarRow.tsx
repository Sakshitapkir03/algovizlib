import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { BarRowElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { sizes } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

const EMPTY_HEIGHT = 40;

/**
 * Vertical bars on a shared baseline (walls, terrain, values being sorted). Optional `fill` shades the container
 * between two bars up to a level; optional `water` stacks standing water on each bar. Water is always drawn with a
 * wave pattern and a "water" label, so it never depends on color alone. `moves` slide bars from their old slots
 * (two bars trading places arc past each other), and `empty` slots are dashed outlines with no value.
 */
export function BarRow({ element }: { element: BarRowElement }) {
  const { rows, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = rows[element.id];
  if (!layout) return null;

  const max = Math.max(
    1,
    element.maxValue ?? 0,
    ...element.bars.map((b, i) => b.value + (element.water?.[i] ?? 0)),
    element.fill?.level ?? 0,
  );
  const labelSize = text.size(TEXT.barValue);
  // The value label sits inside the column, above the tallest bar.
  const unitHeight = Math.max(0, layout.cardHeight - sizes.barLabel(text)) / max;
  // Standing water's "+n" and the container's "water" word are extras: the wave pattern already marks water.
  const waterSize = text.size(TEXT.barWater);
  const showWaterText = !text.compact;
  const baseline = layout.top + layout.cardHeight;
  const waterStyle = {
    background: `repeating-linear-gradient(0deg, ${palette.info}55 0 6px, ${palette.info}33 6px 12px)`,
    border: `2px solid ${palette.info}`,
  };
  const p = enterProgress(frame, fps, reducedMotion);
  const fill = element.fill;
  const empty = new Set(element.empty ?? []);
  const movedFrom = new Map((element.moves ?? []).map((m) => [m.to, m.from]));
  const swapped = (i: number) => {
    const from = movedFrom.get(i);
    return from !== undefined && movedFrom.get(from) === i;
  };
  // Under reduced motion bars appear in their new slots; the cross-fade between scenes still shows the change.
  const travel = reducedMotion
    ? 1
    : spring({ frame: frame - 18, fps, config: { damping: 26, stiffness: 40, mass: 1 } });

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
        if (empty.has(i)) {
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: layout.lefts[i],
                width: layout.cardWidth,
                top: baseline - EMPTY_HEIGHT,
                height: EMPTY_HEIGHT,
                borderRadius: "6px 6px 0 0",
                border: `2px dashed ${palette.textMuted}`,
                borderBottom: "none",
                opacity: p,
              }}
            />
          );
        }
        const from = movedFrom.get(i);
        const moving = from !== undefined;
        // A moved bar is already full height; it slides instead of growing.
        const grow = moving ? 1 : enterProgress(frame, fps, reducedMotion, i * 2);
        const height = bar.value * unitHeight * grow;
        const water = (element.water?.[i] ?? 0) * unitHeight;
        const dx = moving ? interpolate(travel, [0, 1], [layout.lefts[from] - layout.lefts[i], 0]) : 0;
        // In a swap the bar heading right lifts over the one heading left, so they never overlap mid-move.
        const dy = moving && swapped(i) && from < i ? -Math.sin(Math.PI * Math.min(1, travel)) * 48 : 0;
        return (
          <div
            key={i}
            style={{ position: "absolute", left: 0, top: 0, transform: `translate(${dx}px, ${dy}px)` }}
          >
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
                top: baseline - height - water - labelSize - 8,
                textAlign: "center",
                fontFamily: FONT_MONO,
                fontSize: labelSize,
                lineHeight: 1,
                fontWeight: 700,
                color: palette.text,
                opacity: grow,
              }}
            >
              {element.unit}
              {bar.value}
              {element.water?.[i] && showWaterText ? (
                <span style={{ color: palette.info, fontSize: waterSize }}> +{element.water[i]}</span>
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
              display: showWaterText ? undefined : "none",
              position: "absolute",
              top: 6,
              left: "50%",
              transform: "translateX(-50%)",
              fontFamily: FONT_SANS,
              fontSize: waterSize,
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
