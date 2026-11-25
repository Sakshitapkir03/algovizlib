import { buildQuickChecks, validateQuickChecks, type QuickCheck } from "@/lib/quickcheck";
import { estimateDurationInFrames, type Storyboard, type StoryboardInput } from "@/lib/storyboard";
import { CONTENTION, lostUpdate, type InterleavingRange } from "@/lib/traces/system-design/lost-update";

import { concurrencyScenarioSchema, editWords, type ConcurrencyScenario, type EditKind } from "./concurrency";
import { checkReplay } from "./scenario";

/**
 * "Your scenario" for "Two edits, one lost": two or three editors, the gap between their starts, compare-and-set on
 * or off, and the kind of edit (a stock change, or adding a tag to a shared document). The replay is built from the
 * simulation and checked like every committed video; the proof enumerates every interleaving for the chosen number of
 * editors. Loaded only when a learner opens "Your scenario".
 */
export type ConcurrencyChoices = {
  editors: 2 | 3;
  gapMs: number;
  cas: boolean;
  kind: EditKind;
  seed: number;
};

export const EDITOR_COUNTS = [2, 3] as const;
export const GAPS = [0, 20, 60, 150];
export const KINDS: { value: EditKind; label: string }[] = [
  { value: "stock", label: "Change the stock (sell, receive)" },
  { value: "tags", label: "Add a tag to a shared document" },
];

export const DEFAULT_CONCURRENCY_CHOICES: ConcurrencyChoices = {
  editors: 2,
  gapMs: 10,
  cas: false,
  kind: "stock",
  seed: 2,
};

const LESSON = "consistency/lost-update";
const PEOPLE = [
  { name: "Bo", delta: -3, tag: "ui" },
  { name: "Cy", delta: 5, tag: "q3" },
  { name: "Dee", delta: -2, tag: "bug" },
];

export function toConcurrencyScenario(c: ConcurrencyChoices): ConcurrencyScenario {
  return concurrencyScenarioSchema.parse({
    label: "your setup",
    seed: c.seed,
    mode: c.cas ? "compare-and-set" : "blind",
    kind: c.kind,
    editors: PEOPLE.slice(0, c.editors).map((p, k) => ({ ...p, startMs: k * c.gapMs })),
  });
}

export type ConcurrencyReplay =
  | {
      ok: true;
      storyboard: Storyboard;
      checks: QuickCheck[];
      input: string;
      summary: {
        lost: number;
        schedules: number;
        lostSchedules: number;
        /** With 16 editors at once (compare-and-set only): retries per editor, and edits that gave up. */
        avgRetries: number;
        maxRetries: number;
        gaveUp: string;
      };
    }
  | { ok: false; message: string };

export const TOO_BIG =
  "This scenario makes a replay that can't be shown clearly on a small screen. Try other settings.";

