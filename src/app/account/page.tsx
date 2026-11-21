import type { Metadata } from "next";

import { AccountView } from "@/components/account/account-view";
import { signInOptions } from "@/lib/auth/flags";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

/** Static shell; the session is read in the browser, and every change goes through a server action that checks it. */
export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <AccountView options={signInOptions()} />
    </div>
  );
}
