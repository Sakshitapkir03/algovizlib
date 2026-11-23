import { useCurrentFrame, useVideoConfig } from "remotion";

import type { StackElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { firstFitting } from "../labels";
import { CANVAS } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";
import { arrowHead } from "./Grid";

/**
 * A stack as a column on the right, bottom to top, the top item marked "top ▶". Items pushed this scene drop in from
 * above; popped items lift out above the top, dashed and struck through ("out"). A monotonic stack's title says
 * "increasing ↑" or "decreasing ↓". On the input row, each answer a pop resolved is an arc from the popped item's
 * position to the one that resolved it (labeled, e.g. "+3"), resolved answers stay under their cards, and text built
 * so far shows in a strip under the row.
 */
export function Stack({ element }: { element: StackElement }) {
  const { pile: scenePile, piles, rows, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Two stacks (or a stack beside an op log) each have their own column.
  const pile = piles?.[element.id] ?? scenePile;
  if (!pile) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  const leave = enterProgress(frame, fps, reducedMotion, 4);
  const arrive = enterProgress(frame, fps, reducedMotion, 14);
  const links = enterProgress(frame, fps, reducedMotion, 10);
  const itemSize = text.size(TEXT.stackItem);
  const titleSize = text.size(TEXT.stackTitleSmall);
  const noteSize = text.size(TEXT.stackNote);
  const { itemHeight: h, gap, width: w, left } = pile;
  const slotTop = (k: number) => pile.bottom - (k + 1) * h - k * gap;
  const n = element.items.length;
  const pushedFrom = n - (element.pushed ?? 0);
  const row = element.rowId ? rows[element.rowId] : undefined;
  const orderWord =
    element.order === "increasing" ? "increasing ↑" : element.order === "decreasing" ? "decreasing ↓" : "";
  const title =
    text.compact && !pile.titled
      ? undefined
      : firstFitting(
          orderWord ? [`${element.label} · ${orderWord}`, orderWord, element.label] : [element.label],
          titleSize,
          w + 40,
          text,
        );
  const popped = element.popped ?? [];
  const topY = slotTop(Math.max(0, n - 1));
  // Popped items stack above where the top was, first popped lowest.
  const poppedTop = (k: number) => topY - (k + 1) * (h + gap) - 8;
  const titleTop = Math.max(
    pile.top,
    Math.min(n > 0 ? topY : pile.bottom - h, popped.length ? poppedTop(popped.length - 1) : Infinity) -
      titleSize -
      26,
  );

  const box = (
    key: string,
    label: string,
    top: number,
    style: React.CSSProperties,
    extra?: React.ReactNode,
  ) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left,
        top,
        width: w,
        height: h,
        boxSizing: "border-box",
        borderRadius: 10,
        background: palette.surface,
        border: `2px solid ${palette.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_MONO,
        fontSize: itemSize,
        fontWeight: 700,
        color: palette.text,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {label}
      {extra}
    </div>
  );

  const arcs =
    row && pile.arcsTop !== undefined
      ? (element.links ?? []).map((link, k) => {
          const a = { x: row.centers[link.from], y: pile.arcsTop! + 2 };
          const b = { x: row.centers[link.to] - 6, y: pile.arcsTop! + 2 };
          const depth = pile.arcsBottom! - pile.arcsTop! - noteSize - 4;
          const mid = { x: (a.x + b.x) / 2, y: a.y + depth };
          return (
            <g key={`link-${k}`} opacity={links}>
              <path
                d={`M ${a.x} ${a.y} Q ${mid.x} ${a.y + depth * 2 - 6}, ${b.x} ${b.y}`}
                fill="none"
                stroke={palette.primary}
                strokeWidth={4}
              />
              {arrowHead(b.x, b.y, -Math.PI / 2 - 0.5, 12, palette.primary)}
              <text
                x={mid.x}
                y={mid.y + noteSize * 0.95}
                textAnchor="middle"
                fontFamily={FONT_SANS}
                fontSize={noteSize}
                fontWeight={700}
                fill={palette.primary}
                stroke={palette.background}
                strokeWidth={5}
                paintOrder="stroke"
              >
                {link.label}
              </text>
            </g>
          );
        })
      : [];

  return (
    // A full-stage box, so its fading layer has real bounds (see LinkedList).
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      {title ? (
        <div
          style={{
            position: "absolute",
            left: left - 20,
            width: w + 40,
            top: titleTop,
            textAlign: "center",
            fontFamily: FONT_SANS,
            fontSize: titleSize,
            fontWeight: 700,
            color: palette.textMuted,
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
      ) : null}
      {n === 0
        ? box("empty", "", slotTop(0), { border: `2px dashed ${palette.border}`, background: "transparent" })
        : null}
      {element.items.map((item, k) => {
        const pushed = k >= pushedFrom;
        const top = k === n - 1;
        const y = slotTop(k) - motion(pushed ? (1 - arrive) * (h + 24) : 0, reducedMotion);
        return box(
          `item-${k}`,
          item.label,
          y,
          {
            opacity: pushed ? arrive : 1,
            border: top ? `3px solid ${palette.primary}` : `2px solid ${palette.border}`,
          },
          top ? (
            <div
              style={{
                position: "absolute",
                right: w + 8,
                top: h / 2 - noteSize * 0.65,
                fontFamily: FONT_SANS,
                fontSize: noteSize,
                fontWeight: 700,
                color: palette.primary,
                whiteSpace: "nowrap",
              }}
            >
              {text.compact ? "▶" : "top ▶"}
            </div>
          ) : null,
        );
      })}
      {popped.map((item, k) =>
        box(
          `out-${k}`,
          item.label,
          poppedTop(k) - motion(leave * 10, reducedMotion),
          {
            opacity: 1 - 0.5 * leave,
            border: `2px dashed ${palette.textMuted}`,
            color: palette.textMuted,
            textDecoration: "line-through",
          },
          !text.compact ? (
            <div
              style={{
                position: "absolute",
                left: -noteSize * 2.4,
                top: h / 2 - noteSize * 0.65,
                fontFamily: FONT_SANS,
                fontSize: noteSize,
                fontWeight: 700,
                color: palette.textMuted,
              }}
            >
              out
            </div>
          ) : null,
        ),
      )}
      {row && pile.answersTop !== undefined
        ? (element.answers ?? []).map((answer) => (
            <div
              key={`answer-${answer.index}`}
              style={{
                position: "absolute",
                left: row.centers[answer.index],
                top: pile.answersTop,
                transform: "translateX(-50%)",
                fontFamily: FONT_MONO,
                fontSize: noteSize,
                fontWeight: 700,
                color: palette.text,
                whiteSpace: "nowrap",
              }}
            >
              {answer.label}
            </div>
          ))
        : null}
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {arcs}
      </svg>
      {element.text && pile.textTop !== undefined && row ? (
        <div
          style={{
            position: "absolute",
            left: row.lefts[0],
            top: pile.textTop,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: FONT_MONO,
            fontSize: itemSize,
            fontWeight: 700,
            color: palette.text,
            whiteSpace: "nowrap",
          }}
        >
          {!text.compact ? (
            <span style={{ fontFamily: FONT_SANS, fontSize: noteSize, color: palette.textMuted }}>
              {element.text.label}
            </span>
          ) : null}
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 8,
              border: `2px solid ${palette.border}`,
              background: palette.surface,
              minWidth: 40,
            }}
          >
            {element.text.value || " "}
          </span>
        </div>
      ) : null}
    </div>
  );
}
