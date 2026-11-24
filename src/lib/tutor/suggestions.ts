import type { StepContext } from "./context";

/**
 * Two or three questions a learner might ask about this moment, made from what the scene shows (no model call), so
 * the server can recognise them later: their answers are cached. Every name in a question is one the viewer can see:
 * a pointer's on-screen label (never the trace's variable it binds), a panel's label and the key it looked up, the
 * equation's own numbers. Then what comes next; an intro or closing scene gets questions about the problem.
 */
export function suggestedQuestions(ctx: StepContext): string[] {
  const out: string[] = [];
  const { step, previous, elements } = ctx;
  if (!step) {
    if (ctx.sceneIndex === 0) out.push("What is this problem asking?");
    out.push("What's the key idea of the approach?", "Why is the simple approach slow?");
    return out.slice(0, 3);
  }

  // A pointer that moved since the previous step, by the label drawn on screen.
  for (const el of elements) {
    if (el.type !== "pointer" || !el.binds) continue;
    const now = step.pointers[el.binds];
    const before = previous?.pointers[el.binds];
    if (now !== undefined && before !== undefined && now !== before) {
      out.push(`Why did "${el.label}" move?`);
      break;
    }
  }

  // The scene's equation, with the numbers it shows.
  const eq = elements.find((el) => el.type === "equation");
  if (eq?.type === "equation") {
    if (eq.comparison) {
      const lhs = eq.terms.length === 1 ? String(eq.terms[0]) : String(eq.result);
      out.push(`What does ${lhs} ${eq.comparison.op} ${eq.comparison.target} tell us here?`);
    } else if (eq.terms.length > 1) {
      out.push(`Why is it ${eq.terms.join(` ${eq.operator} `)} = ${eq.result}?`);
    }
  }

  // A map's lookup or new entry, by the map's label and the key it shows.
  const map = elements.find((el) => el.type === "hash-map");
  if (map?.type === "hash-map" && out.length < 2) {
    // "the register" reads naturally; a label with symbols ("key → node") reads better quoted.
    const where = /^[a-z]+( [a-z]+)?$/i.test(map.label) ? `the ${map.label}` : `"${map.label}"`;
    if (map.lookup) out.push(`Why look up ${map.lookup.key} in ${where}?`);
    else if (map.inserted) out.push(`Why does ${map.inserted} go into ${where}?`);
  }

  if (out.length < 2) out.push("Why does this step happen?");
  out.push(ctx.next ? "What happens next?" : "How does this give the answer?");
  return [...new Set(out)].slice(0, 3);
}

/** The words the questions above are made of (everything else in a question comes from the scene). */
export const SUGGESTION_WORDS = new Set(
  "why did move what does tell us here is it look up in the go into this step happen happens next how give answer problem asking what's key idea of approach simple slow".split(
    " ",
  ),
);
