import { useCurrentFrame, useVideoConfig } from "remotion";

import type { HeapElement, HeapState } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { firstFitting } from "../labels";
import { CANVAS, type HeapPanel } from "../layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/** Frames (after the element enters): a pop's root leaving and last item moving up, then each swap. */
const POP = { from: 6, to: 22 };
const SWAP_FRAMES = 13;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (v: number) => (v < 0.5 ? 2 * v * v : 1 - (-2 * v + 2) ** 2 / 2);

/**
 * Where each item sits at every stage of the step. Items are numbered by their place at the start of the step (the
 * final array with the swaps undone); stage k is after k swaps.
 */
function stages(heap: HeapState): number[][] {
  const swaps = heap.swaps ?? [];
  const start = heap.items.map((_, i) => i);
  const out = [start];
  for (const [a, b] of swaps) {
    const next = [...out.at(-1)!];
    [next[a], next[b]] = [next[b], next[a]];
    out.push(next);
  }
  return out;
}

/** The items in start order (the final array with the swaps undone). */
function startItems(heap: HeapState) {
  const items = [...heap.items];
  for (const [a, b] of [...(heap.swaps ?? [])].reverse()) [items[a], items[b]] = [items[b], items[a]];
  return items;
}

/**
 * Priority queues as a tree with the backing array underneath, always the same list: array position i is the node
 * whose children are 2i + 1 and 2i + 2, and each item moves in both views at once. Beside each array strip: its
 * name ("max-heap", or the storyboard's) on the left, its size against its capacity on the right. A push starts at the next free slot, marked "new",
 * and sifts up one swap at a time; a pop lifts the root out (dashed, "out"), the last item moves to the root, and it
 * sifts down. The pair being swapped is ringed in the accent. Two heaps sit side by side.
 */
export function Heap({ element }: { element: HeapElement }) {
  const { heapPanels, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!heapPanels) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      {element.heaps.map((heap, h) =>
        heapPanels[h] ? (
          <HeapView
            key={h}
            heap={heap}
            panel={heapPanels[h]}
            label={element.labels?.[h] ?? `${heap.kind}-heap`}
            slots={element.slots?.[h] ?? heap.items.length}
            frame={reducedMotion ? 10_000 : frame}
            text={text}
            palette={palette}
          />
        ) : null,
      )}
    </div>
  );
}

