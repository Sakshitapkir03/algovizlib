import { useCurrentFrame, useVideoConfig } from "remotion";

import type { HashMapElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { MAP_ROW_GAP, sizes } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * A hash map or set, entries in the order they were added: as rows ("6 → #3", a group's items in the value) or as
 * compact cells ("l:1", a set's values). The key just looked up gets a thick accent ring and "✓ found" or "✗ not found"
 * (a lookup for a key that isn't there shows a dashed ghost of it); a new entry slides in marked "new"; a changed value
 * shows the old one struck through beside it. On a phone-sized player the words drop and the ring, ✓/✗, and dashes
 * stay.
 */
export function HashMap({ element }: { element: HashMapElement }) {
  const { palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterProgress(frame, fps, reducedMotion);
  const arrive = enterProgress(frame, fps, reducedMotion, 12);
  const size = text.size(TEXT.countCell);
  const labelSize = text.size(TEXT.panelLabel);
  const tagSize = text.size(TEXT.tag);
  const cellHeight = sizes.cell(text);
  const lookup = element.lookup;
  const missing = lookup && !lookup.found && !element.entries.some((e) => e.key === lookup.key);

  const box = (key: string, label: string, style: React.CSSProperties = {}) => (
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
        fontSize: size,
        fontWeight: 700,
        color: palette.text,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {label}
    </div>
  );
  const verdict = (found: boolean) => (
    <div
      style={{
        fontFamily: FONT_SANS,
        fontSize: text.compact ? size : tagSize,
        fontWeight: 700,
        color: found ? palette.success : palette.textMuted,
        whiteSpace: "nowrap",
      }}
    >
      {text.compact ? (found ? "✓" : "✗") : found ? "✓ found" : "✗ not found"}
    </div>
  );
  const looked = (key: string) => lookup?.key === key;
  const ring = (key: string): React.CSSProperties =>
    looked(key)
      ? { border: `4px solid ${palette.primary}` }
      : element.inserted === key
        ? {
            border: `2px solid ${palette.primary}`,
            opacity: arrive,
            transform: `translateX(${motion((1 - arrive) * 24, reducedMotion)}px)`,
          }
        : {};
  const title = (
    <div
      style={{
        fontFamily: FONT_SANS,
        fontSize: labelSize,
        fontWeight: 700,
        color: palette.textMuted,
        whiteSpace: "nowrap",
        height: cellHeight,
        display: "flex",
        alignItems: "center",
      }}
    >
      {element.label}
    </div>
  );
  const ghost = missing
    ? box("ghost", lookup!.key, {
        border: `3px dashed ${palette.primary}`,
        background: "transparent",
        color: palette.textMuted,
      })
    : null;
  const valueOf = (value: string | undefined, key: string) => {
    const changed = element.updated?.key === key;
    return (
      <>
        {box(`v-${key}`, value ?? "", changed ? { border: `2px solid ${palette.primary}` } : {})}
        {changed && !text.compact
          ? box(`old-${key}`, element.updated!.from || "∅", {
              border: `2px dashed ${palette.textMuted}`,
              color: palette.textMuted,
              textDecoration: "line-through",
              opacity: 1 - 0.6 * arrive,
            })
          : null}
      </>
    );
  };

  if (element.display === "rows")
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, opacity: p }}>
        {title}
        <div style={{ display: "flex", flexDirection: "column", gap: MAP_ROW_GAP }}>
          {element.entries.length === 0 && !missing
            ? box("empty", "", { border: `2px dashed ${palette.border}`, background: "transparent" })
            : null}
          {element.entries.map((entry) => (
            <div
              key={entry.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                ...(element.inserted === entry.key ? ring(entry.key) : {}),
              }}
            >
              {box(`k-${entry.key}`, entry.key, looked(entry.key) ? ring(entry.key) : {})}
              {element.kind === "map" ? (
                <>
                  <div style={{ fontFamily: FONT_MONO, fontSize: size, color: palette.textMuted }}>→</div>
                  {valueOf(entry.value, entry.key)}
                </>
              ) : null}
              {looked(entry.key) ? verdict(lookup!.found) : null}
              {element.inserted === entry.key && !text.compact ? (
                <div
                  style={{
                    fontFamily: FONT_SANS,
                    fontSize: tagSize,
                    fontWeight: 700,
                    color: palette.primary,
                  }}
                >
                  new
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {missing ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {ghost}
            {verdict(false)}
          </div>
        ) : null}
      </div>
    );

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, opacity: p }}>
      {title}
      {element.entries.length === 0 && !missing
        ? box("empty", "", { border: `2px dashed ${palette.border}`, background: "transparent" })
        : null}
      {element.entries.map((entry) => (
        <div
          key={entry.key}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
        >
          {box(
            `c-${entry.key}`,
            element.kind === "map" ? `${entry.key}:${entry.value ?? ""}` : entry.key,
            ring(entry.key),
          )}
          <div style={{ height: sizes.marker(text) }}>
            {looked(entry.key) ? verdict(lookup!.found) : null}
          </div>
        </div>
      ))}
      {missing ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {ghost}
          <div style={{ height: sizes.marker(text) }}>{verdict(false)}</div>
        </div>
      ) : null}
    </div>
  );
}
