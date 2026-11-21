import type {
  BarRowElement,
  BinaryTreeElement,
  CallStackElement,
  Element,
  ItemRowElement,
  LinkedListElement,
  PointerElement,
} from "@/lib/storyboard";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "@/lib/storyboard";

import { TEXT, textMetrics, type TextMetrics } from "./text";

/**
 * Pixel geometry of an item-row or bar-row on the 1280×720 canvas. For a bar-row, `top`/`cardHeight` is the full
 * column each bar can grow in (bars are bottom-aligned at `top + cardHeight`), so pointers, highlights, and anchored
 * callouts work on either kind of row unchanged.
 */
export type RowLayout = {
  rowId: string;
  top: number;
  cardWidth: number;
  cardHeight: number;
  /** Left x of each card. */
  lefts: number[];
  /** Center x of each card. */
  centers: number[];
  /** Top of everything drawn for this row, including a held value above it; anchored callouts sit above this. */
  reservedTop: number;
  /** Where "below" pointers start (under the baseline, and under segment brackets when there are any). */
  pointerTop: number;
  /** Top of a panel under the pointers (merge buffer, tally). */
  panelTop: number;
  /** Labels beside the row (e.g. "✓ sorted") must end before this x. */
  rightLimit: number;
  /** Per position, when positions sit at different heights (a linked list's lanes); otherwise `top` for all. */
  tops?: number[];
  /** Highlight tags go under the cards (a linked list's pointers use the space above). */
  tagsBelow?: boolean;
};

/** Where a linked-list draws: one horizontal lane per list, with node boxes in slots. */
export type ListLayout = {
  nodeWidth: number;
  nodeHeight: number;
  /** Top of each lane's nodes. */
  laneTops: number[];
  /** Left x of slot `slot` in lane `lane`. */
  slotLeft: (lane: number, slot: number) => number;
  /** Lane labels' left edge, and the room they have (0 = no labels). */
  labelLeft: number;
  labelWidth: number;
  /** How far curved links (skipping nodes) dip under a lane. */
  dip: number;
  /** Where a node's "null" end goes: after it (`right`), or before it when the slot after it is taken. */
  nullSide: (node: { lane: number; slot: number }) => "right" | "left";
  /** Lanes with something in them this scene (empty lanes take no room and lose their label). */
  present: boolean[];
};

/** Where a binary tree draws: node centers by id, plus geometry for stubs and annotations. */
export type TreeLayout = {
  nodeSize: number;
  /** Center of node `id`. */
  center: (id: number) => { x: number; y: number };
  /** Vertical distance between levels (center to center). */
  levelGap: number;
  /** Horizontal distance from a node at `depth` to either child's center. */
  childOffset: (depth: number) => number;
  depthOf: (id: number) => number;
  /** Room to the right of a node for its note ("sum 9", "↑ 3") before the next node or the region's edge. */
  noteRoom: (id: number) => number;
  region: Region;
};

/** Where a call-stack draws: a column beside the tree, frames stacked from the bottom. */
export type StackLayout = {
  left: number;
  width: number;
  /** Top of the title (hidden on a phone-sized player) and bottom of the lowest frame. */
  top: number;
  bottom: number;
  frameHeight: number;
  gap: number;
};

const SIDE_MARGIN = 64;
const GAP = 16;
const MAX_CARD_WIDTH = 140;
const CARD_HEIGHT = 124;
/** Vertical band the rows share (between the caption and the bottom stack). */
const BAND_TOP = 270;
const BAND_BOTTOM = 470;
/** A single bar-row gets a taller band: from under the floating callouts down to just above the pointers. */
const BAR_TOP = 232;
/** On a phone-sized player callouts are hidden, so the bars can start right under a two-line caption. */
const COMPACT_BAR_TOP = 200;
const BAR_HEIGHT = 200;
const MAX_BAR_WIDTH = 96;
/** Segment brackets sit under the baseline; groups are drawn this much further apart. */
export const BRACKET_SPACE = 20;
const GROUP_GAP = 28;
const ARROW = 14;
/** How far a cut's divider reaches above and below its cards. */
export const CUT_OVERHANG = 12;
/** The bottom stack (equations, results, counters) normally starts here, and ends this far above the bottom. */
const BOTTOM_TOP = 500;
const BOTTOM_MARGIN = 24;
const BOTTOM_GAP = 16;
/**
 * With a heap-tree the stage splits: the bars take a narrow column on the left and the tree gets the rest, so
 * the tree stays readable when the whole video is scaled down to phone width.
 */
