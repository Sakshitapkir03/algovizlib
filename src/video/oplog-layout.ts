import { VIDEO_WIDTH, type OpLogElement } from "@/lib/storyboard";

import { TEXT, type TextMetrics } from "./text";

/** Room around an op log's rows; the column never takes more than `maxShare` of the stage. */
export const OPLOG = { left: 36, padX: 14, gap: 18, rowGap: 6, maxShare: 0.42, stageGap: 32 };

export type OpLogShape = {
  left: number;
  right: number;
  /** The title's top (hidden on a phone-sized player) and the first row's top. */
  titleTop?: number;
  top: number;
  rowHeight: number;
  /**
   * Calls drawn as `labels[k]` and outputs as `outputs[k]`: when the full form is too wide, the compact one drops
   * spaces and quotes, and then a key every call shares (and the outputs' quotes).
   */
  labels: string[];
  outputs: string[];
  /** The rows in view: calls first…first + count − 1 (a long sequence scrolls to keep the running call in view). */
  first: number;
  count: number;
  /** Everything else in the scene starts right of this x. */
  stageLeft: number;
};

/** A call without spaces after commas or quotes around strings: `get(color,4)`. */
export function compactCall(call: string): string {
  return call.replace(/, /g, ",").replace(/"([^"]*)"/g, "$1");
}

/** An output without quotes, except the empty string (`""` still has to show). */
export const compactOutput = (output: string) =>
  output === '""' ? output : output.replace(/^"(.*)"$/, "$1");

/**
 * The first argument every call with arguments shares (a store with one key: "color"), or undefined. Dropping it
 * loses nothing on screen: the hash map beside the log shows the key.
 */
function sharedFirstArg(calls: readonly string[]): string | undefined {
  const firsts = calls.flatMap((c) => {
    const inside = c.slice(c.indexOf("(") + 1, -1);
    return inside ? [inside.split(",")[0]] : [];
  });
  const withMore = calls.filter((c) => c.slice(c.indexOf("(") + 1, -1).includes(","));
  return firsts.length > 1 &&
    withMore.length > 0 &&
    firsts.every((f) => f === firsts[0]) &&
    firsts[0].startsWith('"')
    ? firsts[0]
    : undefined;
}

/** The forms an op log tries, widest first: as given, compact, then compact without a shared key (and quotes). */
export function opLogForms(calls: readonly { call: string; output: string }[]) {
  const full = { labels: calls.map((c) => c.call), outputs: calls.map((c) => c.output) };
  const compact = { labels: full.labels.map(compactCall), outputs: full.outputs };
  const key = sharedFirstArg(full.labels);
  if (!key) return [full, compact];
  const keyless = {
    labels: full.labels.map((c) => compactCall(c.replace(`(${key}, `, "(").replace(`(${key})`, "()"))),
    outputs: full.outputs.map(compactOutput),
  };
  return [full, compact, keyless];
}

/** The widest row a set of labels and outputs needs (call, gap, output, padding). */
export function opRowWidth(labels: readonly string[], outputs: readonly string[], t: TextMetrics): number {
  const size = t.size(TEXT.opCall);
  const call = Math.max(...labels.map((l) => t.width(l, size, "mono")));
  const output = Math.max(0, ...outputs.map((o) => t.width(o, size, "mono")));
  return OPLOG.padX * 2 + call + OPLOG.gap + output;
}

/**
 * The op log's column on the left of the stage, from under the caption down to the bottom stack: one row per call,
 * as wide as the widest call and output (every output counts, shown or not, so the column never changes width between
 * scenes). When the rows don't all fit, a window of them keeps the running call in view with the next one below it.
 * Pure, so tests check the same boxes the component draws.
 */
export function layoutOpLog(
  el: OpLogElement,
  t: TextMetrics,
  bandTop: number,
  bottomTop: number,
): OpLogShape {
  const size = t.size(TEXT.opCall);
  const max = VIDEO_WIDTH * OPLOG.maxShare;
  const forms = opLogForms(el.calls);
  const { labels, outputs } =
    forms.find((f) => opRowWidth(f.labels, f.outputs, t) <= max) ?? forms[forms.length - 1];
  const width = opRowWidth(labels, outputs, t);
  const title = t.compact ? 0 : t.size(TEXT.opTitle) + 10;
  const top = bandTop + title;
  const rowHeight = size + 16;
  const n = el.calls.length;
  const room = bottomTop - 12 - top;
  const visible = Math.max(1, Math.min(n, Math.floor((room + OPLOG.rowGap) / (rowHeight + OPLOG.rowGap))));
  // Keep the running call (or, unbound, the start or the end) in view, with one call after it when there is one.
  const anchor = el.current ?? (el.shown >= n ? n - 1 : 0);
  const first = Math.max(0, Math.min(n - visible, anchor - (visible - 2)));
  const left = OPLOG.left;
  return {
    left,
    right: left + width,
    titleTop: title > 0 ? bandTop : undefined,
    top,
    rowHeight,
    labels,
    outputs,
    first,
    count: visible,
    stageLeft: left + width + OPLOG.stageGap,
  };
}
