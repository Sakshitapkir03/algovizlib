import type { ComparisonOp, EquationElement, VerdictTone } from "@/lib/storyboard";

export type VideoThemeName = "light" | "dark";

export type VideoPalette = {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  secondary: string;
  secondaryText: string;
  active: string;
  success: string;
  successSoft: string;
  danger: string;
  info: string;
  infoSoft: string;
};

/**
 * The video's colors, matching the site: near-black (dark) or warm off-white (light), with orange as the one accent
 * (pointers, active items, brackets, the "mid" markers). Verdicts stay clearly apart from it: green for good news,
 * sky for information, and rose (never red-orange) for bad news, always next to a glyph or a word. Secondary
 * pointers are neutral so they never compete with the accent.
 */
export const palettes: Record<VideoThemeName, VideoPalette> = {
  light: {
    background: "#fafaf9",
    surface: "#ffffff",
    surfaceMuted: "#f5f5f4",
    border: "#d6d3d1",
    text: "#1c1917",
    textMuted: "#57534e",
    primary: "#c2410c",
    primaryText: "#ffffff",
    secondary: "#44403c",
    secondaryText: "#ffffff",
    active: "#c2410c",
    success: "#15803d",
    successSoft: "#dcfce7",
    danger: "#be123c",
    info: "#0369a1",
    infoSoft: "#e0f2fe",
  },
  dark: {
    background: "#0f0d0c",
    surface: "#1a1715",
    surfaceMuted: "#25211e",
    border: "#3d3733",
    text: "#f6f4f2",
    textMuted: "#a8a29e",
    primary: "#f97316",
    primaryText: "#0f0d0c",
    secondary: "#d6d3d1",
    secondaryText: "#0f0d0c",
    active: "#f97316",
    success: "#4ade80",
    successSoft: "#14532d",
    danger: "#fb7185",
    info: "#38bdf8",
    infoSoft: "#0c4a6e",
  },
};

const SIGN_COLOR: Record<ComparisonOp, keyof VideoPalette> = { "<": "info", ">": "danger", "=": "success" };
const TONE_COLOR: Record<VerdictTone, keyof VideoPalette> = {
  positive: "success",
  negative: "danger",
  neutral: "textMuted",
};

/** The verdict pill's color: its explicit tone, else the comparison sign (the pair-sum convention), else muted. */
export function verdictColor(
  element: Pick<EquationElement, "verdictTone" | "comparison">,
  palette: VideoPalette,
): string {
  if (element.verdictTone) return palette[TONE_COLOR[element.verdictTone]];
  if (element.comparison) return palette[SIGN_COLOR[element.comparison.op]];
  return palette.textMuted;
}

export const FONT_SANS = "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif";
export const FONT_MONO = "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace";
