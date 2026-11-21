import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ForgotForm } from "@/components/account/forgot-form";
import { emailPasswordEnabled } from "@/lib/auth/flags";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPasswordPage() {
  if (!emailPasswordEnabled()) notFound();
  return <ForgotForm />;
}
