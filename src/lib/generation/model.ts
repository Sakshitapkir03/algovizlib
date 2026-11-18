import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";

import type { GenerationConfig } from "./config";
import { draftSchema } from "./draft";
import { classifyProviderError } from "./errors";

export type ModelRequest = { system: string; prompt: string };

/**
 * The seam between the pipeline and a real model. `generate` returns the model's raw structured output, which
 * may be invalid: the pipeline validates it and sends the issues back. Tests inject a fake.
 * Throws `RateLimitError` / `DailyQuotaError` for quota problems.
 */
export interface StoryboardModel {
  readonly provider: string;
  readonly modelId: string;
  generate(request: ModelRequest): Promise<unknown>;
}

/** Wraps an AI SDK language model (real or `MockLanguageModelV4`). */
export function createSdkStoryboardModel(
  model: LanguageModel,
  provider: string,
  modelId: string,
  /** Abort a request after this long; the pipeline retries it like an overload. */
  timeoutMs?: number,
): StoryboardModel {
  return {
    provider,
    modelId,
    async generate({ system, prompt }) {
      try {
        const result = await generateText({
          model,
          system,
          prompt,
          output: Output.object({ schema: draftSchema }),
          // Retries are ours, so waits are logged and counted against the request budget.
          maxRetries: 0,
          ...(timeoutMs ? { timeout: timeoutMs } : {}),
        });
        return result.output;
      } catch (error) {
        // Output that doesn't match the schema still goes back to the pipeline, which reports exact issues.
        if (NoObjectGeneratedError.isInstance(error) && error.text) {
          try {
            return JSON.parse(error.text);
          } catch {
            return { unparseableOutput: error.text.slice(0, 2000) };
          }
        }
        throw classifyProviderError(error);
      }
    },
  };
}

type Env = Readonly<Record<string, string | undefined>>;

/** The configured provider's model. Reads the API key from `env` and never logs it. */
export function createStoryboardModel(config: GenerationConfig, env: Env): StoryboardModel {
  const apiKey = env[config.apiKeyVar];
  const sdkModel =
    config.provider === "google"
      ? createGoogleGenerativeAI({ apiKey })(config.model)
      : createAnthropic({ apiKey })(config.model);
  return createSdkStoryboardModel(sdkModel, config.provider, config.model, config.timeoutMs);
}
