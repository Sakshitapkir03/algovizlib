import { useCurrentFrame, useVideoConfig } from "remotion";

import type { LoadChartElement } from "@/lib/storyboard";

import { enterProgress } from "../animation";
import { useScene } from "../context";
import { CANVAS } from "../layout";
import { chartMs } from "../system-layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * A growth story's measured windows: offered load as a dashed outline, served throughput as a bar, p99 under each
 * column, grouped by replay. A saturated window's bar is hatched rose with a ✕ and its error count when requests were
 * turned away (pattern and glyph, never color alone); a group that saturated gets a dashed line at its measured
 * limit. The window this step measured is ringed in the accent; a p99 three times the previous one is marked ▲.
 */
export function LoadChart({ element }: { element: LoadChartElement }) {
  const { palette, reducedMotion, text, load: s } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterProgress(frame, fps, reducedMotion);
  const grow = enterProgress(frame, fps, reducedMotion, 8);
  if (!s) return null;
  const valueSize = text.size(TEXT.chartValue);
  const chipSize = text.size(TEXT.chartChip);
  const labelSize = text.size(TEXT.chartLabel);
  const groupSize = text.size(TEXT.chartGroup);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        <defs>
          <pattern
            id="sat-hatch"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="10" height="10" fill={`${palette.danger}33`} />
            <line x1="0" y1="0" x2="0" y2="10" stroke={palette.danger} strokeWidth="4" />
          </pattern>
        </defs>
        <line
          x1={52}
          y1={s.barBottom}
          x2={CANVAS.width - 52}
          y2={s.barBottom}
          stroke={palette.border}
          strokeWidth={2}
        />
        {element.windows.map((w, k) => {
          const col = s.columns[k];
          const current = k === element.current;
          const top = s.y(w.served);
          const height = (s.barBottom - top) * (current ? grow : 1);
          return (
            <g key={k}>
              {current ? (
                <rect
                  x={col.x - col.w / 2 - 12}
                  y={s.valueY - 4}
                  width={col.w + 24}
                  height={s.barBottom - s.valueY + 8}
                  rx={10}
                  fill="none"
                  stroke={palette.primary}
                  strokeWidth={3}
                />
              ) : null}
              <rect
                x={col.x - col.w / 2}
                y={s.y(w.offered)}
                width={col.w}
                height={s.barBottom - s.y(w.offered)}
                fill="none"
                stroke={palette.textMuted}
                strokeWidth={2}
                strokeDasharray="6 5"
              />
              <rect
                x={col.x - col.w / 2 + 3}
                y={s.barBottom - height}
                width={col.w - 6}
                height={height}
                rx={4}
                fill={w.saturated ? "url(#sat-hatch)" : current ? palette.primary : palette.secondary}
                stroke={w.saturated ? palette.danger : "none"}
                strokeWidth={w.saturated ? 2 : 0}
              />
            </g>
          );
        })}
        {s.groups.map((g) =>
          g.limit !== undefined ? (
            <line
              key={`limit-${g.from}`}
              x1={g.x0}
              y1={s.y(g.limit)}
              x2={g.x1}
              y2={s.y(g.limit)}
              stroke={palette.danger}
              strokeWidth={2.5}
              strokeDasharray="10 6"
            />
          ) : null,
        )}
      </svg>
      {s.groups.map((g) => (
        <div
          key={`group-${g.from}`}
          style={{
            position: "absolute",
            left: g.x0,
            top: s.groupY,
            width: g.x1 - g.x0,
            height: s.rowH.group,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            borderBottom: `2px solid ${palette.border}`,
            fontFamily: FONT_SANS,
            fontSize: groupSize,
            fontWeight: 700,
            color: palette.textMuted,
            whiteSpace: "nowrap",
          }}
        >
          {g.label}
          {g.limit !== undefined && !text.compact ? (
            <span style={{ fontFamily: FONT_MONO, color: palette.danger }}>limit ≈ {g.limit}/s</span>
          ) : null}
        </div>
      ))}
      {element.windows.map((w, k) => {
        const col = s.columns[k];
        const current = k === element.current;
        const prev = k > 0 && element.windows[k - 1].group === w.group ? element.windows[k - 1] : undefined;
        const climb = prev !== undefined && prev.p99 > 0 && w.p99 >= 3 * prev.p99;
        const show = s.shows(k);
        const value = `${w.served}${w.errors ? ` ✕${w.errors}` : ""}`;
        const chip = s.chip(k, `${climb ? "▲ " : ""}${chartMs(w.p99)}`);
        return (
          <div key={k}>
            {show ? (
              <div
                style={{
                  position: "absolute",
                  left: col.x - 90,
                  width: 180,
                  top: s.y(w.served) - s.rowH.value - 2,
                  textAlign: "center",
                  fontFamily: FONT_MONO,
                  fontSize: valueSize,
                  fontWeight: 800,
                  color: w.saturated ? palette.danger : palette.text,
                  whiteSpace: "nowrap",
                }}
              >
                {value}
              </div>
            ) : null}
            {show && element.chips !== false ? (
              <div
                style={{
                  position: "absolute",
                  left: chip.x,
                  width: chip.w,
                  top: chip.y,
                  height: chip.h,
                  boxSizing: "border-box",
                  borderRadius: 999,
                  border: `${current ? 3 : 1.5}px ${climb ? "dashed" : "solid"} ${current ? palette.primary : climb ? palette.danger : palette.border}`,
                  background: palette.background,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT_MONO,
                  fontSize: chipSize,
                  fontWeight: 700,
                  color: climb ? palette.danger : palette.text,
                  whiteSpace: "nowrap",
                }}
              >
                {climb ? "▲ " : ""}
                {chartMs(w.p99)}
              </div>
            ) : null}
            <div
              style={{
                position: "absolute",
                left: col.x - 60,
                width: 120,
                top: s.labelY,
                textAlign: "center",
                fontFamily: FONT_MONO,
                fontSize: labelSize,
                color: current ? palette.primary : palette.textMuted,
                fontWeight: current ? 800 : 500,
              }}
            >
              {w.label}
              {element.labelUnit ?? "/s"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
