import { useCurrentFrame, useVideoConfig } from "remotion";

import type { ItemRowElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

export function ItemRow({ element }: { element: ItemRowElement }) {
  const { rows, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = rows[element.id];
  if (!layout) return null;
  const labelSize = text.size(TEXT.itemLabel);
  const valueSize = text.size(TEXT.itemValue);
  const sublabelSize = text.size(TEXT.itemSublabel);
  // Names are secondary to values: drop any that wouldn't fit the card at a readable size.
  const room = layout.cardWidth - 12;

  return (
    <>
      {element.items.map((item, i) => {
        const p = enterProgress(frame, fps, reducedMotion, i * 2);
        return (
          <div
            key={`${item.label}-${i}`}
            style={{
              position: "absolute",
              left: layout.lefts[i],
              top: layout.top,
              width: layout.cardWidth,
              height: layout.cardHeight,
              borderRadius: 16,
              background: palette.surface,
              border: `2px solid ${palette.border}`,
              boxShadow: "0 1px 2px rgba(15,23,42,0.08)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              opacity: p,
              transform: `translateY(${motion((1 - p) * 16, reducedMotion)}px)`,
              fontFamily: FONT_SANS,
            }}
          >
            <div
              style={{
                display: text.fits(item.label, labelSize, room) ? undefined : "none",
                fontSize: labelSize,
                fontWeight: 600,
                color: palette.textMuted,
                textAlign: "center",
                padding: "0 8px",
              }}
            >
              {item.label}
            </div>
            <div style={{ fontSize: valueSize, fontWeight: 700, color: palette.text, fontFamily: FONT_MONO }}>
              {element.unit}
              {item.value}
            </div>
            {item.sublabel && !text.compact && text.fits(item.sublabel, sublabelSize, room) ? (
              <div style={{ fontSize: sublabelSize, color: palette.textMuted }}>{item.sublabel}</div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
