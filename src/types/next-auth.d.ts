import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** The email is verified (always, for GitHub and Google sign-ins). Progress syncs only when true. */
      verified: boolean;
      hasPassword: boolean;
      /** Linked OAuth providers ("github", "google"). */
      providers: string[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** The user's `sessionVersion` when this session started; a mismatch signs it out. */
    sv?: number;
    emailVerified?: boolean;
    hasPassword?: boolean;
    providers?: string[];
  }
}
