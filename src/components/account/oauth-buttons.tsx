"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { SignInOptions } from "@/lib/auth/flags";

const LABEL = { github: "GitHub", google: "Google" } as const;

/** "Continue with GitHub / Google" (only the providers that are configured). */
export function OAuthButtons({
  options,
  callbackUrl,
  verb = "Continue with",
}: {
  options: SignInOptions;
  callbackUrl: string;
  verb?: string;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const providers = (["github", "google"] as const).filter((p) => options[p]);
  if (providers.length === 0) return null;
  return (
    <div className="grid gap-2">
      {providers.map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          size="lg"
          disabled={pending !== null}
          onClick={() => {
            setPending(provider);
            void signIn(provider, { redirectTo: callbackUrl });
          }}
        >
          {pending === provider ? `Opening ${LABEL[provider]}…` : `${verb} ${LABEL[provider]}`}
        </Button>
      ))}
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
