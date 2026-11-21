import type { PrismaClient } from "@/generated/prisma/client";

import type { TokenPurpose } from "./tokens";

/**
 * The data the auth flows need, as an interface: Prisma in the app (`createPrismaAuthStore`), an in-memory copy in
 * tests. Emails are stored lowercased.
 */
export type StoredUser = {
  id: string;
  email: string | null;
  name: string | null;
  passwordHash: string | null;
  emailVerified: Date | null;
  sessionVersion: number;
};

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  emailVerified: Date | null;
  sessionVersion: number;
  hasPassword: boolean;
  /** Linked OAuth providers ("github", "google"). */
  providers: string[];
};

export interface AuthStore {
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  sessionUser(id: string): Promise<SessionUser | null>;
  createUser(data: { email: string; name: string | null; passwordHash: string }): Promise<{ id: string }>;
  createToken(data: {
    userId: string;
    purpose: TokenPurpose;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  /** Delete the token and return its owner, in one step so it can't be used twice; null if there's none. */
  consumeToken(tokenHash: string, purpose: TokenPurpose): Promise<{ userId: string; expiresAt: Date } | null>;
  deleteTokens(userId: string, purpose: TokenPurpose): Promise<void>;
  /** Sets `emailVerified` if it isn't set yet. */
  markEmailVerified(userId: string, at: Date): Promise<void>;
  /** New password hash; bumps `sessionVersion` so every existing session is signed out. */
  setPassword(userId: string, passwordHash: string, options?: { verifyEmailAt?: Date }): Promise<void>;
  findAccount(provider: string, providerAccountId: string): Promise<{ userId: string } | null>;
}

const userFields = {
  id: true,
  email: true,
  name: true,
  passwordHash: true,
  emailVerified: true,
  sessionVersion: true,
} as const;

export function createPrismaAuthStore(prisma: PrismaClient): AuthStore {
  return {
    findUserByEmail: (email) => prisma.user.findUnique({ where: { email }, select: userFields }),
    findUserById: (id) => prisma.user.findUnique({ where: { id }, select: userFields }),
    async sessionUser(id) {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { ...userFields, image: true, accounts: { select: { provider: true } } },
      });
      if (!user) return null;
      const { passwordHash, accounts, ...rest } = user;
      return {
        ...rest,
        hasPassword: passwordHash !== null,
        providers: accounts.map((a) => a.provider).sort(),
      };
    },
    createUser: (data) => prisma.user.create({ data, select: { id: true } }),
    async createToken(data) {
      await prisma.authToken.create({ data });
    },
    async consumeToken(tokenHash, purpose) {
      const rows = await prisma.$queryRaw<{ userId: string; expiresAt: Date }[]>`
        DELETE FROM "AuthToken" WHERE "tokenHash" = ${tokenHash} AND "purpose" = ${purpose}::"AuthTokenPurpose"
        RETURNING "userId", "expiresAt"`;
      return rows[0] ?? null;
    },
    async deleteTokens(userId, purpose) {
      await prisma.authToken.deleteMany({ where: { userId, purpose } });
    },
    async markEmailVerified(userId, at) {
      await prisma.user.updateMany({
        where: { id: userId, emailVerified: null },
        data: { emailVerified: at },
      });
    },
    async setPassword(userId, passwordHash, options = {}) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { passwordHash, sessionVersion: { increment: 1 } },
        });
        if (options.verifyEmailAt)
          await tx.user.updateMany({
            where: { id: userId, emailVerified: null },
            data: { emailVerified: options.verifyEmailAt },
          });
      });
    },
    findAccount: (provider, providerAccountId) =>
      prisma.account.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        select: { userId: true },
      }),
  };
}
