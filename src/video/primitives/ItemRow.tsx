import { useCurrentFrame, useVideoConfig } from "remotion";

import type { ItemRowElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { FONT_MONO, FONT_SANS } from "../theme";

export function ItemRow({ element }: { element: ItemRowElement }) {
  const { rows, palette, reducedMotion } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = rows[element.id];
  if (!layout) return null;

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
                fontSize: 17,
                fontWeight: 600,
                color: palette.textMuted,
                textAlign: "center",
                padding: "0 8px",
              }}
            >
              {item.label}
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, color: palette.text, fontFamily: FONT_MONO }}>
              {element.unit}
              {item.value}
            </div>
            {item.sublabel ? (
              <div style={{ fontSize: 14, color: palette.textMuted }}>{item.sublabel}</div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
