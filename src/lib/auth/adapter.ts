import type { Adapter } from "next-auth/adapters";

/**
 * The Prisma adapter, with two changes: emails are stored lowercased (so GitHub's "Me@Example.com" and a registered
 * "me@example.com" are one user), and a linked provider account keeps only which provider and which account it is,
 * never the provider's access, refresh, or ID tokens (nothing calls GitHub or Google after sign-in; see /privacy).
 */
export function storageAdapter(base: Adapter): Adapter {
  return {
    ...base,
    getUserByEmail: (email) => base.getUserByEmail!(email.toLowerCase()),
    createUser: (user) => base.createUser!({ ...user, email: user.email.toLowerCase() }),
    linkAccount: (account) =>
      base.linkAccount!({
        userId: account.userId,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      }),
  };
}
