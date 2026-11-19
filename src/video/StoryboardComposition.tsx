import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Fragment } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { getSceneTimeline, sceneIndexAtFrame, TRANSITION_FRAMES, type Storyboard } from "@/lib/storyboard";

import { SceneView } from "./SceneView";
import { TEXT, textMetrics, type TextMetrics } from "./text";
import { FONT_SANS, palettes, type VideoPalette, type VideoThemeName } from "./theme";

export type StoryboardCompositionProps = {
  storyboard: Storyboard;
  theme: VideoThemeName;
  reducedMotion: boolean;
  /** The player's rendered width in CSS px; text is sized so it stays readable (see `video/text.ts`). */
  displayWidth?: number;
};

/**
 * Persistent chrome that does not cross-fade: concept label + progress. On a phone-sized player only the progress
 * dots remain; the page around the player already names the video and the scene.
 */
function Chrome({
  storyboard,
  palette,
  text,
}: {
  storyboard: Storyboard;
  palette: VideoPalette;
  text: TextMetrics;
}) {
  const frame = useCurrentFrame();
  const { timings } = getSceneTimeline(storyboard.scenes);
  const current = sceneIndexAtFrame(timings, frame);
  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        left: 32,
        right: 32,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: FONT_SANS,
        fontSize: text.size(TEXT.chrome),
        fontWeight: 600,
        color: palette.textMuted,
      }}
    >
      <span>
        {text.compact ? null : (
          <>
            <span style={{ color: palette.primary }}>algovizlib</span> · {storyboard.concept}
          </>
        )}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {storyboard.scenes.map((s, i) => (
          <span
            key={s.id}
            style={{
              width: i === current ? 22 : 8,
              height: 8,
              borderRadius: 999,
              background: i <= current ? palette.primary : palette.border,
            }}
          />
        ))}
        {text.compact ? null : (
          <span style={{ marginLeft: 8 }}>
            {current + 1}/{storyboard.scenes.length}
          </span>
        )}
      </span>
    </div>
  );
}

export function StoryboardComposition({
  storyboard,
  theme,
  reducedMotion,
  displayWidth,
}: StoryboardCompositionProps) {
  const palette = palettes[theme];
  const text = textMetrics(displayWidth);
  const last = storyboard.scenes.length - 1;

  return (
    <AbsoluteFill style={{ background: palette.background }}>
      <TransitionSeries>
        {storyboard.scenes.map((scene, i) => (
          <Fragment key={scene.id}>
            <TransitionSeries.Sequence durationInFrames={scene.durationInFrames} name={scene.id}>
              <SceneView scene={scene} palette={palette} reducedMotion={reducedMotion} text={text} />
            </TransitionSeries.Sequence>
            {i < last ? (
              <TransitionSeries.Transition
                presentation={fade()}
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
              />
            ) : null}
          </Fragment>
        ))}
      </TransitionSeries>
      <Chrome storyboard={storyboard} palette={palette} text={text} />
    </AbsoluteFill>
  );
}
