import { interpolate, spring } from "remotion";

/** 0→1 entrance progress. Reduced motion skips the spring (still fades). */
export function enterProgress(frame: number, fps: number, reducedMotion: boolean, delay = 0): number {
  if (reducedMotion) {
    return interpolate(frame - delay, [0, 8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  return spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.6 } });
}

/** Translate/scale offsets are dropped entirely under reduced motion. */
export function motion(value: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : value;
}
