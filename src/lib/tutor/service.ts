import { z } from "zod";

import type { RateLimiter } from "@/lib/auth/rate-limit";

import { MAX_QUESTION_LENGTH, type TutorConfig } from "./config";
import { buildStepContext, type StepContext } from "./context";
import type { TutorModel } from "./model";
import { classifyTutorError } from "./model";
import {
  DECLINE,
  looksLikeInjection,
  MAX_HISTORY,
  TUTOR_PROMPT_VERSION,
  tutorMessages,
  tutorSystemPrompt,
} from "./prompt";
import { plainText, plainTextStream } from "./plain-text";
import { suggestedQuestions } from "./suggestions";
import { answerKey, pacificDayEnd, type AnswerCache, type UsageCounter } from "./usage";

/**
 * "Ask about this step", with every dependency injected (the route wires the real ones; tests pass fakes). Order of
 * checks: the feature flag, the origin, a verified sign-in, the request's shape and the question's length, the step
 * (which must exist), an obvious attempt to change the tutor's instructions (declined without a model call), the
 * per-minute limit, then the cache (a suggested question asked first on a step costs nothing the second time) and
 * only then the daily caps, per user and in total, before the model is called.
 */
export type TutorDeps = {
  config: TutorConfig;
  user: { id: string; verified: boolean } | null;
  sameOrigin: boolean;
  limiter: RateLimiter;
  usage: UsageCounter;
  cache: AnswerCache;
  model: () => TutorModel;
  now: () => number;
  /** Where operational problems go (the server log). Never given the question or anything about the user. */
  log?: (message: string) => void;
};

/** Postgres's "undefined_table": the migration that creates it hasn't run on this database. */
const missingTable = (error: unknown) =>
  /42P01|does not exist/i.test(
    `${(error as { code?: string })?.code ?? ""} ${(error as Error)?.message ?? ""}`,
  );

/** A cache failure is logged and skipped: the question is answered through the model, like any other. */
function cacheTrouble(deps: TutorDeps, action: "read" | "write", error: unknown) {
  const why = missingTable(error)
    ? 'the AskCache table is missing: run "pnpm db:deploy" against this database'
    : ((error as Error)?.name ?? "error");
  (deps.log ?? console.warn)(`[tutor] answer cache ${action} failed (${why}); answering without the cache.`);
}

export const askSchema = z.object({
  problemKey: z.string().max(120),
  sceneId: z.string().max(80),
  question: z.string(),
  history: z
    .array(z.object({ question: z.string().max(MAX_QUESTION_LENGTH), answer: z.string().max(2000) }))
    .max(MAX_HISTORY)
    .default([]),
});

export type AskInput = z.input<typeof askSchema>;

/** What the learner sees when nothing can be answered: a message, and when a cap resets. */
export type TutorRefusal = {
  status: 400 | 401 | 403 | 404 | 429 | 503;
  code:
    | "disabled"
    | "cross-site"
    | "sign-in"
    | "verify"
    | "invalid"
    | "too-long"
    | "unknown-step"
    | "slow-down"
    | "daily-limit"
    | "site-limit"
    | "busy"
    | "failed";
  message: string;
  resetsAt?: number;
};

export type TutorAnswer =
  | { kind: "text"; text: string; cached: boolean; remaining: number }
  | { kind: "stream"; chunks: AsyncIterable<string>; remaining: number };

export type StepInfo = { label: string; suggestions: string[]; remaining: number; resetsAt: number };

