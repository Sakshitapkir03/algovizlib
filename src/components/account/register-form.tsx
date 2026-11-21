"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { registerAction, type ActionState } from "@/lib/auth/actions";
import type { SignInOptions } from "@/lib/auth/flags";
import { registerSchema } from "@/lib/auth/validation";

import { AuthCard, Field, FormMessage, PasswordStrength, TextLink, useFieldValidation } from "./form";
import { OAuthButtons, OrDivider } from "./oauth-buttons";

export function RegisterForm({ options }: { options: SignInOptions }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(registerAction, { status: "idle" });
  const validation = useFieldValidation(registerSchema, state.status === "error" ? state.fields : undefined);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  return (
    <AuthCard
      label="algovizlib --register"
      title="Create an account"
      description="Free. Your progress and video positions sync across devices once your email is verified."
      footer={
        <p>
          Already have an account? <TextLink href="/login">Sign in</TextLink>
        </p>
      }
    >
      <FormMessage state={state} />
      {state.status !== "ok" && (
        <>
          <OAuthButtons options={options} callbackUrl="/" verb="Sign up with" />
          {(options.github || options.google) && <OrDivider />}
          <form
            noValidate
            className="space-y-4"
            onBlur={validation.onBlur}
            onChange={validation.onChange}
            onSubmit={validation.submitWith(action)}
          >
            <Field
              name="name"
              label="Name (optional)"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={validation.errors.name}
            />
            <Field
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={validation.errors.email}
            />
            <Field
              name="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={validation.errors.password}
              hint={<PasswordStrength password={password} context={[email.split("@")[0] ?? "", name]} />}
            />
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </>
      )}
    </AuthCard>
  );
}
