import { useCurrentFrame, useVideoConfig } from "remotion";

import type { DataTableElement } from "@/lib/storyboard";

import { enterProgress, motion } from "../animation";
import { useScene } from "../context";
import { layoutDataTable } from "../system-layout";
import { TEXT } from "../text";
import { FONT_MONO, FONT_SANS } from "../theme";

/**
 * Stored data at one moment of a simulation: one or two small tables side by side. What the step did to a row is a
 * border style, never color alone: new is solid accent, read is a double green border with ✓, a duplicate is dashed
 * rose with ✕, a row being waited on is dotted accent. An empty table shows one dashed "empty" row.
 */
export function DataTable({ element }: { element: DataTableElement }) {
  const { palette, reducedMotion, text } = useScene();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterProgress(frame, fps, reducedMotion);
  const marked = enterProgress(frame, fps, reducedMotion, 12);
  const shape = layoutDataTable(element, text);
  const cell = text.size(TEXT.tableCell);

  const rowStyle = (mark?: string): React.CSSProperties => {
    switch (mark) {
      case "new":
        return { border: `3px solid ${palette.primary}`, background: `${palette.primary}1f` };
      case "read":
        return { border: `5px double ${palette.success}`, background: `${palette.success}14` };
      case "duplicate":
        return { border: `3px dashed ${palette.danger}`, background: `${palette.danger}14` };
      case "waiting":
        return { border: `3px dotted ${palette.primary}` };
      default:
        return { border: `1.5px solid ${palette.border}` };
    }
  };
  const glyph = (mark?: string) => (mark === "read" ? "✓" : mark === "duplicate" ? "✕" : "");

  return (
    <div
      style={{
        position: "relative",
        width: shape.width,
        height: shape.height,
        opacity: p,
        transform: `translateY(${motion((1 - p) * 10, reducedMotion)}px)`,
      }}
    >
      {element.tables.map((table, k) => {
        const place = shape.tables[k];
        return (
          <div key={table.id} style={{ position: "absolute", left: place.x, top: 0, width: place.w }}>
            <div
              style={{
                height: shape.titleH,
                fontFamily: FONT_SANS,
                fontSize: text.size(TEXT.tableTitle),
                fontWeight: 700,
                color: palette.textMuted,
                whiteSpace: "nowrap",
              }}
            >
              {table.title}
            </div>
            {shape.headerH > 0 ? (
              <div style={{ display: "flex", height: shape.headerH }}>
                {table.columns.map((c, i) => (
                  <div
                    key={c}
                    style={{
                      width: place.cols[i],
                      paddingLeft: 14,
                      fontFamily: FONT_MONO,
                      fontSize: text.size(TEXT.tableHeader),
                      color: palette.textMuted,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c}
                  </div>
                ))}
              </div>
            ) : null}
            {(table.rows.length ? table.rows : [undefined]).map((row, r) => (
              <div
                key={r}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  height: shape.rowH - 6,
                  marginBottom: 6,
                  boxSizing: "border-box",
                  borderRadius: 10,
                  background: palette.surface,
                  ...(row
                    ? rowStyle(marked > 0.5 ? row.mark : undefined)
                    : { border: `1.5px dashed ${palette.border}` }),
                }}
              >
                {row ? (
                  row.cells.map((c, i) => (
                    <div
                      key={i}
                      style={{
                        width: place.cols[i],
                        paddingLeft: 12,
                        boxSizing: "border-box",
                        fontFamily: FONT_MONO,
                        fontSize: cell,
                        fontWeight: i === 0 ? 700 : 500,
                        color: row.mark === "duplicate" ? palette.danger : palette.text,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c}
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      paddingLeft: 12,
                      fontFamily: FONT_MONO,
                      fontSize: cell,
                      color: palette.textMuted,
                    }}
                  >
                    empty
                  </div>
                )}
                {row && glyph(row.mark) && marked > 0.5 ? (
                  <div
                    style={{
                      position: "absolute",
                      right: -cell * 0.9,
                      fontFamily: FONT_SANS,
                      fontSize: cell,
                      fontWeight: 800,
                      color: row.mark === "read" ? palette.success : palette.danger,
                    }}
                  >
                    {glyph(row.mark)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
