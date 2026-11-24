/**
 * The fields a learner fills in to try their own input: a list of whole numbers, one whole number, a piece of text,
 * a list of words, or a list of tokens. Each parses what was typed (forgivingly: brackets, commas or spaces, a
 * typographic minus), explains what it expects in plain words when it can't, formats a value back into the box, and
 * draws a random valid value (for "Random" and the tests).
 */

/** A source of random numbers in [0, 1). */
export type Rng = () => number;

type Common = {
  /** The parameter's name, as the problem statement writes it ("nums", "target"). */
  name: string;
};

export type NumbersField = Common & {
  kind: "numbers";
  min: number;
  max: number;
  minLength: number;
  maxLength: number;
  /** Only these values (Lemonade Change's bills). */
  allowed?: readonly number[];
  /** Never this value (Circular Array Loop's jumps aren't 0). */
  excludeZero?: boolean;
};
export type NumberField = Common & { kind: "number"; min: number; max: number };
export type TextField = Common & {
  kind: "text";
  minLength: number;
  maxLength: number;
  /** Which characters are allowed, tested one at a time. */
  chars: RegExp;
  /** The allowed characters in words: "lowercase letters (a–z)". */
  charsLabel: string;
  /** The characters a random value is drawn from. */
  alphabet: string;
};
export type WordsField = Common & {
  kind: "words";
  minCount: number;
  maxCount: number;
  minLength: number;
  maxLength: number;
  /** The letters a random word is drawn from (words are always lowercase a–z). */
  alphabet: string;
};
export type TokensField = Common & {
  kind: "tokens";
  minCount: number;
  maxCount: number;
  token: RegExp;
  /** What a token may be, in words: "whole numbers and + − * /". */
  tokensLabel: string;
};

export type Field = NumbersField | NumberField | TextField | WordsField | TokensField;
export type FieldValue = number[] | number | string | string[];

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

/** Numbers as they read in messages: "−99" with a real minus sign. */
export const num = (n: number) => (n < 0 ? `−${-n}` : String(n));
const range = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

/** What a field expects, in one sentence ("Use 2–8 whole numbers between −99 and 99, separated by commas."). */
export function fieldHint(field: Field): string {
  switch (field.kind) {
    case "numbers": {
      const count = `${range(field.minLength, field.maxLength)} ${plural(field.maxLength, "whole number")}`;
      if (field.allowed)
        return `Use ${count}, each ${field.allowed
          .map(num)
          .join(", ")
          .replace(/, (\S+)$/, " or $1")}.`;
      const zero = field.excludeZero ? " (not 0)" : "";
      return `Use ${count} between ${num(field.min)} and ${num(field.max)}${zero}, separated by commas.`;
    }
    case "number":
      return `Use a whole number between ${num(field.min)} and ${num(field.max)}.`;
    case "text":
      return field.minLength === 0
        ? `Use up to ${field.maxLength} ${field.charsLabel}.`
        : `Use ${range(field.minLength, field.maxLength)} ${field.charsLabel}.`;
    case "words":
      return `Use ${range(field.minCount, field.maxCount)} ${plural(field.maxCount, "word")} of ${range(field.minLength, field.maxLength)} lowercase letters, separated by commas.`;
    case "tokens":
      return `Use ${range(field.minCount, field.maxCount)} ${plural(field.maxCount, "token")} (${field.tokensLabel}), separated by spaces.`;
  }
}

