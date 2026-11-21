"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import Link from "next/link";
import { startTransition, useId, useState, type ReactNode } from "react";
import type { z } from "zod";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordStrength } from "@/lib/auth/strength";
import { fieldErrors, type FieldErrors, type FormState } from "@/lib/auth/validation";
import { cn } from "@/lib/utils";

/** The centered card every auth page uses: a mono label, a heading, the form, and links under it. */
export function AuthCard({
  label,
  title,
  description,
  children,
  footer,
}: {
  label: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-12 sm:py-16">
      <p className="font-mono text-xs text-muted-foreground">
        <span className="text-primary">$</span> {label}
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-6 space-y-4">{children}</div>
      {footer && <div className="mt-6 space-y-2 text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="rounded-sm text-primary underline underline-offset-4">
      {children}
    </Link>
  );
}

/** A labeled input with its inline error (announced, and tied to the input with aria-describedby). */
export function Field({
  name,
  label,
  error,
  hint,
  className,
  ...props
}: {
  name: string;
  label: string;
  error?: string;
  hint?: ReactNode;
} & Omit<React.ComponentProps<"input">, "name">) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="h-9"
        {...props}
      />
      {hint && (
        <div id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </div>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-xs text-destructive">
          <CircleAlert aria-hidden className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

/** The form-level result: an error (rose, with a glyph) or a success message, in a polite live region. */
export function FormMessage({ state }: { state: FormState }) {
  const message = state.status === "idle" ? undefined : state.message;
  return (
    <div aria-live="polite" role="status">
      {message && (
        <p
          className={cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
            state.status === "error" ? "border-destructive/40 text-destructive" : "border-primary/40",
          )}
        >
          {state.status === "error" ? (
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          ) : (
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          )}
          <span>{message}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Inline validation with the same Zod schema the server uses: a field shows its error once it's been left (or on
 * submit), and clears as soon as it's fixed. Server-side field errors are merged in.
 */
export function useFieldValidation<S extends z.ZodType>(schema: S, server?: FieldErrors) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  // The server's errors hide once the person edits the form after them.
  const [editedAfter, setEditedAfter] = useState<FieldErrors | undefined>(undefined);

  const check = (form: HTMLFormElement, only?: Set<string>) => {
    const values = Object.fromEntries(new FormData(form).entries());
    const parsed = schema.safeParse(values);
    const all = parsed.success ? {} : fieldErrors(parsed.error);
    const visible: FieldErrors = {};
    for (const [k, v] of Object.entries(all)) if (!only || only.has(k)) visible[k] = v;
    setErrors(visible);
    return parsed.success;
  };

  return {
    errors: { ...(server !== editedAfter ? server : undefined), ...errors },
    /** On blur: mark the field touched and check the touched fields. */
    onBlur: (e: React.FocusEvent<HTMLFormElement>) => {
      const target: EventTarget = e.target;
      if (!(target instanceof HTMLInputElement) || !target.name) return;
      const name = target.name;
      const next = new Set(touched).add(name);
      setTouched(next);
      check(e.currentTarget, next);
    },
    /** On input: re-check touched fields so a fixed error disappears right away. */
    onChange: (e: React.FormEvent<HTMLFormElement>) => {
      setEditedAfter(server);
      if (touched.size > 0) check(e.currentTarget, touched);
    },
    /**
     * On submit: check everything, then run the action in a transition. Not through `<form action>`, which resets
     * the fields afterwards: a wrong password shouldn't also clear the email.
     */
    submitWith: (action: (form: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      setTouched(new Set(Array.from(new FormData(form).keys())));
      if (!check(form)) {
        form.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
        return;
      }
      const data = new FormData(form);
      startTransition(() => action(data));
    },
  };
}

/** A bar meter plus the hint; the word and the bar together, never color alone. */
export function PasswordStrength({ password, context }: { password: string; context?: string[] }) {
  if (!password) return <span>At least 10 characters. A few unrelated words work well.</span>;
  const s = passwordStrength(password, context);
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="flex gap-0.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1 w-5 rounded-full", i <= s.score ? "bg-primary" : "bg-muted")} />
        ))}
      </span>
      <span>
        <span className="font-medium text-foreground">{s.label}</span>: {s.hint}
      </span>
    </span>
  );
}
