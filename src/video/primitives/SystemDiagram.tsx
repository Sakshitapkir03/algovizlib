import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import type { SystemDiagramElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS } from "../layout";
import { tokenSize } from "../system-layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * A system's components as boxes on a small grid with their links. States never rely on color alone: busy is a thick
 * accent border, waiting a dashed accent border, idle a thin border; a store has rounded ends, an external service a
 * double border. Messages travel their link as pills (dots on a phone-sized player): one that arrives this step
 * travels the whole link, one still in flight goes halfway, and a lost one stops halfway and turns into a rose ✕.
 */
export function SystemDiagram({ element }: { element: SystemDiagramElement }) {
  const { system: shape, palette, reducedMotion, text, sceneDurationInFrames } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!shape) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  const labelSize = text.size(TEXT.systemLabel);
  const badgeSize = text.size(TEXT.systemBadge);
  // Tokens travel over the middle of the scene (after the diagram fades in), so the narration can follow them.
  const travel = reducedMotion
    ? 1
    : interpolate(frame, [sceneDurationInFrames * 0.12, sceneDurationInFrames * 0.55], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  return (
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {element.edges.map((e) => {
          const seg = shape.edge(e.from, e.to);
          if (!seg) return null;
          return (
            <line
              key={`${e.from}-${e.to}`}
              x1={seg.a.x}
              y1={seg.a.y}
              x2={seg.b.x}
              y2={seg.b.y}
              stroke={palette.border}
              strokeWidth={3}
            />
          );
        })}
      </svg>
      {element.nodes.map((n) => {
        const box = shape.box(n.id);
        if (!box) return null;
        const border =
          n.state === "busy"
            ? `6px solid ${palette.primary}`
            : n.state === "waiting"
              ? `4px dashed ${palette.primary}`
              : n.kind === "external"
                ? `5px double ${palette.textMuted}`
                : `2px solid ${palette.border}`;
        const badge = shape.badge(n.id);
        return (
          <div key={n.id}>
            <div
              style={{
                position: "absolute",
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
                boxSizing: "border-box",
                borderRadius: n.kind === "store" ? `${box.h / 2}px` : 14,
                border,
                background: n.state === "busy" ? `${palette.primary}22` : palette.surface,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_SANS,
                fontSize: labelSize,
                fontWeight: 700,
                color: palette.text,
                whiteSpace: "nowrap",
              }}
            >
              {n.label}
            </div>
            {badge ? (
              <div
                style={{
                  position: "absolute",
                  left: badge.x,
                  top: badge.y,
                  width: badge.w,
                  height: badge.h,
                  boxSizing: "border-box",
                  borderRadius: badge.h / 2,
                  border: `1.5px solid ${n.state === "idle" ? palette.border : palette.primary}`,
                  background: palette.background,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT_MONO,
                  fontSize: badgeSize,
                  fontWeight: 600,
                  color: n.state === "idle" ? palette.textMuted : palette.primary,
                  whiteSpace: "nowrap",
                }}
              >
                {badge.text}
              </div>
            ) : null}
          </div>
        );
      })}
      {element.tokens.map((tok) => {
        const seg = shape.edge(tok.from, tok.to);
        if (!seg) return null;
        const goal = tok.status === "arrived" ? 1 : 0.5;
        const k = goal * travel;
        // Requests and their responses share a link: each direction keeps to its own side of it.
        const len = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) || 1;
        const side = tok.from < tok.to ? 1 : -1;
        const nx = (-(seg.b.y - seg.a.y) / len) * 16 * side;
        const ny = ((seg.b.x - seg.a.x) / len) * 16 * side;
        const x = seg.a.x + (seg.b.x - seg.a.x) * k + nx;
        const y = seg.a.y + (seg.b.y - seg.a.y) * k + ny;
        const lost = tok.status === "lost" && travel >= 1;
        const size = tokenSize(lost ? `✕ ${tok.label}` : tok.label, text);
        return (
          <div
            key={tok.id}
            style={{
              position: "absolute",
              left: x - size.w / 2,
              top: y - size.h / 2,
              width: size.w,
              height: size.h,
              boxSizing: "border-box",
              borderRadius: size.h / 2,
              border: `2.5px ${lost ? "dashed" : "solid"} ${lost ? palette.danger : palette.primary}`,
              background: lost ? `${palette.danger}1f` : palette.primary,
              color: lost ? palette.danger : palette.primaryText,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_MONO,
              fontSize: text.size(TEXT.systemToken),
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {lost && !size.text ? "✕" : size.text}
          </div>
        );
      })}
    </div>
  );
}
