/**
 * Seeded randomness for the simulation. Nothing in `src/lib/sim` reads `Math.random` or the clock: every draw comes
 * from a named stream (`latency:api→provider`, `work:provider`), each seeded from the scenario's seed and the stream's
 * name. Streams are independent, so adding a component (a new stream) never changes the draws of the others, and the
 * same scenario always replays exactly.
 */

/** A generator of numbers in [0, 1). */
export type Rng = () => number;

/** FNV-1a over a string, mixed with the seed: a 32-bit stream seed. */
function hash(seed: number, name: string): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** mulberry32: small, fast, and good enough for picking latencies (not for anything security-related). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Named, independent streams for one seed. The same name always returns the same stream object. */
export function streams(seed: number): (name: string) => Rng {
  const made = new Map<string, Rng>();
  return (name) => {
    let rng = made.get(name);
    if (!rng) {
      rng = mulberry32(hash(seed, name));
      made.set(name, rng);
    }
    return rng;
  };
}

/** A whole number of milliseconds in [base, base + spread). */
export const jitter = (rng: Rng, base: number, spread: number) => base + Math.floor(rng() * spread);
