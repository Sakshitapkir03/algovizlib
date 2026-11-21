import "server-only";

import { PrismaAdapter } from "@auth/prisma-adapter";
import { cookies } from "next/headers";
import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import { decode } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { storageAdapter } from "@/lib/auth/adapter";
import { authDeps, clientIp } from "@/lib/auth/deps";
import { emailPasswordEnabled, oauthProviders } from "@/lib/auth/flags";
import {
  createVerificationMemo,
  decideOAuthSignIn,
  githubEmailVerified,
  googleEmailVerified,
  provesEmail,
} from "@/lib/auth/linking";
import { authorizeCredentials } from "@/lib/auth/service";
import { createPrismaAuthStore } from "@/lib/auth/store";
import { db } from "@/lib/db";

/**
 * Auth.js: GitHub and Google (when their credentials are set), plus email + password behind
 * `AUTH_EMAIL_PASSWORD_ENABLED`. Sessions are JWTs in an httpOnly cookie (the credentials provider requires
 * them); every read re-checks the user's `sessionVersion`, so changing or resetting a password signs out every
 * other session. See "Accounts" in CLAUDE.md.
 */
class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}

const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

const verificationMemo = createVerificationMemo();

/** The signed-in user behind the request's session cookie: an id, "invalid" if it was signed out, or null. */
async function sessionFromCookie(): Promise<string | "invalid" | null> {
  const jar = await cookies();
  for (const name of SESSION_COOKIES) {
    const value = jar.get(name)?.value;
    if (!value) continue;
    try {
      const token = await decode({ token: value, secret: process.env.AUTH_SECRET!, salt: name });
      if (!token?.sub) return null;
      const user = await createPrismaAuthStore(db()).findUserById(token.sub);
      return user && user.sessionVersion === token.sv ? user.id : "invalid";
    } catch {
      return null; // Auth.js treats an unreadable cookie as no session too.
    }
  }
  return null;
}

async function providerEmailVerified(
  provider: string,
  accessToken: string | undefined,
  profile: unknown,
  email: string,
): Promise<boolean> {
  if (provider === "google") return googleEmailVerified(profile);
  if (provider === "github" && accessToken) return githubEmailVerified(fetch, accessToken, email);
  return false;
}

function config(): NextAuthConfig {
  const oauth = oauthProviders();
  const providers: NextAuthConfig["providers"] = [];
  if (oauth.github) providers.push(GitHub({ allowDangerousEmailAccountLinking: true }));
  if (oauth.google) providers.push(Google({ allowDangerousEmailAccountLinking: true }));
  if (emailPasswordEnabled())
    providers.push(
      Credentials({
        credentials: { email: {}, password: {} },
        async authorize(credentials, request) {
          const result = await authorizeCredentials(authDeps(), credentials, clientIp(request.headers));
          if (result.ok) return result.user;
          if (result.reason === "rate-limited") throw new RateLimited();
          return null; // "Invalid email or password", whatever the reason.
        },
      }),
    );

  const prisma = db();
  const store = createPrismaAuthStore(prisma);

  return {
    adapter: storageAdapter(PrismaAdapter(prisma)),
    session: { strategy: "jwt" },
    providers,
    pages: { signIn: "/login", error: "/login" },
    logger: {
      // A wrong password isn't a server error; everything else is logged as usual (never with credentials).
      error(error) {
        if (error.name === "CredentialsSignin" || error.name === "RateLimited") return;
        console.error(error);
      },
    },
    callbacks: {
      async signIn({ user, account, profile }) {
        if (!account || account.type === "credentials") return true;
        const email = (profile?.email ?? user.email)?.toLowerCase() ?? null;
        const linked = await store.findAccount(account.provider, account.providerAccountId);
        const session = linked ? null : await sessionFromCookie();
        // Here `profile` is the provider's raw profile (Google's `email_verified` is only available here).
        const verified = email
          ? await providerEmailVerified(account.provider, account.access_token, profile, email)
          : false;
        if (linked) {
          // Returning: fix an account whose email this provider proves but that was never marked verified.
          const owner = await store.findUserById(linked.userId);
          if (
            owner &&
            provesEmail({
              userEmail: owner.email,
              userEmailVerified: owner.emailVerified !== null,
              providerEmail: email,
              providerEmailVerified: verified,
            })
          )
            await store.markEmailVerified(owner.id, new Date());
        } else verificationMemo.remember(account.provider, account.providerAccountId, email, verified);
        const needsEmailCheck = !linked && session === null;
        const existing = needsEmailCheck && email ? await store.findUserByEmail(email) : null;
        const decision = decideOAuthSignIn({
          linkedUserId: linked?.userId ?? null,
          session,
          providerEmailVerified: verified,
          existingUser: existing && { id: existing.id, emailVerified: existing.emailVerified !== null },
        });
        return decision.allow ? true : `/login?error=${decision.error}`;
      },
      async jwt({ token, user }) {
        const id = user?.id ?? token.sub;
        if (!id) return null;
        const row = await store.sessionUser(id);
        if (!row) return null;
        if (user) token.sv = row.sessionVersion;
        else if (token.sv !== row.sessionVersion) return null; // password changed or reset: signed out
        token.sub = row.id;
        token.name = row.name;
        token.email = row.email;
        token.picture = row.image;
        token.emailVerified = row.emailVerified !== null;
        token.hasPassword = row.hasPassword;
        token.providers = row.providers;
        return token;
      },
      session({ session, token }) {
        session.user.id = token.sub!;
        session.user.verified = token.emailVerified === true;
        session.user.hasPassword = token.hasPassword === true;
        session.user.providers = token.providers ?? [];
        return session;
      },
    },
    events: {
      // A new link: mark the email verified if the provider proved it (checked in `signIn`, this same request).
      async linkAccount({ user, account }) {
        const checked = verificationMemo.take(account.provider, account.providerAccountId);
        if (!user.id || !checked) return;
        if (
          provesEmail({
            userEmail: user.email ?? null,
            userEmailVerified: "emailVerified" in user && Boolean(user.emailVerified),
            providerEmail: checked.email,
            providerEmailVerified: checked.verified,
          })
        )
          await store.markEmailVerified(user.id, new Date());
      },
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(config);
