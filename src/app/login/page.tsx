import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/account/login-form";
import { PageSkeleton } from "@/components/catalog/page-skeleton";
import { signInOptions } from "@/lib/auth/flags";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function LoginPage() {
  return (
    <Suspense fallback={<PageSkeleton label="Loading sign-in" />}>
      <LoginForm options={signInOptions()} />
    </Suspense>
  );
}
