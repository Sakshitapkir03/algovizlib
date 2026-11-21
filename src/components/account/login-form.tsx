"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { loginAction, type ActionState } from "@/lib/auth/actions";
import type { SignInOptions } from "@/lib/auth/flags";
import { DEFAULT_SIGN_IN_ERROR, SIGN_IN_ERRORS } from "@/lib/auth/linking";
import { loginSchema } from "@/lib/auth/validation";

import { AuthCard, Field, FormMessage, TextLink, useFieldValidation } from "./form";
import { OAuthButtons, OrDivider } from "./oauth-buttons";

const NOTICES: Record<string, string> = {
  "password-changed": "Password changed. Sign in again with your new password.",
  "password-reset": "Your password has been reset. Sign in with your new password.",
};

/** Only same-site paths, like the server's check. */
export function callbackFrom(params: URLSearchParams): string {
  const value = params.get("callbackUrl");
  return value && /^\/(?!\/|\\)/.test(value) ? value : "/";
}

export function LoginForm({ options }: { options: SignInOptions }) {
  const params = useSearchParams();
  const callbackUrl = callbackFrom(params);
  const error = params.get("error");
  const notice = params.get("notice");
  const [state, action, pending] = useActionState<ActionState, FormData>(loginAction, { status: "idle" });
  const validation = useFieldValidation(loginSchema, state.status === "error" ? state.fields : undefined);

  useEffect(() => {
    // A full load, so the header (and progress sync) pick up the new session.
    if (state.status === "ok" && state.redirectTo) window.location.assign(state.redirectTo);
  }, [state]);

  const banner: ActionState =
    state.status !== "idle"
      ? state
      : error
        ? { status: "error", message: SIGN_IN_ERRORS[error] ?? DEFAULT_SIGN_IN_ERROR }
        : notice && NOTICES[notice]
          ? { status: "ok", message: NOTICES[notice] }
          : state;

  return (
    <AuthCard
      label="algovizlib --sign-in"
      title="Sign in"
      description="Sync your progress and pick up videos where you left off, on any device. Signing in is optional."
      footer={
        options.emailPassword && (
          <p>
            New here? <TextLink href="/register">Create an account</TextLink>
          </p>
        )
      }
    >
      <FormMessage state={banner} />
      <OAuthButtons options={options} callbackUrl={callbackUrl} />
      {options.emailPassword && (
        <>
          {(options.github || options.google) && <OrDivider />}
          <form
            noValidate
            className="space-y-4"
            onBlur={validation.onBlur}
            onChange={validation.onChange}
            onSubmit={validation.submitWith(action)}
          >
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <Field
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              error={validation.errors.email}
            />
            <Field
              name="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              error={validation.errors.password}
            />
            <div className="flex items-center justify-between gap-4">
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? "Signing in…" : "Sign in"}
              </Button>
              <TextLink href="/forgot-password">Forgot password?</TextLink>
            </div>
          </form>
        </>
      )}
      {!options.emailPassword && !options.github && !options.google && (
        <p className="text-sm text-muted-foreground">Sign-in isn&apos;t set up on this site yet.</p>
      )}
    </AuthCard>
  );
}
