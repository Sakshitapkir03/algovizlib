import { buildQuickChecks, validateQuickChecks, type QuickCheck } from "@/lib/quickcheck";
import {
  estimateDurationInFrames,
  formatIssue,
  resolveStoryboard,
  storyboardSourceSchema,
  validateStoryboard,
  zodIssues,
  type Storyboard,
  type StoryboardInput,
} from "@/lib/storyboard";
import { chargedTwice, safeguardWords } from "@/lib/traces/system-design/charged-twice";
import { sceneFitProblems } from "@/video/fit/scene";

import { LINKS, paymentScenarioSchema, type Link, type PaymentScenario } from "./payments";

/**
 * "Your scenario" for the charged-twice lesson, end to end in the browser: the learner's choices become a scenario,
 * the simulation runs it (and the lost-message proof for its safeguards), and the replay is built from its steps and
 * passed through the same checks as every committed video (source schema, resolution, `validateStoryboard`, the
 * phone-width fit of every scene). This module loads only when a learner opens "Your scenario".
 */
export type ScenarioChoices = {
  key: boolean;
  inProgress: boolean;
  forwardKey: boolean;
  /** The first message lost on this link, or none. */
  lose: Link | "none";
  /** The provider takes 2.6 s per charge, so a retry overlaps the first attempt. */
  slowProvider: boolean;
  /** The client waits 5 s instead of 2 s. */
  patientClient: boolean;
  retries: number;
  seed: number;
};

export const DEFAULT_CHOICES: ScenarioChoices = {
  key: false,
  inProgress: false,
  forwardKey: false,
  lose: "api→client",
  slowProvider: false,
  patientClient: false,
  retries: 2,
  seed: 7,
};

export const LOSS_LABEL: Record<Link | "none", string> = {
  none: "Nothing is lost",
  "client→api": "The client's request to the API",
  "api→provider": "The API's charge request to the provider",
  "provider→api": "The provider's answer to the API",
  "api→client": "The API's answer to the client",
};
export const LOSSES: (Link | "none")[] = ["none", ...LINKS];

export function toScenario(c: ScenarioChoices): PaymentScenario {
  return paymentScenarioSchema.parse({
    label: "your scenario",
    seed: c.seed,
    key: c.key,
    forwardKey: c.key && c.forwardKey,
    inProgress: c.key && c.inProgress,
    clientTimeoutMs: c.patientClient ? 5000 : 2000,
    clientRetries: c.retries,
    retryBackoffMs: 300,
    providerTimeoutMs: 3000,
    providerRetries: 1,
    providerWorkMs: c.slowProvider ? 2600 : 800,
    lose: c.lose === "none" ? [] : [{ link: c.lose, nth: 1 }],
  });
}

export type ScenarioReplay =
  | {
      ok: true;
      storyboard: Storyboard;
      checks: QuickCheck[];
      /** The scenario as a link-safe string (recorded with quick check answers, never counted as the lesson). */
      input: string;
      summary: { charges: number; outcome: string; runs: number; doubleCharges: number };
    }
  | { ok: false; message: string };

const LESSON = "idempotency/charged-twice";
export const TOO_BIG =
  "This scenario makes a replay that can't be shown clearly on a small screen. Try fewer retries or other settings.";

