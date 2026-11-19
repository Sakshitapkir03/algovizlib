import { useCurrentFrame, useVideoConfig } from "remotion";

import type { PartitionElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { cardRoom, firstFitting, PILL_PADDING } from "../labels";
import { CANVAS, sizes } from "../layout";
import { TEXT } from "../text";
import { FONT_SANS } from "../theme";

/**
 * Quick sort's partition. A "◆ pivot" tag sits in the strip above the pivot's bar (the layout reserves it), a
 * dashed boundary line runs down to the baseline with "◀ smaller" on its left, and bars outside the range being
 * partitioned are dimmed. Glyphs and words carry every state; color only reinforces them.
 */
export function Partition({ element }: { element: PartitionElement }) {
  const { rows, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = rows[element.rowId];
  if (!layout) return null;

  const p = enterProgress(frame, fps, reducedMotion);
  const n = layout.lefts.length;
  const baseline = layout.top + layout.cardHeight;
  const stripTop = layout.reservedTop;
  // The line sits in the gap before `boundary`; at the range's start it hugs the first bar.
  const lineX =
    element.boundary === element.from
      ? layout.lefts[element.from] - 10
      : (layout.lefts[element.boundary - 1] + layout.cardWidth + layout.lefts[element.boundary]) / 2;
  const tagSize = text.size(TEXT.pivotTag);
  // The tag has the strip above the bars to itself (on a phone "◀ smaller" is hidden), so it only needs to stay on
  // the stage; with "◀ smaller" showing it keeps near its bar. The ◆ glyph always stays.
  const x = layout.centers[element.pivot];
  const tagRoom = text.compact
    ? 2 * Math.min(x - 8, CANVAS.width - 8 - x) - PILL_PADDING
    : cardRoom(layout) * 1.4 - PILL_PADDING;
  const tagText = firstFitting([`◆ ${element.label}`], tagSize, tagRoom, text) ?? "◆";
  const tagWidth = Math.max(layout.cardWidth + 24, text.width(tagText, tagSize) + PILL_PADDING);
  const tagLeft = layout.centers[element.pivot] - tagWidth / 2;
  const boundarySize = text.size(TEXT.boundary);
  // "◀ smaller" reads left from the line; drop it if it would run into the pivot tag or off the stage.
  const showSmaller =
    !text.compact &&
    (tagLeft > lineX + 4 || tagLeft + tagWidth < lineX - 8 - text.width("◀ smaller", boundarySize)) &&
    lineX - 8 - text.width("◀ smaller", boundarySize) > 0;
  // Wait for the bars to settle (moves start around frame 18) before the line jumps in.
  const lineIn = enterProgress(frame, fps, reducedMotion, 10);

  return (
    <>
      {Array.from({ length: n }, (_, i) => i)
        .filter((i) => i < element.from || i > element.to)
        .map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: layout.lefts[i] - 4,
              width: layout.cardWidth + 8,
              top: stripTop,
              height: baseline - stripTop,
              background: palette.background,
              opacity: 0.6 * p,
            }}
          />
        ))}
      <div
        style={{
          position: "absolute",
          left: tagLeft,
          width: tagWidth,
          top: stripTop + 4,
          height: sizes.pivotTag(text),
          borderRadius: 999,
          border: `2px solid ${palette.secondary}`,
          background: palette.surface,
          color: palette.text,
          fontFamily: FONT_SANS,
          fontSize: tagSize,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          whiteSpace: "nowrap",
          opacity: p,
          transform: `translateY(${motion((1 - p) * -8, reducedMotion)}px)`,
        }}
      >
        <span style={{ color: palette.secondary }}>{tagText.slice(0, 1)}</span>
        {tagText.length > 1 ? <span style={{ marginLeft: 6 }}>{tagText.slice(2)}</span> : null}
      </div>
      <div
        style={{
          position: "absolute",
          left: lineX - 2,
          top: stripTop + 8,
          height: baseline - stripTop + 4,
          borderLeft: `3px dashed ${palette.text}`,
          opacity: lineIn,
        }}
      />
      <div
        style={{
          display: showSmaller ? undefined : "none",
          position: "absolute",
          right: CANVAS.width - lineX + 8,
          top: stripTop + 10,
          fontFamily: FONT_SANS,
          fontSize: boundarySize,
          fontWeight: 700,
          color: palette.textMuted,
          whiteSpace: "nowrap",
          opacity: lineIn,
        }}
      >
        ◀ smaller
      </div>
    </>
  );
}
