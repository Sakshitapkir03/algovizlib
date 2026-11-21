import { useCurrentFrame, useVideoConfig } from "remotion";

import type { CallStackElement, StackFrame } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { firstFitting } from "../labels";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/** What a frame is doing, longest first (shorter forms when the column is narrow). */
function noteOptions(frame: StackFrame, top: boolean): string[] {
  if (frame.returns !== undefined) return [`returns ${frame.returns}`, `→ ${frame.returns}`];
  if (frame.waiting === "left") return ["waiting for left", "wait: left", "◀ left"];
  if (frame.waiting === "right") return ["waiting for right", "wait: right", "right ▶"];
  return top ? ["● running", "●"] : [""];
}

/**
 * The recursion's open calls, bottom (the first call) to top (the running one), beside the tree. Each frame shows
 * the call and what it's doing ("waiting for left", "returns 3"). The running frame has the accent border, like its
 * node's ring; a returning frame is dashed (it pops next). Frames pushed since the previous bound scene slide down
 * into place.
 */
export function CallStack({ element }: { element: CallStackElement }) {
  const { stack, palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!stack) return null;
  const p = enterProgress(frame, fps, reducedMotion);
  const labelSize = text.size(TEXT.stackLabel);
  const noteSize = text.size(TEXT.stackNote);
  const titleSize = text.size(TEXT.stackTitle);
  const kept = element.kept ?? element.frames.length;
  const n = element.frames.length;
  const rowAt = (k: number) => stack.bottom - (k + 1) * stack.frameHeight - k * stack.gap;

  return (
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      {!text.compact ? (
        <div
          style={{
            position: "absolute",
            left: stack.left,
            top: Math.max(stack.top, rowAt(Math.max(0, n - 1)) - titleSize - 14),
            fontFamily: FONT_SANS,
            fontSize: titleSize,
            fontWeight: 700,
            color: palette.textMuted,
            whiteSpace: "nowrap",
          }}
        >
          {element.label}
        </div>
      ) : null}
      {n === 0 ? (
        <div
          style={{
            position: "absolute",
            left: stack.left,
            top: rowAt(0),
            width: stack.width,
            height: stack.frameHeight,
            boxSizing: "border-box",
            borderRadius: 10,
            border: `2px dashed ${palette.border}`,
          }}
        />
      ) : null}
      {element.frames.map((f, k) => {
        const top = k === n - 1;
        const pushed = k >= kept;
        // Pushed frames arrive one after another, bottom first.
        const arrive = pushed ? enterProgress(frame, fps, reducedMotion, 6 + (k - kept) * 6) : 1;
        const labelWidth = text.width(f.label, labelSize, "mono");
        const note = firstFitting(noteOptions(f, top), noteSize, stack.width - labelWidth - 36, text) ?? "";
        const returning = f.returns !== undefined;
        return (
          <div
            key={`${k}-${f.label}`}
            style={{
              position: "absolute",
              left: stack.left,
              top: rowAt(k),
              width: stack.width,
              height: stack.frameHeight,
              boxSizing: "border-box",
              padding: "0 12px",
              borderRadius: 10,
              background: palette.surface,
              border: returning
                ? `3px dashed ${palette.primary}`
                : top
                  ? `3px solid ${palette.primary}`
                  : `2px solid ${palette.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              opacity: arrive,
              transform: `translateY(${motion((arrive - 1) * 24, reducedMotion)}px)`,
            }}
          >
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: labelSize,
                fontWeight: 700,
                color: palette.text,
                whiteSpace: "nowrap",
              }}
            >
              {f.label}
            </span>
            <span
              style={{
                fontFamily: FONT_SANS,
                fontSize: noteSize,
                fontWeight: 700,
                color: returning || top ? palette.primary : palette.textMuted,
                whiteSpace: "nowrap",
              }}
            >
              {note}
            </span>
          </div>
        );
      })}
    </div>
  );
}
