import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import type { PrefixRowElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS } from "../layout";
import { layoutPrefixRow } from "../prefix-layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * Running totals under an item-row, one cell per boundary: cell i is centered between items i − 1 and i, so a range
 * of items is visibly the stretch between two cells. Unbuilt cells are dashed and empty; the cell built this scene has
 * a thick accent border; cells read have an accent border. Each span draws a bracket over its items whose edges sit on
 * the two boundaries, with a dashed guide from each edge down to its cell and its value in a pill above; for a sum, the
 * later cell is marked "+" and the earlier "−" (the subtraction that replaces adding up the range). The row's label
 * sits left of cell 0 (not on a phone-sized player).
 */
export function PrefixRow({ element }: { element: PrefixRowElement }) {
  const { rows, elements, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const row = rows[element.rowId];
  if (!row) return null;
  const order = elements.filter((e) => e.type === "prefix-row" && e.rowId === element.rowId);
  const shape = layoutPrefixRow(element, row, Math.max(0, order.indexOf(element)), text);
  const p = enterProgress(frame, fps, reducedMotion);
  const later = enterProgress(frame, fps, reducedMotion, 12);
  const size = text.size(TEXT.prefixValue);
  const signSize = text.size(TEXT.prefixSign);
  const reads = new Set(element.reads ?? []);
  const signs = new Map<number, string>();
  if (element.op === "+")
    for (const sp of element.spans ?? [])
      if (sp.to > sp.from) {
        const [plus, minus] = element.direction === "prefix" ? [sp.to, sp.from] : [sp.from, sp.to];
        signs.set(plus, "+");
        if (!signs.has(minus)) signs.set(minus, "−");
      }
  const pop = reducedMotion ? 1 : interpolate(later, [0, 0.6, 1], [0.7, 1.12, 1]);

  return (
    // A full-stage box, so its fading layer has real bounds (see LinkedList).
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: later }}
      >
        {shape.spans.map((sp, k) => {
          const x0 = sp.bracket.x;
          const x1 = sp.bracket.x + sp.bracket.w;
          const y = sp.bracket.y;
          const cellTop = shape.cells[sp.from].y;
          return (
            <g key={`span-${k}`}>
              <rect
                x={x0}
                y={y}
                width={x1 - x0}
                height={row.top + row.cardHeight - y}
                rx={10}
                fill={`${palette.primary}14`}
              />
              <path
                d={`M ${x0} ${y + sp.bracket.h} L ${x0} ${y} L ${x1} ${y} L ${x1} ${y + sp.bracket.h}`}
                fill="none"
                stroke={palette.primary}
                strokeWidth={4}
              />
              {[x0, x1].map((x) => (
                <line
                  key={x}
                  x1={x}
                  x2={x}
                  y1={y + sp.bracket.h}
                  y2={cellTop}
                  stroke={palette.primary}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  opacity={0.8}
                />
              ))}
            </g>
          );
        })}
      </svg>
      {shape.spans.map((sp, k) =>
        sp.label ? (
          <div
            key={`label-${k}`}
            style={{
              position: "absolute",
              left: sp.label.x,
              top: sp.label.y,
              width: sp.label.w,
              height: sp.label.h,
              boxSizing: "border-box",
              borderRadius: 999,
              border: `2px solid ${palette.primary}`,
              background: palette.surface,
              color: palette.text,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_MONO,
              fontSize: text.size(TEXT.windowLabel),
              fontWeight: 700,
              whiteSpace: "nowrap",
              opacity: later,
            }}
          >
            {sp.label.text}
          </div>
        ) : null,
      )}
      {shape.label ? (
        <div
          style={{
            position: "absolute",
            left: shape.label.x,
            top: shape.label.y,
            width: shape.label.w,
            textAlign: "right",
            fontFamily: FONT_SANS,
            fontSize: text.size(TEXT.prefixLabel),
            fontWeight: 700,
            color: palette.textMuted,
            whiteSpace: "nowrap",
          }}
        >
          {shape.label.text}
        </div>
      ) : null}
      {shape.cells.map((box, i) => {
        const value = element.values[i];
        const current = element.current === i;
        const read = reads.has(i);
        const sign = signs.get(i);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: box.x,
              top: box.y,
              width: box.w,
              height: box.h,
              boxSizing: "border-box",
              borderRadius: 8,
              background: value === null ? "transparent" : palette.surface,
              border:
                value === null
                  ? `2px dashed ${palette.border}`
                  : current
                    ? `4px solid ${palette.primary}`
                    : read
                      ? `3px solid ${palette.primary}`
                      : `2px solid ${palette.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_MONO,
              fontSize: size,
              fontWeight: 700,
              color: palette.text,
              transform: current ? `scale(${pop})` : undefined,
            }}
          >
            {value === null ? "" : value}
            {sign ? (
              <span
                style={{
                  position: "absolute",
                  right: -8,
                  top: -signSize * 0.7,
                  minWidth: signSize + 8,
                  height: signSize + 8,
                  borderRadius: 999,
                  background: palette.primary,
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
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
