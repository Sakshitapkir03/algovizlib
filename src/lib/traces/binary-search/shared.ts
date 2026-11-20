import { z } from "zod";

/** Only the pointers that sit on a card: a bound that has moved past either end isn't drawn. */
export function onRow(pointers: Record<string, number>, length: number): Record<string, number> {
  return Object.fromEntries(Object.entries(pointers).filter(([, i]) => i >= 0 && i < length));
}

/** Strictly increasing whole numbers that fit on a card. */
export const sortedNums = (max: number) =>
  z
    .array(z.number().int().min(-99).max(99))
    .min(1)
    .max(max)
    .refine((nums) => nums.every((v, i) => i === 0 || nums[i - 1] < v), "nums must be strictly increasing");
