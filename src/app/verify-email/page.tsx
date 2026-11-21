import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { VerifyForm } from "@/components/account/verify-form";
import { PageSkeleton } from "@/components/catalog/page-skeleton";
import { emailPasswordEnabled } from "@/lib/auth/flags";

export const metadata: Metadata = { title: "Verify your email", robots: { index: false } };

export default function VerifyEmailPage() {
  if (!emailPasswordEnabled()) notFound();
  return (
    <Suspense fallback={<PageSkeleton label="Loading" />}>
      <VerifyForm />
    </Suspense>
  );
}
