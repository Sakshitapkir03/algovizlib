import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import type { TrieElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO } from "../theme";
import { MISSING } from "../trie-layout";

/**
 * A prefix tree, root at the top, one letter per node. A word's end has a double ring and a ✓ (and its note, such as
 * the root word, beside it); the path from the root to the current node is drawn in the accent, its nodes with a thick
 * accent border; a wildcard's other candidates get a dashed accent ring; a node completing a word this scene turns
 * green. Nodes created in this scene pop in after the rest; a missing child is a dashed stub with its letter and ✕;
 * removed nodes fade out where they were.
 */
export function Trie({ element }: { element: TrieElement }) {
  const { trie: shape, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!shape) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  const later = enterProgress(frame, fps, reducedMotion, 12);
  const pop = reducedMotion ? 1 : interpolate(later, [0, 0.6, 1], [0.4, 1.12, 1]);
  const size = shape.nodeSize;
  const letterSize = text.size(TEXT.trieLetter);
  const onPath = new Set(element.path);
  const created = new Set(element.created ?? []);
  const branches = new Set(element.branches ?? []);
  const hits = new Set(element.hits ?? []);
  const pruned = (element.pruned ?? []).filter((n) => !element.nodes.some((m) => m.id === n.id));
  const fade = interpolate(later, [0, 1], [0.8, 0]);

  const edges = [...element.nodes, ...pruned]
    .filter((n) => n.parent !== null)
    .map((n) => ({ n, gone: pruned.includes(n) }));
  const missing = element.missing;

  return (
    // A full-stage box, so its fading layer has real bounds (see LinkedList).
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {edges.map(({ n, gone }) => {
          const a = shape.center(n.parent!);
          const b = shape.center(n.id);
          if (!a || !b) return null;
          const lit = onPath.has(n.id) && onPath.has(n.parent!);
          return (
            <line
              key={`e-${n.id}`}
              x1={a.x}
              y1={a.y + size / 2}
              x2={b.x}
              y2={b.y - size / 2}
              stroke={lit ? palette.primary : palette.border}
              strokeWidth={lit ? 5 : 3}
              opacity={gone ? fade : created.has(n.id) ? later : 1}
            />
          );
        })}
        {missing
          ? (() => {
              const a = shape.center(missing.parent);
              const b = shape.center(MISSING);
              if (!a || !b) return null;
              return (
                <line
                  x1={a.x}
                  y1={a.y + size / 2}
                  x2={b.x}
                  y2={b.y - size / 2}
                  stroke={palette.danger}
                  strokeWidth={3}
                  strokeDasharray="7 6"
                  opacity={later}
                />
              );
            })()
          : null}
      </svg>
      {[...element.nodes, ...pruned].map((n) => {
        const c = shape.center(n.id);
        if (!c) return null;
        const gone = pruned.includes(n);
        const root = n.parent === null;
        const path = onPath.has(n.id);
        const hit = hits.has(n.id);
        const border = hit
          ? `5px double ${palette.success}`
          : n.end
            ? `6px double ${path ? palette.primary : palette.textMuted}`
            : branches.has(n.id)
              ? `4px dashed ${palette.primary}`
              : path
                ? `4px solid ${palette.primary}`
                : `2px solid ${palette.border}`;
        const isNew = created.has(n.id);
        const note = shape.note(n.id);
        return (
          <div key={`n-${n.id}`} style={{ opacity: gone ? fade : isNew ? later : 1 }}>
            <div
              style={{
                position: "absolute",
                left: c.x - size / 2,
                top: c.y - size / 2,
                width: size,
                height: size,
                boxSizing: "border-box",
                borderRadius: "50%",
                border,
                background: hit ? `${palette.success}29` : path ? `${palette.primary}26` : palette.surface,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_MONO,
                fontSize: letterSize,
                fontWeight: 700,
                color: root ? palette.textMuted : palette.text,
                transform: isNew ? `scale(${pop})` : undefined,
              }}
            >
              {root ? "·" : n.letter}
            </div>
            {n.end && !root ? (
              <div
                style={{
                  position: "absolute",
                  left: c.x + size / 2 - letterSize * 0.55,
                  top: c.y - size / 2 - letterSize * 0.35,
                  fontFamily: FONT_MONO,
                  fontSize: text.size(TEXT.trieNote),
                  fontWeight: 800,
                  color: hit ? palette.success : palette.textMuted,
                }}
              >
                ✓
              </div>
            ) : null}
            {note ? (
              <div
                style={{
                  position: "absolute",
                  left: note.x,
                  top: note.y + size * 0.45,
                  fontFamily: FONT_MONO,
                  fontSize: text.size(TEXT.trieNote),
                  fontWeight: 700,
                  color: palette.textMuted,
                  whiteSpace: "nowrap",
                }}
              >
                {note.text}
              </div>
            ) : null}
          </div>
        );
      })}
      {missing
        ? (() => {
            const c = shape.center(MISSING);
            if (!c) return null;
            return (
              <div
                style={{
                  position: "absolute",
                  left: c.x - size / 2,
                  top: c.y - size / 2,
                  width: size,
                  height: size,
                  boxSizing: "border-box",
                  borderRadius: "50%",
                  border: `3px dashed ${palette.danger}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT_MONO,
                  fontSize: letterSize * 0.8,
                  fontWeight: 700,
                  color: palette.danger,
                  opacity: later,
                }}
              >
                {missing.letter}✕
              </div>
            );
          })()
        : null}
    </div>
  );
}
