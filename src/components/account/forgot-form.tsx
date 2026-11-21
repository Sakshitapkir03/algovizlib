"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { forgotPasswordAction, type ActionState } from "@/lib/auth/actions";
import { forgotPasswordSchema } from "@/lib/auth/validation";

import { AuthCard, Field, FormMessage, TextLink, useFieldValidation } from "./form";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(forgotPasswordAction, {
    status: "idle",
  });
  const validation = useFieldValidation(
    forgotPasswordSchema,
    state.status === "error" ? state.fields : undefined,
  );
  return (
    <AuthCard
      label="algovizlib --forgot-password"
      title="Reset your password"
      description="Enter your account's email and we'll send a link to choose a new password."
      footer={
        <p>
          Remembered it? <TextLink href="/login">Sign in</TextLink>
        </p>
      }
    >
      <FormMessage state={state} />
      {state.status !== "ok" && (
        <form
          noValidate
          className="space-y-4"
          onBlur={validation.onBlur}
          onChange={validation.onChange}
          onSubmit={validation.submitWith(action)}
        >
          <Field
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            error={validation.errors.email}
          />
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