/** A caption from a step's note: its first sentence, cut at a word to 80 characters. */
function caption(note: string): string {
  const first = note.split(/(?<=[.:])\s/)[0].replace(/[.:]$/, "");
  if (first.length <= 80) return first;
  const cut = first.slice(0, 79);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function scenes(c: ScenarioChoices, scenario: PaymentScenario, lean: Set<string>): StoryboardInput["scenes"] {
  const trace = chargedTwice([scenario]);
  const last = trace.steps.length - 1;
  const picked = trace.steps
    .map((step, i) => ({ step, i }))
    .filter(({ step, i }) => i < last && (step.key || step.kind === "timeout" || step.kind === "outcome"));
  const setup = `${c.lose === "none" ? "No message is lost" : `${LOSS_LABEL[c.lose]} is lost`}. The client waits ${scenario.clientTimeoutMs} milliseconds and retries up to ${scenario.clientRetries} times; a charge takes about ${scenario.providerWorkMs} milliseconds. Safeguards: ${safeguardWords(scenario)}.`;
  const out: StoryboardInput["scenes"] = [
    {
      id: "setup",
      caption: caption(
        `Your scenario: ${LOSS_LABEL[c.lose].toLowerCase()}${c.lose === "none" ? "" : " is lost"}`,
      ),
      narration: setup,
      durationInFrames: estimateDurationInFrames(setup),
      elements: [{ id: "system", type: "system-diagram" }],
    },
  ];
  for (const { step, i } of picked) {
    const id = `s${i}`;
    const panel: StoryboardInput["scenes"][number]["elements"] = lean.has(id)
      ? []
      : step.kind === "outcome"
        ? [{ id: "metrics", type: "metrics", show: ["charges", "attempts", "time"] }]
        : [{ id: "data", type: "data-table", show: ["keys", "ledger"] }];
    out.push({
      id,
      caption: caption(step.note),
      narration: step.note,
      traceStep: i,
      durationInFrames: estimateDurationInFrames(step.note),
      elements: [{ id: "seq", type: "sequence", title: "your scenario" }, ...panel],
    });
  }
  const proof = trace.steps[last].sim!.proof!;
  out.push({
    id: "proof",
    caption:
      `Every single and double lost message: ${proof.doubleCharges} of ${proof.runs} runs double-charge (not crashes)`.slice(
        0,
        80,
      ),
    narration: trace.steps[last].note,
    traceStep: last,
    durationInFrames: estimateDurationInFrames(trace.steps[last].note),
    elements: [
      { id: "metrics", type: "metrics", show: ["runs", "double"] },
      {
        id: "answer",
        type: "result",
        title: "Double charges with these safeguards",
        showsAnswer: true,
        detail: "Every single and double lost message (not crashes)",
        tone: proof.doubleCharges === 0 ? "success" : "info",
      },
    ],
  });
  return out;
}

function storyboardFor(c: ScenarioChoices, scenario: PaymentScenario, lean: Set<string>): StoryboardInput {
  return {
    id: "charged-twice-your-scenario",
    title: "Your scenario",
    concept: "Idempotency & retries",
    category: "system-design",
    summary: "The learner's own failures, timings, and safeguards, simulated and replayed.",
    exampleSource: "problem-native",
    takeaway: {
      pattern: "Idempotency key",
      summary: "Claim one key per operation before the work, store the result under it, and pass it on.",
      timeComplexity: "One key lookup per request",
      spaceComplexity: "One stored result per key",
      whenToUse: [],
    },
    trace: { problem: LESSON, args: [[scenario]] },
    scenes: scenes(c, scenario, lean),
  };
}

type Checked = { storyboard?: Storyboard; problems: { scene?: string; text: string }[] };

function check(input: unknown): Checked {
  const located = (texts: string[]): Checked => ({
    problems: texts.map((text) => ({ scene: /^scene "([^"]+)"/.exec(text)?.[1], text })),
  });
  const source = storyboardSourceSchema.safeParse(input);
  if (!source.success) return located(zodIssues("", source.error.issues, input).map(formatIssue));
  const resolved = resolveStoryboard(source.data);
  if (!resolved.storyboard) return located(resolved.issues.map(formatIssue));
  const validation = validateStoryboard(resolved.storyboard);
  if (!validation.ok) return located(validation.issues.map(formatIssue));
  const unfit = resolved.storyboard.scenes.flatMap((scene) =>
    sceneFitProblems(scene.elements).map((text) => ({ scene: scene.id, text })),
  );
  return unfit.length > 0 ? { problems: unfit } : { storyboard: resolved.storyboard, problems: [] };
}

/** The choices as a link-safe string (base64url of their UTF-8 JSON: link names contain "→"). */
export function encodeScenario(c: ScenarioChoices): string {
  let binary = "";
  for (const b of new TextEncoder().encode(JSON.stringify(c))) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Run the learner's scenario and build its replay; a scene that doesn't fit drops its panel, then it's refused. */
export function buildScenarioReplay(c: ScenarioChoices): ScenarioReplay {
  let scenario: PaymentScenario;
  try {
    scenario = toScenario(c);
  } catch {
    return { ok: false, message: "These settings can't be simulated." };
  }
  const lean = new Set<string>();
  for (let round = 0; round < 2; round++) {
    const input = storyboardFor(c, scenario, lean);
    if (input.scenes.length > 14) return { ok: false, message: TOO_BIG };
    const checked = check(input);
    if (checked.storyboard) {
      const storyboard = checked.storyboard;
      const trace = chargedTwice([scenario]);
      const checks = buildQuickChecks(storyboard, trace);
      const valid = validateQuickChecks(storyboard, trace, checks).length === 0;
      const run = trace.steps.filter((s) => s.sim?.run === 0);
      const final = run.at(-1)!.sim!;
      const proof = trace.steps.at(-1)!.sim!.proof!;
      const outcome = run.findLast((s) => s.kind === "outcome");
      return {
        ok: true,
        storyboard,
        checks: valid ? checks : [],
        input: encodeScenario(c),
        summary: {
          charges: Number(final.metrics.find((m) => m.id === "charges")?.value ?? 0),
          outcome: outcome
            ? outcome.note.includes("fails")
              ? "payment failed"
              : "client shown paid"
            : "no answer",
          runs: proof.runs,
          doubleCharges: proof.doubleCharges,
        },
      };
    }
    const failing = checked.problems.map((p) => p.scene).filter((id): id is string => id !== undefined);
    if (failing.length === 0) break;
    for (const id of failing) lean.add(id);
    if (typeof console !== "undefined") console.warn("[scenario] simplified scenes:", checked.problems);
  }
  return { ok: false, message: TOO_BIG };
}
