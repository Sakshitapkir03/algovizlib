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

export const palettes: Record<VideoThemeName, VideoPalette> = {
  light: {
    background: "#f8fafc",
    surface: "#ffffff",
    surfaceMuted: "#f1f5f9",
    border: "#cbd5e1",
    text: "#0f172a",
    textMuted: "#64748b",
    primary: "#4f46e5",
    primaryText: "#ffffff",
    secondary: "#c2410c",
    secondaryText: "#ffffff",
    active: "#4f46e5",
    success: "#15803d",
    successSoft: "#dcfce7",
    danger: "#b91c1c",
    info: "#0369a1",
    infoSoft: "#e0f2fe",
  },
  dark: {
    background: "#0b1120",
    surface: "#151e32",
    surfaceMuted: "#1e293b",
    border: "#334155",
    text: "#f1f5f9",
    textMuted: "#94a3b8",
    primary: "#818cf8",
    primaryText: "#0b1120",
    secondary: "#fb923c",
    secondaryText: "#0b1120",
    active: "#818cf8",
    success: "#4ade80",
    successSoft: "#14532d",
    danger: "#f87171",
    info: "#38bdf8",
    infoSoft: "#0c4a6e",
  },
};

export const FONT_SANS = "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif";
export const FONT_MONO = "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace";
