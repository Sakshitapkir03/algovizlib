import { useCurrentFrame, useVideoConfig } from "remotion";

import type { QueueElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { sizes } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * The BFS queue, front (left) to back. The item taken off the front this scene fades, struck through ("◀ out"); items added at the back slide in ("new"). Items are grouped by level: a marker over the
 * first item of each level ("level 2") and a divider between levels show that the queue holds one level before the
 * next. On a phone-sized player the words are hidden and the dividers stay.
 */
export function Queue({ element }: { element: QueueElement }) {
  const { palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterProgress(frame, fps, reducedMotion);
  const leave = enterProgress(frame, fps, reducedMotion, 8);
  const arrive = enterProgress(frame, fps, reducedMotion, 16);
  const labels = [...element.items, ...(element.dequeued ? [element.dequeued] : [])].map((i) => i.label);
  const cellWidth = sizes.queueCell(text, labels);
  const cellHeight = sizes.cell(text);
  const itemSize = text.size(TEXT.queueItem);
  const tagSize = text.size(TEXT.tag);
  const marker = sizes.queueMarker(text);
  const below = sizes.marker(text);
  const enqueued = new Set(element.enqueued ?? []);

  const cell = (label: string, style: React.CSSProperties) => (
    <div
      style={{
        width: cellWidth,
        height: cellHeight,
        boxSizing: "border-box",
        borderRadius: 8,
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
    </div>
  );
  const tag = (word: string, color = palette.textMuted) =>
    !text.compact ? (
      <div
        style={{
          height: below,
          fontFamily: FONT_SANS,
          fontSize: tagSize,
          lineHeight: 1,
          color,
          whiteSpace: "nowrap",
        }}
      >
        {word}
      </div>
    ) : null;
  const levelMarker = (level: number | undefined) => (
    <div
      style={{
        height: marker,
        fontFamily: FONT_SANS,
        fontSize: tagSize,
        fontWeight: 700,
        lineHeight: 1,
        color: palette.textMuted,
        whiteSpace: "nowrap",
        alignSelf: "flex-start",
      }}
    >
      {level !== undefined && marker > 0 ? `${element.levelLabel} ${level}` : ""}
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        opacity: p,
        transform: `translateY(${motion((1 - p) * 10, reducedMotion)}px)`,
      }}
    >
      <div
        style={{
          marginTop: marker,
          height: cellHeight,
          display: "flex",
          alignItems: "center",
          fontFamily: FONT_SANS,
          fontSize: text.size(TEXT.panelLabel),
          fontWeight: 700,
          color: palette.textMuted,
          whiteSpace: "nowrap",
        }}
      >
        {element.label}
      </div>
      {element.dequeued ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            // It fades where it was (sliding left would run into the panel's label).
            opacity: 1 - 0.55 * leave,
          }}
        >
          {levelMarker(undefined)}
          {cell(element.dequeued.label, {
            border: `2px dashed ${palette.textMuted}`,
            color: palette.textMuted,
            textDecoration: "line-through",
          })}
          {tag("◀ out")}
        </div>
      ) : null}
      {element.items.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {levelMarker(undefined)}
          {cell("", { border: `2px dashed ${palette.border}` })}
          {tag("empty")}
        </div>
      ) : null}
      {element.items.map((item, k) => {
        const previous = element.items[k - 1];
        const startsLevel = !previous || previous.level !== item.level;
        const isNew = enqueued.has(item.id);
        return (
          <div key={`${item.id}`} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            {previous && startsLevel ? (
              // A level boundary: the queue never mixes levels out of order.
              <div
                style={{
                  width: 3,
                  height: marker + cellHeight + 6,
                  borderRadius: 2,
                  background: palette.textMuted,
                  opacity: 0.6,
                }}
              />
            ) : null}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                opacity: isNew ? arrive : 1,
                transform: isNew ? `translateX(${motion((1 - arrive) * 28, reducedMotion)}px)` : undefined,
              }}
            >
              {levelMarker(startsLevel ? item.level : undefined)}
              {cell(item.label, isNew ? { border: `2px solid ${palette.primary}` } : {})}
              {tag(isNew ? "new" : "", palette.primary)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