const HEAP_BARS = { left: 32, right: 440, top: 300, height: 160 };
const HEAP_TREE = { left: 570, right: 1250, top: 188 };

export type Region = { left: number; right: number; top: number; bottom: number };

/** Everything a scene's primitives position against. */
export type SceneLayout = {
  rows: Record<string, RowLayout>;
  /** Top of the bottom stack; raised when its contents (e.g. a split-tree at phone size) need more room. */
  bottomTop: number;
  /** Where a heap-tree draws: under a two-line caption, beside the bars, down to the bottom stack. */
  heapRegion: Region;
  /** A linked-list's geometry, when the scene has one. */
  list?: ListLayout;
  /** A binary tree's and a call stack's geometry, when the scene has them. */
  tree?: TreeLayout;
  stack?: StackLayout;
};

/** Heights the layout reserves, from the same font sizes the primitives use. */
export const sizes = {
  pointer: (t: TextMetrics) => ARROW + t.size(TEXT.pointer) + 18,
  barLabel: (t: TextMetrics) => t.size(TEXT.barValue) + 10,
  heldCard: (t: TextMetrics) => t.size(TEXT.heldValue) + 14 + (t.compact ? 0 : t.size(TEXT.heldLabel) + 2),
  pivotTag: (t: TextMetrics) => t.size(TEXT.pivotTag) + 14,
  countKeys: (t: TextMetrics) => t.size(TEXT.countKey) + 6,
  cell: (t: TextMetrics) => t.size(TEXT.countCell) + 20,
  marker: (t: TextMetrics) => (t.compact ? 0 : t.size(TEXT.marker) + 4),
  splitRow: (t: TextMetrics) => t.size(TEXT.splitValue) + 12,
  splitCell: (t: TextMetrics) => Math.max(46, t.width("88", t.size(TEXT.splitValue), "mono") + 12),
  /** Highlight tags above the cards (hidden on a phone-sized player). */
  tagRoom: (t: TextMetrics) => (t.compact ? 0 : t.size(TEXT.tag) + 12),
  /** A window's label pill + bracket above the tags. */
  window: (t: TextMetrics) => sizes.tagRoom(t) + 4 + 12 + 6 + t.size(TEXT.windowLabel) + 14 + 4,
  /** A freq-table cell: wide enough for "count/need". */
  freqCell: (t: TextMetrics, entries: readonly { count: number; need?: number }[]) =>
    Math.max(
      56,
      ...entries.map(
        (e) =>
          t.width(
            e.need !== undefined ? `${e.count}/${e.need}` : String(e.count),
            t.size(TEXT.countCell),
            "mono",
          ) + 16,
      ),
    ),
  dequeCell: (t: TextMetrics) => Math.max(56, t.width("-88", t.size(TEXT.countCell), "mono") + 16),
  /** A number-line tick: wide enough for its largest candidate. */
  numberCell: (t: TextMetrics, values: readonly number[]) =>
    Math.max(48, ...values.map((v) => t.width(String(v), t.size(TEXT.countCell), "mono") + 16)),
  /** A call-stack frame: one line of label and note. */
  stackFrame: (t: TextMetrics) => Math.max(t.size(TEXT.stackLabel), t.size(TEXT.stackNote)) + 18,
  /** A tree node's box: big enough for a two-digit negative value. */
  treeNode: (t: TextMetrics) => t.width("-88", t.size(TEXT.treeValue), "mono") + 14,
  /** Each extra pointer stacked under the first at the same position: its pill plus a gap. */
  stackedPointer: (t: TextMetrics) => t.size(TEXT.pointer) + 18 + 6,
};
export const NUMBER_GAP = 8;

/**
 * Pointers under a row that share a position stack downward in storyboard order (low, mid, and high can all land
 * on one card). Level 0 has the arrow; the others are pills under it.
 */
