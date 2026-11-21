import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RegisterForm } from "@/components/account/register-form";
import { emailPasswordEnabled, signInOptions } from "@/lib/auth/flags";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default function RegisterPage() {
  if (!emailPasswordEnabled()) notFound();
  return <RegisterForm options={signInOptions()} />;
}
