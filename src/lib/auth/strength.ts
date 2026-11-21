/**
 * A small password strength hint (no dictionary download): length, variety, and the patterns people reach for
 * first. It only guides; the server's one rule is the minimum length.
 */
const COMMON = [
  "password",
  "qwerty",
  "letmein",
  "welcome",
  "iloveyou",
  "admin",
  "monkey",
  "dragon",
  "football",
  "baseball",
  "sunshine",
  "princess",
  "abc123",
  "123456",
  "111111",
  "algoviz",
];

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; hint: string };

const LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"] as const;

export function passwordStrength(password: string, context: readonly string[] = []): Strength {
  if (password.length < 10) return { score: 0, label: LABELS[0], hint: "Use at least 10 characters." };
  const lower = password.toLowerCase();
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  const unique = new Set(password).size;
  let score = password.length >= 16 ? 3 : password.length >= 12 ? 2 : 1;
  if (classes >= 3) score += 1;
  const problems: string[] = [];
  const words = [...COMMON, ...context.map((c) => c.toLowerCase()).filter((c) => c.length >= 3)];
  if (words.some((w) => lower.includes(w))) {
    score -= 2;
    problems.push("avoid common words and your name or email");
  }
  if (unique <= 4 || /(.)\1{3,}/.test(password)) {
    score -= 2;
    problems.push("avoid repeated characters");
  }
  if (/(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|qwer|asdf)/.test(lower)) {
    score -= 1;
    problems.push("avoid sequences like 1234 or abcd");
  }
  const clamped = Math.max(1, Math.min(4, score)) as Strength["score"];
  const hint =
    problems.length > 0
      ? `${problems[0][0].toUpperCase()}${problems[0].slice(1)}.`
      : clamped >= 4
        ? "Long and varied: good."
        : "Longer is stronger: a few unrelated words work well.";
  return { score: clamped, label: LABELS[clamped], hint };
}