export function pointerLevel(element: PointerElement, elements: readonly Element[]): number {
  const same = elements.filter(
    (el): el is PointerElement =>
      el.type === "pointer" &&
      el.rowId === element.rowId &&
      el.placement === element.placement &&
      el.index === element.index,
  );
  return Math.max(0, same.indexOf(element));
}

/** The most pointers on any one position of a row, on one side. */
function pointerDepthOn(
  elements: readonly Element[],
  rowId: string,
  placement: "above" | "below",
  only?: (index: number) => boolean,
): number {
  const counts = new Map<number, number>();
  for (const el of elements)
    if (
      el.type === "pointer" &&
      el.rowId === rowId &&
      el.placement === placement &&
      (!only || only(el.index))
    )
      counts.set(el.index, (counts.get(el.index) ?? 0) + 1);
  return Math.max(0, ...counts.values());
}

/** The most "below" pointers on any one position of a row. */
function pointerDepth(elements: readonly Element[], rowId: string): number {
  const counts = new Map<number, number>();
  for (const el of elements)
    if (el.type === "pointer" && el.rowId === rowId && el.placement === "below")
      counts.set(el.index, (counts.get(el.index) ?? 0) + 1);
  return Math.max(0, ...counts.values());
}

/** Room under a row for its pointers, stacked ones included. */
export const pointerRoom = (elements: readonly Element[], rowId: string, t: TextMetrics) => {
  const depth = pointerDepth(elements, rowId);
  return depth === 0 ? 0 : sizes.pointer(t) + (depth - 1) * sizes.stackedPointer(t);
};
export const SPLIT_ROW_GAP = 6;

/** Where a two-line caption ends (captions are at most 80 characters). */
export const captionBottom = (t: TextMetrics) => 70 + 2 * Math.ceil(t.size(TEXT.caption) * 1.25);

/** Estimated height of a bottom-slot element, so the stack can rise to make room. */
function bottomHeight(el: Element, t: TextMetrics): number {
  switch (el.type) {
    case "equation":
      return Math.ceil(t.size(TEXT.equation) * 1.25) + 8;
    case "result":
      return (
        Math.max(
          t.size(TEXT.resultIcon) + 18,
          Math.ceil(
            (t.size(TEXT.resultTitle) +
              t.size(TEXT.resultValue) +
              (el.detail && !t.compact ? t.size(TEXT.resultDetail) : 0)) *
              1.25,
          ),
        ) + 32
      );
    case "counter":
      return Math.ceil(t.size(TEXT.counterValue) * 1.25) + 20;
    case "split-tree":
      return el.levels.length * (sizes.splitRow(t) + SPLIT_ROW_GAP) - SPLIT_ROW_GAP;
    case "freq-table":
      return t.size(TEXT.countKey) + 4 + sizes.cell(t) + 4 + sizes.marker(t);
    case "deque":
      return sizes.cell(t) + 2 + sizes.marker(t);
    case "number-line":
      return t.size(TEXT.countKey) + 4 + sizes.cell(t) + 4 + sizes.marker(t);
    default:
      return 0;
  }
}

type Row = ItemRowElement | BarRowElement;
const lengthOf = (row: Row) => (row.type === "item-row" ? row.items.length : row.bars.length);

/** Room above a lane for its pointers (stacked ones included). */
const pointersAbove = (depth: number, t: TextMetrics) =>
  depth === 0 ? 0 : sizes.pointer(t) + (depth - 1) * sizes.stackedPointer(t) + 8;

const LIST = {
  maxNodeWidth: 120,
  maxNodeHeight: 96,
  minNodeHeight: 52,
  /** Space between slots, where the arrows run. */
  gapRatio: 0.42,
  dip: 30,
  laneGap: 10,
  /** With a heap-tree: input lanes on the left, the tree on the right, the last lane across the bottom. */
  splitRight: 640,
};

