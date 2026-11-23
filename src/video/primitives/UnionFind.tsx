import { useCurrentFrame, useVideoConfig } from "remotion";

import type { UnionFindElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { parentsBefore } from "../forest-layout";
import { CANVAS } from "../layout";
import { ARROW_HEAD } from "../network-layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * Union-find as trees: an arrow from each element up to its parent, roots on top with a note ("chief · 3"). The
 * scene's finds light their path (nodes ringed, links thick, in the accent) from the start; a beat later the work
 * lands: links rewired by path compression ghost out (dashed) as their shortcuts draw in, a union's new arrow draws
 * in, and the trees slide into their new shape. A root two elements already share gets a dashed rose ring and ✕.
 */
export function UnionFind({ element }: { element: UnionFindElement }) {
  const { forest: shape, palette, reducedMotion, text, sceneDurationInFrames } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!shape) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  const changeAt = Math.min(45, Math.round(sceneDurationInFrames * 0.3));
  const raw = enterProgress(frame, fps, reducedMotion, changeAt);
  // Under reduced motion nothing slides: the trees switch shape halfway through the fade.
  const move = reducedMotion ? (raw >= 0.5 ? 1 : 0) : raw;
  const size = shape.nodeSize;
  const r = size / 2;
  const before = parentsBefore(element);
  const at = (id: number) => {
    const a = shape.before(id);
    const b = shape.after(id);
    return { x: a.x + (b.x - a.x) * move, y: a.y + (b.y - a.y) * move };
  };
  const onPath = new Set((element.finds ?? []).flatMap((f) => f.path));
  const pathLinks = new Set(
    (element.finds ?? []).flatMap((f) => f.path.slice(0, -1).map((x, k) => `${x}>${f.path[k + 1]}`)),
  );
  const union = element.union;

  const arrow = (
    from: number,
    to: number,
    style: { color: string; width: number; dash?: string; opacity: number },
  ) => {
    const a = at(from);
    const b = at(to);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const start = { x: a.x + u.x * r, y: a.y + u.y * r };
    const tip = { x: b.x - u.x * (r + 3), y: b.y - u.y * (r + 3) };
    const head = ARROW_HEAD + style.width;
    const back = { x: tip.x - u.x * head, y: tip.y - u.y * head };
    const side = { x: -u.y * head * 0.5, y: u.x * head * 0.5 };
    return (
      <g key={`a-${from}-${to}`} opacity={style.opacity}>
        <line
          x1={start.x}
          y1={start.y}
          x2={tip.x - u.x * head * 0.7}
          y2={tip.y - u.y * head * 0.7}
          stroke={style.color}
          strokeWidth={style.width}
          strokeDasharray={style.dash}
          strokeLinecap="round"
        />
        <polygon
          points={`${tip.x},${tip.y} ${back.x + side.x},${back.y + side.y} ${back.x - side.x},${back.y - side.y}`}
          fill={style.color}
        />
      </g>
    );
  };

  const links: React.ReactNode[] = [];
  element.labels.forEach((_, i) => {
    const old = before[i];
    const now = element.parents[i];
    const lit = pathLinks.has(`${i}>${old}`);
    const base = { color: lit ? palette.primary : palette.textMuted, width: lit ? 5 : 3, opacity: 1 };
    if (old === now) {
      if (now !== i) links.push(arrow(i, now, base));
      return;
    }
    // A rewired link (or a root that now has a parent): the old one ghosts out, the new one draws in.
    if (old !== i) links.push(arrow(i, old, { ...base, dash: "8 7", opacity: 1 - 0.75 * move }));
    links.push(
      arrow(i, now, {
        color: palette.primary,
        width: 5,
        opacity: move,
      }),
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
        {links}
      </svg>
      {element.labels.map((label, i) => {
        const c = at(i);
        const same = element.same === i;
        const isRoot = element.parents[i] === i;
        const joined = union?.parent === i && move > 0.5;
        const border = same
          ? `4px dashed ${palette.danger}`
          : onPath.has(i)
            ? `5px solid ${palette.primary}`
            : joined
              ? `4px solid ${palette.primary}`
              : isRoot
                ? `3px double ${palette.text}`
                : `2px solid ${palette.border}`;
        return (
          <div
            key={`n-${i}`}
            style={{
              position: "absolute",
              left: c.x - r,
              top: c.y - r,
              width: size,
              height: size,
              boxSizing: "border-box",
              borderRadius: "50%",
              border,
              background: onPath.has(i) ? `${palette.primary}26` : palette.surface,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_MONO,
              fontSize: text.size(TEXT.forestLabel),
              fontWeight: 700,
              color: palette.text,
            }}
          >
            {label}
          </div>
        );
      })}
      {element.labels.map((_, i) => {
        const box = shape.note(i);
        const same = element.same === i;
        if (!box && !same) return null;
        const c = at(i);
        const noteSize = text.size(TEXT.forestNote);
        return (
          <div key={`note-${i}`}>
            {box ? (
              <div
                style={{
                  position: "absolute",
                  left: c.x - box.w / 2,
                  top: c.y - r - box.h,
                  width: box.w,
                  height: box.h,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT_SANS,
                  fontSize: noteSize,
                  fontWeight: 700,
                  color: palette.textMuted,
                  whiteSpace: "nowrap",
                }}
              >
                {box.text}
              </div>
            ) : null}
            {same ? (
              <div
                style={{
                  position: "absolute",
                  left: c.x + r * 0.78,
                  top: c.y - r * 0.05,
                  fontFamily: FONT_MONO,
                  fontSize: text.size(TEXT.networkGlyph),
                  fontWeight: 800,
                  color: palette.danger,
                }}
              >
                ✕
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
