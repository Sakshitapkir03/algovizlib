import { GenerationConfigError } from "./errors";

export const PROVIDERS = {
  google: {
    keyVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    // Available on the Gemini API free tier (≈20 requests/day at the time of writing).
    defaultModel: "gemini-3.8-flash",
  },
  anthropic: { keyVar: "ANTHROPIC_API_KEY", defaultModel: "claude-opus-5-5" },
} as const;

export type ProviderName = keyof typeof PROVIDERS;

export type GenerationConfig = {
  provider: ProviderName;
  model: string;
  /** Name of the env var holding the key. The value itself is read only when the model is created. */
  apiKeyVar: string;
  /** Pause between model requests, for free-tier per-minute limits. */
  delayMs: number;
  /** Abort a request that hasn't finished after this long (it's then retried as an overload). */
  timeoutMs: number;
};

export const DEFAULT_DELAY_MS = 10_000;
export const DEFAULT_TIMEOUT_MS = 120_000;

function readMs(env: Env, name: string, fallback: number, min: number): number {
  const raw = env[name];
  const value = raw ? Number(raw) : fallback;
  if (!Number.isFinite(value) || value < min) {
    throw new GenerationConfigError(`${name} must be a number of milliseconds ≥ ${min}.`);
  }
  return value;
}

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Read AI_PROVIDER (default "google"), AI_MODEL (default per provider), GENERATION_DELAY_MS, and
 * GENERATION_TIMEOUT_MS. Fails fast with
 * a clear message if the provider is unknown or its API key is missing. Never echoes a key's value.
 */
export function readGenerationConfig(env: Env): GenerationConfig {
  const provider = (env.AI_PROVIDER?.trim() || "google") as ProviderName;
  if (!(provider in PROVIDERS)) {
    throw new GenerationConfigError(
      `AI_PROVIDER must be one of ${Object.keys(PROVIDERS).join(", ")} (got "${env.AI_PROVIDER}").`,
    );
  }
  const { keyVar, defaultModel } = PROVIDERS[provider];
  if (!env[keyVar]?.trim()) {
    throw new GenerationConfigError(
      `${keyVar} is not set. Add it to .env.local (see .env.example) to use AI_PROVIDER=${provider}.`,
    );
  }
  return {
    provider,
    model: env.AI_MODEL?.trim() || defaultModel,
    apiKeyVar: keyVar,
    delayMs: readMs(env, "GENERATION_DELAY_MS", DEFAULT_DELAY_MS, 0),
    timeoutMs: readMs(env, "GENERATION_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, 1000),
  };
}
