import { useCurrentFrame, useVideoConfig } from "remotion";

import type { GraphElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO } from "../theme";
import { arrowHead } from "./Grid";

/**
 * A graph for a breadth-first search, in columns by level from the start node, so each new level of the frontier
 * appears one column further right. The node being processed has a thick accent ring; queued nodes a dashed accent
 * outline; seen nodes a muted fill, a ✓ (a double border on a phone-sized player), and their level underneath. This
 * scene's neighbor checks light up their edges one after another: solid accent with a head when the neighbor joins the
 * queue, dashed with ✕ when it was already seen.
 */
export function Graph({ element }: { element: GraphElement }) {
  const { graph, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!graph) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  const { nodeWidth: w, nodeHeight: h } = graph;
  const visited = new Set(element.visited);
  const frontier = new Set(element.frontier);
  const levels = new Map((element.levels ?? []).map((l) => [l.id, l.level]));
  const labelSize = text.size(TEXT.graphLabel);
  const noteSize = text.size(TEXT.gridNote);
  const checks = element.checks ?? [];
  const checked = new Set(checks.map((ch) => [ch.from, ch.to].sort().join("-")));

  // Where a line between two node centers leaves the first node's box.
  const edgePoint = (a: { x: number; y: number }, b: { x: number; y: number }, pad = 0) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const k = Math.min((w / 2 + pad) / Math.abs(dx || 1e-6), (h / 2 + pad) / Math.abs(dy || 1e-6));
    return { x: a.x + dx * k, y: a.y + dy * k };
  };

  const edges = element.edges
    .filter(([a, b]) => !checked.has([a, b].sort().join("-")))
    .map(([a, b]) => {
      const pa = graph.center(a);
      const pb = graph.center(b);
      return (
        <line
          key={`edge-${a}-${b}`}
          x1={pa.x}
          y1={pa.y}
          x2={pb.x}
          y2={pb.y}
          stroke={palette.border}
          strokeWidth={3}
        />
      );
    });
  const checkEdges = checks.map((check, k) => {
    if (check.to === undefined) return null;
    const shown = enterProgress(frame, fps, reducedMotion, 10 + k * 6);
    const a = graph.center(check.from);
    const b = graph.center(check.to);
    const start = edgePoint(a, b, 2);
    const end = edgePoint(b, a, 6);
    const added = check.result === "added";
    const color = added ? palette.primary : palette.textMuted;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    return (
      <g key={`check-${k}`}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={palette.border} strokeWidth={3} />
        <g opacity={shown}>
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={color}
            strokeWidth={added ? 5 : 3}
            strokeDasharray={added ? undefined : "7 6"}
          />
          {added ? (
            arrowHead(end.x, end.y, angle, 14, color)
          ) : (
            <text
              x={(start.x + end.x) / 2}
              y={(start.y + end.y) / 2 + noteSize * 0.45}
              textAnchor="middle"
              fontFamily={FONT_MONO}
              fontSize={noteSize * 1.3}
              fontWeight={700}
              fill={palette.textMuted}
              stroke={palette.background}
              strokeWidth={5}
              paintOrder="stroke"
            >
              ✕
            </text>
          )}
        </g>
      </g>
    );
  });

  return (
    // A full-stage box, so its fading layer has real bounds (see LinkedList).
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {edges}
        {checkEdges}
      </svg>
      {element.nodes.map((node) => {
        const c = graph.center(node.id);
        const current = element.current === node.id;
        const queued = frontier.has(node.id);
        const seen = visited.has(node.id);
        const level = levels.get(node.id);
        const border = current
          ? `5px solid ${palette.primary}`
          : queued
            ? `3px dashed ${palette.primary}`
            : seen && text.compact
              ? `6px double ${palette.textMuted}`
              : `2px solid ${palette.border}`;
        return (
          <div key={node.id}>
            <div
              style={{
                position: "absolute",
                left: c.x - w / 2,
                top: c.y - h / 2,
                width: w,
                height: h,
                boxSizing: "border-box",
                borderRadius: 12,
                background: seen && !queued && !current ? palette.surfaceMuted : palette.surface,
                border,
                boxShadow: current ? `0 0 0 6px ${palette.primary}33` : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_MONO,
                fontSize: labelSize,
                fontWeight: 700,
                color: palette.text,
              }}
            >
              {node.label}
              {/* ✓ once its own turn is over (seen, no longer queued, not running). */}
              {seen && !queued && !current && !text.compact ? (
                <div
                  style={{
                    position: "absolute",
                    top: -noteSize * 0.7,
                    right: -noteSize * 0.5,
                    width: noteSize * 1.4,
                    height: noteSize * 1.4,
                    borderRadius: 999,
                    background: palette.success,
                    color: palette.background,
                    fontSize: noteSize,
                    lineHeight: `${noteSize * 1.4}px`,
                    textAlign: "center",
                  }}
                >
                  ✓
                </div>
              ) : null}
            </div>
            {level !== undefined ? (
              <div
                style={{
                  position: "absolute",
                  left: c.x,
                  top: c.y + h / 2 + 6,
                  transform: "translateX(-50%)",
                  fontFamily: FONT_MONO,
                  fontSize: noteSize,
                  fontWeight: 700,
                  color: palette.textMuted,
                  whiteSpace: "nowrap",
                }}
              >
                {text.compact ? level : `level ${level}`}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
