import { emails, type Mailer } from "./mailer";
import { allowed, type RateLimiter } from "./rate-limit";
import type { AuthStore } from "./store";
import { generateToken, hashToken, TOKEN_TTL_MS, type TokenPurpose } from "./tokens";
import {
  changePasswordSchema,
  fieldErrors,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
  type FormState,
} from "./validation";

/**
 * The email + password flows, independent of Next.js and Auth.js so they're tested directly: everything they touch
 * comes in through `AuthDeps`. Server actions and the credentials provider are thin wrappers around these.
 *
 * Rules every flow keeps: answers never reveal whether an email is registered (same message, same work, the
 * password check runs against a dummy hash when there's no account); every attempt is rate limited per IP and per
 * email; tokens are single-use and expire.
 */
export type PasswordHasher = {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
  /** Spend a real check's time when there's no hash, then fail. */
  dummy(password: string): Promise<false>;
};

export type AuthDeps = {
  store: AuthStore;
  mailer: Mailer;
  limiter: RateLimiter;
  passwords: PasswordHasher;
  /** Origin for links in emails (`APP_URL`), never the request's Host header. */
  appUrl: string;
  /** `AUTH_EMAIL_PASSWORD_ENABLED`. */
  enabled: boolean;
  now?: () => number;
};

export const MESSAGES = {
  invalidLogin: "Invalid email or password.",
  rateLimited: "Too many attempts. Wait a few minutes and try again.",
  disabled: "Email and password sign-in isn't available. Sign in with GitHub or Google.",
  registered:
    "Check your email: we sent a link to verify your address. Then sign in. (If you already have an account, the email explains what to do.)",
  forgot: "If an account uses that email, we've sent a link to reset its password. It expires in 30 minutes.",
  invalidToken: "This link is invalid or has expired. Request a new one.",
  verified: "Your email is verified. Your progress now syncs to your account.",
  reset: "Your password has been reset. Sign in with your new password.",
  changed: "Password changed. Sign in again with your new password.",
  wrongCurrent: "Your current password is incorrect.",
  resent: "We sent a new verification link. It expires in 24 hours.",
  alreadyVerified: "Your email is already verified.",
  sendFailed: "We couldn't send the email. Try again in a few minutes.",
} as const;

const disabled = (): FormState => ({ status: "error", message: MESSAGES.disabled });
const limited = (): FormState => ({ status: "error", message: MESSAGES.rateLimited });

async function issueToken(deps: AuthDeps, userId: string, purpose: TokenPurpose): Promise<string> {
  const token = generateToken();
  const now = (deps.now ?? Date.now)();
  await deps.store.createToken({
    userId,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: new Date(now + TOKEN_TTL_MS[purpose]),
  });
  return token;
}

const link = (deps: AuthDeps, path: string, token?: string) =>
  `${deps.appUrl.replace(/\/$/, "")}${path}${token ? `?token=${token}` : ""}`;

async function sendVerification(deps: AuthDeps, userId: string, email: string) {
  await deps.store.deleteTokens(userId, "VERIFY_EMAIL");
  const token = await issueToken(deps, userId, "VERIFY_EMAIL");
  await deps.mailer.send(emails.verify(email, link(deps, "/verify-email", token)));
}

/**
 * Create an account and email a verification link. If the email is taken, email its owner instead and answer
 * exactly the same, so the form can't be used to find out who has an account.
 */
export async function register(deps: AuthDeps, input: unknown, ip: string): Promise<FormState> {
  if (!deps.enabled) return disabled();
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error) };
  const { email, password } = parsed.data;
  const name = parsed.data.name || null;
  if (
    !(await allowed(deps.limiter, [
      ["registerIp", ip],
      ["registerEmail", email],
    ]))
  )
    return limited();

  const existing = await deps.store.findUserByEmail(email);
  try {
    if (existing) {
      await deps.passwords.dummy(password); // the same work as hashing a new password
      await deps.mailer.send(
        emails.alreadyRegistered(email, link(deps, "/login"), link(deps, "/forgot-password")),
      );
    } else {
      const passwordHash = await deps.passwords.hash(password);
      const user = await deps.store.createUser({ email, name, passwordHash });
      await sendVerification(deps, user.id, email);
    }
  } catch {
    return { status: "error", message: MESSAGES.sendFailed };
  }
  return { status: "ok", message: MESSAGES.registered };
}

export type CredentialsResult =
  | { ok: true; user: { id: string; email: string; name: string | null } }
  | { ok: false; reason: "invalid" | "rate-limited" | "disabled" };

