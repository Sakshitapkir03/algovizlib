import { useCurrentFrame, useVideoConfig } from "remotion";

import type { OpLogElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { OPLOG } from "../oplog-layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * A design problem's calls as a column on the left, one row per call with its output on the right, like the problem
 * page's operation table. Finished calls are solid with their outputs; the running call has a thick accent border
 * and its output appears (in the accent) once it returns; calls still to come are dashed and empty. A long sequence
 * shows a window that keeps the running call in view; the title (hidden on a phone-sized player) says which calls.
 */
export function OpLog({ element }: { element: OpLogElement }) {
  const { opLog: shape, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!shape) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  const reveal = enterProgress(frame, fps, reducedMotion, 10);
  const size = text.size(TEXT.opCall);
  const titleSize = text.size(TEXT.opTitle);
  const n = element.calls.length;
  const width = shape.right - shape.left;
  const windowed = shape.count < n;
  const title = windowed
    ? `${element.label} ${shape.first + 1}–${shape.first + shape.count} of ${n}`
    : element.label;

  return (
    // A full-stage box, so its fading layer has real bounds (see LinkedList).
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      {shape.titleTop !== undefined ? (
        <div
          style={{
            position: "absolute",
            left: shape.left,
            top: shape.titleTop,
            width,
            fontFamily: FONT_SANS,
            fontSize: titleSize,
            fontWeight: 700,
            color: palette.textMuted,
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
      ) : null}
      {Array.from({ length: shape.count }, (_, k) => {
        const index = shape.first + k;
        const running = element.current === index;
        const done = index < element.shown;
        // The running call's output appears a beat into the scene, the moment it returns.
        const fresh = running && done;
        const border = running
          ? `4px solid ${palette.primary}`
          : done
            ? `2px solid ${palette.border}`
            : `2px dashed ${palette.border}`;
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: shape.left,
              top: shape.top + k * (shape.rowHeight + OPLOG.rowGap),
              width,
              height: shape.rowHeight,
              boxSizing: "border-box",
              borderRadius: 8,
              border,
              background: done || running ? palette.surface : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: `0 ${OPLOG.padX - (running ? 2 : 0)}px`,
              fontFamily: FONT_MONO,
              fontSize: size,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: running || done ? palette.text : palette.textMuted }}>
              {shape.labels[index]}
            </span>
            {done ? (
              <span
                style={{
                  color: fresh ? palette.primary : palette.textMuted,
                  opacity: fresh ? reveal : 1,
                  transform: fresh ? `translateX(${motion((1 - reveal) * 12, reducedMotion)}px)` : undefined,
                }}
              >
                {shape.outputs[index]}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
