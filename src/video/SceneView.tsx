import type { ComponentType } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";

import type { Element, Scene } from "@/lib/storyboard";

import { enterProgress, motion } from "./animation";
import { SceneContext, type SceneContextValue } from "./context";
import { layoutRows } from "./layout";
import { primitiveRegistry } from "./primitives/registry";
import { FONT_SANS, type VideoPalette } from "./theme";

function ElementView({ element, sceneDuration }: { element: Element; sceneDuration: number }) {
  // The registry is keyed by `type`, so this lookup always matches the element's
  // variant; TypeScript can't correlate the two through an index, hence the widening.
  const Component = primitiveRegistry[element.type].component as ComponentType<{ element: Element }>;
  const from = Math.round(element.enterAt * sceneDuration);
  return (
    <Sequence from={from} layout="none" name={`${element.type}:${element.id}`}>
      <Component element={element} />
    </Sequence>
  );
}

function Caption({
  text,
  palette,
  reducedMotion,
}: {
  text: string;
  palette: VideoPalette;
  reducedMotion: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterProgress(frame, fps, reducedMotion, 4);
  return (
    <div
      style={{
        position: "absolute",
        top: 70,
        left: 80,
        right: 80,
        textAlign: "center",
        fontFamily: FONT_SANS,
        fontSize: 44,
        fontWeight: 700,
        letterSpacing: -0.5,
        color: palette.text,
        opacity: p,
        transform: `translateY(${motion((1 - p) * 12, reducedMotion)}px)`,
      }}
    >
      {text}
    </div>
  );
}

export function SceneView({
  scene,
  palette,
  reducedMotion,
}: {
  scene: Scene;
  palette: VideoPalette;
  reducedMotion: boolean;
}) {
  const ctx: SceneContextValue = {
    rows: layoutRows(scene.elements),
    palette,
    reducedMotion,
    sceneDurationInFrames: scene.durationInFrames,
  };
  const canvas = scene.elements
    .filter((el) => primitiveRegistry[el.type].slot === "canvas")
    .sort((a, b) => primitiveRegistry[a.type].layer - primitiveRegistry[b.type].layer);
  const bottom = scene.elements.filter((el) => primitiveRegistry[el.type].slot === "bottom");

  return (
    <SceneContext.Provider value={ctx}>
      <AbsoluteFill style={{ background: palette.background }}>
        <Caption text={scene.caption} palette={palette} reducedMotion={reducedMotion} />
        {canvas.map((el) => (
          <ElementView key={el.id} element={el} sceneDuration={scene.durationInFrames} />
        ))}
        <div
          style={{
            position: "absolute",
            top: 500,
            left: 0,
            right: 0,
            bottom: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 16,
          }}
        >
          {bottom.map((el) => (
            <ElementView key={el.id} element={el} sceneDuration={scene.durationInFrames} />
          ))}
        </div>
      </AbsoluteFill>
    </SceneContext.Provider>
  );
}
