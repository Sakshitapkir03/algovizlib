import { useCurrentFrame, useVideoConfig } from "remotion";

import type { PrefixGridElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import type { Box, LabelBox } from "../greedy-layout";
import { layoutPrefixGrid } from "../prefix-layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * A matrix (left) beside its 2D prefix grid (right; row 0 and column 0 are the empty 0s). Rectangles this scene adds
 * are outlined solid in the accent with "+" on their bottom-right corner; the one subtracted is dashed and muted with
 * "−" (meaning by line style and glyph, not color alone), drawn a little inset so stacked rectangles stay apart. The
 * prefix cells standing for them carry the same signs, the cell built or read is ringed, unbuilt cells are dashed, and
 * a rectangle that hit the target gets a green double border with ✓.
 */
export function PrefixGrid({ element }: { element: PrefixGridElement }) {
  const { bottomTop, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shape = layoutPrefixGrid(element, text, bottomTop);
  const p = enterProgress(frame, fps, reducedMotion);
  const later = enterProgress(frame, fps, reducedMotion, 12);
  const size = text.size(TEXT.prefixValue);
  const signSize = text.size(TEXT.prefixSign);

  const cellBox = (box: Box, value: number | null, style: React.CSSProperties, key: string) => (
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
        background: value === null ? "transparent" : palette.surface,
        border: value === null ? `2px dashed ${palette.border}` : `2px solid ${palette.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_MONO,
        fontSize: size,
        fontWeight: 700,
        color: palette.text,
        ...style,
      }}
    >
      {value === null ? "" : value}
    </div>
  );
  const badge = (sign: string, x: number, y: number, key: string, color = palette.primary) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left: x,
        top: y,
        minWidth: signSize + 8,
        height: signSize + 8,
        borderRadius: 999,
        background: color,
        color: palette.background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_MONO,
        fontSize: signSize,
        fontWeight: 700,
        opacity: later,
      }}
    >
      {sign}
    </div>
  );
  const label = (box: LabelBox) => (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        textAlign: "center",
        fontFamily: FONT_SANS,
        fontSize: text.size(TEXT.prefixLabel),
        fontWeight: 700,
        color: palette.textMuted,
        whiteSpace: "nowrap",
      }}
    >
      {box.text}
    </div>
  );
  const marks = new Map(element.marks.map((m) => [m.at.join(","), m.sign]));

  return (
    // A full-stage box, so its fading layer has real bounds (see LinkedList).
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      {label(shape.matrixLabel)}
      {label(shape.prefixLabel)}
      {element.matrix.flatMap((row, r) =>
        row.map((v, c) => cellBox(shape.matrixCell(r, c), v, {}, `m-${r}-${c}`)),
      )}
      {element.prefix.flatMap((row, i) =>
        row.map((v, j) => {
          const current = element.current?.[0] === i && element.current?.[1] === j;
          const sign = marks.get(`${i},${j}`);
          const box = shape.prefixCell(i, j);
          return (
            <div key={`p-${i}-${j}`}>
              {cellBox(
                box,
                v,
                {
                  ...(i === 0 || j === 0 ? { color: palette.textMuted } : {}),
                  ...(current
                    ? { border: `4px solid ${palette.primary}` }
                    : sign
                      ? { border: `3px solid ${palette.primary}` }
                      : {}),
                },
                "cell",
              )}
              {sign ? badge(sign, box.x + box.w - signSize, box.y - signSize * 0.6, `s-${i}-${j}`) : null}
            </div>
          );
        }),
      )}
      {element.rects.map((r, k) => {
        const box = shape.rectBox(r, k * 5);
        const plus = r.sign === "+";
        return (
          <div key={`r-${k}`} style={{ opacity: later }}>
            <div
              style={{
                position: "absolute",
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
                boxSizing: "border-box",
                borderRadius: 10,
                border: plus ? `3px solid ${palette.primary}` : `3px dashed ${palette.textMuted}`,
                background: plus ? `${palette.primary}12` : "transparent",
              }}
            />
            {badge(
              r.sign,
              // On the rectangle's bottom-right corner, clear of the cell values.
              box.x + box.w - (signSize + 8) / 2,
              box.y + box.h - (signSize + 8) / 2,
              `rs-${k}`,
              plus ? palette.primary : palette.textMuted,
            )}
          </div>
        );
      })}
      {element.found
        ? (() => {
            const box = shape.rectBox(element.found, -6);
            return (
              <div style={{ opacity: later }}>
                <div
                  style={{
                    position: "absolute",
                    left: box.x,
                    top: box.y,
                    width: box.w,
                    height: box.h,
                    boxSizing: "border-box",
                    borderRadius: 12,
                    border: `6px double ${palette.success}`,
                  }}
                />
                {badge("✓", box.x - 6, box.y - signSize * 0.7, "found", palette.success)}
              </div>
            );
          })()
        : null}
    </div>
  );
}
