import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ResetForm } from "@/components/account/reset-form";
import { PageSkeleton } from "@/components/catalog/page-skeleton";
import { emailPasswordEnabled } from "@/lib/auth/flags";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetPasswordPage() {
  if (!emailPasswordEnabled()) notFound();
  return (
    <Suspense fallback={<PageSkeleton label="Loading" />}>
      <ResetForm />
    </Suspense>
  );
}
