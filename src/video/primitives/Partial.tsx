import { useCurrentFrame, useVideoConfig } from "remotion";

import type { PartialElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { sizes } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * The answer being built, as chips: the choice just added slides in from the right (accent border); one just taken
 * back slides out to the right, dashed and struck through. Under it, every answer found so far (✓), the newest last;
 * when they don't all fit, the earliest are summed up as "+N". On a phone-sized player it's one row: the chips and
 * "✓ N", the number found.
 */
export function Partial({ element }: { element: PartialElement }) {
  const { palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterProgress(frame, fps, reducedMotion);
  const move = enterProgress(frame, fps, reducedMotion, 10);
  const itemSize = text.size(TEXT.partialItem);
  const labelSize = text.size(TEXT.panelLabel);
  const cellHeight = sizes.cell(text);
  const chipWidth = (s: string) => text.width(s, itemSize, "mono") + 22;

  const chip = (key: string, label: string, style: React.CSSProperties = {}) => (
    <div
      key={key}
      style={{
        minWidth: cellHeight,
        height: cellHeight,
        boxSizing: "border-box",
        padding: "0 10px",
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
  const heading = (word: string) => (
    <div
      style={{
        width: Math.max(text.width(element.label, labelSize), text.width(element.foundLabel, labelSize)) + 8,
        fontFamily: FONT_SANS,
        fontSize: labelSize,
        fontWeight: 700,
        color: palette.textMuted,
        whiteSpace: "nowrap",
      }}
    >
      {word}
    </div>
  );

  // The found answers that fit on one line (the newest), the rest counted.
  const room = 1280 - 160 - text.width(element.foundLabel, labelSize);
  const shown: string[] = [];
  let used = 0;
  for (const f of [...element.found].reverse()) {
    const width = chipWidth(`✓ ${f}`) + 10;
    if (used + width > room - chipWidth("+99")) break;
    shown.unshift(f);
    used += width;
  }
  const more = element.found.length - shown.length;
  const last = element.items.length - 1;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
        opacity: p,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {heading(element.label)}
        {element.items.length === 0 && !element.removed
          ? chip("empty", "∅", { border: `2px dashed ${palette.border}`, color: palette.textMuted })
          : null}
        {element.items.map((item, k) =>
          chip(
            `item-${k}`,
            item,
            k === last && element.added !== undefined
              ? {
                  border: `3px solid ${palette.primary}`,
                  opacity: move,
                  transform: `translateX(${motion((1 - move) * 30, reducedMotion)}px)`,
                }
              : {},
          ),
        )}
        {element.removed !== undefined
          ? chip("removed", element.removed, {
              border: `2px dashed ${palette.textMuted}`,
              color: palette.textMuted,
              textDecoration: "line-through",
              opacity: 1 - 0.6 * move,
              transform: `translateX(${motion(move * 30, reducedMotion)}px)`,
            })
          : null}
        {text.compact
          ? chip("found", `✓ ${element.found.length}`, {
              background: `${palette.success}1f`,
              border: `2px solid ${palette.success}`,
            })
          : null}
      </div>
      {text.compact ? null : (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {heading(element.foundLabel)}
          {element.found.length === 0 ? (
            <div style={{ fontFamily: FONT_SANS, fontSize: labelSize, color: palette.textMuted }}>
              none yet
            </div>
          ) : null}
          {more > 0 ? chip("more", `+${more}`, { color: palette.textMuted }) : null}
          {shown.map((f, k) =>
            chip(`found-${k}`, `✓ ${f}`, {
              background: `${palette.success}1f`,
              border: `2px solid ${palette.success}`,
            }),
          )}
        </div>
      )}
    </div>
  );
}
