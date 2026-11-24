import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { BitsElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { bitAt, headerAt, layoutBits, rowName } from "../bits-layout";
import { useScene } from "../context";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * Numbers as rows of bits in aligned columns, most significant on the left, under a header of place values (or what
 * each bit means). Each row: its name, the operation that made it ("^", "& ~twos"), its bits, and "= decimal". A
 * result row has a rule line above it and appears a beat after the operands. Bits this step changed get a thick accent
 * border and a tint; 1s are bold on a surface, 0s muted. A shifted row's bits slide in from their old columns.
 */
export function Bits({ element }: { element: BitsElement }) {
  const { palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shape = layoutBits(element, text);
  const p = enterProgress(frame, fps, reducedMotion);
  const later = enterProgress(frame, fps, reducedMotion, 12);
  const travel = reducedMotion
    ? 1
    : spring({ frame: frame - 14, fps, config: { damping: 20, stiffness: 80, mass: 0.9 } });
  const bitSize = text.size(TEXT.bitValue);
  const nameSize = text.size(TEXT.bitName);
  const pitch = shape.cellWidth + 4;
  const firstResult = element.rows.findIndex((r) => r.rule);

  const digit = (key: string, value: 0 | 1, left: number, extra: React.CSSProperties = {}) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left,
        top: 0,
        width: shape.cellWidth,
        height: shape.cellHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_MONO,
        fontSize: bitSize,
        fontWeight: value ? 800 : 500,
        color: value ? palette.text : palette.textMuted,
        ...extra,
      }}
    >
      {value}
    </div>
  );

  return (
    <div style={{ position: "relative", width: shape.width, height: shape.height, opacity: p }}>
      {Array.from({ length: element.width }, (_, k) => (
        <div
          key={`h-${k}`}
          style={{
            position: "absolute",
            left: shape.cellLeft(k),
            top: 0,
            width: shape.cellWidth,
            textAlign: "center",
            fontFamily: FONT_MONO,
            fontSize: text.size(TEXT.bitHeader),
            fontWeight: 700,
            color: palette.textMuted,
            whiteSpace: "nowrap",
          }}
        >
          {headerAt(element, k)}
        </div>
      ))}
      {element.rows.map((row, r) => {
        const top = shape.rowTops[r];
        const result = firstResult >= 0 && r >= firstResult;
        const show = result ? later : 1;
        const changed = new Set(row.changed ?? []);
        const slide = row.from ? travel : 1;
        return (
          <div
            key={`r-${r}`}
            style={{
              position: "absolute",
              left: 0,
              top,
              width: shape.width,
              height: shape.cellHeight,
              opacity: show,
            }}
          >
            {row.rule ? (
              <div
                style={{
                  position: "absolute",
                  left: shape.cellLeft(0) - 6,
                  width: shape.cellLeft(element.width) - shape.cellLeft(0) + 8,
                  top: -6,
                  height: 3,
                  background: palette.textMuted,
                }}
              />
            ) : null}
            <div
              style={{
                position: "absolute",
                left: 0,
                width: shape.nameWidth,
                top: 0,
                height: shape.cellHeight,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                fontFamily: FONT_SANS,
                fontSize: nameSize,
                fontWeight: 700,
                color: palette.textMuted,
                whiteSpace: "nowrap",
              }}
            >
              {rowName(element, r)}
            </div>
            {row.op ? (
              <div
                style={{
                  position: "absolute",
                  left: shape.nameWidth + 12,
                  width: shape.opWidth,
                  top: 0,
                  height: shape.cellHeight,
                  display: "flex",
                  alignItems: "center",
                  fontFamily: FONT_MONO,
                  fontSize: nameSize,
                  fontWeight: 700,
                  color: palette.primary,
                  whiteSpace: "nowrap",
                }}
              >
                {row.op}
              </div>
            ) : null}
            {Array.from({ length: element.width }, (_, k) => {
              const pos = element.width - 1 - k;
              const hit = changed.has(pos);
              return (
                <div
                  key={`c-${k}`}
                  style={{
                    position: "absolute",
                    left: shape.cellLeft(k),
                    top: 0,
                    width: shape.cellWidth,
                    height: shape.cellHeight,
                    boxSizing: "border-box",
                    borderRadius: 8,
                    background: hit
                      ? `${palette.primary}2e`
                      : bitAt(row.value, element.width, k)
                        ? palette.surface
                        : "transparent",
                    border: hit ? `4px solid ${palette.primary}` : `2px solid ${palette.border}`,
                  }}
                />
              );
            })}
            {/* A shift: the old bits slide over, then the row's own bits settle in. */}
            {row.from
              ? Array.from({ length: element.width }, (_, k) =>
                  digit(
                    `from-${k}`,
                    bitAt(row.from!.value, element.width, k) as 0 | 1,
                    shape.cellLeft(k) - row.from!.shift * pitch * slide,
                    {
                      opacity: interpolate(slide, [0, 0.85, 1], [1, 1, 0]),
                    },
                  ),
                )
              : null}
            {Array.from({ length: element.width }, (_, k) =>
              digit(`bit-${k}`, bitAt(row.value, element.width, k) as 0 | 1, shape.cellLeft(k), {
                opacity: row.from ? interpolate(slide, [0.8, 1], [0, 1], { extrapolateLeft: "clamp" }) : 1,
              }),
            )}
            <div
              style={{
                position: "absolute",
                left: shape.decimalLeft,
                top: 0,
                height: shape.cellHeight,
                display: "flex",
                alignItems: "center",
                fontFamily: FONT_MONO,
                fontSize: nameSize + 4,
                fontWeight: 700,
                color: palette.text,
                whiteSpace: "nowrap",
              }}
            >
              = {row.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
