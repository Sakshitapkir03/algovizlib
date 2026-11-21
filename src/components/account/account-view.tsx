"use client";

import { CircleCheck, CircleDashed } from "lucide-react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";

import { PageSkeleton } from "@/components/catalog/page-skeleton";
import { Button } from "@/components/ui/button";
import { changePasswordAction, type ActionState } from "@/lib/auth/actions";
import type { SignInOptions } from "@/lib/auth/flags";
import { changePasswordSchema } from "@/lib/auth/validation";

import { Field, FormMessage, PasswordStrength, useFieldValidation } from "./form";

const PROVIDERS = [
  { id: "github", name: "GitHub" },
  { id: "google", name: "Google" },
] as const;

/** /account: who you're signed in as, how you can sign in (and linking another provider), password change. */
export function AccountView({ options }: { options: SignInOptions }) {
  const { data, status } = useSession();
  if (status === "loading") return <PageSkeleton label="Loading your account" />;
  if (!data?.user)
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
        <p className="text-muted-foreground">
          You&apos;re not signed in.{" "}
          <Link href="/login?callbackUrl=%2Faccount" className="text-primary underline underline-offset-4">
            Sign in
          </Link>{" "}
          to manage your account.
        </p>
      </div>
    );
  const user = data.user;
  return (
    <div className="space-y-12">
      <header>
        <p className="font-mono text-xs text-muted-foreground">
          <span className="text-primary">$</span> algovizlib --account
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Account</h1>
        <p className="mt-2 text-muted-foreground">
          {user.name ? `${user.name} · ` : ""}
          <span className="font-mono text-sm">{user.email}</span>
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm">
          {user.verified ? (
            <>
              <CircleCheck aria-hidden className="size-4 text-primary" /> Email verified: progress syncs to
              this account.
            </>
          ) : (
            <>
              <CircleDashed aria-hidden className="size-4 text-muted-foreground" /> Email not verified yet:
              progress stays in this browser.
            </>
          )}
        </p>
      </header>

      <section aria-labelledby="signin-methods">
        <h2 id="signin-methods" className="mb-3 font-mono text-xs text-muted-foreground">
          sign-in methods
        </h2>
        <ul className="divide-y rounded-lg border">
          {user.hasPassword && (
            <li className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span>Email and password</span>
              <span className="font-mono text-xs text-muted-foreground">● linked</span>
            </li>
          )}
          {PROVIDERS.map(({ id, name }) => {
            const linked = user.providers.includes(id);
            if (!linked && !options[id]) return null;
            return (
              <li key={id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span>{name}</span>
                {linked ? (
                  <span className="font-mono text-xs text-muted-foreground">● linked</span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void signIn(id, { redirectTo: "/account" })}
                  >
                    Link {name}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Linking signs you in with that provider once and connects it to this account.
        </p>
      </section>

      {user.hasPassword && options.emailPassword && <ChangePassword email={user.email ?? ""} />}

      <section aria-labelledby="session-heading">
        <h2 id="session-heading" className="mb-3 font-mono text-xs text-muted-foreground">
          session
        </h2>
        <Button variant="outline" onClick={() => void signOut({ redirectTo: "/" })}>
          Sign out
        </Button>
      </section>
    </div>
  );
}

function ChangePassword({ email }: { email: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(changePasswordAction, {
    status: "idle",
  });
  const validation = useFieldValidation(
    changePasswordSchema,
    state.status === "error" ? state.fields : undefined,
  );
  const [password, setPassword] = useState("");
  useEffect(() => {
    if (state.status === "ok" && state.redirectTo) window.location.assign(state.redirectTo);
  }, [state]);
  return (
    <section aria-labelledby="password-heading" className="max-w-sm">
      <h2 id="password-heading" className="mb-1 font-mono text-xs text-muted-foreground">
        change password
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">This signs you out everywhere, including here.</p>
      <form
        noValidate
        className="space-y-4"
        onBlur={validation.onBlur}
        onChange={validation.onChange}
        onSubmit={validation.submitWith(action)}
      >
        <FormMessage state={state} />
        <Field
          name="current"
          label="Current password"
          type="password"
          autoComplete="current-password"
          error={validation.errors.current}
        />
        <Field
          name="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={validation.errors.password}
          hint={<PasswordStrength password={password} context={[email.split("@")[0] ?? ""]} />}
        />
        <Field
          name="confirm"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={validation.errors.confirm}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Change password"}
        </Button>
      </form>
    </section>
  );
}