/** Lanes, slots, and per-node positions for a scene's linked list. */
function layoutList(
  list: LinkedListElement,
  elements: readonly Element[],
  t: TextMetrics,
  bottomTop: number,
  hasHeap: boolean,
): { list: ListLayout; row: RowLayout; heap?: Region; overflow: number } {
  const places = [...list.nodes, ...(list.fromPlaces ?? [])];
  const lanes = Math.max(...places.map((p) => p.lane)) + 1;
  const split = hasHeap && lanes > 1;
  const laneOf = new Map(list.nodes.map((n) => [n.id, n.lane]));
  const inLane = (lane: number) => (index: number) => laneOf.get(index) === lane;
  const highlighted = (lane: number) =>
    elements.some(
      (el) =>
        el.type === "highlight" && el.rowId === list.id && el.indices.some((i) => laneOf.get(i) === lane),
    );
  // Only links that skip over nodes curve under the lane (neighbors in either direction get straight arrows).
  const curves = (lane: number) =>
    list.nodes.some((n) => {
      if (n.lane !== lane || n.next === null) return false;
      const to = list.nodes.find((m) => m.id === n.next);
      return to !== undefined && to.lane === lane && Math.abs(to.slot - n.slot) > 1;
    });
  const occupied = new Set(list.nodes.map((n) => `${n.lane}:${n.slot}`));
  const nullSide = (node: { lane: number; slot: number }) =>
    occupied.has(`${node.lane}:${node.slot + 1}`) ? ("left" as const) : ("right" as const);
  // A null end before slot 0 needs a slot of its own on the left.
  const leftNull = list.nodes.some((n) => n.next === null && n.slot === 0 && nullSide(n) === "left");
  // A lane with nothing in it (its nodes all moved on, none sliding out of it now) takes no room.
  const present = Array.from({ length: lanes }, (_, lane) => places.some((p) => p.lane === lane));
  const shown = present.filter(Boolean).length;
  const above = Array.from({ length: lanes }, (_, lane) =>
    present[lane] ? pointersAbove(pointerDepthOn(elements, list.id, "above", inLane(lane)), t) : 0,
  );
  const tags = t.compact ? 0 : t.size(TEXT.tag) + 12;
  const below = Array.from({ length: lanes }, (_, lane) =>
    present[lane] ? Math.max(highlighted(lane) ? tags : 0, curves(lane) ? LIST.dip : 0) + 4 : 0,
  );

  const bandTop = captionBottom(t) + 8;
  const bandBottom = bottomTop - 8;
  const fixed =
    above.reduce((a, b) => a + b, 0) + below.reduce((a, b) => a + b, 0) + LIST.laneGap * (shown - 1);
  const nodeHeight = Math.max(
    LIST.minNodeHeight,
    Math.min(LIST.maxNodeHeight, Math.floor((bandBottom - bandTop - fixed) / shown)),
  );
  const used = fixed + nodeHeight * shown;
  const overflow = Math.max(0, used - (bandBottom - bandTop));
  const laneTops: number[] = [];
  let y = bandTop + Math.max(0, (bandBottom - bandTop - used) / 2);
  for (let lane = 0; lane < lanes; lane++) {
    laneTops.push(y + above[lane]);
    if (present[lane]) y += above[lane] + nodeHeight + below[lane] + LIST.laneGap;
  }

  // Lane labels sit at the left of their lane (dropped on a phone-sized player: the caption carries the story).
  const labelSize = t.size(TEXT.laneLabel);
  const labels = t.compact ? [] : (list.laneLabels ?? []);
  const labelWidth =
    labels.length > 0 ? Math.max(...labels.map((l) => t.width(l, labelSize, "mono"))) + 16 : 0;
  const left = SIDE_MARGIN + labelWidth;
  const fullRight = VIDEO_WIDTH - SIDE_MARGIN;
  // Slots per lane: every node's slot (and where moved nodes came from), plus one for a "null" end.
  const slotsIn = (from: number, to: number) =>
    Math.max(...places.filter((p) => p.lane >= from && p.lane <= to).map((p) => p.slot), 0) +
    2 +
    (leftNull ? 1 : 0);
  // Each slot is a node plus the gap its outgoing arrow runs in; wide stages don't stretch nodes past their cap.
  const pitchFor = (slots: number, right: number) =>
    Math.min((right - left) / slots, LIST.maxNodeWidth * (1 + LIST.gapRatio));
  const topSlots = slotsIn(0, split ? lanes - 2 : lanes - 1);
  const topPitch = pitchFor(topSlots, split ? LIST.splitRight : fullRight);
  const lastPitch = split ? pitchFor(slotsIn(lanes - 1, lanes - 1), fullRight) : topPitch;
  const nodeWidth = Math.min(topPitch, lastPitch) / (1 + LIST.gapRatio);
  // Without a heap the lanes are centered as a block (same offset for all, so slots line up between lanes).
  const offset = split ? 0 : (fullRight - left - Math.max(topSlots, slotsIn(0, lanes - 1)) * topPitch) / 2;
  const pitchOf = (lane: number) => (split && lane === lanes - 1 ? lastPitch : topPitch);
  const slotLeft = (lane: number, slot: number) =>
    left + offset + (slot + (leftNull ? 1 : 0)) * pitchOf(lane);

  const sorted = [...list.nodes].sort((a, b) => a.id - b.id);
  const lefts = sorted.map((n) => slotLeft(n.lane, n.slot));
  const tops = sorted.map((n) => laneTops[n.lane]);
  const row: RowLayout = {
    rowId: list.id,
    top: Math.min(...laneTops),
    cardWidth: nodeWidth,
    cardHeight: nodeHeight,
    lefts,
    centers: lefts.map((l) => l + nodeWidth / 2),
    tops,
    tagsBelow: true,
    reservedTop: Math.min(...laneTops.map((top, lane) => top - above[lane])),
    pointerTop: Math.max(...laneTops) + nodeHeight + 8,
    panelTop: Math.max(...laneTops) + nodeHeight + 8,
    rightLimit: VIDEO_WIDTH - 16,
  };
  const heap = split
    ? {
        left: LIST.splitRight + 40,
        right: 1250,
        top: bandTop,
        bottom: laneTops[lanes - 1] - above[lanes - 1] - 16,
      }
    : undefined;
  return {
    list: {
      nodeWidth,
      nodeHeight,
      laneTops,
      slotLeft,
      labelLeft: SIDE_MARGIN + offset,
      labelWidth,
      dip: LIST.dip,
      nullSide,
      present,
    },
    row,
    heap,
    overflow,
  };
}