/** Split a list on commas and/or whitespace, dropping surrounding brackets and quotes. */
function items(text: string): string[] {
  const inner = text.trim().replace(/^\[([\s\S]*)\]$/, "$1");
  return inner
    .split(/[\s,]+/)
    .map((s) => s.replace(/^["']|["']$/g, ""))
    .filter((s) => s !== "");
}

const normalizeMinus = (s: string) => s.replace(/[−–]/g, "-");

export function parseField(field: Field, text: string): Parsed<FieldValue> {
  const fail = (lead?: string) => ({
    ok: false as const,
    message: [lead, fieldHint(field)].filter(Boolean).join(" "),
  });
  switch (field.kind) {
    case "numbers": {
      const parts = items(normalizeMinus(text));
      const values: number[] = [];
      for (const part of parts) {
        if (!/^-?\d+$/.test(part)) return fail(`"${part}" isn't a whole number.`);
        const v = Number(part);
        if (field.allowed && !field.allowed.includes(v)) return fail(`${num(v)} isn't allowed here.`);
        if (v < field.min || v > field.max) return fail(`${num(v)} is out of range.`);
        if (field.excludeZero && v === 0) return fail("0 isn't allowed here.");
        values.push(v);
      }
      if (values.length < field.minLength || values.length > field.maxLength)
        return fail(`That's ${values.length} ${plural(values.length, "number")}.`);
      return { ok: true, value: values };
    }
    case "number": {
      const s = normalizeMinus(text.trim());
      if (!/^-?\d+$/.test(s)) return fail(s === "" ? undefined : `"${s}" isn't a whole number.`);
      const v = Number(s);
      if (v < field.min || v > field.max) return fail(`${num(v)} is out of range.`);
      return { ok: true, value: v };
    }
    case "text": {
      // Surrounding quotes are dropped (people paste "abc"). Where a space is a character (Valid Palindrome), the
      // text is kept exactly; elsewhere stray spaces at the ends are.
      const unquoted = text.replace(/^\s*"([\s\S]*)"\s*$/, "$1");
      const s = field.chars.test(" ") ? unquoted : unquoted.trim();
      const bad = [...s].find((c) => !field.chars.test(c));
      if (bad !== undefined) return fail(`"${bad}" isn't allowed here.`);
      if (s.length < field.minLength || s.length > field.maxLength)
        return fail(`That's ${s.length} ${plural(s.length, "character")}.`);
      return { ok: true, value: s };
    }
    case "words": {
      const words = items(text).map((w) => w.toLowerCase());
      const bad = words.find(
        (w) => !/^[a-z]+$/.test(w) || w.length < field.minLength || w.length > field.maxLength,
      );
      if (bad !== undefined) return fail(`"${bad}" doesn't fit.`);
      if (words.length < field.minCount || words.length > field.maxCount)
        return fail(`That's ${words.length} ${plural(words.length, "word")}.`);
      return { ok: true, value: words };
    }
    case "tokens": {
      const tokens = normalizeMinus(text)
        .trim()
        .replace(/^\[([\s\S]*)\]$/, "$1")
        .split(/[\s,]+/)
        .map((s) => s.replace(/^["']|["']$/g, ""))
        .filter((s) => s !== "");
      const bad = tokens.find((t) => !field.token.test(t));
      if (bad !== undefined) return fail(`"${bad}" isn't a token.`);
      if (tokens.length < field.minCount || tokens.length > field.maxCount)
        return fail(`That's ${tokens.length} ${plural(tokens.length, "token")}.`);
      return { ok: true, value: tokens };
    }
  }
}

/** A value as it goes back into the box (parsing it gives the same value). */
export function formatField(field: Field, value: FieldValue): string {
  switch (field.kind) {
    case "numbers":
    case "words":
      return (value as (number | string)[]).join(", ");
    case "tokens":
      return (value as string[]).join(" ");
    case "number":
      return String(value);
    case "text":
      return value as string;
  }
}

/** A value as it reads in a sentence: `nums = [4, 9, 14]`, `s = "abc"`. */
export function describeField(field: Field, value: FieldValue): string {
  switch (field.kind) {
    case "numbers":
      return `${field.name} = [${(value as number[]).join(", ")}]`;
    case "words":
    case "tokens":
      return `${field.name} = [${(value as string[]).map((w) => `"${w}"`).join(", ")}]`;
    case "number":
      return `${field.name} = ${value as number}`;
    case "text":
      return `${field.name} = "${value as string}"`;
  }
}

export const randomInt = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
export const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)];

/** A random value the field accepts (rules between fields are the spec's business). */
export function randomField(field: Field, rng: Rng): FieldValue {
  switch (field.kind) {
    case "numbers": {
      const length = randomInt(rng, field.minLength, field.maxLength);
      return Array.from({ length }, () => {
        if (field.allowed) return pick(rng, field.allowed);
        for (;;) {
          const v = randomInt(rng, field.min, field.max);
          if (!(field.excludeZero && v === 0)) return v;
        }
      });
    }
    case "number":
      return randomInt(rng, field.min, field.max);
    case "text":
      return Array.from({ length: randomInt(rng, field.minLength, field.maxLength) }, () =>
        pick(rng, [...field.alphabet]),
      ).join("");
    case "words":
      return Array.from({ length: randomInt(rng, field.minCount, field.maxCount) }, () =>
        Array.from({ length: randomInt(rng, field.minLength, field.maxLength) }, () =>
          pick(rng, [...field.alphabet]),
        ).join(""),
      );
    case "tokens":
      // Token lists need their own generator (they must form a valid expression); see the spec.
      return [];
  }
}
