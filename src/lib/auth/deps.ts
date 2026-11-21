import "server-only";

import { headers } from "next/headers";

import { db } from "@/lib/db";

import { emailPasswordEnabled } from "./flags";
import { mailerFromEnv } from "./mailer";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "./password";
import { createDbRateLimiter } from "./rate-limit";
import type { AuthDeps } from "./service";
import { createPrismaAuthStore } from "./store";

/** Where links in emails point: `APP_URL`, else Vercel's production domain, else localhost. */
export function appUrl(env: Readonly<Record<string, string | undefined>> = process.env): string {
  if (env.APP_URL) return env.APP_URL;
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/** The real dependencies of the auth flows (Postgres, Argon2id, Resend or the console). */
export function authDeps(): AuthDeps {
  const enabled = emailPasswordEnabled();
  const mailer = mailerFromEnv();
  // Never print verification or reset links to production logs: refuse instead.
  if (enabled && mailer.kind === "console" && process.env.NODE_ENV === "production")
    throw new Error("Email + password is enabled but RESEND_API_KEY / EMAIL_FROM aren't set.");
  const prisma = db();
  return {
    store: createPrismaAuthStore(prisma),
    mailer,
    limiter: createDbRateLimiter(prisma),
    passwords: { hash: hashPassword, verify: verifyPassword, dummy: verifyAgainstDummy },
    appUrl: appUrl(),
    enabled,
  };
}

/**
 * The client's IP for rate limits. Vercel sets `x-forwarded-for` (first entry: the client) and `x-real-ip`;
 * locally there's no proxy, so it falls back to "local".
 */
export function clientIp(h: Pick<Headers, "get">): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || "local";
}

export async function requestIp(): Promise<string> {
  return clientIp(await headers());
}
