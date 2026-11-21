import type { Email, Mailer } from "@/lib/auth/mailer";
import { createMemoryRateLimiter } from "@/lib/auth/rate-limit";
import type { AuthDeps, PasswordHasher } from "@/lib/auth/service";
import type { AuthStore, StoredUser } from "@/lib/auth/store";
import type { TokenPurpose } from "@/lib/auth/tokens";

/** An in-memory AuthStore with the same contract as the Prisma one (tokens are single-use). */
export function memoryAuthStore() {
  const users = new Map<string, StoredUser & { image: string | null }>();
  const tokens = new Map<string, { userId: string; purpose: TokenPurpose; expiresAt: Date }>();
  const accounts = new Map<string, string>();
  let next = 1;
  const store: AuthStore = {
    async findUserByEmail(email) {
      return [...users.values()].find((u) => u.email === email) ?? null;
    },
    async findUserById(id) {
      return users.get(id) ?? null;
    },
    async sessionUser(id) {
      const u = users.get(id);
      if (!u) return null;
      const providers = [...accounts.entries()].filter(([, uid]) => uid === id).map(([k]) => k.split(":")[0]);
      const { passwordHash, ...rest } = u;
      return { ...rest, hasPassword: passwordHash !== null, providers };
    },
    async createUser(data) {
      const id = `u${next++}`;
      users.set(id, { id, ...data, emailVerified: null, sessionVersion: 0, image: null });
      return { id };
    },
    async createToken({ userId, purpose, tokenHash, expiresAt }) {
      tokens.set(tokenHash, { userId, purpose, expiresAt });
    },
    async consumeToken(tokenHash, purpose) {
      const t = tokens.get(tokenHash);
      if (!t || t.purpose !== purpose) return null;
      tokens.delete(tokenHash);
      return { userId: t.userId, expiresAt: t.expiresAt };
    },
    async deleteTokens(userId, purpose) {
      for (const [hash, t] of tokens) if (t.userId === userId && t.purpose === purpose) tokens.delete(hash);
    },
    async markEmailVerified(userId, at) {
      const u = users.get(userId);
      if (u && !u.emailVerified) u.emailVerified = at;
    },
    async setPassword(userId, passwordHash, options = {}) {
      const u = users.get(userId)!;
      u.passwordHash = passwordHash;
      u.sessionVersion += 1;
      if (options.verifyEmailAt && !u.emailVerified) u.emailVerified = options.verifyEmailAt;
    },
    async findAccount(provider, providerAccountId) {
      const userId = accounts.get(`${provider}:${providerAccountId}`);
      return userId ? { userId } : null;
    },
  };
  return { store, users, tokens, accounts };
}

/** Records sent emails instead of sending them. */
export function memoryMailer() {
  const sent: Email[] = [];
  const mailer: Mailer = { kind: "console", send: async (e) => void sent.push(e) };
  return { mailer, sent };
}

/** Fast and deterministic, so service tests don't spend Argon2's time; Argon2 itself is tested separately. */
export function fakeHasher(): PasswordHasher & { dummyCalls: number } {
  const hasher = {
    dummyCalls: 0,
    hash: async (p: string) => `hashed:${p}`,
    verify: async (h: string, p: string) => h === `hashed:${p}`,
    dummy: async () => {
      hasher.dummyCalls++;
      return false as const;
    },
  };
  return hasher;
}

export function authFixture(overrides: Partial<AuthDeps> = {}) {
  const { store, users, tokens } = memoryAuthStore();
  const { mailer, sent } = memoryMailer();
  const passwords = fakeHasher();
  let clock = Date.UTC(2026, 10, 20, 12);
  const deps: AuthDeps = {
    store,
    mailer,
    limiter: createMemoryRateLimiter(() => clock),
    passwords,
    appUrl: "https://algoviz.test",
    enabled: true,
    now: () => clock,
    ...overrides,
  };
  return {
    deps,
    users,
    tokens,
    sent,
    passwords,
    advance: (ms: number) => void (clock += ms),
    /** The token in the newest email's link to `path`. */
    tokenFrom: (path: string) => {
      const text = sent.at(-1)?.text ?? "";
      return new RegExp(`${path}\\?token=([A-Za-z0-9_-]{43})`).exec(text)?.[1];
    },
  };
}