function HeapView({
  heap,
  panel,
  label,
  slots,
  frame,
  text,
  palette,
}: {
  heap: HeapState;
  panel: HeapPanel;
  label: string;
  slots: number;
  frame: number;
  text: ReturnType<typeof useScene>["text"];
  palette: ReturnType<typeof useScene>["palette"];
}) {
  const n = heap.items.length;
  const items = startItems(heap);
  const arrangement = stages(heap);
  const swaps = heap.swaps ?? [];
  const popping = heap.popped !== undefined;
  const swapStart = popping ? POP.to : 10;
  const stage = clamp01((frame - swapStart) / (SWAP_FRAMES * Math.max(1, swaps.length))) * swaps.length;
  const k = Math.min(Math.floor(stage), Math.max(0, swaps.length - 1));
  const f = swaps.length ? ease(stage - k) : 0;
  const popT = popping ? ease(clamp01((frame - POP.from) / (POP.to - POP.from))) : 1;
  const swapping = swaps.length && stage < swaps.length ? swaps[k] : undefined;
  // Where item `id` is right now, as a (fractional) array position.
  const slotOf = (id: number) => {
    const before = arrangement[k].indexOf(id);
    const after = arrangement[Math.min(k + 1, arrangement.length - 1)].indexOf(id);
    const at = stage >= swaps.length ? arrangement.at(-1)!.indexOf(id) : before + (after - before) * f;
    // A pop's last item starts in the old last slot (now past the end) and moves to the root.
    return popping && id === 0 && popT < 1 ? n + (0 - n) * popT : at;
  };
  const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
  const nodeAt = (slot: number) => {
    const lo = Math.floor(slot);
    return lo === slot ? panel.node(slot) : lerp(panel.node(lo), panel.node(lo + 1), slot - lo);
  };
  const { nodeWidth: w, nodeHeight: hgt } = panel;
  const size = text.size(TEXT.heapItem);
  const noteSize = text.size(TEXT.heapNote);
  const titleSize = text.size(TEXT.heapTitle);
  const count = heap.capacity !== undefined ? `size ${n}/${heap.capacity}` : `size ${n}`;
  // Beside the root: the name on the left, the size on the right (each shortened, or hidden, when the top level is
  // narrow).
  // Beside the array strip, which leaves room on both sides: the name on the left, the size on the right.
  const stripLeft = panel.cellLeft(0);
  const stripRight = panel.cellLeft(Math.max(0, slots - 1)) + w;
  const side = Math.min(stripLeft - panel.left, panel.right - stripRight) - 16;
  // With a title row (two heaps), the full name goes above the tree and the strip's left side names the kind.
  const title = firstFitting(
    panel.titleTop !== undefined ? [`${heap.kind}-heap`, heap.kind] : [label, `${heap.kind}-heap`, heap.kind],
    titleSize,
    side,
    text,
  );
  const heading =
    panel.titleTop !== undefined
      ? firstFitting([label, `${heap.kind}-heap`], titleSize, panel.right - panel.left, text)
      : undefined;
  const sizeText = firstFitting([count, count.replace("size ", "")], titleSize, side, text);
  const pushedId = heap.pushed && !popping ? n - 1 : undefined;
  // Swapped nodes travel along the tree's edges (between levels), so tree positions interpolate by slot only at
  // stage boundaries; mid-swap, each of the pair moves straight between the two slots' centers.
  const treePos = (id: number) => {
    const slot = slotOf(id);
    if (swapping && (arrangement[k][swapping[0]] === id || arrangement[k][swapping[1]] === id)) {
      const from = arrangement[k].indexOf(id);
      const to = arrangement[k + 1].indexOf(id);
      return lerp(panel.node(from), panel.node(to), f);
    }
    if (popping && id === 0 && popT < 1) return lerp(panel.node(n), panel.node(0), popT);
    return nodeAt(Math.round(slot));
  };
  const cellPos = (id: number) => panel.cellLeft(0) + (panel.cellLeft(1) - panel.cellLeft(0)) * slotOf(id);

  const edges = Array.from({ length: n }, (_, i) => i)
    .filter((i) => i > 0)
    .map((i) => {
      const a = panel.node((i - 1) >> 1);
      const b = panel.node(i);
      return (
        <line
          key={i}
          x1={a.x}
          y1={a.y + hgt / 2}
          x2={b.x}
          y2={b.y - hgt / 2}
          stroke={palette.border}
          strokeWidth={3}
        />
      );
    });

  const box = (key: string, labelText: string, x: number, y: number, style: React.CSSProperties) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: hgt,
        boxSizing: "border-box",
        borderRadius: 12,
        background: palette.surface,
        border: `2px solid ${palette.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_MONO,
        fontSize: size,
        fontWeight: 700,
        color: palette.text,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {labelText}
    </div>
  );
  const tag = (key: string, word: string, x: number, y: number, color: string) =>
    text.compact ? null : (
      <div
        key={key}
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: "translateX(-50%)",
          fontFamily: FONT_SANS,
          fontSize: noteSize,
          fontWeight: 700,
          color,
          whiteSpace: "nowrap",
        }}
      >
        {word}
      </div>
    );
  const ringFor = (id: number) =>
    (swapping && (arrangement[k][swapping[0]] === id || arrangement[k][swapping[1]] === id)) ||
    (id === pushedId && stage < Math.max(1, swaps.length))
      ? { border: `4px solid ${palette.primary}` }
      : {};

  const root = panel.node(0);
  // A popped root steps out to the right, clear of the new root and its children.
  const outX = root.x + w * 1.7;
  const outY = root.y;
  const settled = frame > swapStart + SWAP_FRAMES * swaps.length;

  return (
    <>
      {heading ? (
        <div
          style={{
            position: "absolute",
            left: panel.left,
            width: panel.right - panel.left,
            top: panel.titleTop,
            textAlign: "center",
            fontFamily: FONT_SANS,
            fontSize: titleSize,
            fontWeight: 700,
            color: palette.text,
            whiteSpace: "nowrap",
          }}
        >
          {heading}
        </div>
      ) : null}
      {[
        { key: "title", value: title, left: stripLeft - 16 - side, align: "right" as const },
        { key: "size", value: sizeText, left: stripRight + 16, align: "left" as const },
      ].map((label) =>
        label.value ? (
          <div
            key={label.key}
            style={{
              position: "absolute",
              left: label.left,
              width: side,
              textAlign: label.align,
              top: panel.arrayTop + hgt / 2 - titleSize * 0.65,
              fontFamily: FONT_SANS,
              fontSize: titleSize,
              fontWeight: 700,
              color: palette.textMuted,
              whiteSpace: "nowrap",
            }}
          >
            {label.value}
          </div>
        ) : null,
      )}
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {edges}
      </svg>
      {n === 0 && !popping
        ? box("empty", "", root.x - w / 2, root.y - hgt / 2, {
            border: `2px dashed ${palette.border}`,
            background: "transparent",
          })
        : null}
      {heap.popped
        ? (() => {
            const at = lerp(root, { x: outX, y: outY }, popT);
            return (
              <div key="popped">
                {box("popped-box", heap.popped.label, at.x - w / 2, at.y - hgt / 2, {
                  border: `2px dashed ${palette.textMuted}`,
                  color: palette.textMuted,
                  textDecoration: popT >= 1 ? "line-through" : undefined,
                  opacity: 1 - 0.45 * popT,
                })}
                {popT >= 1 ? tag("popped-tag", "◀ out", at.x, at.y + hgt / 2 + 4, palette.textMuted) : null}
              </div>
            );
          })()
        : null}
      {items.map((item, id) => {
        const c = treePos(id);
        return (
          <div key={`node-${id}`}>
            {box(`n-${id}`, item.label, c.x - w / 2, c.y - hgt / 2, ringFor(id))}
            {id === pushedId && !text.compact
              ? tag(`new-${id}`, settled ? "new" : "new ▲", c.x, c.y + hgt / 2 + 4, palette.primary)
              : null}
          </div>
        );
      })}
      {Array.from({ length: slots }, (_, i) => (
        <div key={`slot-${i}`}>
          {i >= n
            ? box(`empty-${i}`, "", panel.cellLeft(i), panel.arrayTop, {
                border: `2px dashed ${palette.border}`,
                background: "transparent",
              })
            : null}
          {!text.compact ? (
            <div
              style={{
                position: "absolute",
                left: panel.cellLeft(i),
                width: w,
                top: panel.arrayTop + hgt + 4,
                textAlign: "center",
                fontFamily: FONT_MONO,
                fontSize: noteSize,
                color: palette.textMuted,
              }}
            >
              [{i}]
            </div>
          ) : null}
        </div>
      ))}
      {items.map((item, id) => box(`c-${id}`, item.label, cellPos(id), panel.arrayTop, ringFor(id)))}
    </>
  );
}
