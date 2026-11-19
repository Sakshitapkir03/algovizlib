import { useCurrentFrame, useVideoConfig } from "remotion";

import type { ResultElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { TEXT } from "../text";
import { FONT_SANS } from "../theme";

export function Result({ element }: { element: ResultElement }) {
  const { palette, reducedMotion, text } = useScene();
  const iconSize = text.size(TEXT.resultIcon);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterProgress(frame, fps, reducedMotion);
  const success = element.tone === "success";
  const accent = success ? palette.success : palette.info;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "14px 28px",
        borderRadius: 20,
        background: success ? palette.successSoft : palette.infoSoft,
        border: `2px solid ${accent}`,
        fontFamily: FONT_SANS,
        color: palette.text,
        opacity: p,
        transform: `scale(${1 - motion((1 - p) * 0.08, reducedMotion)})`,
      }}
    >
      <div
        aria-hidden
        style={{
          width: iconSize + 18,
          height: iconSize + 18,
          borderRadius: 999,
          background: accent,
          color: palette.background,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: iconSize,
          fontWeight: 800,
        }}
      >
        {success ? "✓" : "i"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div
          style={{
            fontSize: text.size(TEXT.resultTitle),
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: accent,
          }}
        >
          {element.title}
        </div>
        <div style={{ fontSize: text.size(TEXT.resultValue), fontWeight: 700 }}>{element.value}</div>
        {element.detail && !text.compact ? (
          <div style={{ fontSize: text.size(TEXT.resultDetail), color: palette.textMuted }}>
            {element.detail}
          </div>
        ) : null}
      </div>
    </div>
  );
}
