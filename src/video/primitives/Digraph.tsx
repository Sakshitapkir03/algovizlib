import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import type { DigraphElement, NetworkEdge, NetworkNode } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS } from "../layout";
import { ARROW_HEAD } from "../network-layout";
import { TEXT } from "../text";
import { FONT_MONO } from "../theme";

/**
 * A directed (often weighted) graph at fixed spots. Node states never rely on color alone: ready is a dashed accent
 * ring, current a thick accent ring, done a green ring with ✓, stuck a dashed rose ring with ✕. A badge ("in 2")
 * sits up and right of its node. Edges: idle in the border color; new and better in the accent (thick; better adds ✓
 * to its weight); used faint and dashed; worse dashed with ✕ on its weight. Edges marked this scene draw in after
 * the rest.
 */
export function Digraph({ element }: { element: DigraphElement }) {
  const { network: shape, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!shape) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  const later = enterProgress(frame, fps, reducedMotion, 12);
  const pop = reducedMotion ? 1 : interpolate(later, [0, 0.6, 1], [0.6, 1.1, 1]);
  const size = shape.nodeSize;
  const r = size / 2;
  const labelSize = text.size(TEXT.networkLabel);
  const marked = (e: NetworkEdge) => e.state === "new" || e.state === "better" || e.state === "worse";

  const edgeStyle = (e: NetworkEdge) => {
    switch (e.state) {
      case "new":
      case "better":
        return { color: palette.primary, width: 5, dash: undefined, opacity: 1 };
      case "worse":
        return { color: palette.textMuted, width: 3, dash: "9 7", opacity: 1 };
      case "used":
        return { color: palette.textMuted, width: 2.5, dash: "4 8", opacity: 0.45 };
      default:
        return { color: palette.textMuted, width: 3, dash: undefined, opacity: 0.85 };
    }
  };

  const nodeStyle = (n: NetworkNode): React.CSSProperties => {
    switch (n.state) {
      case "ready":
        return { border: `4px dashed ${palette.primary}`, background: palette.surface };
      case "current":
        return { border: `6px solid ${palette.primary}`, background: `${palette.primary}2e` };
      case "done":
        return { border: `4px solid ${palette.success}`, background: `${palette.success}1f` };
      case "stuck":
        return {
          border: `4px dashed ${palette.danger}`,
          background: `${palette.danger}14`,
          color: palette.textMuted,
        };
      default:
        return { border: `2px solid ${palette.border}`, background: palette.surface };
    }
  };
  const glyph = (n: NetworkNode) => (n.state === "done" ? "✓" : n.state === "stuck" ? "✕" : "");

  return (
    // A full-stage box, so its fading layer has real bounds (see LinkedList).
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {element.edges.map((e) => {
          const g = shape.edge(e);
          if (!g) return null;
          const s = edgeStyle(e);
          const head = ARROW_HEAD + s.width;
          // Pull the line back from the tip so its end hides under the arrowhead.
          const lineEnd = element.directed
            ? { x: g.end.x - g.dir.x * head * 0.7, y: g.end.y - g.dir.y * head * 0.7 }
            : g.end;
          const back = { x: g.end.x - g.dir.x * head, y: g.end.y - g.dir.y * head };
          const side = { x: -g.dir.y * head * 0.5, y: g.dir.x * head * 0.5 };
          return (
            <g key={`e-${e.from}-${e.to}`} opacity={(marked(e) ? later : 1) * s.opacity}>
              <path
                d={`M ${g.start.x} ${g.start.y} Q ${g.control.x} ${g.control.y} ${lineEnd.x} ${lineEnd.y}`}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width}
                strokeDasharray={s.dash}
                strokeLinecap="round"
              />
              {element.directed ? (
                <polygon
                  points={`${g.end.x},${g.end.y} ${back.x + side.x},${back.y + side.y} ${back.x - side.x},${back.y - side.y}`}
                  fill={s.color}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      {element.edges.map((e) => {
        const box = shape.weight(e);
        if (!box) return null;
        const accent = e.state === "better" || e.state === "new";
        return (
          <div
            key={`w-${e.from}-${e.to}`}
            style={{
              position: "absolute",
              left: box.x,
              top: box.y,
              width: box.w,
              height: box.h,
              boxSizing: "border-box",
              borderRadius: box.h / 2,
              border: `2px ${e.state === "worse" ? "dashed" : "solid"} ${accent ? palette.primary : palette.border}`,
              background: palette.background,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_MONO,
              fontSize: text.size(TEXT.networkWeight),
              fontWeight: 700,
              color: accent ? palette.primary : palette.textMuted,
              opacity: e.state === "used" ? 0.5 : marked(e) ? later : 1,
              whiteSpace: "nowrap",
            }}
          >
            {box.text}
          </div>
        );
      })}
      {element.nodes.map((n) => {
        const c = shape.center(n.id);
        if (!c) return null;
        const badge = shape.badge(n.id);
        const mark = glyph(n);
        return (
          <div key={`n-${n.id}`}>
            <div
              style={{
                position: "absolute",
                left: c.x - r,
                top: c.y - r,
                width: size,
                height: size,
                boxSizing: "border-box",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_MONO,
                fontSize: labelSize,
                fontWeight: 700,
                color: palette.text,
                transform: n.state === "current" ? `scale(${pop})` : undefined,
                ...nodeStyle(n),
              }}
            >
              {n.label}
            </div>
            {mark ? (
              <div
                style={{
                  position: "absolute",
                  left: c.x + r * 0.78,
                  top: c.y - r * 0.05,
                  fontFamily: FONT_MONO,
                  fontSize: text.size(TEXT.networkGlyph),
                  fontWeight: 800,
                  color: n.state === "done" ? palette.success : palette.danger,
                }}
              >
                {mark}
              </div>
            ) : null}
            {badge ? (
              <div
                style={{
                  position: "absolute",
                  left: badge.x,
                  top: badge.y,
                  width: badge.w,
                  height: badge.h,
                  boxSizing: "border-box",
                  borderRadius: 6,
                  border: `2px solid ${palette.border}`,
                  background: palette.surfaceMuted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT_MONO,
                  fontSize: text.size(TEXT.networkBadge),
                  fontWeight: 700,
                  color: palette.text,
                  whiteSpace: "nowrap",
                }}
              >
                {badge.text}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