/** How far a missing child's "null" stub reaches below its parent before its box. */
export const STUB_DROP = 28;

const TREE = {
  maxNode: 76,
  /** Levels are at least this far apart beyond a node's height (room for the edges). */
  minEdge: 22,
  idealEdge: 44,
  maxLevelGap: 132,
  margin: 48,
  stackGap: 40,
  stackMaxWidth: 380,
  /** On a phone-sized player the stack's text is larger: it gets more room. */
  compactStackMaxWidth: 470,
  stackMinWidth: 240,
};

/** The call-stack's longest line, at the sizes it's drawn with (its notes fall back to shorter forms). */
function stackWidth(stack: CallStackElement, t: TextMetrics): number {
  const label = Math.max(0, ...stack.frames.map((f) => t.width(f.label, t.size(TEXT.stackLabel), "mono")));
  const note = t.width(t.compact ? "→ false" : "waiting for right", t.size(TEXT.stackNote));
  return Math.min(
    t.compact ? TREE.compactStackMaxWidth : TREE.stackMaxWidth,
    Math.max(TREE.stackMinWidth, label + note + 48),
  );
}

/** A binary tree by depth (each node at its position in a full tree), with a call stack beside it. */
function layoutTree(
  tree: BinaryTreeElement,
  stackElement: CallStackElement | undefined,
  elements: readonly Element[],
  t: TextMetrics,
  bottomTop: number,
): { tree: TreeLayout; row: RowLayout; stack?: StackLayout; overflow: number } {
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const place = new Map<number, { depth: number; k: number }>();
  const walk = (id: number | null, depth: number, k: number) => {
    if (id === null || place.has(id)) return;
    place.set(id, { depth, k });
    walk(byId.get(id)?.left ?? null, depth + 1, 2 * k);
    walk(byId.get(id)?.right ?? null, depth + 1, 2 * k + 1);
  };
  walk(0, 0, 0);
  const levels = Math.max(1, ...[...place.values()].map((p) => p.depth + 1));

  const stackW = stackElement ? stackWidth(stackElement, t) : 0;
  const right = VIDEO_WIDTH - TREE.margin;
  const stackLeft = right - stackW;
  const region: Region = {
    left: TREE.margin,
    right: stackElement ? stackLeft - TREE.stackGap : right,
    top: captionBottom(t) + 8,
    bottom: bottomTop - 16,
  };
  const width = region.right - region.left;
  const bottomPitch = width / 2 ** (levels - 1);
  // Room above the root for highlight tags, and under the last level when this scene visits a missing child there.
  const tags = elements.some((el) => el.type === "highlight" && el.rowId === tree.id) ? sizes.tagRoom(t) : 0;
  const deepStub =
    tree.nullVisit !== undefined && (place.get(tree.nullVisit.parent)?.depth ?? 0) === levels - 1;
  const stub = deepStub ? STUB_DROP + t.size(TEXT.treeNull) * 1.8 : 0;
  const height = region.bottom - region.top - tags - stub;
  // Nodes as large as the width and height allow (capped), but never smaller than their widest value.
  const valueSize = t.size(TEXT.treeValue);
  const needed = Math.max(...tree.nodes.map((n) => t.width(String(n.value), valueSize, "mono"))) + 14;
  const nodeSize = Math.max(
    needed,
    Math.min(TREE.maxNode, bottomPitch * 0.74, (height - (levels - 1) * TREE.minEdge) / levels),
  );
  const minGap = nodeSize + TREE.minEdge;
  const levelGap =
    levels > 1 ? Math.min(TREE.maxLevelGap, Math.max(minGap, (height - nodeSize) / (levels - 1))) : 0;
  const used = tags + nodeSize + (levels - 1) * levelGap + stub;
  // Ask the bottom stack to move down until the tree gets its full-size nodes and roomy levels (it only moves as
  // far as its own contents allow).
  const ideal = Math.min(TREE.maxNode, bottomPitch * 0.74);
  const wanted = tags + ideal + (levels - 1) * (ideal + TREE.idealEdge) + stub;
  const overflow = Math.max(0, Math.max(used, wanted) - (region.bottom - region.top));
  // Centered in the band when there's room to spare.
  const top = region.top + tags + Math.max(0, (region.bottom - region.top - used) / 2);
  const center = (id: number) => {
    const p = place.get(id) ?? { depth: 0, k: 0 };
    return {
      x: region.left + ((p.k + 0.5) * width) / 2 ** p.depth,
      y: top + nodeSize / 2 + p.depth * levelGap,
    };
  };
  const childOffset = (depth: number) => width / 2 ** (depth + 2);
  const noteRoom = (id: number) => {
    const p = place.get(id);
    if (!p) return 0;
    const x = center(id).x + nodeSize / 2;
    const next = [...place.entries()]
      .filter(([other, q]) => other !== id && q.depth === p.depth && q.k > p.k)
      .map(([other]) => center(other).x - nodeSize / 2);
    return Math.max(0, Math.min(region.right + TREE.stackGap / 2, ...next) - x - 8);
  };

  const ids = [...tree.nodes].sort((a, b) => a.id - b.id).map((n) => n.id);
  const centers = ids.map((id) => center(id).x);
  const tops = ids.map((id) => center(id).y - nodeSize / 2);
  const row: RowLayout = {
    rowId: tree.id,
    top: Math.min(...tops),
    cardWidth: nodeSize,
    cardHeight: nodeSize,
    lefts: centers.map((x) => x - nodeSize / 2),
    centers,
    tops,
    reservedTop: Math.min(...tops) - tags,
    pointerTop: Math.max(...tops) + nodeSize + 8,
    panelTop: Math.max(...tops) + nodeSize + 8,
    rightLimit: region.right,
  };

  let stack: StackLayout | undefined;
  if (stackElement) {
    const frameHeight = sizes.stackFrame(t);
    stack = {
      left: stackLeft,
      width: stackW,
      top: region.top,
      bottom: region.bottom,
      frameHeight,
      gap: 6,
    };
  }
  return {
    tree: {
      nodeSize,
      center,
      levelGap,
      childOffset,
      depthOf: (id) => place.get(id)?.depth ?? 0,
      noteRoom,
      region,
    },
    row,
    stack,
    overflow,
  };
}

