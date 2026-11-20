import { useCurrentFrame, useVideoConfig } from "remotion";

import type { DequeElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { sizes } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * Sliding Window Maximum's deque, front first: each cell shows a value (and its position, space permitting). Values
 * removed this step stay for a moment, crossed out and dashed, tagged with the end they left ("✕ back", "◀ front"),
 * then fade. Beside it, the maxima recorded so far. Strike-through, dashes, and words carry the state.
 */
export function Deque({ element }: { element: DequeElement }) {
  const { palette, reducedMotion, text, elements } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterProgress(frame, fps, reducedMotion);
  // Removed values fade after the viewer has seen them go.
  const gone = 1 - enterProgress(frame, fps, reducedMotion, 40);
  const row = elements.find((el) => el.id === element.rowId);
  const valueAt = (i: number) =>
    row?.type === "item-row" ? row.items[i]?.value : row?.type === "bar-row" ? row.bars[i]?.value : undefined;

  const cellSize = text.size(TEXT.countCell);
  const cellHeight = sizes.cell(text);
  const cellWidth = sizes.dequeCell(text);
  const labelSize = text.size(TEXT.panelLabel);
  const tagSize = text.size(TEXT.tag);
  const front = (element.poppedFront ?? []).map((i) => ({ i, end: "front" as const }));
  const back = (element.poppedBack ?? []).map((i) => ({ i, end: "back" as const }));
  // Where things were: front removals before the front, then the survivors, then the values popped off the back
  // (in their old order), then the newcomer that pushed them out (always the last position in the deque).
  const kept = element.indices.map((i) => ({ i, end: undefined, removed: false }));
  const newcomer = back.length ? kept.slice(-1) : [];
  const cells = [
    ...front.map((c) => ({ ...c, removed: true })),
    ...(back.length ? kept.slice(0, -1) : kept),
    ...[...back].reverse().map((c) => ({ ...c, removed: true })),
    ...newcomer,
  ];
  const label = (s: string) => (
    <div
      style={{
        fontFamily: FONT_SANS,
        fontSize: labelSize,
        fontWeight: 700,
        color: palette.textMuted,
        height: cellHeight,
        display: "flex",
        alignItems: "center",
        whiteSpace: "nowrap",
      }}
    >
      {s}
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        opacity: p,
        transform: `translateY(${motion((1 - p) * 10, reducedMotion)}px)`,
      }}
    >
      {label(element.label)}
      {cells.length === 0 ? (
        <div
          style={{
            width: cellWidth,
            height: cellHeight,
            boxSizing: "border-box",
            borderRadius: 8,
            border: `2px dashed ${palette.border}`,
          }}
        />
      ) : null}
      {cells.map((cell) => (
        <div
          key={`${cell.removed ? cell.end : "in"}-${cell.i}`}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            opacity: cell.removed ? 0.35 + 0.65 * gone : 1,
          }}
        >
          <div
            style={{
              width: cellWidth,
              height: cellHeight,
              boxSizing: "border-box",
              borderRadius: 8,
              border: cell.removed ? `2px dashed ${palette.danger}` : `2px solid ${palette.border}`,
              background: palette.surface,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_MONO,
              fontSize: cellSize,
              fontWeight: 700,
              lineHeight: 1,
              color: cell.removed ? palette.textMuted : palette.text,
              textDecoration: cell.removed ? "line-through" : undefined,
            }}
          >
            {valueAt(cell.i)}
          </div>
          {!text.compact ? (
            <div
              style={{
                height: sizes.marker(text),
                fontFamily: FONT_SANS,
                fontSize: tagSize,
                lineHeight: 1,
                color: cell.removed ? palette.danger : palette.textMuted,
                whiteSpace: "nowrap",
              }}
            >
              {cell.removed ? (cell.end === "front" ? "◀ front" : "✕ back") : `[${cell.i}]`}
            </div>
          ) : null}
        </div>
      ))}
      <div style={{ width: 18 }} />
      {label(element.outputLabel)}
      <div
        style={{
          height: cellHeight,
          display: "flex",
          alignItems: "center",
          fontFamily: FONT_MONO,
          fontSize: cellSize,
          fontWeight: 700,
          color: element.output.length ? palette.text : palette.textMuted,
          whiteSpace: "nowrap",
        }}
      >
        {element.output.length ? element.output.join(" ") : "—"}
      </div>
    </div>
  );
}
