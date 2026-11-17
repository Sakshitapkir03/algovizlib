import { createContext, useContext } from "react";

import type { RowLayout } from "./layout";
import type { VideoPalette } from "./theme";

export type SceneContextValue = {
  rows: Record<string, RowLayout>;
  palette: VideoPalette;
  reducedMotion: boolean;
  sceneDurationInFrames: number;
};

export const SceneContext = createContext<SceneContextValue | null>(null);

export function useScene(): SceneContextValue {
  const ctx = useContext(SceneContext);
  if (!ctx) throw new Error("useScene must be used inside a <SceneView>");
  return ctx;
}
