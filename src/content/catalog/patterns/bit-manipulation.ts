import { definePattern } from "@/lib/catalog";

export const bitManipulationPattern = definePattern({
  slug: "bit-manipulation",
  categorySlug: "dsa",
  group: "foundations",
  name: "Bit Manipulation",
  summary:
    "Treat integers as rows of bits and use AND, OR, XOR, and shifts to count, cancel, combine, or record sets of flags in a single number.",
  whenToUse: [
    "every value appears twice (or k times) except one",
    "arithmetic without using + or -",
    "counting set bits or working with powers of two",
    "a small set (up to ~20 items) whose subsets you need to track as state",
  ],
  coreIdea:
    "Bitwise operators work on every bit position independently and in constant time, so properties that hold per bit become cheap whole-number tricks. XOR is its own inverse (x ^ x = 0, x ^ 0 = x) and order doesn't matter, so XOR-ing a list cancels every value that appears an even number of times. Shifting and masking let you read or set one bit, and x & (x - 1) clears the lowest set bit, which links a number's bit count to a smaller number's. Finally, an integer with n bits can stand for any subset of n items, so a set of visited nodes or chosen elements fits in one number that can be used as an array index or a hash key.",
  typicalComplexity: { time: "O(n)", space: "O(1)" },
  order: 3,
});
