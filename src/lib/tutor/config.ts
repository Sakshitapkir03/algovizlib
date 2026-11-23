/**
 * "Ask about this step" (the tutor) ships behind `ASK_ENABLED`, off unless it's "true" or "1". It has its own model
 * settings, apart from the offline storyboard generator's (`AI_PROVIDER` / `AI_MODEL`): `TUTOR_PROVIDER` (default
 * google) and `TUTOR_MODEL` (default Gemini 3.5 Flash-Lite, the cheapest stable Flash model on the free tier). The key
 * is the provider's usual variable. `ASK_USER_DAILY` and `ASK_GLOBAL_DAILY` cap questions per user and in total per
 * day; the global cap sits a little below the free tier's daily request limit (500 requests a day for Flash-Lite as
 * of November 2026; Google shows a project's current limits only in AI Studio, so check it there).
 */
type Env = Readonly<Record<string, string | undefined>>;

export const TUTOR_PROVIDERS = {
  google: { keyVar: "GOOGLE_GENERATIVE_AI_API_KEY", defaultModel: "gemini-3.5-flash-lite" },
  anthropic: { keyVar: "ANTHROPIC_API_KEY", defaultModel: "claude-haiku-5-5" },
} as const;

export type TutorProvider = keyof typeof TUTOR_PROVIDERS;

export type TutorConfig = {
  enabled: boolean;
  provider: TutorProvider;
  model: string;
  /** The env var holding the key (its value is read only when the model is made, and never sent anywhere else). */
  keyVar: string;
  /** Questions a signed-in user may ask per day (Pacific time, like the provider's quota). */
  userDaily: number;
  /** Questions everyone together may ask per day: a safety net under the provider's free quota. */
  globalDaily: number;
  /** Questions a user may ask per minute. */
  userPerMinute: number;
  /** Give up on a model request after this long. */
  timeoutMs: number;
};

export const DEFAULT_USER_DAILY = 20;
export const DEFAULT_GLOBAL_DAILY = 450;
export const MAX_QUESTION_LENGTH = 300;

const positiveInt = (raw: string | undefined, fallback: number) => {
  const value = raw?.trim() ? Number(raw) : fallback;
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export function tutorEnabled(env: Env = process.env): boolean {
  const value = env.ASK_ENABLED?.trim().toLowerCase();
  return value === "true" || value === "1";
}

export function readTutorConfig(env: Env = process.env): TutorConfig {
  const named = env.TUTOR_PROVIDER?.trim() || "google";
  const provider: TutorProvider = named in TUTOR_PROVIDERS ? (named as TutorProvider) : "google";
  const { keyVar, defaultModel } = TUTOR_PROVIDERS[provider];
  return {
    // Off without a key, whatever the flag says: there'd be nothing to answer with.
    enabled: tutorEnabled(env) && Boolean(env[keyVar]?.trim()),
    provider,
    model: env.TUTOR_MODEL?.trim() || defaultModel,
    keyVar,
    userDaily: positiveInt(env.ASK_USER_DAILY, DEFAULT_USER_DAILY),
    globalDaily: positiveInt(env.ASK_GLOBAL_DAILY, DEFAULT_GLOBAL_DAILY),
    userPerMinute: 5,
    timeoutMs: 30_000,
  };
}
