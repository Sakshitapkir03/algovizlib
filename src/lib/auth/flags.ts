/**
 * Email + password sign-in (registration, verification, reset) ships behind `AUTH_EMAIL_PASSWORD_ENABLED`: on by
 * default locally, off by default in production until a verified sending domain is set up with Resend (see
 * "Accounts" in CLAUDE.md). When off, its UI is hidden, the credentials provider isn't registered, and its actions
 * refuse to run.
 */
export function emailPasswordEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const value = env.AUTH_EMAIL_PASSWORD_ENABLED?.trim().toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return env.NODE_ENV !== "production";
}

/** Which OAuth providers have credentials configured (`AUTH_GITHUB_ID`/`_SECRET`, `AUTH_GOOGLE_ID`/`_SECRET`). */
export function oauthProviders(env: Readonly<Record<string, string | undefined>> = process.env) {
  return {
    github: Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET),
    google: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
  };
}

export type SignInOptions = { emailPassword: boolean; github: boolean; google: boolean };

export function signInOptions(
  env: Readonly<Record<string, string | undefined>> = process.env,
): SignInOptions {
  return { emailPassword: emailPasswordEnabled(env), ...oauthProviders(env) };
}
