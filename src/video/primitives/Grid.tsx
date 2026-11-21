import { useCurrentFrame, useVideoConfig } from "remotion";

import type { BfsCheckElement, CellKind, GridElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS } from "../layout";
import { TEXT } from "../text";
import type { VideoPalette } from "../theme";
import { FONT_MONO, FONT_SANS } from "../theme";

/** A triangle pointing along `angle` (0 = right), its tip at (x, y). */
export function arrowHead(x: number, y: number, angle: number, size: number, color: string, opacity = 1) {
  const pts = [
    [0, 0],
    [-size, -size * 0.55],
    [-size, size * 0.55],
  ].map(([px, py]) => [
    x + px * Math.cos(angle) - py * Math.sin(angle),
    y + px * Math.sin(angle) + py * Math.cos(angle),
  ]);
  return <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={color} opacity={opacity} />;
}

/** Why a check skipped its neighbor, in a word. */
export function skipWord(check: BfsCheckElement, kindOf: (id: number) => CellKind | undefined): string {
  if (check.result === "visited") return "seen";
  if (check.result === "out") return "edge";
  return (check.to !== undefined ? kindOf(check.to)?.word : undefined) ?? "blocked";
}

const cellBackground = (tone: CellKind["tone"], palette: VideoPalette) =>
  tone === "fill"
    ? palette.surfaceMuted
    : tone === "wall"
      ? `repeating-linear-gradient(135deg, ${palette.border} 0 6px, ${palette.surfaceMuted} 6px 14px)`
      : tone === "mark"
        ? `${palette.primary}2e`
        : palette.background;

/**
 * A grid for a breadth-first search: each cell shows its content's glyph (water ≈, a wall ■, a pixel's color). The
 * cell being processed has a thick accent ring; queued cells (the frontier) a dashed accent outline; seen cells their
 * level in the corner (or ✓). This scene's neighbor checks appear one after another as short arrows: solid with a
 * head when the neighbor joins the queue, dashed with ✕ and the reason ("water", "seen", "edge") when it's skipped.
 * On a phone-sized player a seen cell shows its level (or ✓) in place of a symbol glyph, and reasons are dropped.
 */
export function Grid({ element }: { element: GridElement }) {
  const { grid, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!grid) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  const { cell } = grid;
  const kinds = new Map(element.legend.map((k) => [String(k.value), k]));
  const valueOf = (id: number) => element.cells[Math.floor(id / element.cols)]?.[id % element.cols];
  const kindOf = (id: number) => kinds.get(String(valueOf(id)));
  const visited = new Set(element.visited);
  const frontier = new Set(element.frontier);
  const levels = new Map((element.levels ?? []).map((l) => [l.id, l.level]));
  const glyphSize = text.size(TEXT.gridGlyph);
  const noteSize = text.size(TEXT.gridNote);
  const checks = element.checks ?? [];
  // Reasons only when they have room: a few checks, on a large player.
  const words = !text.compact && checks.length <= 4;

  const arrows = checks.map((check, k) => {
    const shown = enterProgress(frame, fps, reducedMotion, 10 + k * 5);
    const from = grid.center(check.from);
    const [dr, dc] = check.dir ?? [0, 0];
    const len = Math.hypot(dr, dc) || 1;
    const [ux, uy] = [dc / len, dr / len];
    const reach = cell * Math.hypot(dr, dc);
    const start = { x: from.x + ux * cell * 0.3, y: from.y + uy * cell * 0.3 };
    // Off the grid, the arrow only just crosses the edge (it would run into the caption or the bottom stack).
    const stop = check.result === "out" ? cell * 0.62 : reach - cell * 0.22;
    const end = { x: from.x + ux * stop, y: from.y + uy * stop };
    const angle = Math.atan2(uy, ux);
    const added = check.result === "added";
    const color = added ? palette.primary : palette.textMuted;
    return (
      <g key={`check-${k}`} opacity={shown}>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={color}
          strokeWidth={added ? 5 : 3}
          strokeDasharray={added ? undefined : "6 5"}
          strokeLinecap="round"
        />
        {added ? (
          arrowHead(end.x + ux * 4, end.y + uy * 4, angle, 13, color)
        ) : (
          <text
            x={end.x + ux * 10}
            y={end.y + uy * 10 + noteSize * 0.4}
            textAnchor="middle"
            fontFamily={FONT_SANS}
            fontSize={noteSize * 1.2}
            fontWeight={700}
            fill={palette.textMuted}
          >
            ✕
          </text>
        )}
        {!added && words ? (
          <text
            x={end.x + ux * 10}
            y={end.y + uy * 10 + noteSize * 1.6}
            textAnchor="middle"
            fontFamily={FONT_SANS}
            fontSize={noteSize}
            fontWeight={700}
            fill={palette.textMuted}
            stroke={palette.background}
            strokeWidth={4}
            paintOrder="stroke"
          >
            {skipWord(check, kindOf)}
          </text>
        ) : null}
      </g>
    );
  });

  return (
    // A full-stage box, so its fading layer has real bounds (see LinkedList).
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      {element.cells.flatMap((row, r) =>
        row.map((value, c) => {
          const id = r * element.cols + c;
          const kind = kinds.get(String(value));
          const current = element.current === id;
          const queued = frontier.has(id);
          const seen = visited.has(id);
          const level = levels.get(id);
          const glyph = kind?.glyph ?? String(value);
          // On a phone the corner note would be unreadably cramped: a symbol cell shows its level (or ✓) instead.
          const swap = text.compact && seen && !/^\d+$/.test(glyph);
          const main = swap ? (level !== undefined ? String(level) : "✓") : glyph;
          const border = current
            ? `5px solid ${palette.primary}`
            : queued
              ? `3px dashed ${palette.primary}`
              : `2px solid ${palette.border}`;
          return (
            <div
              key={id}
              style={{
                position: "absolute",
                left: grid.left + c * cell + 2,
                top: grid.top + r * cell + 2,
                width: cell - 4,
                height: cell - 4,
                boxSizing: "border-box",
                borderRadius: 10,
                background: kind ? cellBackground(kind.tone, palette) : palette.background,
                border,
                boxShadow: current ? `0 0 0 5px ${palette.primary}33` : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_MONO,
                fontSize: glyphSize,
                fontWeight: 700,
                color: kind?.tone === "mark" || swap ? palette.text : palette.textMuted,
              }}
            >
              {main}
              {seen && !text.compact ? (
                <div
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 6,
                    fontFamily: FONT_MONO,
                    fontSize: noteSize,
                    fontWeight: 700,
                    color: palette.text,
                  }}
                >
                  {level !== undefined ? level : "✓"}
                </div>
              ) : null}
            </div>
          );
        }),
      )}
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {arrows}
      </svg>
    </div>
  );
}
