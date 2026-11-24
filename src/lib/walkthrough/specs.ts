import {
  type Field,
  type NumbersField,
  pick,
  randomField,
  randomInt,
  type Rng,
  type TextField,
  type WordsField,
} from "./fields";

/**
 * What "Try your own input" accepts for each problem: the fields (with limits small enough that every scene fits on
 * a phone), the problem's own constraints as rules with the reason when one is broken, and a generator of random
 * valid inputs (for "Random" and the tests). A problem is supported when every argument is a number, a string, or a
 * list of them; trees, grids, graphs, interval lists, and operation sequences aren't (yet).
 */
export type Rule<A> = { ok: (args: A) => boolean; message: string };

export type InputSpec<A extends unknown[] = unknown[]> = {
  problem: string;
  fields: Field[];
  /** The problem's constraints the fields can't express, checked in order. */
  rules?: Rule<A>[];
  /** Shown under the fields before anything is typed: the rules in a few words. */
  requirements?: string[];
  /** Random valid input; by default each field at random, retried until the rules hold. */
  random?: (rng: Rng) => A;
};

// Field builders.
const nums = (
  name: string,
  min: number,
  max: number,
  minLength: number,
  maxLength: number,
  extra: Partial<NumbersField> = {},
): NumbersField => ({ kind: "numbers", name, min, max, minLength, maxLength, ...extra });
const int = (name: string, min: number, max: number): Field => ({ kind: "number", name, min, max });
const lower = (name: string, minLength: number, maxLength: number, alphabet = "abcdeor"): TextField => ({
  kind: "text",
  name,
  minLength,
  maxLength,
  chars: /^[a-z]$/,
  charsLabel: "lowercase letters (a–z)",
  alphabet,
});
const printable = (name: string, minLength: number, maxLength: number, alphabet: string): TextField => ({
  kind: "text",
  name,
  minLength,
  maxLength,
  chars: /^[ -~]$/,
  charsLabel: "characters (letters, digits, spaces, or symbols)",
  alphabet,
});
const words = (
  name: string,
  minCount: number,
  maxCount: number,
  minLength: number,
  maxLength: number,
  alphabet = "abcdeorst",
): WordsField => ({ kind: "words", name, minCount, maxCount, minLength, maxLength, alphabet });

// Rule helpers.
const increasing = (list: readonly number[]) => list.every((v, i) => i === 0 || list[i - 1] < v);
const nonDecreasing = (list: readonly number[]) => list.every((v, i) => i === 0 || list[i - 1] <= v);
const distinct = (list: readonly (number | string)[]) => new Set(list).size === list.length;
const counts = <T>(list: readonly T[]) => {
  const map = new Map<T, number>();
  for (const v of list) map.set(v, (map.get(v) ?? 0) + 1);
  return map;
};
const shuffle = <T>(rng: Rng, list: readonly T[]): T[] => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const distinctValues = (rng: Rng, count: number, min: number, max: number): number[] =>
  shuffle(
    rng,
    Array.from({ length: max - min + 1 }, (_, k) => min + k),
  ).slice(0, count);

/** Exactly one value appears once and every other exactly `times` times. */
const oneOddOut = (list: readonly number[], times: number) => {
  const c = [...counts(list).values()];
  return c.filter((n) => n === 1).length === 1 && c.every((n) => n === 1 || n === times);
};
const oddOutInput = (rng: Rng, times: number, maxValue: number, maxLength: number): [number[]] => {
  const groups = randomInt(rng, 0, Math.floor((maxLength - 1) / times));
  const values = distinctValues(rng, groups + 1, 0, maxValue);
  return [shuffle(rng, [values[0], ...values.slice(1).flatMap((v) => Array<number>(times).fill(v))])];
};

/** The stack column fits 4 items, counting the ones popped this step (they're drawn lifting out). */
const STACK_ROOM = 4;

/** Valid Parentheses: the most brackets open at once (until the first mismatch, where the scan stops). */
function openDepth(s: string): number {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  let most = 0;
  for (const c of s) {
    if (c in pairs) {
      if (stack.pop() !== pairs[c]) break;
    } else most = Math.max(most, stack.push(c));
  }
  return most;
}

/** Reverse Polish notation: the most numbers waiting at once. */
function rpnDepth(tokens: readonly string[]): number {
  let depth = 0;
  let most = 0;
  for (const t of tokens) {
    depth += /^-?\d+$/.test(t) ? 1 : -1;
    most = Math.max(most, depth);
  }
  return most;
}

/** Daily Temperatures' monotonic stack: the most it holds in a step, counting the days that step pops. */
function tempsRoom(temps: readonly number[]): number {
  const stack: number[] = [];
  let most = 0;
  for (const t of temps) {
    let popped = 0;
    while (stack.length > 0 && stack.at(-1)! < t) {
      stack.pop();
      popped++;
    }
    stack.push(t);
    most = Math.max(most, stack.length + popped);
  }
  return most;
}

