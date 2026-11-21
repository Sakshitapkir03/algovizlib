import type { Adapter } from "next-auth/adapters";
import { describe, expect, it } from "vitest";

import {
  decideOAuthSignIn,
  createVerificationMemo,
  githubEmailVerified,
  googleEmailVerified,
  provesEmail,
  SIGN_IN_ERRORS,
  type LinkingInput,
} from "@/lib/auth/linking";

const base: LinkingInput = {
  linkedUserId: null,
  session: null,
  providerEmailVerified: true,
  existingUser: null,
};

describe("account linking rules", () => {
  it("a provider account that's already linked signs in as its user", () => {
    expect(decideOAuthSignIn({ ...base, linkedUserId: "u1", providerEmailVerified: false })).toEqual({
      allow: true,
      reason: "returning",
    });
  });

  it("a new verified email creates an account", () => {
    expect(decideOAuthSignIn(base)).toEqual({ allow: true, reason: "new-user" });
  });

  it("links to an existing account only when the email is verified on both sides", () => {
    const verified = { id: "u1", emailVerified: true };
    const unverified = { id: "u1", emailVerified: false };
    expect(decideOAuthSignIn({ ...base, existingUser: verified })).toEqual({
      allow: true,
      reason: "verified-match",
    });
    expect(decideOAuthSignIn({ ...base, existingUser: unverified })).toEqual({
      allow: false,
      error: "account-exists",
    });
    expect(decideOAuthSignIn({ ...base, existingUser: verified, providerEmailVerified: false })).toEqual({
      allow: false,
      error: "unverified-provider-email",
    });
  });

  it("an unverified provider email can't create an account either", () => {
    expect(decideOAuthSignIn({ ...base, providerEmailVerified: false })).toEqual({
      allow: false,
      error: "unverified-provider-email",
    });
  });

  it("a signed-in user may link on purpose; a signed-out (revoked) session may not", () => {
    expect(decideOAuthSignIn({ ...base, session: "u1", providerEmailVerified: false })).toEqual({
      allow: true,
      reason: "linking",
    });
    expect(
      decideOAuthSignIn({ ...base, session: "invalid", existingUser: { id: "u1", emailVerified: true } }),
    ).toEqual({
      allow: false,
      error: "session-expired",
    });
  });

  it("has a message for every refusal", () => {
    for (const error of ["account-exists", "unverified-provider-email", "session-expired"])
      expect(SIGN_IN_ERRORS[error]).toBeTruthy();
  });
});

describe("provider email verification", () => {
  const reply =
    (body: unknown, ok = true) =>
    async () => ({ ok, json: async () => body });

  it("GitHub: the matching address must be marked verified in /user/emails", async () => {
    const emails = [
      { email: "Ada@Example.com", verified: true, primary: true },
      { email: "old@example.com", verified: false, primary: false },
    ];
    expect(await githubEmailVerified(reply(emails), "token", "ada@example.com")).toBe(true);
    expect(await githubEmailVerified(reply(emails), "token", "old@example.com")).toBe(false);
    expect(await githubEmailVerified(reply(emails), "token", "new@example.com")).toBe(false);
    expect(
      await githubEmailVerified(reply({ message: "Bad credentials" }, false), "t", "ada@example.com"),
    ).toBe(false);
    expect(await githubEmailVerified(reply("not a list"), "t", "ada@example.com")).toBe(false);
    const throws = async () => {
      throw new Error("network");
    };
    expect(await githubEmailVerified(throws, "t", "ada@example.com")).toBe(false);
  });

  it("GitHub: sends the token as a bearer header", async () => {
    let headers: Record<string, string> = {};
    await githubEmailVerified(
      async (_url, init) => ((headers = init.headers), { ok: true, json: async () => [] }),
      "tok",
      "a@b.co",
    );
    expect(headers.Authorization).toBe("Bearer tok");
  });

  it("Google: email_verified must be true", () => {
    expect(googleEmailVerified({ email_verified: true })).toBe(true);
    expect(googleEmailVerified({ email_verified: false })).toBe(false);
    expect(googleEmailVerified({ email_verified: "true" })).toBe(false);
    expect(googleEmailVerified(undefined)).toBe(false);
  });
});

describe("what the adapter stores", () => {
  it("lowercases emails and keeps no provider tokens", async () => {
    const { storageAdapter } = await import("@/lib/auth/adapter");
    const calls: Record<string, unknown>[] = [];
    const base = {
      getUserByEmail: async (email: string) => (calls.push({ email }), null),
      createUser: async (user: Record<string, unknown>) => (calls.push(user), user),
      linkAccount: async (account: Record<string, unknown>) => void calls.push(account),
    };
    const adapter = storageAdapter(base as unknown as Adapter);
    await adapter.getUserByEmail!("Ada@Example.COM");
    await adapter.linkAccount!({
      userId: "u1",
      type: "oauth",
      provider: "github",
      providerAccountId: "42",
      access_token: "gho_secret",
      refresh_token: "r",
      id_token: "i",
      scope: "read:user user:email",
      token_type: "bearer",
    });
    expect(calls).toEqual([
      { email: "ada@example.com" },
      { userId: "u1", type: "oauth", provider: "github", providerAccountId: "42" },
    ]);
  });
});

describe("marking an account's email verified from a provider", () => {
  const base = { userEmail: "ada@example.com", userEmailVerified: false, providerEmail: "Ada@Example.com" };
  it("only when the provider verified that same address and the account isn't verified yet", () => {
    expect(provesEmail({ ...base, providerEmailVerified: true })).toBe(true);
    expect(provesEmail({ ...base, providerEmailVerified: false })).toBe(false);
    expect(provesEmail({ ...base, providerEmailVerified: true, userEmailVerified: true })).toBe(false);
    expect(provesEmail({ ...base, providerEmailVerified: true, providerEmail: "other@example.com" })).toBe(
      false,
    );
    expect(provesEmail({ ...base, providerEmailVerified: true, userEmail: null })).toBe(false);
  });

  it("carries the sign-in check (Google's raw email_verified) to the link event once, and forgets old entries", () => {
    let now = 0;
    const memo = createVerificationMemo(() => now, 1000);
    memo.remember("google", "123", "ada@example.com", true);
    expect(memo.take("google", "123")).toMatchObject({ verified: true, email: "ada@example.com" });
    expect(memo.take("google", "123")).toBeUndefined();
    memo.remember("google", "456", "b@example.com", true);
    now = 2000;
    expect(memo.take("google", "456")).toBeUndefined();
  });
});