const USER_KEY = (id: string) => `askDay:${id}`;
const GLOBAL_KEY = "askDay:all";
const until = (resetsAt: number, now: number) => {
  const minutes = Math.max(1, Math.round((resetsAt - now) / 60_000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

function gate(deps: TutorDeps): TutorRefusal | undefined {
  if (!deps.config.enabled)
    return { status: 404, code: "disabled", message: "Ask about this step isn't available." };
  if (!deps.sameOrigin) return { status: 403, code: "cross-site", message: "Cross-site request refused." };
  if (!deps.user) return { status: 401, code: "sign-in", message: "Sign in to ask about this step." };
  if (!deps.user.verified)
    return { status: 403, code: "verify", message: "Verify your email to ask about this step." };
  return undefined;
}

/** The panel's header and suggestions, and how many questions the learner has left today (no model call). */
export async function stepInfo(
  deps: TutorDeps,
  problemKey: string,
  sceneId: string,
): Promise<StepInfo | TutorRefusal> {
  const refused = gate({ ...deps, sameOrigin: true });
  if (refused) return refused;
  const ctx = buildStepContext(problemKey, sceneId);
  if (!ctx) return { status: 404, code: "unknown-step", message: "That step doesn't exist." };
  const resetsAt = pacificDayEnd(deps.now());
  const used = await deps.usage.peek(USER_KEY(deps.user!.id), resetsAt);
  return {
    label: ctx.label,
    suggestions: suggestedQuestions(ctx),
    remaining: Math.max(0, deps.config.userDaily - used),
    resetsAt,
  };
}

export async function ask(deps: TutorDeps, body: unknown): Promise<TutorAnswer | TutorRefusal> {
  const refused = gate(deps);
  if (refused) return refused;
  const parsed = askSchema.safeParse(body);
  if (!parsed.success) return { status: 400, code: "invalid", message: "That request wasn't understood." };
  const { problemKey, sceneId, history } = parsed.data;
  const question = parsed.data.question.trim();
  if (!question) return { status: 400, code: "invalid", message: "Type a question first." };
  if (question.length > MAX_QUESTION_LENGTH)
    return {
      status: 400,
      code: "too-long",
      message: `Keep questions to ${MAX_QUESTION_LENGTH} characters.`,
    };
  const ctx = buildStepContext(problemKey, sceneId);
  if (!ctx) return { status: 404, code: "unknown-step", message: "That step doesn't exist." };
  const now = deps.now();
  const resetsAt = pacificDayEnd(now);
  const userKey = USER_KEY(deps.user!.id);
  const remainingNow = async () =>
    Math.max(0, deps.config.userDaily - (await deps.usage.peek(userKey, resetsAt)));

  if (looksLikeInjection(question) || history.some((h) => looksLikeInjection(h.question)))
    return { kind: "text", text: DECLINE, cached: false, remaining: await remainingNow() };

  if (
    !(await deps.limiter.hit(`askMinute:${deps.user!.id}`, {
      max: deps.config.userPerMinute,
      windowMs: 60_000,
    }))
  )
    return {
      status: 429,
      code: "slow-down",
      message: "That's a lot of questions at once. Try again in a minute.",
    };

  // A suggested question, asked first on its step, has one answer for everyone: cache it.
  const cacheable = history.length === 0 && suggestedQuestions(ctx).includes(question);
  const key = cacheable
    ? answerKey({
        prompt: TUTOR_PROMPT_VERSION,
        model: deps.config.model,
        problemKey,
        sceneId,
        question,
      })
    : undefined;
  let cacheKey = key;
  if (key) {
    let hit: string | undefined;
    try {
      hit = await deps.cache.get(key);
    } catch (error) {
      cacheTrouble(deps, "read", error);
      // Without a working cache, the answer isn't stored either.
      cacheKey = undefined;
    }
    if (hit !== undefined)
      return { kind: "text", text: plainText(hit), cached: true, remaining: await remainingNow() };
  }

  const used = await deps.usage.add(userKey, resetsAt);
  if (used > deps.config.userDaily)
    return {
      status: 429,
      code: "daily-limit",
      message: `You've used today's ${deps.config.userDaily} questions. They come back in ${until(resetsAt, now)}.`,
      resetsAt,
    };
  const total = await deps.usage.add(GLOBAL_KEY, resetsAt);
  if (total > deps.config.globalDaily)
    return {
      status: 429,
      code: "site-limit",
      message: `The tutor has answered all it can today. It's back in ${until(resetsAt, now)}.`,
      resetsAt,
    };

  return startStream(deps, ctx, history, question, cacheKey, Math.max(0, deps.config.userDaily - used));
}

/**
 * Start the model's answer and wait for its first chunk, so a busy or failing provider is reported as an error
 * (with a status) instead of an empty stream. The rest streams through, and a finished suggested answer is cached.
 */
async function startStream(
  deps: TutorDeps,
  ctx: StepContext,
  history: { question: string; answer: string }[],
  question: string,
  cacheKey: string | undefined,
  remaining: number,
): Promise<TutorAnswer | TutorRefusal> {
  let iterator: AsyncIterator<string>;
  let first: IteratorResult<string>;
  try {
    // Answers are plain text: LaTeX and Markdown that slip through are cleaned as the answer streams.
    iterator = plainTextStream(
      deps.model().stream({ system: tutorSystemPrompt(ctx), messages: tutorMessages(history, question) }),
    )[Symbol.asyncIterator]();
    first = await iterator.next();
  } catch (error) {
    const e = classifyTutorError(error);
    return e.kind === "busy"
      ? { status: 503, code: "busy", message: "The tutor is busy right now. Try again in a moment." }
      : { status: 503, code: "failed", message: "The tutor couldn't answer that. Try asking another way." };
  }
  async function* chunks() {
    let text = "";
    let done = first.done;
    if (!first.done) {
      text += first.value;
      yield first.value;
    }
    while (!done) {
      const next = await iterator.next();
      done = next.done;
      if (!next.done) {
        text += next.value;
        yield next.value;
      }
    }
    if (cacheKey && text.trim()) {
      try {
        await deps.cache.set(cacheKey, plainText(text).trim());
      } catch (error) {
        cacheTrouble(deps, "write", error);
      }
    }
  }
  return { kind: "stream", chunks: chunks(), remaining };
}