/** The credentials provider's check. Unknown email, no password, or a wrong one: the same answer and timing. */
export async function authorizeCredentials(
  deps: AuthDeps,
  input: unknown,
  ip: string,
): Promise<CredentialsResult> {
  if (!deps.enabled) return { ok: false, reason: "disabled" };
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { email, password } = parsed.data;
  if (
    !(await allowed(deps.limiter, [
      ["loginIp", ip],
      ["loginEmail", email],
    ]))
  )
    return { ok: false, reason: "rate-limited" };
  const user = await deps.store.findUserByEmail(email);
  const ok = user?.passwordHash
    ? await deps.passwords.verify(user.passwordHash, password)
    : await deps.passwords.dummy(password);
  if (!ok || !user) return { ok: false, reason: "invalid" };
  return { ok: true, user: { id: user.id, email, name: user.name } };
}

/** The "Confirm my email" button on /verify-email (a POST, so link scanners can't use the token up). */
export async function confirmEmail(deps: AuthDeps, token: unknown, ip: string): Promise<FormState> {
  if (!deps.enabled) return disabled();
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { status: "error", message: MESSAGES.invalidToken };
  if (!(await allowed(deps.limiter, [["verifyIp", ip]]))) return limited();
  const now = (deps.now ?? Date.now)();
  const found = await deps.store.consumeToken(hashToken(parsed.data), "VERIFY_EMAIL");
  if (!found || found.expiresAt.getTime() <= now) return { status: "error", message: MESSAGES.invalidToken };
  await deps.store.markEmailVerified(found.userId, new Date(now));
  return { status: "ok", message: MESSAGES.verified };
}

/** Signed in but not verified yet: send a fresh link (the old one stops working). */
export async function resendVerification(deps: AuthDeps, userId: string): Promise<FormState> {
  if (!deps.enabled) return disabled();
  if (!(await allowed(deps.limiter, [["resendUser", userId]]))) return limited();
  const user = await deps.store.findUserById(userId);
  if (!user?.email) return { status: "error", message: MESSAGES.invalidToken };
  if (user.emailVerified) return { status: "ok", message: MESSAGES.alreadyVerified };
  try {
    await sendVerification(deps, user.id, user.email);
  } catch {
    return { status: "error", message: MESSAGES.sendFailed };
  }
  return { status: "ok", message: MESSAGES.resent };
}

/** Email a reset link if the account exists; the answer is the same either way. */
export async function requestPasswordReset(deps: AuthDeps, input: unknown, ip: string): Promise<FormState> {
  if (!deps.enabled) return disabled();
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error) };
  const { email } = parsed.data;
  if (
    !(await allowed(deps.limiter, [
      ["forgotIp", ip],
      ["forgotEmail", email],
    ]))
  )
    return limited();
  const user = await deps.store.findUserByEmail(email);
  if (user) {
    try {
      await deps.store.deleteTokens(user.id, "RESET_PASSWORD");
      const token = await issueToken(deps, user.id, "RESET_PASSWORD");
      await deps.mailer.send(emails.reset(email, link(deps, "/reset-password", token)));
    } catch {
      // Same answer as for an unknown email; the failure is in the server log.
    }
  }
  return { status: "ok", message: MESSAGES.forgot };
}

/**
 * Set a new password from a reset link. The token is used up, other reset links stop working, every session is
 * signed out (`sessionVersion`), and the email counts as verified (the link proved the inbox is theirs).
 */
export async function resetPassword(deps: AuthDeps, input: unknown, ip: string): Promise<FormState> {
  if (!deps.enabled) return disabled();
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    return fields.token ? { status: "error", message: MESSAGES.invalidToken } : { status: "error", fields };
  }
  if (!(await allowed(deps.limiter, [["resetIp", ip]]))) return limited();
  const now = (deps.now ?? Date.now)();
  const found = await deps.store.consumeToken(hashToken(parsed.data.token), "RESET_PASSWORD");
  if (!found || found.expiresAt.getTime() <= now) return { status: "error", message: MESSAGES.invalidToken };
  const passwordHash = await deps.passwords.hash(parsed.data.password);
  await deps.store.setPassword(found.userId, passwordHash, { verifyEmailAt: new Date(now) });
  await deps.store.deleteTokens(found.userId, "RESET_PASSWORD");
  return { status: "ok", message: MESSAGES.reset };
}

/** Change the password from /account (email accounts). Every session, this one included, is signed out after. */
export async function changePassword(deps: AuthDeps, userId: string, input: unknown): Promise<FormState> {
  if (!deps.enabled) return disabled();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error) };
  if (!(await allowed(deps.limiter, [["changePasswordUser", userId]]))) return limited();
  const user = await deps.store.findUserById(userId);
  if (!user?.passwordHash || !(await deps.passwords.verify(user.passwordHash, parsed.data.current)))
    return { status: "error", fields: { current: MESSAGES.wrongCurrent } };
  await deps.store.setPassword(userId, await deps.passwords.hash(parsed.data.password));
  return { status: "ok", message: MESSAGES.changed };
}
