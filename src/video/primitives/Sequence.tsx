import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import type { SequenceElement, SequenceRow } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS } from "../layout";
import { messageReach, sequenceLabelSpot } from "../system-layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * One replay as a sequence view: a lifeline per component and one row per message or note, newest at the bottom. A
 * delivered message is a solid arrow; a lost one stops partway with a rose ✕; one still in flight is dashed and stops
 * halfway; one that arrived after its sender stopped waiting is dashed and muted ("ignored"). Notes sit on their lane
 * with a border for their tone (solid green good news, dashed rose bad news). The row this step added is drawn in the
 * accent and grows in; on a phone-sized player only its message label shows.
 */
export function Sequence({ element }: { element: SequenceElement }) {
  const { sequence: shape, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!shape) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  const grow = reducedMotion ? 1 : enterProgress(frame, fps, reducedMotion, 10);
  const laneSize = text.size(TEXT.seqLane);
  const labelSize = text.size(TEXT.seqLabel);
  const noteSize = text.size(TEXT.seqNote);
  const timeSize = text.size(TEXT.seqTime);
  const bottom = shape.region.y + shape.region.h;
  const laneX = new Map(shape.lanes.map((l) => [l.id, l.x]));
  const first = shape.lanes[0];
  const firstBoxW = text.width(first.label, laneSize) + 28;
  const title = element.title && !text.compact ? element.title : undefined;
  // "↑ 3 earlier" sits at the right end of the header row. With four or more lanes, when the last lane's name reaches
  // into it, it goes just under the header instead (three-lane sequences keep their place exactly as before).
  const lastLane = shape.lanes.at(-1)!;
  const earlierText = `↑ ${shape.hidden} earlier`;
  const earlierBelow =
    shape.lanes.length >= 4 &&
    lastLane.x +
      (text.width(lastLane.label, laneSize) + 28) / 2 +
      12 +
      text.width(earlierText, timeSize, "mono") >
      CANVAS.width - 12;

  const arrow = (row: Extract<SequenceRow, { kind: "message" }>, y: number) => {
    const x1 = laneX.get(row.from)!;
    const x2 = laneX.get(row.to)!;
    const current = row.id === element.current;
    const reach = messageReach(row);
    const end = x1 + (x2 - x1) * reach * (current ? grow : 1);
    const color = row.status === "ignored" ? palette.textMuted : current ? palette.primary : palette.text;
    const dir = Math.sign(x2 - x1);
    const head = 12;
    const spot = sequenceLabelSpot(shape, row);
    const showLabel = shape.showsLabel(row) && text.fits(row.label, labelSize, spot.room, "mono");
    return (
      <g key={row.id} opacity={row.status === "ignored" ? 0.75 : 1}>
        <line
          x1={x1}
          y1={y}
          x2={end - (reach === 1 ? dir * head * 0.6 : 0)}
          y2={y}
          stroke={color}
          strokeWidth={current ? 4 : 2.5}
          strokeDasharray={row.status === "in-flight" || row.status === "ignored" ? "10 7" : undefined}
        />
        {reach === 1 ? (
          <polygon
            points={`${end},${y} ${end - dir * head},${y - head * 0.55} ${end - dir * head},${y + head * 0.55}`}
            fill={color}
          />
        ) : null}
        {row.status === "lost" && (!current || grow > 0.95) ? (
          <text
            x={end + dir * 6}
            y={y + noteSize * 0.36}
            textAnchor={dir > 0 ? "start" : "end"}
            fontFamily={FONT_SANS}
            fontSize={noteSize + 4}
            fontWeight={800}
            fill={palette.danger}
          >
            ✕ lost
          </text>
        ) : null}
        {showLabel ? (
          <text
            x={spot.x}
            y={y - 8}
            textAnchor="middle"
            fontFamily={FONT_MONO}
            fontSize={labelSize}
            fontWeight={700}
            fill={color}
          >
            {row.label}
          </text>
        ) : null}
        {!text.compact ? (
          <text
            x={shape.region.x - 8}
            y={y + timeSize * 0.36}
            textAnchor="end"
            fontFamily={FONT_MONO}
            fontSize={timeSize}
            fill={palette.textMuted}
          >
            {row.at}
          </text>
        ) : null}
      </g>
    );
  };

  return (
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {shape.lanes.map((l) => (
          <line
            key={`life-${l.id}`}
            x1={l.x}
            y1={shape.header.y + shape.header.h}
            x2={l.x}
            y2={bottom}
            stroke={palette.border}
            strokeWidth={2}
            strokeDasharray="4 8"
          />
        ))}
        {shape.visible.map(({ row, y }) => (row.kind === "message" ? arrow(row, y) : null))}
      </svg>
      {title && text.fits(title, timeSize + 2, first.x - firstBoxW / 2 - 16, "mono") ? (
        <div
          style={{
            position: "absolute",
            left: 12,
            top: shape.header.y,
            height: shape.header.h,
            display: "flex",
            alignItems: "center",
            fontFamily: FONT_MONO,
            fontSize: timeSize + 2,
            fontWeight: 700,
            color: palette.primary,
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
      ) : null}
      {shape.lanes.map((l) => {
        const w = text.width(l.label, laneSize) + 28;
        return (
          <div
            key={`lane-${l.id}`}
            style={{
              position: "absolute",
              left: l.x - w / 2,
              top: shape.header.y,
              width: w,
              height: shape.header.h,
              boxSizing: "border-box",
              borderRadius: 10,
              border: `2px solid ${palette.border}`,
              background: palette.surface,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_SANS,
              fontSize: laneSize,
              fontWeight: 700,
              color: palette.text,
              whiteSpace: "nowrap",
            }}
          >
            {l.label}
          </div>
        );
      })}
      {shape.hidden > 0 && !text.compact ? (
        <div
          style={{
            position: "absolute",
            right: 12,
            top: earlierBelow ? shape.header.y + shape.header.h + 2 : shape.header.y,
            height: earlierBelow ? undefined : shape.header.h,
            display: "flex",
            alignItems: "center",
            fontFamily: FONT_MONO,
            fontSize: timeSize,
            color: palette.textMuted,
            whiteSpace: "nowrap",
          }}
        >
          {earlierText}
        </div>
      ) : null}
      {shape.visible.map(({ row, y }) => {
        if (row.kind !== "note") return null;
        const pill = shape.notePill(row, y);
        const current = row.id === element.current;
        const tone =
          row.tone === "positive"
            ? palette.success
            : row.tone === "negative"
              ? palette.danger
              : palette.border;
        return (
          <div
            key={row.id}
            style={{
              position: "absolute",
              left: pill.x,
              top: pill.y,
              width: pill.w,
              height: pill.h,
              boxSizing: "border-box",
              borderRadius: pill.h / 2,
              border: `${current ? 4 : 2}px ${row.tone === "negative" ? "dashed" : "solid"} ${current ? palette.primary : tone}`,
              outline: current && row.tone !== "neutral" ? `2px solid ${tone}` : undefined,
              outlineOffset: 2,
              background: palette.background,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_SANS,
              fontSize: noteSize,
              fontWeight: 700,
              color: row.tone === "neutral" ? palette.text : tone,
              whiteSpace: "nowrap",
              opacity: current ? interpolate(grow, [0, 1], [0, 1]) : 1,
            }}
          >
            {row.text}
          </div>
        );
      })}
    </div>
  );
}
