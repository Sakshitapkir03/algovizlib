"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, type ReactNode } from "react";

import { syncAccountProgress } from "@/lib/progress/use-progress";

/**
 * The session, read in the browser (`/api/auth/session`), so every page stays statically generated. When a
 * verified user is signed in, progress switches to the account copy (merging this browser's copy first).
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
  }, [status, id, verified]);
  return null;
}
