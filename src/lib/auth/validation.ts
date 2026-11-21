import { z } from "zod";

/**
 * Form schemas shared by the forms (inline errors) and the server (the only check that counts). Error messages
 * are written for people; they never say whether an email is registered.
 */
export const PASSWORD_MIN = 10;
/** Argon2 accepts more, but nobody types this much; the cap bounds hashing work per request. */
export const PASSWORD_MAX = 128;

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .max(254, "That email address is too long.")
  .pipe(z.email("Enter a valid email address."))
  .transform((email) => email.toLowerCase());

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`);

export const registerSchema = z.object({
  name: z.string().trim().max(80, "Use at most 80 characters.").optional(),
  email: emailSchema,
  password: newPasswordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  // Any length: a wrong password is just wrong (and the check costs the same either way).
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(PASSWORD_MAX * 4),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "This link is invalid or has expired.");

export const resetPasswordSchema = z
  .object({ token: tokenSchema, password: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." });

export const changePasswordSchema = z
  .object({
    current: z
      .string()
      .min(1, "Enter your current password.")
      .max(PASSWORD_MAX * 4),
    password: newPasswordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." })
  .refine((v) => v.password !== v.current, {
    path: ["password"],
    message: "Choose a password you haven't used here.",
  });

/** Field → first error message, for inline display. */
export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    out[field] ??= issue.message;
  }
  return out;
}

/** What every auth form action returns. `ok` carries the message to show; errors stay on the form. */
export type FormState =
  | { status: "idle" }
  | { status: "error"; message?: string; fields?: FieldErrors }
  | { status: "ok"; message: string };

export const IDLE: FormState = { status: "idle" };
