"use server";

import { AuthError } from "next-auth";

import { auth, signIn, signOut } from "@/auth";

import { authDeps, requestIp } from "./deps";
import { emailPasswordEnabled } from "./flags";
import {
  changePassword,
  confirmEmail,
  MESSAGES,
  register,
  requestPasswordReset,
  resendVerification,
  resetPassword,
} from "./service";
import type { FormState } from "./validation";

/**
 * Server actions behind the auth forms. Next checks every action's Origin against the host (CSRF), each one
 * re-reads the session itself, and none trusts an id from the client. Successful sign-in and sign-out answer with
 * a URL the form opens with a full page load, so the header's session refreshes.
 */
export type ActionState = FormState & { redirectTo?: string };

const fields = (form: FormData, ...names: string[]) =>
  Object.fromEntries(names.map((n) => [n, String(form.get(n) ?? "")]));

/** Only same-site paths ("/dsa/…"), never "//evil.example" or an absolute URL. */
export async function safeCallback(value: unknown): Promise<string> {
  return typeof value === "string" && /^\/(?!\/|\\)/.test(value) ? value : "/";
}

export async function registerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return register(authDeps(), fields(form, "name", "email", "password"), await requestIp());
}

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!emailPasswordEnabled()) return { status: "error", message: MESSAGES.disabled };
  const redirectTo = await safeCallback(form.get("callbackUrl"));
  try {
    const url = await signIn("credentials", {
      ...fields(form, "email", "password"),
      redirect: false,
      redirectTo,
    });
    // A failed check comes back as a redirect to the error page rather than a throw in some versions.
    if (typeof url === "string" && /[?&]error=/.test(url)) {
      return url.includes("rate_limited")
        ? { status: "error", message: MESSAGES.rateLimited }
        : { status: "error", message: MESSAGES.invalidLogin };
    }
    return { status: "ok", message: "Signed in.", redirectTo };
  } catch (error) {
    if (error instanceof AuthError) {
      const code = (error as AuthError & { code?: string }).code;
      return {
        status: "error",
        message: code === "rate_limited" ? MESSAGES.rateLimited : MESSAGES.invalidLogin,
      };
    }
    throw error;
  }
}

export async function forgotPasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return requestPasswordReset(authDeps(), fields(form, "email"), await requestIp());
}

export async function resetPasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return resetPassword(authDeps(), fields(form, "token", "password", "confirm"), await requestIp());
}

export async function confirmEmailAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return confirmEmail(authDeps(), String(form.get("token") ?? ""), await requestIp());
}

export async function resendVerificationAction(): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { status: "error", message: "Sign in first." };
  return resendVerification(authDeps(), session.user.id);
}

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { status: "error", message: "Sign in first." };
  const result = await changePassword(
    authDeps(),
    session.user.id,
    fields(form, "current", "password", "confirm"),
  );
  if (result.status !== "ok") return result;
  // Every session is signed out (sessionVersion moved on); clear this one's cookie too.
  await signOut({ redirect: false });
  return { ...result, redirectTo: "/login?notice=password-changed" };
}
