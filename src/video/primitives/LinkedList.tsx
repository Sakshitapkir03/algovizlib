import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { LinkedListElement, ListNode } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { firstFitting } from "../labels";
import { arrowHeadPoints, type Box, DOUBLY_NEXT, listLinkPath } from "../list-links";
import { CANVAS } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO } from "../theme";

/** When a rewired link's old arrow ghosts away and the new one draws in (frames after the element enters). */
const REWIRE = { ghostFrom: 6, ghostTo: 34, drawFrom: 14, drawTo: 40 };

/**
 * Linked lists as node boxes in lanes, an arrow from each node to its `next`, and a "null" end. Arrows between
 * neighbors in a lane are straight; arrows that point backward or skip nodes curve under the lane; arrows to another
 * lane are S-curves. A dummy node is dashed. Nodes slide from `fromPlaces` as the scene starts, and the arrows
 * follow them. A rewired link's old arrow turns dashed and fades while the new one draws in from its node.
 */
export function LinkedList({ element }: { element: LinkedListElement }) {
  const { list, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!list) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  const { nodeWidth: w, nodeHeight: h } = list;

  const travel = reducedMotion
    ? 1
    : spring({ frame: frame - 4, fps, config: { damping: 22, stiffness: 70, mass: 0.9 } });
  const from = new Map((element.fromPlaces ?? []).map((place) => [place.id, place]));
  const boxOf = (node: ListNode): Box => {
    const old = from.get(node.id);
    const x1 = list.slotLeft(node.lane, node.slot);
    const y1 = list.laneTops[node.lane];
    if (!old) return { x: x1, y: y1, w, h };
    const x0 = list.slotLeft(old.lane, old.slot);
    const y0 = list.laneTops[old.lane] ?? y1;
    return { x: interpolate(travel, [0, 1], [x0, x1]), y: interpolate(travel, [0, 1], [y0, y1]), w, h };
  };
  const byId = new Map(element.nodes.map((node) => [node.id, node]));
  const boxes = new Map(element.nodes.map((node) => [node.id, boxOf(node)]));

  const valueSize = text.size(TEXT.listValue);
  const nullSize = text.size(TEXT.listNull);
  const labelSize = text.size(TEXT.laneLabel);
  const rewired = new Map((element.rewired ?? []).map((r) => [r.node, r]));
  const draw = reducedMotion
    ? interpolate(frame, [REWIRE.drawFrom, REWIRE.drawFrom + 8], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : interpolate(frame, [REWIRE.drawFrom, REWIRE.drawTo], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const ghost = reducedMotion
    ? 0
    : interpolate(frame, [REWIRE.ghostFrom, REWIRE.ghostTo], [0.9, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  // A doubly linked list (its nodes carry back links) also draws an arrow from each node to its `prev`.
  const doubly = element.nodes.some((node) => node.prev !== undefined);
  const linkPath = (a: Box, aNode: ListNode, b: Box, bNode: ListNode) =>
    listLinkPath(a, aNode, b, bNode, list.dip, doubly);
  const head = (tip: readonly [number, number, number], color: string, opacity = 1) => (
    <polygon points={arrowHeadPoints(tip)} fill={color} opacity={opacity} />
  );

  const links: React.ReactNode[] = [];
  const nulls: React.ReactNode[] = [];
  for (const node of element.nodes) {
    const a = boxes.get(node.id)!;
    const before = node.prev === null || node.prev === undefined ? undefined : byId.get(node.prev);
    if (before) {
      const path = linkPath(a, node, boxes.get(before.id)!, before);
      links.push(
        <g key={`prev-${node.id}`}>
          <path d={path.d} fill="none" stroke={palette.textMuted} strokeWidth={2.5} />
          {head(path.end, palette.textMuted)}
        </g>,
      );
    }
    const change = rewired.get(node.id);
    // The old link, ghosted while the new one draws in.
    if (change && change.from !== null && ghost > 0) {
      const target = byId.get(change.from);
      if (target) {
        const path = linkPath(a, node, boxes.get(change.from)!, target);
        links.push(
          <g key={`old-${node.id}`} opacity={ghost}>
            <path d={path.d} fill="none" stroke={palette.textMuted} strokeWidth={3} strokeDasharray="8 7" />
            {head(path.end, palette.textMuted)}
          </g>,
        );
      }
    }
    const progress = change ? draw : 1;
    if (node.next === null) {
      // A null end: a dashed "null" box in the free slot after the node, or before it when that slot is taken
      // (a reversed list's new tail), with an arrow to it.
      const label = firstFitting(["null", "∅"], nullSize, w * 0.7, text, "mono") ?? "∅";
      const gap = list.slotLeft(node.lane, 1) - list.slotLeft(node.lane, 0) - a.w;
      const boxWidth = Math.min(w, Math.max(nullSize * 2.8, w * 0.62));
      const right = list.nullSide(node) === "right";
      const y = right ? a.y + a.h * (doubly ? DOUBLY_NEXT : 0.5) : a.y + a.h * 0.7;
      const [x0, x1] = right ? [a.x + a.w, a.x + a.w + gap - 2] : [a.x, a.x - gap + 2];
      const bx = right ? a.x + a.w + gap : a.x - gap - boxWidth;
      nulls.push(
        <g key={`null-${node.id}`} opacity={progress}>
          <line x1={x0} y1={y} x2={x1} y2={y} stroke={palette.textMuted} strokeWidth={3} />
          {head([x1, y, right ? 0 : Math.PI], palette.textMuted)}
          <rect
            x={bx}
            y={y - nullSize * 0.9}
            width={boxWidth}
            height={nullSize * 1.8}
            rx={8}
            fill="none"
            stroke={palette.border}
            strokeWidth={2}
            strokeDasharray="5 4"
          />
          <text
            x={bx + boxWidth / 2}
            y={y + nullSize * 0.35}
            textAnchor="middle"
            fontFamily={FONT_MONO}
            fontSize={nullSize}
            fontWeight={700}
            fill={palette.textMuted}
          >
            {label}
          </text>
        </g>,
      );
      continue;
    }
    const target = byId.get(node.next);
    if (!target) continue;
    const path = linkPath(a, node, boxes.get(node.next)!, target);
    const color = change ? palette.primary : palette.textMuted;
    links.push(
      <g key={`link-${node.id}`}>
        <path
          d={path.d}
          fill="none"
          stroke={color}
          strokeWidth={change ? 4 : 3}
          pathLength={1}
          strokeDasharray={progress < 1 ? `${progress} 1` : undefined}
        />
        {progress > 0.85 ? head(path.end, color, (progress - 0.85) / 0.15) : null}
      </g>,
    );
  }

  return (
    // A full-stage box (not a zero-size wrapper): its fading layer then has real bounds, and Chrome paints every
    // node and arrow in it.
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      {(text.compact ? [] : (element.laneLabels ?? [])).map((label, lane) =>
        list.laneTops[lane] === undefined || !label || !list.present[lane] ? null : (
          <div
            key={`lane-${lane}`}
            style={{
              position: "absolute",
              left: list.labelLeft,
              top: list.laneTops[lane] + h / 2 - labelSize * 0.7,
              width: list.labelWidth - 10,
              fontFamily: FONT_MONO,
              fontSize: labelSize,
              fontWeight: 700,
              color: palette.textMuted,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {label}
          </div>
        ),
      )}
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {links}
        {nulls}
      </svg>
      {element.nodes.map((node) => {
        const box = boxes.get(node.id)!;
        // The dummy's word is smaller than a value; on a narrow node it shortens to "D" (the dashed border still
        // marks it).
        const size = node.dummy ? text.size(TEXT.listDummy) : valueSize;
        const value = node.dummy
          ? (firstFitting(["dummy", "D"], size, w - 12, text, "mono") ?? "D")
          : String(node.value);
        return (
          <div
            key={node.id}
            style={{
              position: "absolute",
              left: box.x,
              top: box.y,
              width: box.w,
              height: box.h,
              borderRadius: 14,
              background: node.dummy ? "transparent" : palette.surface,
              border: node.dummy ? `3px dashed ${palette.textMuted}` : `2px solid ${palette.border}`,
              boxShadow: node.dummy ? "none" : "0 1px 2px rgba(15,23,42,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_MONO,
              fontSize: size,
              fontWeight: 700,
              color: node.dummy ? palette.textMuted : palette.text,
            }}
          >
            {value}
          </div>
        );
      })}
    </div>
  );
}
