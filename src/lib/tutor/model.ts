import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, type LanguageModel } from "ai";

import type { TutorConfig } from "./config";
import type { TutorMessage } from "./prompt";

/** A model failure the learner sees as "busy, try again later" (quota, overload, timeout) or as a plain error. */
export class TutorModelError extends Error {
  constructor(
    readonly kind: "busy" | "failed",
    message: string,
  ) {
    super(message);
  }
}

/** The seam between the tutor and a real model: a stream of text chunks. Tests inject a fake. */
export interface TutorModel {
  readonly modelId: string;
  stream(request: { system: string; messages: TutorMessage[]; signal?: AbortSignal }): AsyncIterable<string>;
}

export const MAX_ANSWER_TOKENS = 320;

const status = (error: unknown): number | undefined => {
  const e = error as { statusCode?: number; status?: number; cause?: { statusCode?: number } };
  return e?.statusCode ?? e?.status ?? e?.cause?.statusCode;
};

/** Quota (429), overload (5xx), timeouts, and dropped connections are "busy"; anything else "failed". */
export function classifyTutorError(error: unknown): TutorModelError {
  if (error instanceof TutorModelError) return error;
  const code = status(error);
  const name = (error as { name?: string })?.name ?? "";
  if (code === 429 || (code !== undefined && code >= 500) || /Abort|Timeout/i.test(name))
    return new TutorModelError("busy", "The tutor is busy right now.");
  if (
    code === undefined &&
    /fetch failed|ECONNRESET|ETIMEDOUT|socket/i.test(String((error as Error)?.message))
  )
    return new TutorModelError("busy", "The tutor is busy right now.");
  return new TutorModelError("failed", "The tutor couldn't answer that.");
}

/** Wraps an AI SDK language model (real, or `MockLanguageModelV4` in tests). */
export function createSdkTutorModel(model: LanguageModel, modelId: string, timeoutMs: number): TutorModel {
  return {
    modelId,
    async *stream({ system, messages, signal }) {
      const timeout = AbortSignal.timeout(timeoutMs);
      const result = streamText({
        model,
        system,
        messages,
        maxOutputTokens: MAX_ANSWER_TOKENS,
        temperature: 0.3,
        // One attempt: a busy provider is reported to the learner instead of making them wait.
        maxRetries: 0,
        abortSignal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        onError: () => {},
      });
      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") yield part.text;
          else if (part.type === "error") throw part.error;
        }
      } catch (error) {
        throw classifyTutorError(error);
      }
    },
  };
}

/** The configured provider's model. Reads the key from the environment here, on the server, and nowhere else. */
export function createTutorModel(config: TutorConfig, env = process.env): TutorModel {
  const apiKey = env[config.keyVar];
  const model =
    config.provider === "anthropic"
      ? createAnthropic({ apiKey })(config.model)
      : createGoogleGenerativeAI({ apiKey })(config.model);
  return createSdkTutorModel(model, config.model, config.timeoutMs);
}
