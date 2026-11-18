import { APICallError } from "ai";

/** A per-minute rate limit: worth waiting and retrying. */
export class RateLimitError extends Error {
  constructor(
    message: string,
    /** Provider-suggested wait, when it gives one (Gemini's RetryInfo, Anthropic's retry-after). */
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

/** The model is temporarily overloaded (Gemini 503 UNAVAILABLE, Anthropic 529): retried like a rate limit. */
export class OverloadedError extends RateLimitError {
  constructor(message: string, retryAfterMs?: number) {
    super(message, retryAfterMs);
    this.name = "OverloadedError";
  }
}

/** The daily quota is used up: retrying today is pointless, so the run stops. */
export class DailyQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DailyQuotaError";
  }
}

/** Bad or missing configuration (provider, model, API key). Never includes secret values. */
export class GenerationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationConfigError";
  }
}

const DAILY = /per ?day|perday|daily/i;

function retryAfterMs(error: APICallError): number | undefined {
  const header = error.responseHeaders?.["retry-after"];
  if (header && Number.isFinite(Number(header))) return Number(header) * 1000;
  // Gemini: "retryDelay": "37s" inside the RetryInfo detail.
  const match = error.responseBody?.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return match ? Math.ceil(Number(match[1]) * 1000) : undefined;
}

/**
 * Map a provider error onto the cases the pipeline handles differently:
 * - 429 per-minute limit → `RateLimitError` (retry with backoff)
 * - 429 daily quota → `DailyQuotaError` (stop the run). Gemini uses 429 RESOURCE_EXHAUSTED for both; the quota id
 *   in the body says which ("…PerDay…" vs "…PerMinute…").
 * - 503 / 529 overloaded, timeouts, connection errors → `OverloadedError` (retry with backoff)
 * Anything else is returned unchanged.
 */
export function classifyProviderError(error: unknown): unknown {
  // Our per-request timeout, or the connection dropping before the provider answered: the model is unavailable.
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return new OverloadedError("The model didn't respond in time.");
  }
  if (APICallError.isInstance(error) && error.statusCode === undefined && error.isRetryable) {
    return new OverloadedError("Couldn't reach the model (connection error or timeout).");
  }
  if (!APICallError.isInstance(error)) return error;
  if (error.statusCode === 503 || error.statusCode === 529) {
    return new OverloadedError("The model is temporarily overloaded.", retryAfterMs(error));
  }
  if (error.statusCode !== 429) return error;
  const text = `${error.message}\n${error.responseBody ?? ""}`;
  if (DAILY.test(text)) return new DailyQuotaError("The provider's daily request quota is used up.");
  return new RateLimitError("Rate limited by the provider (per-minute limit).", retryAfterMs(error));
}
