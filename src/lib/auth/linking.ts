/**
 * When a GitHub or Google sign-in may go ahead. Auth.js does the linking itself (`allowDangerousEmailAccountLinking`
 * is on, so it links by email); this decides beforehand, in the `signIn` callback, so linking only ever happens
 * when it's safe:
 *
 * - An OAuth account already linked to a user signs in as that user.
 * - A signed-in user (a valid session) linking another provider from /account is linking on purpose: allowed. A
 *   session that was signed out (password changed or reset) can't link anything.
 * - Otherwise the provider must say the email is verified: an unverified provider email can't create an account
 *   or claim one.
 * - If an account already uses that email, it's linked only if that account's email is verified too. Otherwise the
 *   person is told to sign in with their password and link from Account.
 */
export type LinkingInput = {
  /** The user this provider account is already linked to, if any. */
  linkedUserId: string | null;
  /** The current session: a user id, "invalid" (a cookie for a signed-out session), or null. */
  session: string | "invalid" | null;
  providerEmailVerified: boolean;
  /** The account that already uses the provider's email, if any. */
  existingUser: { id: string; emailVerified: boolean } | null;
};

export type LinkingDecision =
  | { allow: true; reason: "returning" | "linking" | "verified-match" | "new-user" }
  | { allow: false; error: LinkingError };

export type LinkingError = "account-exists" | "unverified-provider-email" | "session-expired";

export function decideOAuthSignIn(input: LinkingInput): LinkingDecision {
  if (input.linkedUserId) return { allow: true, reason: "returning" };
  if (input.session === "invalid") return { allow: false, error: "session-expired" };
  if (input.session) return { allow: true, reason: "linking" };
  if (!input.providerEmailVerified) return { allow: false, error: "unverified-provider-email" };
  if (input.existingUser)
    return input.existingUser.emailVerified
      ? { allow: true, reason: "verified-match" }
      : { allow: false, error: "account-exists" };
  return { allow: true, reason: "new-user" };
}

/** What the login page says for each refusal (`/login?error=<code>`), plus Auth.js's own error codes. */
export const SIGN_IN_ERRORS: Record<string, string> = {
  "account-exists":
    "An account with this email already exists. Sign in with your email and password, then link this provider from Account.",
  "unverified-provider-email":
    "Your email isn't verified with that provider. Verify it there first, then try again.",
  "session-expired": "Your session ended. Sign in again, then link the provider from Account.",
  OAuthAccountNotLinked: "That account is already linked to a different algovizlib user.",
  AccessDenied: "Sign-in was cancelled or refused.",
  Configuration: "Sign-in isn't configured correctly. Try again later.",
  Verification: "This sign-in link is invalid or has expired.",
};

export const DEFAULT_SIGN_IN_ERROR = "Something went wrong while signing in. Try again.";

type FetchLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
}>;

/**
 * Whether GitHub has verified `email` for this user: its profile email may be unverified, so ask `/user/emails`
 * (the `user:email` scope Auth.js requests by default).
 */
export async function githubEmailVerified(fetcher: FetchLike, accessToken: string, email: string) {
  try {
    const res = await fetcher("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return false;
    const list = (await res.json()) as unknown;
    if (!Array.isArray(list)) return false;
    return list.some(
      (e: { email?: unknown; verified?: unknown }) =>
        typeof e?.email === "string" && e.email.toLowerCase() === email.toLowerCase() && e.verified === true,
    );
  } catch {
    return false;
  }
}

/** Google puts `email_verified` in the ID token's profile. */
export function googleEmailVerified(profile: unknown): boolean {
  return (profile as { email_verified?: unknown } | undefined)?.email_verified === true;
}
