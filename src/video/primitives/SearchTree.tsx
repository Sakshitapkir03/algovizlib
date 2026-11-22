import { useCurrentFrame, useVideoConfig } from "remotion";

import type { SearchTreeElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS, visibleSearchNodes } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO } from "../theme";

/**
 * A backtracking decision tree. Nodes are partial solutions (labeled with their state), edges the choices that lead to
 * them (labeled on a large player). The path from the root to the current node is drawn in the accent and the current
 * node ringed; the node just stepped back from is dashed in the accent. Explored dead ends fade (a folded one shows
 * "✕"); pruned branches are short dashed stubs with ✕ and the reason; solutions get a ✓ double border. Nodes reached in
 * this scene fade in.
 */
export function SearchTree({ element }: { element: SearchTreeElement }) {
  const { search, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!search) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  const visible = visibleSearchNodes(element);
  const onPath = new Set(element.path);
  const dead = new Set(element.dead);
  const solutions = new Set(element.solutions);
  const folded = new Set(element.collapsed ?? []);
  const nodeSize = text.size(TEXT.searchNode);
  const labelSize = text.size(TEXT.dpLabel);
  const { nodeWidth: w, nodeHeight: h } = search;
  // Choice labels sit between levels: only when there's room for them (and never on a phone-sized player).
  const showEdges = !text.compact && search.levelGap >= h + labelSize * 1.8;

  const edges = visible.flatMap((id) => {
    const node = element.nodes[id];
    if (node.parent === null) return [];
    const a = search.center(node.parent);
    const b = search.center(id);
    if (!a || !b) return [];
    const pruned = node.pruned !== undefined;
    const active = onPath.has(id);
    const faded = dead.has(id) || pruned;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + h / 2 + b.y - h / 2) / 2 };
    return [
      <g key={`edge-${id}`} opacity={faded && !active ? 0.55 : 1}>
        <line
          x1={a.x}
          y1={a.y + h / 2}
          x2={b.x}
          y2={b.y - h / 2}
          stroke={active ? palette.primary : palette.textMuted}
          strokeWidth={active ? 5 : 3}
          strokeDasharray={pruned ? "6 5" : undefined}
        />
        {node.edge && showEdges ? (
          <text
            x={mid.x}
            y={mid.y + labelSize * 0.35}
            textAnchor="middle"
            fontFamily={FONT_MONO}
            fontSize={labelSize}
            fontWeight={700}
            fill={active ? palette.primary : palette.textMuted}
            stroke={palette.background}
            strokeWidth={5}
            paintOrder="stroke"
          >
            {node.edge}
          </text>
        ) : null}
      </g>,
    ];
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
      </svg>
      {visible.map((id) => {
        const node = element.nodes[id];
        const c = search.center(id);
        if (!c) return null;
        const pruned = node.pruned !== undefined;
        const current = element.current === id;
        const solved = solutions.has(id);
        const isDead = dead.has(id);
        const undone = element.undone === id;
        const border = current
          ? `5px solid ${palette.primary}`
          : solved
            ? `6px double ${palette.success}`
            : pruned
              ? `2px dashed ${palette.textMuted}`
              : undone
                ? `3px dashed ${palette.primary}`
                : onPath.has(id)
                  ? `3px solid ${palette.primary}`
                  : `2px solid ${palette.border}`;
        const label = pruned ? "✕" : folded.has(id) ? `${node.label}✕` : node.label || "·";
        return (
          <div key={id}>
            <div
              style={{
                position: "absolute",
                left: c.x - w / 2,
                top: c.y - h / 2,
                width: w,
                height: h,
                boxSizing: "border-box",
                borderRadius: pruned ? 999 : 12,
                background: solved
                  ? `${palette.success}1f`
                  : isDead || pruned
                    ? palette.surfaceMuted
                    : palette.surface,
                border,
                opacity: (isDead || pruned) && !current && !undone ? 0.6 : 1,
                boxShadow: current ? `0 0 0 5px ${palette.primary}33` : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_MONO,
                fontSize: nodeSize,
                fontWeight: 700,
                color: pruned ? palette.textMuted : palette.text,
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </div>
            {pruned && !text.compact ? (
              <div
                style={{
                  position: "absolute",
                  left: c.x,
                  top: c.y + h / 2 + 4,
                  transform: "translateX(-50%)",
                  fontFamily: FONT_MONO,
                  fontSize: labelSize,
                  fontWeight: 700,
                  color: palette.textMuted,
                  whiteSpace: "nowrap",
                }}
              >
                {node.pruned}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
