import { VIDEO_WIDTH } from "@/lib/storyboard";

/**
 * Text that stays readable however small the player is. The composition is 1280 px wide and the Player scales it to
 * fit the page, so on a phone a 22 px label renders at about 6 px. `VideoStage` measures the player and passes its
 * width in as `displayWidth`; every primitive takes its font sizes from `text.size(base)`, which never renders below
 * `MIN_TEXT_PX` on screen. Labels that would no longer fit are abbreviated or hidden by the primitive (`fits`), and
 * `compact` drops purely secondary text (callouts, tag words, position labels) when the player is phone-sized: the
 * caption and narration still carry the story, and every state keeps a non-color cue (glyph, border style, pattern).
 *
 * A test renders the size math for every scene of every video at `PHONE_PLAYER_WIDTH` and fails if any text would
 * be smaller than the minimum or overflow its slot; another forbids literal font sizes in `src/video`.
 */

/** Smallest on-screen text, in CSS px (the caption's size on a phone). */
export const MIN_TEXT_PX = 11;
/** The player's width on a 375 px phone (16 px page gutters). */
export const PHONE_PLAYER_WIDTH = 343;
/** Below this composition size for the minimum, secondary text is dropped rather than enlarged. */
const COMPACT_MIN = 30;

export type FontKind = "sans" | "mono";

export type TextMetrics = {
  /** Rendered px per composition px. */
  scale: number;
  /** The smallest font size (composition px) that renders at `MIN_TEXT_PX`. */
  min: number;
  /** Phone-sized player: secondary labels are hidden. */
  compact: boolean;
  /** A font size in composition px: `base`, raised to the minimum when the player is small. */
  size: (base: number) => number;
  /** Estimated width of `text` set in bold at `size` (composition px). Deliberately generous. */
  width: (text: string, size: number, font?: FontKind) => number;
  /** Whether `text` at `size` fits in `room` composition px. */
  fits: (text: string, size: number, room: number, font?: FontKind) => boolean;
};

const CHAR_WIDTH: Record<FontKind, number> = { mono: 0.62, sans: 0.6 };

export function textMetrics(displayWidth: number = VIDEO_WIDTH): TextMetrics {
  // Never shrink text below its designed size on a large screen.
  const scale = Math.min(1, Math.max(0.1, displayWidth / VIDEO_WIDTH));
  const min = MIN_TEXT_PX / scale;
  const width = (text: string, size: number, font: FontKind = "sans") =>
    [...text].length * size * CHAR_WIDTH[font];
  return {
    scale,
    min,
    compact: min > COMPACT_MIN,
    size: (base) => Math.ceil(Math.max(base, min)),
    width,
    fits: (text, size, room, font) => width(text, size, font) <= room,
  };
}

/**
 * Designed font sizes (composition px at full size). Components pass these through `text.size`; the layout uses the
 * same values to reserve room, so a raised size never collides with its neighbors.
 */
export const TEXT = {
  chrome: 16,
  caption: 44,
  barValue: 22,
  barWater: 16,
  itemLabel: 17,
  itemValue: 34,
  itemSublabel: 14,
  pointer: 18,
  tag: 13,
  callout: 21,
  calloutSpeaker: 14,
  equation: 46,
  verdict: 22,
  resultIcon: 26,
  resultTitle: 16,
  resultValue: 28,
  resultDetail: 17,
  regionLabel: 18,
  heldValue: 26,
  heldLabel: 13,
  countKey: 15,
  countCell: 24,
  panelLabel: 18,
  marker: 14,
  level: 17,
  splitValue: 22,
  splitLabel: 20,
  pivotTag: 17,
  boundary: 16,
  heapNode: 40,
  heapLabel: 19,
  heapSize: 17,
  counterLabel: 22,
  counterValue: 40,
  counterDelta: 26,
  windowLabel: 22,
  listValue: 30,
  listDummy: 18,
  listNull: 15,
  laneLabel: 15,
  treeValue: 30,
  treeNote: 15,
  treeNull: 13,
  stackLabel: 20,
  stackNote: 15,
  stackTitle: 15,
} as const;
