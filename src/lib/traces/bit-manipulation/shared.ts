/** Bit positions (0 = lowest) where `a` and `b` differ, within `width` bits. */
export function changedBits(a: number, b: number, width: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < width; k++) if (((a >> k) & 1) !== ((b >> k) & 1)) out.push(k);
  return out;
}

/** `value` in `width` binary digits, most significant first (two's complement for negatives). */
export const binary = (value: number, width: number) =>
  Array.from({ length: width }, (_, k) => (value >> (width - 1 - k)) & 1).join("");
