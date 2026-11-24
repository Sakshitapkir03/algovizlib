"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, type ReactNode } from "react";

import { syncAccountProgress } from "@/lib/progress/use-progress";
import { checkRecorder } from "@/lib/quickcheck/results";

/**
 * The session, read in the browser (`/api/auth/session`), so every page stays statically generated. When a
 * verified user is signed in, progress switches to the account copy (merging this browser's copy first), and quick
 * check answers kept in this browser are sent to the account.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ProgressSync />
      {children}
    </SessionProvider>
  );
}

function ProgressSync() {
  const { data, status } = useSession();
  const id = data?.user?.id;
  const verified = data?.user?.verified === true;
  useEffect(() => {
    if (status === "loading") return;
    void syncAccountProgress(id ? { id, emailVerified: verified } : null);
    // Quick check answers follow the same rule: a verified account gets this browser's answers (all kept).
    void checkRecorder.setAccount(Boolean(id) && verified);
  }, [status, id, verified]);
  return null;
}
