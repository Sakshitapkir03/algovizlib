import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { BinaryTreeElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { firstFitting } from "../labels";
import { CANVAS, STUB_DROP } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO } from "../theme";

/** When a returned value travels up its edge (frames after the element enters). */
const TRAVEL = { from: 10, to: 38 };

/**
 * A binary tree by depth, with an edge to each child. The running call's node gets a thick accent ring; the open
 * calls from the root are an accent path (thick edges, accent borders); finished calls are tinted with a ✓ and what
 * they returned beside them ("↑ 3"; on a phone-sized player a double border instead of the ✓); running state carried down sits beside its node ("sum 9"); nodes an early exit
 * skipped are dashed and faded. A call on a missing child draws a small dashed "null" stub under its parent, and a
 * value handed up travels along the edge to the parent as a pill. Every state has a non-color cue (ring width,
 * glyph, dashes).
 */
export function BinaryTree({ element }: { element: BinaryTreeElement }) {
  const { tree, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!tree) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  const s = tree.nodeSize;
  const byId = new Map(element.nodes.map((n) => [n.id, n]));
  const onPath = new Set(element.path);
  const done = new Set(element.done);
  const skipped = new Set(element.skipped ?? []);
  // Calls that repeat earlier work (a recursion's overlapping subproblems): a dotted accent border.
  const repeats = new Set(element.repeats ?? []);
  const valueSize = text.size(TEXT.treeValue);
  const noteSize = text.size(TEXT.treeNote);
  const nullSize = text.size(TEXT.treeNull);

  // Where a missing child's stub ends: partway toward where that child would sit.
  const stubEnd = (parent: number, side: "left" | "right") => {
    const c = tree.center(parent);
    const dx = tree.childOffset(tree.depthOf(parent)) * 0.6;
    return { x: c.x + (side === "left" ? -dx : dx), y: c.y + s / 2 + STUB_DROP };
  };
  const childPoint = (to: number, side: "left" | "right") => {
    const child = byId.get(to)?.[side];
    if (child === null || child === undefined) {
      const end = stubEnd(to, side);
      return { x: end.x, y: end.y + nullSize * 0.9 };
    }
    return tree.center(child);
  };

  const edges = element.nodes.flatMap((node) =>
    (["left", "right"] as const).flatMap((side) => {
      const child = node[side];
      if (child === null) return [];
      const a = tree.center(node.id);
      const b = tree.center(child);
      // The path runs from the root through open calls to the running one.
      const active = onPath.has(node.id) && (onPath.has(child) || element.current === child);
      const faded = skipped.has(child);
      return [
        <line
          key={`edge-${node.id}-${side}`}
          x1={a.x}
          y1={a.y + s / 2}
          x2={b.x}
          y2={b.y - s / 2}
          stroke={active ? palette.primary : faded ? palette.border : palette.textMuted}
          strokeWidth={active ? 5 : 3}
          strokeDasharray={faded ? "7 6" : undefined}
          opacity={faded ? 0.6 : 1}
        />,
      ];
    }),
  );

  let stub: React.ReactNode = null;
  if (element.nullVisit) {
    const { parent, side } = element.nullVisit;
    const c = tree.center(parent);
    const end = stubEnd(parent, side);
    const label = firstFitting(["null", "∅"], nullSize, s * 1.2, text, "mono") ?? "∅";
    const w = Math.max(nullSize * 2.6, text.width(label, nullSize, "mono") + 14);
    const h = nullSize * 1.8;
    stub = (
      <g key="stub">
        <line
          x1={c.x + (side === "left" ? -s / 4 : s / 4)}
          y1={c.y + s / 2}
          x2={end.x}
          y2={end.y}
          stroke={palette.primary}
          strokeWidth={3}
          strokeDasharray="5 4"
        />
        <rect
          x={end.x - w / 2}
          y={end.y}
          width={w}
          height={h}
          rx={7}
          fill={palette.background}
          stroke={palette.primary}
          strokeWidth={3}
          strokeDasharray="5 4"
        />
        <text
          x={end.x}
          y={end.y + h / 2 + nullSize * 0.35}
          textAnchor="middle"
          fontFamily={FONT_MONO}
          fontSize={nullSize}
          fontWeight={700}
          fill={palette.textMuted}
        >
          {label}
        </text>
      </g>
    );
  }

  // A note beside each node: what its finished call returned, else the state carried down to it. On a phone-sized
  // player only the running call's note stays.
  const results = new Map((element.results ?? []).map((r) => [r.node, r.value]));
  const badges = new Map((element.badges ?? []).map((b) => [b.node, b.text]));
  const notes = element.nodes.flatMap((node) => {
    const result = done.has(node.id) ? results.get(node.id) : undefined;
    const badge = badges.get(node.id);
    if (result === undefined && badge === undefined) return [];
    if (text.compact && node.id !== element.current) return [];
    const room = tree.noteRoom(node.id) - 8;
    // Whole or not at all: a bare "4" next to a node would read like another value.
    const candidates = [result !== undefined ? `↑ ${result}` : badge!];
    const label = firstFitting(candidates, noteSize, room - 16, text, "mono");
    if (!label) return [];
    const c = tree.center(node.id);
    return [{ id: node.id, label, x: c.x + s / 2 + 8, y: c.y, result: result !== undefined }];
  });

  // The value handed up this scene, traveling from the child (or the missing child's stub) to the parent.
  let traveling: React.ReactNode = null;
  if (element.returned) {
    const { to, side, value } = element.returned;
    const from = childPoint(to, side);
    const target = tree.center(to);
    const k = reducedMotion
      ? 1
      : spring({ frame: frame - TRAVEL.from, fps, config: { damping: 20, stiffness: 60, mass: 0.9 } });
    const x = interpolate(k, [0, 1], [from.x, (from.x + target.x) / 2]);
    const y = interpolate(k, [0, 1], [from.y, target.y + s / 2 + (from.y - target.y - s / 2) * 0.35]);
    traveling = (
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: "translate(-50%, -50%)",
          padding: "2px 10px",
          borderRadius: 999,
          background: palette.primary,
          color: palette.primaryText,
          fontFamily: FONT_MONO,
          fontSize: noteSize,
          fontWeight: 700,
          whiteSpace: "nowrap",
          opacity: interpolate(frame, [TRAVEL.from - 6, TRAVEL.from], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        ↑ {value}
      </div>
    );
  }

  return (
    // A full-stage box, so its fading layer has real bounds (see LinkedList).
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {edges}
        {stub}
      </svg>
      {element.nodes.map((node) => {
        const c = tree.center(node.id);
        const current = element.current === node.id;
        const path = onPath.has(node.id);
        const finished = done.has(node.id);
        const skip = skipped.has(node.id);
        // On a phone-sized player the ✓ would cover the value: a double border marks a finished call instead.
        const border = current
          ? `5px solid ${palette.primary}`
          : repeats.has(node.id) && !skip
            ? `4px dotted ${palette.primary}`
            : skip
              ? `2px dashed ${palette.border}`
              : path
                ? `3px solid ${palette.primary}`
                : finished && text.compact
                  ? `6px double ${palette.textMuted}`
                  : `2px solid ${palette.border}`;
        return (
          <div
            key={node.id}
            style={{
              position: "absolute",
              left: c.x - s / 2,
              top: c.y - s / 2,
              width: s,
              height: s,
              boxSizing: "border-box",
              borderRadius: 16,
              background: finished ? palette.surfaceMuted : palette.surface,
              border,
              boxShadow: current ? `0 0 0 6px ${palette.primary}33` : "0 1px 2px rgba(15,23,42,0.08)",
              opacity: skip ? 0.45 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_MONO,
              fontSize: valueSize,
              fontWeight: 700,
              color: skip ? palette.textMuted : palette.text,
            }}
          >
            {node.value}
            {finished && !text.compact ? (
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
                  fontFamily: FONT_MONO,
                  fontSize: noteSize,
                  lineHeight: `${noteSize * 1.4}px`,
                  textAlign: "center",
                }}
              >
                ✓
              </div>
            ) : null}
          </div>
        );
      })}
      {notes.map((note) => (
        <div
          key={`note-${note.id}`}
          style={{
            position: "absolute",
            left: note.x,
            top: note.y,
            transform: "translateY(-50%)",
            padding: "2px 8px",
            borderRadius: 8,
            background: note.result ? palette.surfaceMuted : "transparent",
            border: `1px solid ${palette.border}`,
            color: note.result ? palette.text : palette.textMuted,
            fontFamily: FONT_MONO,
            fontSize: noteSize,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {note.label}
        </div>
      ))}
      {traveling}
    </div>
  );
}
