"use client";

import { useSession } from "next-auth/react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { resendVerificationAction, type ActionState } from "@/lib/auth/actions";

/** Signed in with an unverified email: progress stays in this browser until the address is confirmed. */
export function VerifyBanner() {
  const { data } = useSession();
  const [result, setResult] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  if (!data?.user || data.user.verified) return null;
  return (
    <div className="border-b bg-muted/40">
      <div
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm sm:px-6"
        role="status"
      >
        <span>
          <span aria-hidden className="mr-1.5 text-primary">
            ◐
          </span>
          Verify your email to sync progress to your account. Until then it&apos;s saved in this browser.
        </span>
        {result ? (
          <span className={result.status === "error" ? "text-destructive" : "text-muted-foreground"}>
            {result.status !== "idle" && result.message}
          </span>
        ) : (
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0"
            disabled={pending}
            onClick={() => start(async () => setResult(await resendVerificationAction()))}
          >
            {pending ? "Sending…" : "Resend the link"}
          </Button>
        )}
      </div>
    </div>
  );
}
