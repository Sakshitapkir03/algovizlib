import type { Judge } from "./schema";

const FLOAT_TOLERANCE = 1e-5;

/** Stable key for deep comparison of JSON-like values. */
function key(value: unknown): string {
  return JSON.stringify(value);
}

function sortedKeys(values: unknown[]): string[] {
  return values.map(key).sort();
}

/** Compare a solution's return value with an example's `expected`, using the problem's judge. */
export function judgeOutput(judge: Judge, actual: unknown, expected: unknown): boolean {
  switch (judge) {
    case "exact":
      return key(actual) === key(expected);
    case "float":
      return (
        typeof actual === "number" &&
        typeof expected === "number" &&
        Math.abs(actual - expected) <= FLOAT_TOLERANCE
      );
    case "unordered":
      return (
        Array.isArray(actual) &&
        Array.isArray(expected) &&
        key(sortedKeys(actual)) === key(sortedKeys(expected))
      );
    case "unordered-nested": {
      if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
      const normalize = (outer: unknown[]) =>
        outer.map((inner) => (Array.isArray(inner) ? key(sortedKeys(inner)) : key(inner))).sort();
      return key(normalize(actual)) === key(normalize(expected));
    }
  }
}
