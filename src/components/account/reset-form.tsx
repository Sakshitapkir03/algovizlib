"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { resetPasswordAction, type ActionState } from "@/lib/auth/actions";
import { resetPasswordSchema } from "@/lib/auth/validation";

import { AuthCard, Field, FormMessage, PasswordStrength, TextLink, useFieldValidation } from "./form";

export function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, action, pending] = useActionState<ActionState, FormData>(resetPasswordAction, {
    status: "idle",
  });
  const validation = useFieldValidation(
    resetPasswordSchema,
    state.status === "error" ? state.fields : undefined,
  );
  const [password, setPassword] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (state.status === "ok") router.replace("/login?notice=password-reset");
  }, [state, router]);

  return (
    <AuthCard
      label="algovizlib --reset-password"
      title="Choose a new password"
      description="This signs you out everywhere else. The link works once."
      footer={
        <p>
          Link expired? <TextLink href="/forgot-password">Request a new one</TextLink>
        </p>
      }
    >
      <FormMessage
        state={
          state.status === "idle" && !token
            ? { status: "error", message: "This link is invalid or has expired. Request a new one." }
            : state
        }
      />
      {token && state.status !== "ok" && (
        <form
          noValidate
          className="space-y-4"
          onBlur={validation.onBlur}
          onChange={validation.onChange}
          onSubmit={validation.submitWith(action)}
        >
          <input type="hidden" name="token" value={token} />
          <Field
            name="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={validation.errors.password}
            hint={<PasswordStrength password={password} />}
          />
          <Field
            name="confirm"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            error={validation.errors.confirm}
          />
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Set new password"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
