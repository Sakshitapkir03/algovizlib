"use client";

import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { confirmEmailAction, type ActionState } from "@/lib/auth/actions";

import { AuthCard, FormMessage, TextLink } from "./form";

/**
 * The link in the verification email opens this page; the token is used only when the person presses the button
 * (a POST), so email scanners that open links can't use it up.
 */
export function VerifyForm() {
  const token = useSearchParams().get("token") ?? "";
  const { status, update } = useSession();
  const [state, action, pending] = useActionState<ActionState, FormData>(confirmEmailAction, {
    status: "idle",
  });

  useEffect(() => {
    // Refresh the session so progress starts syncing (and the "verify your email" banner goes) right away.
    if (state.status === "ok" && status === "authenticated") void update();
  }, [state, status, update]);

  return (
    <AuthCard
      label="algovizlib --verify-email"
      title="Verify your email"
      description="Confirm this address so your progress syncs to your account."
      footer={
        state.status === "ok" ? (
          <p>
            {status === "authenticated" ? (
              <TextLink href="/me">See your progress</TextLink>
            ) : (
              <TextLink href="/login">Sign in</TextLink>
            )}
          </p>
        ) : null
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
        <form action={action}>
          <input type="hidden" name="token" value={token} />
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Verifying…" : "Confirm my email"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