/** Reverse Polish notation: evaluates (no division by zero) with one value left. */
function evalRpn(tokens: readonly string[]): number | undefined {
  const stack: number[] = [];
  for (const t of tokens) {
    if (/^-?\d+$/.test(t)) stack.push(Number(t));
    else {
      if (stack.length < 2) return undefined;
      const b = stack.pop()!;
      const a = stack.pop()!;
      if (t === "/" && b === 0) return undefined;
      stack.push(t === "+" ? a + b : t === "-" ? a - b : t === "*" ? a * b : Math.trunc(a / b));
    }
  }
  return stack.length === 1 ? stack[0] : undefined;
}

/** Decode String's encoding: letters and k[…] with a single digit k ≥ 1, brackets balanced, digits only before "[". */
function wellFormed(s: string): boolean {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (/\d/.test(c)) {
      if (c === "0" || s[i + 1] !== "[") return false;
    } else if (c === "[") {
      if (!/\d/.test(s[i - 1] ?? "")) return false;
      depth++;
    } else if (c === "]") {
      if (depth === 0 || s[i - 1] === "[") return false;
      depth--;
    }
  }
  return depth === 0;
}
/** The longest text built so far when a "[" saves it on the stack (each saved frame is drawn as `"ab" ×3`). */
const longestSaved = (s: string): number => {
  const stack: { saved: string; count: number }[] = [];
  let current = "";
  let count = 0;
  let longest = 0;
  for (const c of s) {
    if (/\d/.test(c)) count = Number(c);
    else if (c === "[") {
      longest = Math.max(longest, current.length);
      stack.push({ saved: current, count });
      current = "";
    } else if (c === "]") {
      const frame = stack.pop();
      current = frame ? frame.saved + current.repeat(frame.count) : current;
    } else current += c;
  }
  return longest;
};
const expandedLength = (s: string): number => {
  const stack: number[] = [0];
  const ks: number[] = [];
  for (const c of s) {
    if (/\d/.test(c)) ks.push(Number(c));
    else if (c === "[") stack.push(0);
    else if (c === "]") {
      const inner = stack.pop()!;
      stack[stack.length - 1] += inner * ks.pop()!;
    } else stack[stack.length - 1]++;
  }
  return stack[0];
};
function randomEncoding(rng: Rng, depth = 0): string {
  const parts: string[] = [];
  const count = randomInt(rng, 1, 2);
  for (let k = 0; k < count; k++) {
    if (depth < 2 && rng() < 0.6) parts.push(`${randomInt(rng, 2, 3)}[${randomEncoding(rng, depth + 1)}]`);
    else parts.push(Array.from({ length: randomInt(rng, 1, 2) }, () => pick(rng, [..."abxyz"])).join(""));
  }
  return parts.join("");
}

const isRotatedSorted = (list: readonly number[]) =>
  list.filter((v, i) => i > 0 && v < list[i - 1]).length +
    (list.length > 1 && list[0] < list.at(-1)! ? 1 : 0) <=
  1;

/** The top k values by count are unique: the k-th and (k+1)-th counts differ. */
const noTieAtCutoff = (list: readonly number[], k: number) => {
  const c = [...counts(list).values()].sort((a, b) => b - a);
  return k >= c.length || c[k - 1] !== c[k];
};

/** An ordering of the letters: words drawn at random and sorted by it, so the list is usually consistent. */
function alienWords(rng: Rng): string[] {
  const letters = shuffle(rng, [..."abcdxyz"]).slice(0, randomInt(rng, 3, 5));
  const rank = (c: string) => letters.indexOf(c);
  const list = Array.from({ length: randomInt(rng, 2, 5) }, () =>
    Array.from({ length: randomInt(rng, 1, 3) }, () => pick(rng, letters)).join(""),
  );
  const compare = (a: string, b: string) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return rank(a[i]) - rank(b[i]);
    return a.length - b.length;
  };
  return [...new Set(list)].sort(compare);
}

const sortedList = (
  rng: Rng,
  min: number,
  max: number,
  minLength: number,
  maxLength: number,
  strict: boolean,
) => {
  const length = randomInt(rng, minLength, maxLength);
  const values = strict
    ? distinctValues(rng, length, min, max)
    : Array.from({ length }, () => randomInt(rng, min, max));
  return values.sort((a, b) => a - b);
};

// Common rule messages.
const SORTED = "nums must be sorted from smallest to largest: the approach relies on it.";
const STRICT = "nums must be sorted from smallest to largest, with no value twice: the search relies on it.";
const DISTINCT = (name: string) => `Every value in ${name} must be different, as the problem says.`;

function spec<A extends unknown[]>(s: InputSpec<A>): InputSpec {
  return s as unknown as InputSpec;
}