function caption(note: string): string {
  const first = note.split(/(?<=[.:])\s/)[0].replace(/[.:]$/, "");
  if (first.length <= 80) return first;
  const cut = first.slice(0, 79);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function storyboardFor(
  c: ConcurrencyChoices,
  scenario: ConcurrencyScenario,
  range: InterleavingRange,
): StoryboardInput {
  const trace = lostUpdate([scenario], range);
  const last = trace.steps.length - 1;
  const people = PEOPLE.slice(0, c.editors);
  const setup = `${people.map((p, k) => `${p.name} ${editWords(c.kind, p)}${k ? ` ${k * c.gapMs} milliseconds later` : ""}`).join(", ")}, each reading the ${c.kind === "stock" ? "stock" : "document's tags"} and writing back a new value about 40 milliseconds later. ${c.cas ? "Writes compare-and-set on the version." : "Writes are blind."} Latencies are illustrative.`;
  const scenes: StoryboardInput["scenes"] = [
    {
      id: "setup",
      caption: caption(
        `Your setup: ${c.editors} editors ${c.gapMs} ms apart, ${c.cas ? "compare-and-set" : "blind writes"}`,
      ),
      narration: setup,
      durationInFrames: estimateDurationInFrames(setup),
      elements: [{ id: "system", type: "system-diagram" }],
    },
  ];
  trace.steps.slice(0, last).forEach((step, i) => {
    if (!step.key) return;
    const sweep = step.kind === "sweep";
    scenes.push({
      id: `s${i}`,
      caption: caption(step.note),
      narration: step.note,
      traceStep: i,
      durationInFrames: estimateDurationInFrames(step.note),
      elements: sweep
        ? [
            {
              id: "chart",
              type: "load-chart",
              label: c.cas ? "retries avg/max" : "edits lost",
              labelUnit: "",
              chips: false,
              limitLine: false,
            },
            {
              id: "metrics",
              type: "metrics",
              show: c.cas
                ? [`avg-${CONTENTION.at(-1)}`, `max-${CONTENTION.at(-1)}`]
                : [`lost-2`, `lost-${CONTENTION.at(-1)}`],
            },
          ]
        : [
            { id: "seq", type: "sequence", title: "your setup" },
            { id: "metrics", type: "metrics", show: ["value", "expected"] },
          ],
    });
  });
  const proof = trace.steps[last].sim!.interleavingProof!;
  const mine = proof.cases[0];
  scenes.push({
    id: "proof",
    caption: `Every interleaving of ${mine.editors} editors: ${c.cas ? mine.cas.lost : mine.blind.lost} of ${c.cas ? mine.cas.schedules : mine.blind.schedules} lose an edit`,
    narration: trace.steps[last].note,
    traceStep: last,
    durationInFrames: estimateDurationInFrames(trace.steps[last].note),
    elements: [
      { id: "metrics", type: "metrics", show: [`${c.cas ? "cas" : "blind"}-${mine.editors}`] },
      {
        id: "answer",
        type: "result",
        title: "Lost with compare-and-set",
        showsAnswer: true,
        detail: `Every interleaving of ${mine.editors} editors, retries included`,
        tone: "success",
      },
    ],
  });
  return {
    id: "lost-update-your-scenario",
    title: "Your scenario",
    concept: "Consistency",
    category: "system-design",
    summary: "The learner's own editors, timing, write mode, and kind of edit, simulated and replayed.",
    exampleSource: "problem-native",
    takeaway: {
      pattern: "Compare-and-set on a version",
      summary:
        "Write only if the row is still at the version you read; otherwise read again and redo the change.",
      timeComplexity: "One version comparison per write",
      spaceComplexity: "One version per row",
      whenToUse: [],
    },
    trace: { problem: LESSON, args: [[scenario], range] },
    scenes,
  };
}

export function encodeConcurrency(c: ConcurrencyChoices): string {
  return btoa(JSON.stringify(c)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function buildConcurrencyReplay(c: ConcurrencyChoices): ConcurrencyReplay {
  let scenario: ConcurrencyScenario;
  try {
    scenario = toConcurrencyScenario(c);
  } catch {
    return { ok: false, message: "These settings can't be simulated." };
  }
  const range: InterleavingRange = { editors: [c.editors] };
  const checked = checkReplay(storyboardFor(c, scenario, range));
  if (!checked.storyboard) {
    if (typeof console !== "undefined") console.warn("[scenario] refused:", checked.problems);
    return { ok: false, message: TOO_BIG };
  }
  const trace = lostUpdate([scenario], range);
  const checks = buildQuickChecks(checked.storyboard, trace);
  const valid = validateQuickChecks(checked.storyboard, trace, checks).length === 0;
  const proof = trace.steps.at(-1)!.sim!.interleavingProof!.cases[0];
  const lastEvent = [...trace.steps].reverse().find((s) => s.sim?.edit);
  const lost = Number(lastEvent?.sim?.metrics.find((m) => m.id === "lost")?.value ?? 0);
  const sweep = trace.steps.find((s) => s.kind === "sweep")!.sim!;
  const crowded = sweep.load!.windows.at(-1)!;
  const gaveUp = sweep.metrics.find((m) => m.id === `gaveup-${CONTENTION.at(-1)}`)?.value ?? "";
  return {
    ok: true,
    storyboard: checked.storyboard,
    checks: valid ? checks : [],
    input: encodeConcurrency(c),
    summary: {
      lost,
      schedules: c.cas ? proof.cas.schedules : proof.blind.schedules,
      lostSchedules: c.cas ? proof.cas.lost : proof.blind.lost,
      avgRetries: c.cas ? crowded.served : 0,
      maxRetries: c.cas ? crowded.offered : 0,
      gaveUp,
    },
  };
}
