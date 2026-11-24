import {
  formatIssue,
  resolveStoryboard,
  storyboardSourceSchema,
  validateStoryboard,
  zodIssues,
  type Storyboard,
} from "@/lib/storyboard";
import { getTraceDefinition, runTrace } from "@/lib/traces";
import { buildQuickChecks, type QuickCheck, validateQuickChecks } from "@/lib/quickcheck";
import { sceneFitProblems } from "@/video/fit/scene";

import { buildWalkthrough, type WalkthroughProblem } from "./build";

export type { WalkthroughProblem };
import { describeField, type FieldValue, formatField, parseField, randomField, type Rng } from "./fields";
import { type InputSpec, inputSpecs } from "./specs";

/**
 * "Try your own input", end to end, in the browser: parse what the learner typed, check the problem's rules, run the
 * problem's trace on it, build the walkthrough, and pass it through the same checks as every committed video (the
 * source schema, resolution against the trace, `validateStoryboard`, and the phone-width fit check of every scene).
 * Anything that fails comes back as a plain message; nothing unchecked reaches the player. This module (with every
 * trace and the fit checks) is loaded only when the learner opens "Your input".
 */

export type InputError = { field?: number; message: string };
export type Parsed = { ok: true; args: unknown[] } | { ok: false; errors: InputError[] };
export type WalkthroughResult =
  | { ok: true; storyboard: Storyboard; args: unknown[]; checks: QuickCheck[] }
  | { ok: false; errors: InputError[] };

const specs = new Map(inputSpecs.map((s) => [s.problem, s]));

export function getInputSpec(problemKey: string): InputSpec | undefined {
  return specs.get(problemKey);
}

export const TOO_BIG =
  "This input makes a walkthrough too big to show clearly on a small screen. Try fewer or smaller values.";
const BROKEN = "Something went wrong building a walkthrough for this input. Try a different one.";

/** Parse every field, then the problem's rules, then the trace's own limits. */
export function parseInput(spec: InputSpec, texts: readonly string[]): Parsed {
  const errors: InputError[] = [];
  const args: FieldValue[] = [];
  spec.fields.forEach((field, i) => {
    const parsed = parseField(field, texts[i] ?? "");
    if (parsed.ok) args.push(parsed.value);
    else errors.push({ field: i, message: parsed.message });
  });
  if (errors.length > 0) return { ok: false, errors };
  return checkArgs(spec, args);
}

function checkArgs(spec: InputSpec, args: unknown[]): Parsed {
  const broken = (spec.rules ?? []).find((rule) => {
    try {
      return !rule.ok(args);
    } catch {
      return true;
    }
  });
  if (broken) return { ok: false, errors: [{ message: broken.message }] };
  const def = getTraceDefinition(spec.problem);
  const checked = def?.args.safeParse(args);
  if (!checked?.success) {
    const detail = checked?.error.issues[0]?.message;
    return {
      ok: false,
      errors: [
        { message: `This input is outside what the walkthrough can show${detail ? `: ${detail}` : ""}.` },
      ],
    };
  }
  return { ok: true, args };
}

/** The input as the boxes show it (the inverse of `parseInput`). */
export function formatInput(spec: InputSpec, args: readonly unknown[]): string[] {
  return spec.fields.map((field, i) => formatField(field, args[i] as FieldValue));
}

/** The input in a sentence: `nums = [4, 9], target = 13`. */
export function describeInput(spec: InputSpec, args: readonly unknown[]): string {
  return spec.fields.map((field, i) => describeField(field, args[i] as FieldValue)).join(", ");
}

/** A random input that passes every check but the walkthrough's (tests check that too). */
export function randomInput(spec: InputSpec, rng: Rng): unknown[] {
  for (let attempt = 0; attempt < 500; attempt++) {
    const args = spec.random ? spec.random(rng) : spec.fields.map((field) => randomField(field, rng));
    if (checkArgs(spec, args).ok) return args;
  }
  throw new Error(`No random input passed the rules for ${spec.problem}`);
}

/** Run, build, and check the walkthrough for parsed input. */
export function buildWalkthroughFor(
  problem: WalkthroughProblem,
  patternName: string,
  spec: InputSpec,
  args: unknown[],
  template?: Storyboard,
): WalkthroughResult {
  const fail = (message: string, detail?: unknown): WalkthroughResult => {
    if (detail !== undefined && typeof console !== "undefined")
      console.warn(`Walkthrough for ${spec.problem} refused:`, detail);
    return { ok: false, errors: [{ message }] };
  };
  let trace;
  try {
    trace = runTrace(spec.problem, args);
  } catch (error) {
    return fail(BROKEN, error);
  }
  // Build, check, and simplify the scenes that don't fit (or don't pass), a level at a time, until all do.
  const levels: Record<string, number> = {};
  let last: unknown;
  for (let round = 0; round <= MAX_LEVEL; round++) {
    let outcome: Check;
    try {
      outcome = check(
        buildWalkthrough({
          problem,
          patternName,
          trace,
          args,
          inputSummary: describeInput(spec, args),
          template,
          levels,
        }),
      );
    } catch (error) {
      return fail(BROKEN, error);
    }
    if (outcome.storyboard) {
      // Quick checks come from the same builder as the videos'; one that doesn't validate is left out.
      const checks = buildQuickChecks(outcome.storyboard, trace);
      const valid = validateQuickChecks(outcome.storyboard, trace, checks).length === 0;
      return { ok: true, storyboard: outcome.storyboard, args, checks: valid ? checks : [] };
    }
    last = outcome.problems;
    const scenes = new Set(
      outcome.problems.map((p) => p.scene).filter((id): id is string => id !== undefined),
    );
    const raised = [...scenes].filter((id) => (levels[id] ?? 0) < MAX_LEVEL);
    if (raised.length === 0) break;
    for (const id of raised) levels[id] = (levels[id] ?? 0) + 1;
  }
  return fail(TOO_BIG, last);
}

/** The deepest simplification (`SceneLook.level`): no input row. */
const MAX_LEVEL = 4;

type Check = { storyboard?: Storyboard; problems: { scene?: string; text: string }[] };

/** The checks every committed video passes: source schema, resolution, the validator, and the phone-width fit. */
function check(input: unknown): Check {
  const located = (texts: string[]): Check => ({
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

/** The input as a link-safe string (base64url of its JSON), for `?input=`. */
export function encodeInput(args: readonly unknown[]): string {
  const bytes = new TextEncoder().encode(JSON.stringify(args));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * A shared link's input, or undefined if it isn't one. Only the shape is checked here (an array of values each
 * field could hold); the caller formats it into the boxes and runs it through `parseInput`, like typed input.
 */
export function decodeInput(spec: InputSpec, encoded: string): unknown[] | undefined {
  if (encoded.length > 2000 || !/^[A-Za-z0-9_-]+$/.test(encoded)) return undefined;
  try {
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const json = new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
    const args: unknown = JSON.parse(json);
    if (!Array.isArray(args) || args.length !== spec.fields.length) return undefined;
    const fits = spec.fields.every((field, i) => {
      const v = args[i];
      switch (field.kind) {
        case "numbers":
          return Array.isArray(v) && v.length <= 50 && v.every((x) => Number.isInteger(x));
        case "number":
          return Number.isInteger(v);
        case "text":
          return typeof v === "string" && v.length <= 200;
        case "words":
        case "tokens":
          return (
            Array.isArray(v) && v.length <= 50 && v.every((x) => typeof x === "string" && x.length <= 50)
          );
      }
    });
    return fits ? args : undefined;
  } catch {
    return undefined;
  }
}
