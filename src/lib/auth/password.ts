import "server-only";

import { hash, verify, type Algorithm } from "@node-rs/argon2";

/**
 * Argon2id with OWASP's recommended minimum (19 MiB, 2 passes, 1 lane). The PHC string stores the parameters and
 * salt, so they can be raised later without breaking existing hashes. Passwords are never stored, logged, or
 * encrypted reversibly.
 */
export const ARGON2_OPTIONS = {
  // Algorithm.Argon2id (a const enum, which isolatedModules can't read).
  algorithm: 2 as Algorithm,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | undefined;

/**
 * Burn the same time as a real check when there's no hash to check (unknown email, or an account without a
 * password), so response times don't reveal which emails are registered.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummy ??= hashPassword("not-a-real-password-just-timing");
  await verifyPassword(await dummy, password);
  return false;
}