export const inputSpecs: readonly InputSpec[] = [
  // Arrays & Hashing
  spec<[number[], number]>({
    problem: "arrays-hashing/two-sum",
    fields: [nums("nums", -99, 99, 2, 7), int("target", -198, 198)],
    requirements: ["Exactly one pair of positions adds up to target."],
    rules: [
      {
        ok: ([n, t]) => n.flatMap((a, i) => n.slice(i + 1).filter((b) => a + b === t)).length === 1,
        message: "Exactly one pair of values must add up to target (the problem promises one answer).",
      },
    ],
    random: (rng) => {
      const n = randomField(nums("nums", -20, 20, 2, 7), rng) as number[];
      const i = randomInt(rng, 0, n.length - 2);
      const j = randomInt(rng, i + 1, n.length - 1);
      return [n, n[i] + n[j]];
    },
  }),
  spec<[string, string]>({
    problem: "arrays-hashing/valid-anagram",
    fields: [lower("s", 1, 7, "aelnst"), lower("t", 1, 7, "aelnst")],
    random: (rng) => {
      const s = randomField(lower("s", 1, 7, "aelnst"), rng) as string;
      return [
        s,
        rng() < 0.6
          ? shuffle(rng, [...s]).join("")
          : (randomField(lower("t", 1, 7, "aelnst"), rng) as string),
      ];
    },
  }),
  spec<[string[]]>({
    problem: "arrays-hashing/group-anagrams",
    fields: [words("words", 1, 6, 1, 5)],
    random: (rng) => {
      const bases = Array.from({ length: randomInt(rng, 1, 3) }, () =>
        Array.from({ length: randomInt(rng, 1, 4) }, () => pick(rng, [..."aoprst"])).join(""),
      );
      return [
        Array.from({ length: randomInt(rng, 1, 6) }, () => shuffle(rng, [...pick(rng, bases)]).join("")),
      ];
    },
  }),
  spec<[number[]]>({
    problem: "arrays-hashing/longest-consecutive-sequence",
    fields: [nums("nums", -99, 999, 0, 8)],
    random: (rng) => [randomField(nums("nums", -5, 15, 0, 8), rng) as number[]],
  }),
  spec<[number[]]>({
    problem: "arrays-hashing/first-missing-positive",
    fields: [nums("nums", 0, 20, 1, 6)],
    random: (rng) => [randomField(nums("nums", 0, 8, 1, 6), rng) as number[]],
  }),

  // Prefix Sum
  spec<[number[]]>({ problem: "prefix-sum/find-pivot-index", fields: [nums("nums", -99, 99, 1, 5)] }),
  spec<[number[], number]>({
    problem: "prefix-sum/subarray-sum-equals-k",
    fields: [nums("nums", -9, 9, 1, 6), int("k", -50, 50)],
    random: (rng) => [randomField(nums("nums", -3, 5, 1, 6), rng) as number[], randomInt(rng, -3, 9)],
  }),
  spec<[number[]]>({
    problem: "prefix-sum/product-of-array-except-self",
    fields: [nums("nums", -9, 9, 2, 5)],
  }),

  // Sorting
  ...(
    [
      "bubble-sort",
      "selection-sort",
      "insertion-sort",
      "merge-sort",
      "quick-sort",
      "count-inversions",
    ] as const
  ).map((slug) => spec<[number[]]>({ problem: `sorting/${slug}`, fields: [nums("nums", 0, 99, 1, 8)] })),
  spec<[number[]]>({ problem: "sorting/heap-sort", fields: [nums("nums", 0, 99, 1, 7)] }),
  spec<[number[]]>({
    problem: "sorting/counting-sort",
    fields: [nums("nums", 0, 9, 1, 8)],
    requirements: ["The largest and smallest values are at most 7 apart (one tally cell per value)."],
    rules: [
      {
        ok: ([n]) => Math.max(...n) - Math.min(...n) <= 7,
        message:
          "The largest and smallest values can be at most 7 apart: the tally needs a cell for every value between them.",
      },
    ],
    random: (rng) => {
      const base = randomInt(rng, 0, 2);
      return [randomField(nums("nums", base, base + 7, 1, 8), rng) as number[]];
    },
  }),

  // Bit Manipulation
  spec<[number[]]>({
    problem: "bit-manipulation/single-number",
    fields: [nums("nums", 0, 15, 1, 7)],
    requirements: ["One value appears once; every other value appears exactly twice."],
    rules: [
      {
        ok: ([n]) => oneOddOut(n, 2),
        message: "Exactly one value must appear once, and every other value exactly twice.",
      },
    ],
    random: (rng) => oddOutInput(rng, 2, 15, 7),
  }),
  spec<[number]>({ problem: "bit-manipulation/counting-bits", fields: [int("n", 0, 7)] }),
  spec<[number, number]>({
    problem: "bit-manipulation/sum-of-two-integers",
    fields: [int("a", 0, 15), int("b", 0, 15)],
    requirements: ["a + b is at most 31 (five bits)."],
    rules: [
      { ok: ([a, b]) => a + b <= 31, message: "a + b can be at most 31, so the sum fits in five bits." },
    ],
  }),
  spec<[number[]]>({
    problem: "bit-manipulation/single-number-ii",
    fields: [nums("nums", 0, 7, 1, 7)],
    requirements: ["One value appears once; every other value appears exactly three times."],
    rules: [
      {
        ok: ([n]) => oneOddOut(n, 3),
        message: "Exactly one value must appear once, and every other value exactly three times.",
      },
    ],
    random: (rng) => oddOutInput(rng, 3, 7, 7),
  }),

  // Two Pointers
  spec<[number[], number]>({
    problem: "two-pointers/pair-with-target-sum",
    fields: [nums("nums", -99, 99, 2, 8), int("target", -198, 198)],
    requirements: ["nums is sorted from smallest to largest."],
    rules: [{ ok: ([n]) => nonDecreasing(n), message: SORTED }],
    random: (rng) => {
      const n = sortedList(rng, -20, 60, 2, 8, false);
      const target =
        rng() < 0.7
          ? n[randomInt(rng, 0, n.length - 2)] + n.at(-1 - randomInt(rng, 0, 1))!
          : randomInt(rng, -30, 99);
      return [n, target];
    },
  }),
  spec<[string]>({
    problem: "two-pointers/valid-palindrome",
    fields: [printable("s", 1, 14, "abA B!,")],
    random: (rng) => {
      const half = Array.from({ length: randomInt(rng, 0, 6) }, () => pick(rng, [..."abcAB ,!"])).join("");
      const s = rng() < 0.6 ? half + [...half].reverse().join("") : half + pick(rng, [..."xy"]);
      return [s.trim() === "" ? "a" : s.slice(0, 14)];
    },
  }),
  spec<[number[]]>({
    problem: "two-pointers/container-with-most-water",
    fields: [nums("heights", 0, 50, 2, 10)],
  }),
  spec<[number[]]>({ problem: "two-pointers/three-sum", fields: [nums("nums", -9, 9, 3, 8)] }),
  spec<[number[]]>({
    problem: "two-pointers/trapping-rain-water",
    fields: [nums("heights", 0, 9, 1, 12)],
  }),

  // Fast & Slow Pointers
  ...(["linked-list-cycle", "linked-list-cycle-ii"] as const).map((slug) =>
    spec<[number[], number]>({
      problem: `fast-slow-pointers/${slug}`,
      fields: [nums("values", -99, 99, 0, 6), int("pos", -1, 5)],
      requirements: ["pos is −1 (no loop) or the position the last node links back to."],
      rules: [
        {
          ok: ([v, pos]) => pos < v.length,
          message: "pos must be −1 (no loop) or a position in values: the last node links back to it.",
        },
      ],
      random: (rng) => {
        const v = randomField(nums("values", 1, 60, 1, 6), rng) as number[];
        return [v, randomInt(rng, -1, v.length - 1)];
      },
    }),
  ),
  spec<[number[]]>({
    problem: "fast-slow-pointers/middle-of-the-linked-list",
    fields: [nums("head", 1, 99, 1, 8)],
  }),
  spec<[number[]]>({
    problem: "fast-slow-pointers/find-the-duplicate-number",
    fields: [nums("nums", 1, 7, 2, 8)],
    requirements: ["With n + 1 values, each is between 1 and n, and exactly one value repeats."],
    rules: [
      {
        ok: ([n]) => n.every((v) => v < n.length),
        message: "With n + 1 values, every value must be between 1 and n (each one names a position).",
      },
      {
        ok: ([n]) => [...counts(n).values()].filter((c) => c > 1).length === 1,
        message: "Exactly one value must appear more than once.",
      },
    ],
    random: (rng) => {
      const n = randomInt(rng, 1, 7);
      const dup = randomInt(rng, 1, n);
      const values = Array.from({ length: n }, (_, k) => k + 1);
      // Sometimes the duplicate takes another value's place too (it can repeat more than twice).
      if (n > 2 && rng() < 0.3) values[values.indexOf(dup) === 0 ? 1 : 0] = dup;
      return [shuffle(rng, [...values, dup])];
    },
  }),
  spec<[number[]]>({
    problem: "fast-slow-pointers/circular-array-loop",
    fields: [nums("nums", -9, 9, 1, 6, { excludeZero: true })],
    random: (rng) => [randomField(nums("nums", -4, 4, 1, 6, { excludeZero: true }), rng) as number[]],
  }),

  // Sliding Window
  spec<[number[], number]>({
    problem: "sliding-window/maximum-sum-subarray-of-size-k",
    fields: [nums("nums", -99, 99, 1, 9), int("k", 1, 9)],
    requirements: ["k is at most the number of values."],
    rules: [{ ok: ([n, k]) => k <= n.length, message: "k can't be more than the number of values in nums." }],
    random: (rng) => {
      const n = randomField(nums("nums", -9, 20, 1, 9), rng) as number[];
      return [n, randomInt(rng, 1, n.length)];
    },
  }),
  spec<[string]>({
    problem: "sliding-window/longest-substring-without-repeating-characters",
    fields: [printable("s", 1, 10, "abcdp")],
  }),
  spec<[string, number]>({
    problem: "sliding-window/longest-repeating-character-replacement",
    fields: [
      {
        kind: "text",
        name: "s",
        minLength: 1,
        maxLength: 10,
        chars: /^[A-Z]$/,
        charsLabel: "uppercase letters (A–Z)",
        alphabet: "ABC",
      },
      int("k", 0, 10),
    ],
    requirements: ["At most 5 different letters; k is at most the length of s."],
    rules: [
      {
        ok: ([s]) => new Set(s).size <= 5,
        message: "Use at most 5 different letters: the tally has one cell per letter.",
      },
      { ok: ([s, k]) => k <= s.length, message: "k can't be more than the length of s." },
    ],
    random: (rng) => {
      const s = Array.from({ length: randomInt(rng, 1, 10) }, () => pick(rng, [..."ABC"])).join("");
      return [s, randomInt(rng, 0, Math.min(3, s.length))];
    },
  }),
  spec<[string, string]>({
    problem: "sliding-window/minimum-window-substring",
    fields: [
      { ...lower("s", 1, 10), chars: /^[A-Za-z]$/, charsLabel: "letters (A–Z or a–z)", alphabet: "ABCXY" },
      { ...lower("t", 1, 5), chars: /^[A-Za-z]$/, charsLabel: "letters (A–Z or a–z)", alphabet: "ABC" },
    ],
    requirements: ["t has at most 4 different letters."],
    rules: [
      {
        ok: ([, t]) => new Set(t).size <= 4,
        message: "t can have at most 4 different letters: the counts panel has one cell per letter.",
      },
    ],
  }),
  spec<[number[], number]>({
    problem: "sliding-window/sliding-window-maximum",
    fields: [nums("nums", -99, 99, 1, 9), int("k", 1, 4)],
    requirements: ["k is at most the number of values."],
    rules: [{ ok: ([n, k]) => k <= n.length, message: "k can't be more than the number of values in nums." }],
    random: (rng) => {
      const n = randomField(nums("nums", -9, 20, 1, 9), rng) as number[];
      return [n, randomInt(rng, 1, Math.min(4, n.length))];
    },
  }),

  // Binary Search
  ...(["search-sorted-array", "search-insert-position"] as const).map((slug) =>
    spec<[number[], number]>({
      problem: `binary-search/${slug}`,
      fields: [nums("nums", -99, 99, 1, 9), int("target", -99, 99)],
      requirements: ["nums is sorted from smallest to largest, with no value twice."],
      rules: [{ ok: ([n]) => increasing(n), message: STRICT }],
      random: (rng) => {
        const n = sortedList(rng, -30, 60, 1, 9, true);
        return [n, rng() < 0.6 ? pick(rng, n) : randomInt(rng, -35, 65)];
      },
    }),
  ),
  spec<[number[], number]>({
    problem: "binary-search/search-in-rotated-sorted-array",
    fields: [nums("nums", -99, 99, 1, 9), int("target", -99, 99)],
    requirements: ["nums is a sorted list (no value twice) rotated by some amount: 22, 27, 3, 8, 12."],
    rules: [
      { ok: ([n]) => distinct(n), message: DISTINCT("nums") },
      {
        ok: ([n]) => isRotatedSorted(n),
        message:
          "nums must be a sorted list rotated by some amount: increasing, then at most one drop back down.",
      },
    ],
    random: (rng) => {
      const sorted = sortedList(rng, -30, 60, 1, 9, true);
      const k = randomInt(rng, 0, sorted.length - 1);
      const n = [...sorted.slice(k), ...sorted.slice(0, k)];
      return [n, rng() < 0.6 ? pick(rng, n) : randomInt(rng, -35, 65)];
    },
  }),
  spec<[number[], number]>({
    problem: "binary-search/koko-eating-bananas",
    fields: [nums("piles", 1, 16, 1, 6), int("h", 1, 99)],
    requirements: ["h is at least the number of piles (one pile per hour at most)."],
    rules: [
      {
        ok: ([p, h]) => h >= p.length,
        message: "h must be at least the number of piles: Koko finishes at most one pile an hour.",
      },
    ],
    random: (rng) => {
      const p = randomField(nums("piles", 1, 16, 1, 6), rng) as number[];
      return [p, randomInt(rng, p.length, p.length + 8)];
    },
  }),
  spec<[number[], number[]]>({
    problem: "binary-search/median-of-two-sorted-arrays",
    fields: [nums("nums1", -99, 99, 0, 6), nums("nums2", -99, 99, 0, 6)],
    requirements: [
      "Each list is sorted from smallest to largest, with no value twice; together they have a value.",
    ],
    rules: [
      {
        ok: ([a, b]) => a.length + b.length >= 1,
        message: "The two lists need at least one value between them.",
      },
      {
        ok: ([a, b]) => increasing(a) && increasing(b),
        message: "Each list must be sorted from smallest to largest, with no value twice.",
      },
    ],
    random: (rng) => {
      const a = sortedList(rng, -20, 40, 0, 6, true);
      return [a, sortedList(rng, -20, 40, a.length === 0 ? 1 : 0, 6, true)];
    },
  }),

  // Stack
  spec<[string]>({
    problem: "stack/valid-parentheses",
    fields: [
      {
        kind: "text",
        name: "s",
        minLength: 1,
        maxLength: 10,
        chars: /^[()[\]{}]$/,
        charsLabel: "brackets: ( ) [ ] { }",
        alphabet: "()[]{}",
      },
    ],
    requirements: [`At most ${STACK_ROOM} brackets open at once.`],
    rules: [
      {
        ok: ([s]) => openDepth(s) <= STACK_ROOM,
        message: `At most ${STACK_ROOM} brackets can be open at once: the stack holds every open one, and more won't fit on screen.`,
      },
    ],
    random: (rng) => {
      if (rng() < 0.5)
        return [Array.from({ length: randomInt(rng, 1, 10) }, () => pick(rng, [..."()[]{}"])).join("")];
      // A balanced string, sometimes with one bracket changed.
      let s = "";
      const open: string[] = [];
      const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
      const length = 2 * randomInt(rng, 1, 5);
      while (s.length < length) {
        if (open.length > 0 && (rng() < 0.5 || s.length + open.length >= length)) s += pairs[open.pop()!];
        else {
          const c = pick(rng, ["(", "[", "{"]);
          open.push(c);
          s += c;
        }
      }
      return [rng() < 0.3 ? s.slice(0, -1) + pick(rng, [")", "]", "}"]) : s];
    },
  }),
  spec<[string[]]>({
    problem: "stack/evaluate-reverse-polish-notation",
    fields: [
      {
        kind: "tokens",
        name: "tokens",
        minCount: 1,
        maxCount: 9,
        token: /^(-?\d{1,2}|[+\-*/])$/,
        tokensLabel: "whole numbers from −99 to 99, and + − * /",
      },
    ],
    requirements: [
      "A valid expression in Reverse Polish notation (numbers before their operator), no division by 0, at most 3 numbers waiting at once.",
    ],
    rules: [
      {
        ok: ([t]) => rpnDepth(t) <= STACK_ROOM - 1,
        message: `At most ${STACK_ROOM - 1} numbers can be waiting at once: they're on the stack, and more won't fit on screen.`,
      },
      {
        ok: ([t]) => evalRpn(t) !== undefined,
        message:
          "That isn't a complete expression: each operator needs two numbers before it, one value must be left at the end, and nothing divides by 0.",
      },
    ],
    random: (rng) => {
      for (;;) {
        const tokens: string[] = [];
        let depth = 0;
        const operands = randomInt(rng, 1, 5);
        let pushed = 0;
        while (pushed < operands || depth > 1) {
          if (pushed < operands && (depth < 2 || rng() < 0.5)) {
            tokens.push(String(randomInt(rng, 1, 9)));
            pushed++;
            depth++;
          } else {
            tokens.push(pick(rng, ["+", "-", "*", "/"]));
            depth--;
          }
        }
        if (evalRpn(tokens) !== undefined && rpnDepth(tokens) <= STACK_ROOM - 1) return [tokens];
      }
    },
  }),
  spec<[number[]]>({
    problem: "stack/daily-temperatures",
    fields: [nums("temps", 30, 100, 1, 7)],
    requirements: [`At most ${STACK_ROOM} days waiting on the stack at once.`],
    rules: [
      {
        ok: ([t]) => tempsRoom(t) <= STACK_ROOM,
        message: `These temperatures stack up more than ${STACK_ROOM} days waiting for a warmer one, too many to show. Try fewer days, or ones that warm up sooner.`,
      },
    ],
  }),
  spec<[string]>({
    problem: "stack/decode-string",
    fields: [
      {
        kind: "text",
        name: "s",
        minLength: 1,
        maxLength: 10,
        chars: /^[a-z0-9[\]]$/,
        charsLabel: "lowercase letters, digits, and square brackets",
        alphabet: "ab2[]",
      },
    ],
    requirements: [
      "Well formed, like 3[ab]c: a count from 1 to 9 before each [ … ], at most 3 letters built before a [, and at most 20 letters in all.",
    ],
    rules: [
      {
        ok: ([s]) => wellFormed(s),
        message:
          "s must be well formed: every [ … ] needs a count from 1 to 9 just before it and something inside, brackets must match, and digits only count repeats.",
      },
      {
        ok: ([s]) => longestSaved(s) <= 3,
        message:
          "Before each [, the text built so far is saved on the stack with its count; keep that text to 3 letters or fewer so it fits on the stack.",
      },
      {
        ok: ([s]) => expandedLength(s) <= 20,
        message: "That expands to more than 20 letters, too long to show. Use smaller counts.",
      },
    ],
    random: (rng) => {
      for (;;) {
        const s = randomEncoding(rng);
        if (s.length <= 10 && expandedLength(s) <= 20 && longestSaved(s) <= 3) return [s];
      }
    },
  }),
  spec<[number[]]>({
    problem: "stack/largest-rectangle-in-histogram",
    fields: [nums("heights", 0, 20, 1, 7)],
  }),

  // Linked List
  spec<[number[]]>({ problem: "linked-list/reverse-linked-list", fields: [nums("head", -99, 99, 0, 5)] }),
  spec<[number[], number[]]>({
    problem: "linked-list/merge-two-sorted-lists",
    fields: [nums("a", -9, 99, 0, 4), nums("b", -9, 99, 0, 4)],
    requirements: ["Each list is sorted from smallest to largest."],
    rules: [
      {
        ok: ([a, b]) => nonDecreasing(a) && nonDecreasing(b),
        message: "Each list must be sorted from smallest to largest, as the problem says.",
      },
    ],
    random: (rng) => [sortedList(rng, 0, 20, 0, 4, false), sortedList(rng, 0, 20, 0, 4, false)],
  }),
  spec<[number[], number]>({
    problem: "linked-list/remove-nth-node-from-end",
    fields: [nums("head", -99, 99, 1, 6), int("n", 1, 6)],
    requirements: ["n is at most the number of nodes."],
    rules: [
      { ok: ([v, n]) => n <= v.length, message: "n can't be more than the number of nodes in the list." },
    ],
    random: (rng) => {
      const v = randomField(nums("head", 1, 60, 1, 6), rng) as number[];
      return [v, randomInt(rng, 1, v.length)];
    },
  }),
  spec<[number[]]>({ problem: "linked-list/reorder-list", fields: [nums("head", 1, 99, 1, 6)] }),

  // Greedy
  spec<[number[]]>({
    problem: "greedy/lemonade-change",
    fields: [nums("bills", 5, 20, 1, 8, { allowed: [5, 10, 20] })],
  }),
  spec<[number[]]>({ problem: "greedy/jump-game", fields: [nums("nums", 0, 9, 1, 7)] }),
  spec<[number[], number[]]>({
    problem: "greedy/gas-station",
    fields: [nums("gas", 0, 99, 1, 6), nums("cost", 0, 99, 1, 6)],
    requirements: ["gas and cost have one value per station (the same length)."],
    rules: [
      {
        ok: ([g, c]) => g.length === c.length,
        message: "gas and cost need the same number of values: one per station.",
      },
    ],
    random: (rng) => {
      const length = randomInt(rng, 1, 6);
      const list = () => Array.from({ length }, () => randomInt(rng, 0, 6));
      return [list(), list()];
    },
  }),
  spec<[string]>({
    problem: "greedy/partition-labels",
    fields: [lower("s", 1, 10, "abcdef")],
    requirements: ["At most 8 different letters."],
    rules: [
      {
        ok: ([s]) => new Set(s).size <= 8,
        message: "Use at most 8 different letters, so every last position fits on screen.",
      },
    ],
  }),
  spec<[number[]]>({ problem: "greedy/candy", fields: [nums("ratings", 0, 99, 1, 6)] }),

  // Heap / Priority Queue
  spec<[number[]]>({ problem: "heap/last-stone-weight", fields: [nums("stones", 1, 99, 1, 7)] }),
  spec<[number[], number]>({
    problem: "heap/kth-largest-element-in-an-array",
    fields: [nums("nums", -99, 99, 1, 8), int("k", 1, 6)],
    requirements: ["k is at most the number of values."],
    rules: [{ ok: ([n, k]) => k <= n.length, message: "k can't be more than the number of values in nums." }],
    random: (rng) => {
      const n = randomField(nums("nums", -9, 40, 1, 8), rng) as number[];
      return [n, randomInt(rng, 1, Math.min(6, n.length))];
    },
  }),
  spec<[number[], number]>({
    problem: "heap/top-k-frequent-elements",
    fields: [nums("nums", -9, 99, 1, 9), int("k", 1, 4)],
    requirements: [
      "At most 6 different values; k is at most that many, with no tie for the last of the top k.",
    ],
    rules: [
      {
        ok: ([n]) => new Set(n).size <= 6,
        message: "Use at most 6 different values, so the counts fit on screen.",
      },
      {
        ok: ([n, k]) => k <= new Set(n).size,
        message: "k can't be more than the number of different values in nums.",
      },
      {
        ok: ([n, k]) => noTieAtCutoff(n, k),
        message: "The top k must be clear: the k-th most frequent value can't tie with the next one.",
      },
    ],
    random: (rng) => {
      const pool = distinctValues(rng, randomInt(rng, 1, 6), -9, 30);
      const n = Array.from({ length: randomInt(rng, 1, 9) }, () => pick(rng, pool));
      return [n, randomInt(rng, 1, Math.min(4, new Set(n).size))];
    },
  }),

  // Trie
  spec<[string[]]>({
    problem: "trie/longest-common-prefix",
    fields: [words("words", 1, 4, 1, 4)],
    requirements: ["At most 11 different prefixes in all (the trie's letter nodes)."],
    rules: [
      {
        ok: ([w]) => new Set(w.join("")).size <= 9,
        message: "Use at most 9 different letters across the words, so the trie fits on screen.",
      },
      {
        ok: ([w]) => new Set(w.flatMap((word) => [...word].map((_, i) => word.slice(0, i + 1)))).size <= 11,
        message:
          "These words need more than 11 letter nodes in the trie (one per different prefix), too many to show. Use shorter words or ones that share more of their start.",
      },
    ],
    random: (rng) => {
      const prefix = Array.from({ length: randomInt(rng, 0, 2) }, () => pick(rng, [..."trea"])).join("");
      return [
        Array.from(
          { length: randomInt(rng, 1, 4) },
          () =>
            (
              prefix + Array.from({ length: randomInt(rng, 0, 2) }, () => pick(rng, [..."trem"])).join("")
            ).slice(0, 4) || "a",
        ),
      ];
    },
  }),
  spec<[string[], string]>({
    problem: "trie/replace-words",
    fields: [
      words("roots", 1, 4, 1, 4),
      {
        kind: "text",
        name: "sentence",
        minLength: 1,
        maxLength: 59,
        chars: /^[a-z ]$/,
        charsLabel: "lowercase words (1–6 words of up to 9 letters, one space apart)",
        alphabet: "abc ",
      },
    ],
    requirements: ["sentence is 1–6 lowercase words of up to 9 letters, one space apart."],
    rules: [
      {
        ok: ([, s]) => /^[a-z]{1,9}( [a-z]{1,9}){0,5}$/.test(s),
        message:
          "sentence must be 1–6 lowercase words of up to 9 letters each, with one space between words.",
      },
    ],
    random: (rng) => {
      const roots = [
        ...new Set(
          Array.from({ length: randomInt(rng, 1, 4) }, () =>
            Array.from({ length: randomInt(rng, 1, 3) }, () => pick(rng, [..."abcr"])).join(""),
          ),
        ),
      ];
      const sentence = Array.from({ length: randomInt(rng, 1, 6) }, () =>
        (
          (rng() < 0.6 ? pick(rng, roots) : "") +
          Array.from({ length: randomInt(rng, 1, 4) }, () => pick(rng, [..."abcrst"])).join("")
        ).slice(0, 9),
      ).join(" ");
      return [roots, sentence];
    },
  }),
  spec<[string[]]>({
    problem: "advanced-graphs/alien-dictionary",
    fields: [words("words", 2, 5, 1, 4)],
    requirements: ["At most 6 different letters across the words."],
    rules: [
      {
        ok: ([w]) => new Set(w.join("")).size <= 6,
        message: "Use at most 6 different letters across the words: the graph has a node per letter.",
      },
    ],
    random: (rng) => {
      for (;;) {
        const list = alienWords(rng);
        if (list.length >= 2) return [list];
      }
    },
  }),

  // Backtracking
  spec<[number[]]>({
    problem: "backtracking/sum-of-all-subset-xor-totals",
    fields: [nums("nums", 1, 20, 1, 3)],
  }),
  spec<[number[]]>({
    problem: "backtracking/subsets",
    fields: [nums("nums", 0, 9, 1, 3)],
    requirements: ["Every value is different."],
    rules: [{ ok: ([n]) => distinct(n), message: DISTINCT("nums") }],
  }),
  spec<[number[]]>({
    problem: "backtracking/permutations",
    fields: [nums("nums", -9, 9, 1, 3)],
    requirements: ["Every value is different."],
    rules: [{ ok: ([n]) => distinct(n), message: DISTINCT("nums") }],
  }),
  spec<[number[], number]>({
    problem: "backtracking/combination-sum",
    fields: [nums("candidates", 2, 20, 1, 3), int("target", 1, 14)],
    requirements: ["Every candidate is different; target is at most 4 times the smallest one."],
    rules: [
      { ok: ([c]) => distinct(c), message: DISTINCT("candidates") },
      {
        ok: ([c, t]) => t <= 4 * Math.min(...c),
        message:
          "target can be at most 4 times the smallest candidate: the decision tree gets a level for every pick, and more than 4 won't fit on screen.",
      },
    ],
    random: (rng) => {
      const c = distinctValues(rng, randomInt(rng, 1, 3), 2, 8);
      return [c, randomInt(rng, 1, Math.min(14, 4 * Math.min(...c)))];
    },
  }),
  spec<[number]>({ problem: "backtracking/n-queens", fields: [int("n", 1, 4)] }),

  // Dynamic Programming
  spec<[number]>({ problem: "dynamic-programming/climbing-stairs", fields: [int("n", 1, 8)] }),
  spec<[number[]]>({ problem: "dynamic-programming/house-robber", fields: [nums("money", 0, 99, 1, 7)] }),
  spec<[number[], number]>({
    problem: "dynamic-programming/coin-change",
    fields: [nums("coins", 1, 20, 1, 4), int("amount", 0, 9)],
    requirements: ["coins listed from smallest to largest, each once."],
    rules: [
      {
        ok: ([c]) => increasing(c),
        message:
          "List the coins from smallest to largest, each value once (the table reads them in that order).",
      },
    ],
    random: (rng) => [sortedList(rng, 1, 8, 1, 4, true), randomInt(rng, 0, 9)],
  }),
  spec<[string, string]>({
    problem: "dynamic-programming/longest-common-subsequence",
    fields: [lower("a", 1, 5, "enost"), lower("b", 1, 5, "enost")],
  }),
  spec<[string, string]>({
    problem: "dynamic-programming/edit-distance",
    fields: [lower("source", 0, 4, "acrt"), lower("target", 0, 4, "acrt")],
  }),
];
