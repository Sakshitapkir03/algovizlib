import { useCurrentFrame, useVideoConfig } from "remotion";

import type { EquationElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS, verdictColor } from "../theme";

const STAGGER = 4;

export function Equation({ element }: { element: EquationElement }) {
  const { palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fmt = (n: number) => `${element.unit}${n}`;

  const tokens: { text: string; kind: "num" | "op" | "result" }[] = [];
  element.terms.forEach((t, i) => {
    if (i > 0) tokens.push({ text: element.operator === "-" ? "−" : element.operator, kind: "op" });
    tokens.push({ text: fmt(t), kind: element.terms.length === 1 ? "result" : "num" });
  });
  // A single term is a comparison ("7 > 3"), not arithmetic, so "= 7" would only add noise.
  if (element.terms.length > 1)
    tokens.push({ text: "=", kind: "op" }, { text: fmt(element.result), kind: "result" });
  if (element.comparison) {
    tokens.push(
      { text: element.comparison.op, kind: "op" },
      { text: fmt(element.comparison.target), kind: "num" },
    );
  }

  const verdictTone = verdictColor(element, palette);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {tokens.map((tok, i) => {
        const p = enterProgress(frame, fps, reducedMotion, i * STAGGER);
        return (
          <span
            key={i}
            style={{
              fontFamily: FONT_MONO,
              fontSize: text.size(TEXT.equation),
              fontWeight: tok.kind === "op" ? 500 : 700,
              color: tok.kind === "op" ? palette.textMuted : palette.text,
              opacity: p,
              transform: `translateY(${motion((1 - p) * 14, reducedMotion)}px)`,
              ...(tok.kind === "result"
                ? {
                    padding: "0 10px",
                    borderRadius: 10,
                    background: palette.surfaceMuted,
                    border: `2px solid ${palette.border}`,
                  }
                : {}),
            }}
          >
            {tok.text}
          </span>
        );
      })}
      {element.verdict ? (
        <span
          style={{
            marginLeft: 8,
            padding: "6px 16px",
            borderRadius: 999,
            border: `2px solid ${verdictTone}`,
            color: verdictTone,
            fontFamily: FONT_SANS,
            fontSize: text.size(TEXT.verdict),
            fontWeight: 700,
            opacity: enterProgress(frame, fps, reducedMotion, tokens.length * STAGGER + 4),
          }}
        >
          {element.verdict}
        </span>
      ) : null}
    </div>
  );
}
