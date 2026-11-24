/**
 * The tutor's answers are plain text. The prompt asks for that; this cleans up what slips through: LaTeX math
 * ("$n^2$", "\le", "\frac{a}{b}") becomes readable symbols ("n²", "≤", "a/b"), and Markdown (bold, italics, headings,
 * bullets, code backticks) becomes plain words.
 */
const SUPER: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  n: "ⁿ",
  i: "ⁱ",
  k: "ᵏ",
  "+": "⁺",
  "-": "⁻",
};
const SUB: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
};
const COMMANDS: Record<string, string> = {
  le: "≤",
  leq: "≤",
  ge: "≥",
  geq: "≥",
  ne: "≠",
  neq: "≠",
  times: "×",
  cdot: "·",
  div: "÷",
  pm: "±",
  to: "→",
  rightarrow: "→",
  Rightarrow: "⇒",
  leftarrow: "←",
  infty: "∞",
  approx: "≈",
  ldots: "…",
  dots: "…",
  log: "log",
  ln: "ln",
  min: "min",
  max: "max",
  sum: "Σ",
  in: "∈",
  sqrt: "√",
};

const mapChars = (s: string, table: Record<string, string>) =>
  [...s].every((c) => c in table) ? [...s].map((c) => table[c]).join("") : undefined;

export function plainText(input: string): string {
  let s = input;
  // Display and inline math delimiters: keep what's inside.
  s = s
    .replace(/\$\$([\s\S]*?)\$\$/g, "$1")
    .replace(/\\\[([\s\S]*?)\\\]/g, "$1")
    .replace(/\\\(([\s\S]*?)\\\)/g, "$1");
  // Inline math, but never money: "$49 … $50" stays as written. Math is "$…$" holding a LaTeX mark (^ _ \ { }) or
  // one spaceless expression starting with a letter ("$n$", "$O(n)$").
  s = s.replace(/\$([^$\n]+?)\$/g, (m, inner: string) =>
    /[\\^_{}]/.test(inner) || /^[A-Za-z][^\s]*$/.test(inner) ? inner : m,
  );
  // LaTeX structures, then commands.
  s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2");
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, "√$1");
  s = s.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\([A-Za-z]+)/g, (m, name: string) => COMMANDS[name] ?? name);
  // Powers and indices: n^2, n^{10}, x_1 (left as written when there's no matching character).
  s = s.replace(
    /\^\{([^{}]+)\}|\^([0-9nik+-]+)/g,
    (m, braced?: string, bare?: string) => mapChars(braced ?? bare!, SUPER) ?? m,
  );
  s = s.replace(
    /_\{([0-9]+)\}|_([0-9]+)\b/g,
    (m, braced?: string, bare?: string) => mapChars(braced ?? bare!, SUB) ?? m,
  );
  s = s.replace(/[{}]/g, "");
  // Markdown: headings, bold and italics, code, bullets.
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/__([^_\n]+)__/g, "$1");
  s = s.replace(/(^|[\s(])\*([^*\s][^*\n]*?)\*(?=[\s).,;:!?]|$)/g, "$1$2");
  s = s.replace(/(^|[\s(])_([^_\s][^_\n]*?)_(?=[\s).,;:!?]|$)/g, "$1$2");
  s = s.replace(/`([^`\n]+)`/g, "$1");
  s = s.replace(/^\s*[-*+]\s+/gm, "• ");
  return s.replace(/[ \t]+\n/g, "\n");
}

/**
 * Clean a stream as it arrives without ever changing what's already been shown: emit the cleaned text up to the last
 * space, holding back anything after an unclosed "$", "**", or backtick until it closes (or the stream ends).
 */
export async function* plainTextStream(chunks: AsyncIterable<string>): AsyncIterable<string> {
  let raw = "";
  let shown = "";
  const emit = (clean: string) => {
    if (!clean.startsWith(shown) || clean.length === shown.length) return "";
    const delta = clean.slice(shown.length);
    shown = clean;
    return delta;
  };
  for await (const chunk of chunks) {
    raw += chunk;
    let safe = raw.slice(0, raw.search(/\s\S*$/) === -1 ? 0 : raw.search(/\s\S*$/) + 1);
    for (const mark of ["**", "`"]) {
      const count = safe.split(mark).length - 1;
      if (count % 2 === 1) safe = safe.slice(0, safe.lastIndexOf(mark));
    }
    // An open "$" that starts math (not a price like "$49") waits for its closing "$".
    const dollars = [...safe.matchAll(/\$/g)].map((m) => m.index!);
    if (dollars.length % 2 === 1) {
      const last = dollars.at(-1)!;
      if (!/\d/.test(safe[last + 1] ?? "")) safe = safe.slice(0, last);
    }
    const delta = emit(plainText(safe));
    if (delta) yield delta;
  }
  const whole = plainText(raw);
  // In the rare case an earlier part reads differently once the rest arrived, send the rest as it now reads.
  const rest = whole.startsWith(shown)
    ? whole.slice(shown.length)
    : whole.slice(Math.min(shown.length, whole.length));
  if (rest) yield rest;
}
