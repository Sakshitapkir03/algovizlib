import { createHash, randomBytes } from "node:crypto";

/**
 * Email verification and password reset tokens: 32 random bytes (base64url, 43 characters) in the link; only the
 * SHA-256 hash is stored, so a database leak doesn't leak usable links. Each is single-use and time-limited.
 */
export const TOKEN_TTL_MS = {
  VERIFY_EMAIL: 24 * 60 * 60 * 1000,
  RESET_PASSWORD: 30 * 60 * 1000,
} as const;

export type TokenPurpose = keyof typeof TOKEN_TTL_MS;

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
