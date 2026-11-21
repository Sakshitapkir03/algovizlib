import { useCurrentFrame, useVideoConfig } from "remotion";

import type { DpTableElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO } from "../theme";
import { arrowHead } from "./Grid";

/**
 * A DP table filling cell by cell. Unfilled cells are dashed and empty. The cell being computed is ringed; the cells
 * it reads send it arrows (a 1D table's arcs rise over the row, a 2D table's arrows run between neighbors), solid in
 * the accent for the winning option and dashed for the rest, each named for its option ("take", "coin 4", "replace")
 * on a large player. Its value fades in after the arrows. The answer cell gets a double border and ✓.
 */
export function DpTable({ element }: { element: DpTableElement }) {
  const { dp, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!dp) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  const arrows = enterProgress(frame, fps, reducedMotion, 8);
  const fill = enterProgress(frame, fps, reducedMotion, 20);
  const valueSize = text.size(TEXT.dpValue);
  const headerSize = text.size(TEXT.dpHeader);
  const labelSize = text.size(TEXT.dpLabel);
  const { cellWidth: w, cellHeight: h } = dp;
  const oneRow = element.rows === 1;
  const center = (r: number, c: number) => ({ x: dp.colX(c) + w / 2, y: dp.rowY(r) + h / 2 });
  const isCurrent = (r: number, c: number) => element.current?.[0] === r && element.current?.[1] === c;
  const isAnswer = (r: number, c: number) => element.answer?.[0] === r && element.answer?.[1] === c;
  const chosen = new Set(element.chosen ?? []);
  // Every option is named when there are two (take / skip, 1 step / 2 steps); with more, or in a grid where the
  // labels would crowd the cell, only the winner. None on a phone-sized player.
  const many = (element.reads ?? []).length > 2 || !oneRow;
  const named = (k: number) => !text.compact && (!many || chosen.has(k));

  const reads = (element.reads ?? []).map((read, k) => {
    if (!element.current) return null;
    const win = chosen.has(k);
    const color = win ? palette.primary : palette.textMuted;
    const [r, c] = read.at;
    const [cr, cc] = element.current;
    let path: string;
    let tip: { x: number; y: number; angle: number };
    let labelAt: { x: number; y: number };
    if (oneRow) {
      // An arc over the row, from the read cell's top to the current cell's top.
      // The label sits over its read cell; the arc leaves from that cell's right side toward the current one.
      const a = { x: dp.colX(c) + w * (c < cc ? 0.75 : 0.25), y: dp.rowY(0) - 4 };
      const b = { x: dp.colX(cc) + w / 2 + (c < cc ? -8 : 8), y: dp.rowY(0) - 4 };
      // The arc's peak rises with the distance it spans (labels stack instead of colliding), within the arc room.
      const peak = Math.max(dp.arcTop + labelSize + 4, a.y - 16 - Math.abs(cc - c) * 10);
      const control = 2 * peak - a.y;
      path = `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${control}, ${b.x} ${b.y}`;
      tip = { x: b.x, y: b.y, angle: Math.PI / 2 + (c < cc ? -0.5 : 0.5) };
      labelAt = { x: dp.colX(c) + w / 2, y: a.y - 6 };
    } else {
      const a = center(r, c);
      const b = center(cr, cc);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const start = { x: a.x + (dx / len) * w * 0.28, y: a.y + (dy / len) * h * 0.28 };
      const end = { x: b.x - (dx / len) * w * 0.38, y: b.y - (dy / len) * h * 0.38 };
      path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
      tip = { x: end.x, y: end.y, angle: Math.atan2(dy, dx) };
      labelAt = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    }
    return (
      <g key={`read-${k}`} opacity={arrows}>
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={win ? 4 : 3}
          strokeDasharray={win ? undefined : "6 5"}
        />
        {arrowHead(tip.x, tip.y, tip.angle, 12, color)}
        {named(k) ? (
          <text
            x={labelAt.x}
            y={labelAt.y}
            textAnchor="middle"
            fontFamily={FONT_MONO}
            fontSize={labelSize}
            fontWeight={700}
            fill={win ? palette.primary : palette.textMuted}
            stroke={palette.background}
            strokeWidth={5}
            paintOrder="stroke"
          >
            {read.label}
          </text>
        ) : null}
      </g>
    );
  });

  const header = (
    key: string,
    value: string,
    x: number,
    y: number,
    align: "center" | "right",
    width: number,
  ) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left: align === "right" ? x - width : x - width / 2,
        top: y,
        width,
        textAlign: align,
        fontFamily: FONT_MONO,
        fontSize: headerSize,
        fontWeight: 700,
        color: palette.textMuted,
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </div>
  );

  return (
    // A full-stage box, so its fading layer has real bounds (see LinkedList).
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      {(element.colHeaders ?? []).map((value, c) =>
        header(`col-${c}`, value, dp.colX(c) + w / 2, dp.colHeaderTop, "center", dp.pitch),
      )}
      {(element.rowHeaders ?? []).map((value, r) =>
        header(`row-${r}`, value, dp.rowHeaderRight, dp.rowY(r) + h / 2 - headerSize * 0.62, "right", 200),
      )}
      {element.cells.map((row, r) =>
        row.map((value, c) => {
          const current = isCurrent(r, c);
          const answer = isAnswer(r, c);
          const empty = value === null;
          return (
            <div
              key={`${r}-${c}`}
              style={{
                position: "absolute",
                left: dp.colX(c),
                top: dp.rowY(r),
                width: w,
                height: h,
                boxSizing: "border-box",
                borderRadius: 10,
                background: empty ? "transparent" : palette.surface,
                border: current
                  ? `5px solid ${palette.primary}`
                  : answer
                    ? `6px double ${palette.success}`
                    : empty
                      ? `2px dashed ${palette.border}`
                      : `2px solid ${palette.border}`,
                boxShadow: current ? `0 0 0 5px ${palette.primary}33` : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_MONO,
                fontSize: valueSize,
                fontWeight: 700,
                color: palette.text,
              }}
            >
              <span style={{ opacity: current ? fill : 1 }}>{empty ? "" : value}</span>
              {answer && !text.compact ? (
                <div
                  style={{
                    position: "absolute",
                    top: -labelSize * 0.7,
                    right: -labelSize * 0.5,
                    width: labelSize * 1.4,
                    height: labelSize * 1.4,
                    borderRadius: 999,
                    background: palette.success,
                    color: palette.background,
                    fontSize: labelSize,
                    lineHeight: `${labelSize * 1.4}px`,
                    textAlign: "center",
                  }}
                >
                  ✓
                </div>
              ) : null}
            </div>
          );
        }),
      )}
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {reads}
      </svg>
    </div>
  );
}