export function layoutScene(elements: readonly Element[], text: TextMetrics = textMetrics()): SceneLayout {
  const t = text;
  const bottom = elements.filter((el) => bottomHeight(el, t) > 0);
  const stack =
    bottom.reduce((sum, el) => sum + bottomHeight(el, t), 0) + BOTTOM_GAP * Math.max(0, bottom.length - 1);
  const lowestTop = VIDEO_HEIGHT - BOTTOM_MARGIN - stack;
  const first = layoutWith(elements, t, Math.min(BOTTOM_TOP, lowestTop));
  // Cards squeezed by what sits under them (stacked pointers, a strip above) push a short bottom stack down into
  // the room it leaves free, rather than shrinking.
  const short = Math.max(
    0,
    ...elements.flatMap((el) =>
      el.type === "item-row" && first.rows[el.id] ? [CARD_HEIGHT - first.rows[el.id].cardHeight] : [],
    ),
  );
  // A linked list's lanes (or a tree's levels) that don't fit push the bottom stack down too.
  const need = Math.max(short, first.listOverflow ?? 0, first.treeOverflow ?? 0);
  if (need <= 0 || first.bottomTop >= lowestTop) return first;
  return layoutWith(elements, t, Math.min(lowestTop, first.bottomTop + need));
}

function layoutWith(
  elements: readonly Element[],
  t: TextMetrics,
  bottomTop: number,
): SceneLayout & { listOverflow?: number; treeOverflow?: number } {
  let heapRegion: Region = { ...HEAP_TREE, bottom: bottomTop + 5 };
  const listElement = elements.find((el): el is LinkedListElement => el.type === "linked-list");
  let list: ListLayout | undefined;
  let listOverflow: number | undefined;
  const listRows: Record<string, RowLayout> = {};
  if (listElement) {
    const laid = layoutList(
      listElement,
      elements,
      t,
      bottomTop,
      elements.some((el) => el.type === "heap-tree"),
    );
    list = laid.list;
    listRows[listElement.id] = laid.row;
    if (laid.heap) heapRegion = laid.heap;
    listOverflow = laid.overflow;
  }
  const treeElement = elements.find((el): el is BinaryTreeElement => el.type === "binary-tree");
  let tree: TreeLayout | undefined;
  let stack: StackLayout | undefined;
  let treeOverflow: number | undefined;
  if (treeElement) {
    const laid = layoutTree(
      treeElement,
      elements.find((el): el is CallStackElement => el.type === "call-stack"),
      elements,
      t,
      bottomTop,
    );
    tree = laid.tree;
    stack = laid.stack;
    listRows[treeElement.id] = laid.row;
    treeOverflow = laid.overflow;
  }

  const rows = elements.filter((el): el is Row => el.type === "item-row" || el.type === "bar-row");
  const layouts: Record<string, RowLayout> = {};
  const hasCounts = elements.some((el) => el.type === "count-array");
  const hasHeap = elements.some((el) => el.type === "heap-tree");
  const rowsWith = (type: Element["type"]) =>
    new Set(elements.flatMap((el) => (el.type === type && "rowId" in el ? [el.rowId] : [])));
  const heldRows = rowsWith("held-value");
  const pivotRows = rowsWith("partition");
  // A search range draws the same bracket (and label) above the cards as a sliding window.
  const windowRows = new Set([...rowsWith("window"), ...rowsWith("search-range")]);
  const bufferRows = rowsWith("merge-buffer");
  const groupsOf = new Map(
    elements.flatMap((el) => (el.type === "segments" ? [[el.rowId, el.groups] as const] : [])),
  );

  rows.forEach((row, r) => {
    const n = lengthOf(row);
    const single = rows.length === 1;
    const soloBars = row.type === "bar-row" && single;
    const heap = soloBars && hasHeap;
    const maxWidth = soloBars ? MAX_BAR_WIDTH : MAX_CARD_WIDTH;
    // A gap before the first position of every group after the first.
    const groupStarts = new Set((groupsOf.get(row.id) ?? []).slice(1).map((g) => g.from));
    const extra = groupStarts.size * GROUP_GAP;
    const [regionLeft, regionRight] = heap
      ? [HEAP_BARS.left, HEAP_BARS.right]
      : [SIDE_MARGIN, VIDEO_WIDTH - SIDE_MARGIN];
    const cardWidth = Math.min(maxWidth, (regionRight - regionLeft - GAP * (n - 1) - extra) / n);
    const total = n * cardWidth + GAP * (n - 1) + extra;
    const lefts: number[] = [];
    let x = (regionLeft + regionRight - total) / 2;
    for (let i = 0; i < n; i++) {
      if (groupStarts.has(i)) x += GROUP_GAP;
      lefts.push(x);
      x += cardWidth + GAP;
    }

    // Stack everything under the row upward from the bottom stack: brackets, pointers, then a panel.
    const bracket = groupsOf.has(row.id) ? BRACKET_SPACE : 0;
    const room = pointerRoom(elements, row.id, t);
    const pointers = room > 0 ? room + 8 : 0;
    const panel = bufferRows.has(row.id)
      ? sizes.cell(t) + sizes.marker(t) + 8
      : hasCounts && soloBars
        ? sizes.countKeys(t) + sizes.cell(t) + sizes.marker(t) + 8
        : 0;
    const lowest = bottomTop - 6 - panel - pointers - bracket - 8;

    let top: number;
    let cardHeight: number;
    let strip = 0;
    if (heap) {
      top = HEAP_BARS.top;
      cardHeight = Math.min(HEAP_BARS.height, lowest - top);
    } else if (soloBars) {
      strip = heldRows.has(row.id)
        ? sizes.heldCard(t) + 10
        : pivotRows.has(row.id)
          ? sizes.pivotTag(t) + 14
          : windowRows.has(row.id)
            ? sizes.window(t)
            : 0;
      const bandTop = t.compact ? COMPACT_BAR_TOP : BAR_TOP;
      top = bandTop + strip;
      cardHeight = Math.min(bandTop + BAR_HEIGHT, lowest) - top;
    } else if (single) {
      cardHeight = CARD_HEIGHT;
      top = Math.min(BAND_TOP + (BAND_BOTTOM - BAND_TOP - CARD_HEIGHT) / 2 - 20, lowest - cardHeight);
      // A sliding window's bracket and label sit above the cards (and their highlight tags). Keep them under a
      // two-line caption, shortening the cards if a tall bottom stack leaves less room.
      if (windowRows.has(row.id)) {
        strip = sizes.window(t);
        const minTop = captionBottom(t) + strip;
        if (top < minTop) {
          top = minTop;
          cardHeight = Math.min(CARD_HEIGHT, lowest - top);
        }
      }
    } else {
      // Two or more rows (Median's two lists) share the space between the caption and the bottom stack, each with
      // room for its highlight tags above and its pointers (and a cut's overhang) below.
      const bandTop = captionBottom(t) + 10;
      const stackSlot = (bottomTop - 8 - bandTop) / rows.length;
      const tags = sizes.tagRoom(t);
      cardHeight = Math.min(CARD_HEIGHT, stackSlot - tags - pointers - CUT_OVERHANG - 8);
      top = bandTop + r * stackSlot + tags + (stackSlot - tags - pointers - CUT_OVERHANG - cardHeight) / 2;
    }
    const pointerTop = top + cardHeight + 8 + bracket;
    layouts[row.id] = {
      rowId: row.id,
      top,
      cardWidth,
      cardHeight,
      lefts,
      centers: lefts.map((l) => l + cardWidth / 2),
      reservedTop: top - strip,
      pointerTop,
      panelTop: pointerTop + pointers,
      rightLimit: heap ? heapRegion.left - 10 : VIDEO_WIDTH - 16,
    };
  });
  return {
    rows: { ...layouts, ...listRows },
    bottomTop,
    heapRegion,
    list,
    listOverflow,
    tree,
    stack,
    treeOverflow,
  };
}

/** Row geometry only (see `layoutScene`). */
export function layoutRows(elements: readonly Element[], text?: TextMetrics): Record<string, RowLayout> {
  return layoutScene(elements, text).rows;
}

export const CANVAS = { width: VIDEO_WIDTH, height: VIDEO_HEIGHT };
