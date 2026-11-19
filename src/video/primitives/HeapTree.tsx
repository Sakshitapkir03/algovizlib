import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { HeapTreeElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS, HEAP_TREE_REGION } from "../layout";
import { FONT_MONO, FONT_SANS } from "../theme";

const NODE = 96;
const LABEL_SPACE = 26;

/**
 * The bar-row's array drawn as a binary tree (children of i at 2i + 1 and 2i + 2), on the right of the stage
 * while the bars take a narrow column on the left. It shows the same values, and nodes trade places with the same
 * `moves` as the bars, so the two views visibly stay one piece of data. Each node is labeled with its position.
 * The parent and child being compared get a thick accent ring, a thick edge, and the words "parent" / "child";
 * nodes past the heap are dashed and faded with a "✓" (already in their final place).
 */
export function HeapTree({ element }: { element: HeapTreeElement }) {
  const { palette, reducedMotion } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterProgress(frame, fps, reducedMotion);
  const n = element.values.length;
  const levels = Math.floor(Math.log2(n)) + 1;
  const region = HEAP_TREE_REGION;
  const width = region.right - region.left;
  const rowGap = levels > 1 ? (region.bottom - region.top - NODE - LABEL_SPACE) / (levels - 1) : 0;
  const pos = (i: number) => {
    const depth = Math.floor(Math.log2(i + 1));
    const k = i - (2 ** depth - 1);
    return {
      x: region.left + ((k + 0.5) * width) / 2 ** depth,
      y: region.top + NODE / 2 + depth * rowGap,
    };
  };
  const travel = reducedMotion
    ? 1
    : spring({ frame: frame - 18, fps, config: { damping: 26, stiffness: 40, mass: 1 } });
  const movedFrom = new Map((element.moves ?? []).map((m) => [m.to, m.from]));
  const [parent, child] = element.compare ?? [-1, -1];
  const inHeap = (i: number) => i < element.heapSize;

  const edges = Array.from({ length: n }, (_, i) => i).filter((i) => i > 0);

  return (
    <div style={{ opacity: p }}>
      <div
        style={{
          position: "absolute",
          right: CANVAS.width - region.right,
          top: region.top,
          padding: "4px 12px",
          borderRadius: 999,
          border: `2px solid ${palette.border}`,
          background: palette.surface,
          fontFamily: FONT_SANS,
          fontSize: 17,
          fontWeight: 700,
          color: palette.textMuted,
          whiteSpace: "nowrap",
        }}
      >
        heap: {element.heapSize} {element.heapSize === 1 ? "value" : "values"}
      </div>
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
        aria-hidden
      >
        {edges.map((i) => {
          const up = Math.floor((i - 1) / 2);
          const a = pos(up);
          const b = pos(i);
          const compared = up === parent && i === child;
          const attached = inHeap(i) && inHeap(up);
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={compared ? palette.primary : attached ? palette.textMuted : palette.border}
              strokeWidth={compared ? 6 : attached ? 3 : 2}
              strokeDasharray={attached ? undefined : "6 6"}
            />
          );
        })}
      </svg>
      {element.values.map((value, i) => {
        const home = pos(i);
        const from = movedFrom.get(i);
        const start = from !== undefined ? pos(from) : home;
        const x = interpolate(travel, [0, 1], [start.x, home.x]);
        // A node swapping with its parent bows sideways so the two never overlap mid-move.
        const bow = from !== undefined ? Math.sin(Math.PI * Math.min(1, travel)) * (from < i ? 34 : -34) : 0;
        const y = interpolate(travel, [0, 1], [start.y, home.y]);
        const role = i === parent ? "parent" : i === child ? "child" : undefined;
        const live = inHeap(i);
        return (
          <div key={i}>
            <div
              style={{
                position: "absolute",
                left: x + bow - NODE / 2,
                top: y - NODE / 2,
                width: NODE,
                height: NODE,
                borderRadius: "50%",
                border: role
                  ? `5px solid ${palette.primary}`
                  : live
                    ? `3px solid ${palette.textMuted}`
                    : `2px dashed ${palette.textMuted}`,
                background: role ? `${palette.primary}26` : live ? palette.surfaceMuted : palette.background,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_MONO,
                fontSize: 40,
                fontWeight: 700,
                color: live ? palette.text : palette.textMuted,
              }}
            >
              {value}
            </div>
            <div
              style={{
                position: "absolute",
                left: home.x,
                transform: "translateX(-50%)",
                top: home.y + NODE / 2 + 2,
                padding: "0 6px",
                borderRadius: 6,
                // Edges to the children pass under the label; the background keeps it legible.
                background: palette.background,
                fontFamily: FONT_MONO,
                fontSize: 19,
                fontWeight: role ? 700 : 500,
                color: role ? palette.text : palette.textMuted,
                whiteSpace: "nowrap",
              }}
            >
              [{i}]{role ? ` ${role}` : live ? "" : " ✓"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
