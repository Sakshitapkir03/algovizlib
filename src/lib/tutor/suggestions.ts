import type { StepContext } from "./context";

/**
 * Two or three questions a learner might ask about this moment, made from what the scene shows (no model call), so
 * the server can recognise them later: their answers are cached. They read as plain questions ("Why does the arriving
 * pointer move right?", "Where does the 6 come from?"), and every name in them is one the viewer can see: a pointer's
 * on-screen label (never the trace's variable it binds), a map's label and the key it shows, the equation's own
 * numbers. Then what comes next; an intro or closing scene gets questions about the problem.
 */
export function suggestedQuestions(ctx: StepContext): string[] {
  const out: string[] = [];
  const { step, previous, elements } = ctx;
  if (!step) {
    if (ctx.sceneIndex === 0) out.push("What is this problem asking?");
    out.push("What's the key idea of the approach?", "Why is the simple approach slow?");
    return out.slice(0, 3);
  }

  // A pointer that moved since the previous step, by the label drawn on screen and the way it went.
  for (const el of elements) {
    if (el.type !== "pointer" || !el.binds) continue;
    const now = step.pointers[el.binds];
    const before = previous?.pointers[el.binds];
    if (now === undefined || before === undefined || now === before) continue;
    const subject = pointerSubject(el.label);
    if (!subject) continue;
    const way = now > before ? "right" : "left";
    out.push(subject === "you" ? `Why do you move ${way}?` : `Why does ${subject} move ${way}?`);
    break;
  }

  // The scene's equation, with the numbers it shows.
  const eq = elements.find((el) => el.type === "equation");
  if (eq?.type === "equation") {
    if (eq.comparison) {
      const lhs = eq.terms.length === 1 ? String(eq.terms[0]) : String(eq.result);
      out.push(`Why compare ${lhs} with ${eq.comparison.target}?`);
    } else if (eq.terms.length > 1) {
      out.push(`Where does the ${eq.result} come from?`);
    }
  }

  // A map's lookup or new entry, by the map's label (when it reads as words) and the key it shows.
  const map = elements.find((el) => el.type === "hash-map");
  if (map?.type === "hash-map" && out.length < 2) {
    const plain = /^[a-z]+( [a-z]+)?$/i.test(map.label);
    if (map.lookup)
      out.push(
        plain ? `Why look for ${map.lookup.key} in the ${map.label}?` : `Why look up ${map.lookup.key}?`,
      );
    else if (map.inserted)
      out.push(plain ? `Why does ${map.inserted} go into the ${map.label}?` : `Why add ${map.inserted} now?`);
  }

  // Otherwise, a question about the structure the scene draws.
  if (out.length < 2) {
    const drawn = elements.find((el) => el.type in STRUCTURE_QUESTIONS);
    const stacks = elements.filter((el) => el.type === "stack").length;
    if (drawn && !(drawn.type === "stack" && stacks > 1)) out.push(STRUCTURE_QUESTIONS[drawn.type]!);
  }
  if (out.length < 2) out.push("What's happening in this step?");
  out.push(ctx.next ? "What happens next?" : "How does this give the answer?");
  return [...new Set(out)].slice(0, 3);
}

/**
 * How a question names a pointer: "you" for "You", a capitalised label as a name ("Friend", "Slow"), any other label
 * of plain words as "the … pointer" ("the arriving pointer", "the left pointer"). Labels with symbols or digits ("#3",
 * "i+1") aren't asked about.
 */
export function pointerSubject(label: string): string | undefined {
  if (!/^[A-Za-z]+( [A-Za-z]+)?$/.test(label)) return undefined;
  if (label.toLowerCase() === "you") return "you";
  if (/^[A-Z][a-z]+$/.test(label)) return label;
  const lower = label.toLowerCase();
  // "this cousin", "your turn": already has its own determiner.
  if (/^(this|that|next|your|my|our|the|a|an) /.test(lower)) return lower;
  // A person or role ("jogger", "walker", "sprinter") reads best on its own.
  if (/^[a-z]+(er|or)$/.test(lower)) return `the ${lower}`;
  return `the ${lower} pointer`;
}

/** One question per kind of structure a scene can draw, about what it does in this step. */
const STRUCTURE_QUESTIONS: Partial<Record<string, string>> = {
  "binary-tree": "What does this call return, and why?",
  "search-tree": "Why is this branch tried or cut?",
  "dp-table": "Which cells does this one depend on?",
  heap: "Why does the heap reorder like this?",
  "heap-tree": "Why does the heap reorder like this?",
  queue: "Why does the queue change here?",
  stack: "Why does the stack change here?",
  trie: "Why does the trie branch like this?",
  "union-find": "Why do these groups join or not?",
  digraph: "Why does this node go next?",
  "linked-list": "Why do these links change?",
  dlist: "Why do these links change?",
  timeline: "Why do these intervals overlap or not?",
  bits: "How do these bits combine?",
  grid: "Why do these cells join the search?",
  graph: "Why do these nodes join the search?",
  sequence: "Why does this message matter here?",
  "system-diagram": "Where does each message go next?",
};

/** The words the questions above are made of (everything else in a question comes from the scene). */
export const SUGGESTION_WORDS = new Set(
  [
    "why do does you move right left the pointer compare with where come from look for up in go into add now",
    "what's happening this step what happens next how give answer is problem asking key idea of approach simple slow",
    // The structure questions: generic words about the structure the scene draws, not names.
    "call return and tried or cut which cells one depend on heap reorder like queue change here stack trie branch",
    "these groups join not node go links intervals overlap bits combine search nodes",
    "message matter each",
  ]
    .join(" ")
    .split(" "),
);
