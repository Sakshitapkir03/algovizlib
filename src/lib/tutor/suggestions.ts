import type { StepContext } from "./context";

const OPS: Record<string, string> = { "<": "<", ">": ">", "=": "=" };

/**
 * Two or three questions a learner might ask about this moment, made from the step itself (no model call), so the
 * server can recognise them later: their answers are cached. A pointer that moved since the previous step, the
 * comparison the step makes, and what comes next; an intro or closing scene gets questions about the problem.
 */
export function suggestedQuestions(ctx: StepContext): string[] {
  const out: string[] = [];
  const { step, previous } = ctx;
  if (!step) {
    if (ctx.sceneIndex === 0) out.push("What is this problem asking?");
    out.push("What's the key idea of the approach?", "Why is the simple approach slow?");
    return out.slice(0, 3);
  }
  const moved = Object.entries(step.pointers).find(
    ([name, at]) => previous && previous.pointers[name] !== undefined && previous.pointers[name] !== at,
  );
  if (moved) out.push(`Why did ${moved[0]} move?`);
  const eq = step.equation;
  if (eq?.comparison) {
    const lhs = eq.terms.length === 1 ? String(eq.terms[0]) : String(eq.result);
    out.push(`What does ${lhs} ${OPS[eq.comparison.op]} ${eq.comparison.target} tell us here?`);
  }
  if (out.length < 2) out.push("Why does this step happen?");
  out.push(ctx.next ? "What happens next?" : "How does this give the answer?");
  return [...new Set(out)].slice(0, 3);
}
