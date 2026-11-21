import { describe, expect, it, vi } from "vitest";

import { emailPasswordEnabled, signInOptions } from "@/lib/auth/flags";
import { createConsoleMailer, emails, mailerFromEnv } from "@/lib/auth/mailer";
import { ARGON2_OPTIONS, hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import { allowed, createMemoryRateLimiter, LIMITS, windowStart } from "@/lib/auth/rate-limit";
import {
  authorizeCredentials,
  changePassword,
  confirmEmail,
  MESSAGES,
  register,
  requestPasswordReset,
  resendVerification,
  resetPassword,
} from "@/lib/auth/service";
import { passwordStrength } from "@/lib/auth/strength";
import { generateToken, hashToken, TOKEN_TTL_MS } from "@/lib/auth/tokens";
import { loginSchema, registerSchema, resetPasswordSchema } from "@/lib/auth/validation";

import { authFixture } from "./fixtures/auth";

const IP = "203.0.113.7";
const PASSWORD = "orange tiger lamp river";

async function registered(f = authFixture(), email = "ada@example.com") {
  await register(f.deps, { email, password: PASSWORD }, IP);
  const user = [...f.users.values()].find((u) => u.email === email)!;
  return { f, user };
}

describe("password hashing (Argon2id)", () => {
  it("hashes with Argon2id at OWASP's parameters, salted, and verifies", async () => {
    const a = await hashPassword(PASSWORD);
    const b = await hashPassword(PASSWORD);
    expect(a).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(a).not.toBe(b); // a fresh salt each time
    expect(a).not.toContain(PASSWORD);
    expect(await verifyPassword(a, PASSWORD)).toBe(true);
    expect(await verifyPassword(a, PASSWORD + "!")).toBe(false);
    expect(ARGON2_OPTIONS).toMatchObject({ memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  });

  it("treats a malformed hash as a wrong password, and the dummy check always fails", async () => {
    expect(await verifyPassword("not-a-hash", PASSWORD)).toBe(false);
    expect(await verifyAgainstDummy(PASSWORD)).toBe(false);
  });
});

describe("registration validation", () => {
  it("needs a valid email and a password of at least 10 characters; lowercases the email", () => {
    expect(registerSchema.safeParse({ email: "a@b.co", password: "123456789" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "nope", password: PASSWORD }).success).toBe(false);
    const ok = registerSchema.parse({ email: "  Ada@Example.COM ", password: "a".repeat(10) });
    expect(ok.email).toBe("ada@example.com");
    expect(registerSchema.safeParse({ email: "a@b.co", password: "a".repeat(129) }).success).toBe(false);
  });

  it("checks the confirmation on reset", () => {
    const token = generateToken();
    const r = resetPasswordSchema.safeParse({ token, password: PASSWORD, confirm: "different one!!" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["confirm"]);
  });

  it("returns field errors instead of creating anything", async () => {
    const f = authFixture();
    const result = await register(f.deps, { email: "bad", password: "short" }, IP);
    expect(result).toEqual({
      status: "error",
      fields: { email: "Enter a valid email address.", password: "Use at least 10 characters." },
    });
    expect(f.users.size).toBe(0);
    expect(f.sent).toHaveLength(0);
  });

  it("rates password strength without a dictionary download", () => {
    expect(passwordStrength("short").score).toBe(0);
    expect(passwordStrength("password12345").score).toBeLessThanOrEqual(1);
    expect(passwordStrength("aaaaaaaaaaaa").score).toBe(1);
    expect(passwordStrength(PASSWORD).score).toBeGreaterThanOrEqual(3);
    expect(passwordStrength("ada-lovelace-2026", ["ada"]).hint).toMatch(/name or email/);
  });
});

describe("register", () => {
  it("creates the account with a hash (never the password) and emails a verification link", async () => {
    const { f, user } = await registered();
    expect(user.passwordHash).toBe(`hashed:${PASSWORD}`);
    expect(user.emailVerified).toBeNull();
    expect(f.sent).toHaveLength(1);
    expect(f.sent[0].subject).toBe("Verify your email for algovizlib");
    expect(f.sent[0].text).toContain("https://algoviz.test/verify-email?token=");
    // Only the token's hash is stored.
    const token = f.tokenFrom("/verify-email")!;
    expect(f.tokens.has(token)).toBe(false);
    expect(f.tokens.get(hashToken(token))).toMatchObject({ userId: user.id, purpose: "VERIFY_EMAIL" });
  });

  it("answers a taken email exactly like a new one and emails the owner instead", async () => {
    const { f } = await registered();
    const first = f.sent.length;
    const again = await register(f.deps, { email: "ADA@example.com", password: "something else 1" }, IP);
    expect(again).toEqual({ status: "ok", message: MESSAGES.registered });
    expect(f.users.size).toBe(1);
    expect(f.sent).toHaveLength(first + 1);
    expect(f.sent.at(-1)!.subject).toBe("You already have an algovizlib account");
    expect(f.sent.at(-1)!.text).toContain("https://algoviz.test/forgot-password");
    expect(f.passwords.dummyCalls).toBe(1); // the same Argon2 work as a new account
  });
});

describe("login (credentials)", () => {
  it("accepts the right password", async () => {
    const { f, user } = await registered();
    const r = await authorizeCredentials(f.deps, { email: "Ada@Example.com", password: PASSWORD }, IP);
    expect(r).toEqual({ ok: true, user: { id: user.id, email: "ada@example.com", name: null } });
  });

  it("gives one generic answer for an unknown email, a wrong password, or an account without one", async () => {
    const { f, user } = await registered();
    const wrong = await authorizeCredentials(
      f.deps,
      { email: "ada@example.com", password: "nope nope nope" },
      IP,
    );
    const unknown = await authorizeCredentials(f.deps, { email: "who@example.com", password: PASSWORD }, IP);
    f.users.get(user.id)!.passwordHash = null; // e.g. a GitHub-only account
    const noPassword = await authorizeCredentials(
      f.deps,
      { email: "ada@example.com", password: PASSWORD },
      IP,
    );
    expect([wrong, unknown, noPassword]).toEqual([
      { ok: false, reason: "invalid" },
      { ok: false, reason: "invalid" },
      { ok: false, reason: "invalid" },
    ]);
    // Unknown and password-less accounts still spend a hash check (no timing difference).
    expect(f.passwords.dummyCalls).toBe(2);
    expect(MESSAGES.invalidLogin).toBe("Invalid email or password.");
  });

  it("is rate limited per email and per IP", async () => {
    const { f } = await registered();
    const attempt = (email: string, ip: string) =>
      authorizeCredentials(f.deps, { email, password: "wrong wrong wrong" }, ip);
    for (let i = 0; i < LIMITS.loginEmail.max; i++) await attempt("ada@example.com", `10.0.0.${i}`);
    expect(await attempt("ada@example.com", "10.0.1.1")).toEqual({ ok: false, reason: "rate-limited" });
    // Even the right password is refused until the window passes.
    expect(
      (await authorizeCredentials(f.deps, { email: "ada@example.com", password: PASSWORD }, "10.0.2.2")).ok,
    ).toBe(false);
    f.advance(LIMITS.loginEmail.windowMs);
    expect(
      (await authorizeCredentials(f.deps, { email: "ada@example.com", password: PASSWORD }, "10.0.2.2")).ok,
    ).toBe(true);

    // One IP trying many emails.
    for (let i = 0; i < LIMITS.loginIp.max; i++) await attempt(`user${i}@example.com`, "198.51.100.9");
    expect(await attempt("fresh@example.com", "198.51.100.9")).toEqual({ ok: false, reason: "rate-limited" });
  });
});

describe("rate limiter", () => {
  it("counts per key within a fixed window", async () => {
    let now = 1_000_000;
    const limiter = createMemoryRateLimiter(() => now);
    const limit = { max: 2, windowMs: 1000 };
    expect(await limiter.hit("k", limit)).toBe(true);
    expect(await limiter.hit("k", limit)).toBe(true);
    expect(await limiter.hit("k", limit)).toBe(false);
    expect(await limiter.hit("other", limit)).toBe(true);
    now += 1000;
    expect(await limiter.hit("k", limit)).toBe(true);
    expect(windowStart(1999, 1000)).toBe(1000);
  });

  it("counts every check, so a blocked request still uses up its other windows", async () => {
    const limiter = createMemoryRateLimiter(() => 0);
    const spy = vi.spyOn(limiter, "hit");
    await allowed(limiter, [
      ["registerIp", "1.2.3.4"],
      ["registerEmail", "a@b.co"],
    ]);
    expect(spy.mock.calls.map((c) => c[0])).toEqual(["registerIp:1.2.3.4", "registerEmail:a@b.co"]);
  });

  it("limits registration and reset requests", async () => {
    const f = authFixture();
    for (let i = 0; i < LIMITS.registerIp.max; i++)
      await register(f.deps, { email: `r${i}@example.com`, password: PASSWORD }, IP);
    expect(await register(f.deps, { email: "late@example.com", password: PASSWORD }, IP)).toEqual({
      status: "error",
      message: MESSAGES.rateLimited,
    });
    for (let i = 0; i < LIMITS.forgotEmail.max; i++)
      await requestPasswordReset(f.deps, { email: "r0@example.com" }, `10.1.0.${i}`);
    expect((await requestPasswordReset(f.deps, { email: "r0@example.com" }, "10.1.1.1")).status).toBe(
      "error",
    );
  });
});

describe("email verification tokens", () => {
  it("verifies once; the link can't be used again", async () => {
    const { f, user } = await registered();
    const token = f.tokenFrom("/verify-email")!;
    expect(await confirmEmail(f.deps, token, IP)).toEqual({ status: "ok", message: MESSAGES.verified });
    expect(f.users.get(user.id)!.emailVerified).toBeInstanceOf(Date);
    expect(await confirmEmail(f.deps, token, IP)).toEqual({
      status: "error",
      message: MESSAGES.invalidToken,
    });
  });

  it("expires after 24 hours", async () => {
    const { f, user } = await registered();
    const token = f.tokenFrom("/verify-email")!;
    f.advance(TOKEN_TTL_MS.VERIFY_EMAIL + 1);
    expect((await confirmEmail(f.deps, token, IP)).status).toBe("error");
    expect(f.users.get(user.id)!.emailVerified).toBeNull();
  });

  it("rejects malformed and unknown tokens", async () => {
    const { f } = await registered();
    expect((await confirmEmail(f.deps, "abc", IP)).status).toBe("error");
    expect((await confirmEmail(f.deps, generateToken(), IP)).status).toBe("error");
  });

  it("resending replaces the old link", async () => {
    const { f, user } = await registered();
    const old = f.tokenFrom("/verify-email")!;
    expect(await resendVerification(f.deps, user.id)).toEqual({ status: "ok", message: MESSAGES.resent });
    const fresh = f.tokenFrom("/verify-email")!;
    expect(fresh).not.toBe(old);
    expect((await confirmEmail(f.deps, old, IP)).status).toBe("error");
    expect((await confirmEmail(f.deps, fresh, IP)).status).toBe("ok");
    expect(await resendVerification(f.deps, user.id)).toEqual({
      status: "ok",
      message: MESSAGES.alreadyVerified,
    });
  });
});

describe("password reset", () => {
  it("answers the same for registered and unknown emails, emailing only the account", async () => {
    const { f } = await registered();
    const before = f.sent.length;
    const known = await requestPasswordReset(f.deps, { email: "ada@example.com" }, IP);
    const unknown = await requestPasswordReset(f.deps, { email: "who@example.com" }, IP);
    expect(known).toEqual(unknown);
    expect(known).toEqual({ status: "ok", message: MESSAGES.forgot });
    expect(f.sent.length).toBe(before + 1);
    expect(f.sent.at(-1)!.to).toBe("ada@example.com");
  });

  it("is single use, signs out every session, invalidates other links, and verifies the email", async () => {
    const { f, user } = await registered();
    await requestPasswordReset(f.deps, { email: "ada@example.com" }, IP);
    const first = f.tokenFrom("/reset-password")!;
    await requestPasswordReset(f.deps, { email: "ada@example.com" }, IP);
    const second = f.tokenFrom("/reset-password")!;
    // Requesting again replaced the first link.
    const input = (token: string) => ({
      token,
      password: "brand new kettle sky",
      confirm: "brand new kettle sky",
    });
    expect(await resetPassword(f.deps, input(first), IP)).toEqual({
      status: "error",
      message: MESSAGES.invalidToken,
    });
    const version = f.users.get(user.id)!.sessionVersion;
    expect(await resetPassword(f.deps, input(second), IP)).toEqual({ status: "ok", message: MESSAGES.reset });
    const after = f.users.get(user.id)!;
    expect(after.passwordHash).toBe("hashed:brand new kettle sky");
    expect(after.sessionVersion).toBe(version + 1);
    expect(after.emailVerified).toBeInstanceOf(Date);
    expect(await resetPassword(f.deps, input(second), IP)).toEqual({
      status: "error",
      message: MESSAGES.invalidToken,
    });
  });

  it("expires after 30 minutes", async () => {
    const { f, user } = await registered();
    await requestPasswordReset(f.deps, { email: "ada@example.com" }, IP);
    const token = f.tokenFrom("/reset-password")!;
    f.advance(TOKEN_TTL_MS.RESET_PASSWORD + 1);
    const r = await resetPassword(
      f.deps,
      { token, password: "brand new kettle sky", confirm: "brand new kettle sky" },
      IP,
    );
    expect(r.status).toBe("error");
    expect(f.users.get(user.id)!.passwordHash).toBe(`hashed:${PASSWORD}`);
  });

  it("a verification token can't reset a password (and vice versa)", async () => {
    const { f } = await registered();
    const verify = f.tokenFrom("/verify-email")!;
    const r = await resetPassword(
      f.deps,
      { token: verify, password: "brand new kettle sky", confirm: "brand new kettle sky" },
      IP,
    );
    expect(r.status).toBe("error");
  });
});

describe("change password", () => {
  it("needs the current password, then signs every session out", async () => {
    const { f, user } = await registered();
    const input = {
      current: "wrong wrong wrong",
      password: "brand new kettle sky",
      confirm: "brand new kettle sky",
    };
    expect(await changePassword(f.deps, user.id, input)).toEqual({
      status: "error",
      fields: { current: MESSAGES.wrongCurrent },
    });
    expect(await changePassword(f.deps, user.id, { ...input, current: PASSWORD })).toEqual({
      status: "ok",
      message: MESSAGES.changed,
    });
    expect(f.users.get(user.id)!.sessionVersion).toBe(1);
  });
});

describe("the email + password flag", () => {
  it("is on locally and off in production unless set", () => {
    expect(emailPasswordEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(emailPasswordEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(emailPasswordEnabled({ NODE_ENV: "production", AUTH_EMAIL_PASSWORD_ENABLED: "true" })).toBe(true);
    expect(emailPasswordEnabled({ NODE_ENV: "development", AUTH_EMAIL_PASSWORD_ENABLED: "false" })).toBe(
      false,
    );
    expect(signInOptions({ NODE_ENV: "production", AUTH_GITHUB_ID: "x", AUTH_GITHUB_SECRET: "y" })).toEqual({
      emailPassword: false,
      github: true,
      google: false,
    });
  });

  it("when off, every email + password flow refuses to run", async () => {
    const f = authFixture({ enabled: false });
    const disabled = { status: "error", message: MESSAGES.disabled };
    expect(await register(f.deps, { email: "a@example.com", password: PASSWORD }, IP)).toEqual(disabled);
    expect(await authorizeCredentials(f.deps, { email: "a@example.com", password: PASSWORD }, IP)).toEqual({
      ok: false,
      reason: "disabled",
    });
    expect(await confirmEmail(f.deps, generateToken(), IP)).toEqual(disabled);
    expect(await requestPasswordReset(f.deps, { email: "a@example.com" }, IP)).toEqual(disabled);
    expect(await resetPassword(f.deps, {}, IP)).toEqual(disabled);
    expect(await resendVerification(f.deps, "u1")).toEqual(disabled);
    expect(await changePassword(f.deps, "u1", {})).toEqual(disabled);
    expect(f.users.size + f.sent.length).toBe(0);
  });
});

describe("email", () => {
  it("logs the link to the console when Resend isn't configured (and never a key)", async () => {
    expect(mailerFromEnv({}).kind).toBe("console");
    expect(mailerFromEnv({ RESEND_API_KEY: "re_x" }).kind).toBe("console"); // needs EMAIL_FROM too
    expect(mailerFromEnv({ RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.co" }).kind).toBe("resend");
    const lines: string[] = [];
    await createConsoleMailer((l) => lines.push(l)).send(
      emails.verify("a@b.co", "https://x.test/verify-email?token=t"),
    );
    expect(lines.join()).toContain("https://x.test/verify-email?token=t");
  });

  it("escapes HTML in messages", () => {
    const e = emails.reset("a@b.co", 'https://x.test/reset-password?token=a"><script>');
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("login input never needs more than a bounded password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x".repeat(10_000) }).success).toBe(false);
  });
});
