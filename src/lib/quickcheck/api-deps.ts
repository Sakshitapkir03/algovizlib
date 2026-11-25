import "server-only";

import { auth } from "@/auth";
import { createDbRateLimiter } from "@/lib/auth/rate-limit";
import { getProgressKeys } from "@/lib/catalog/repository";
import { db } from "@/lib/db";

import { createPrismaCheckResultStore, type ChecksApiDeps } from "./server";

let problemKeys: Set<string> | undefined;

/** The real dependencies of `/api/checks`: the session's user, Postgres, and the catalog's problem keys. */
export async function checksApiDeps(): Promise<ChecksApiDeps> {
  const session = await auth();
  const prisma = db();
  problemKeys ??= getProgressKeys();
  return {
    user: session?.user?.id ? { id: session.user.id, canSync: session.user.verified } : null,
    store: createPrismaCheckResultStore(prisma),
    limiter: createDbRateLimiter(prisma),
    isProblem: (key) => problemKeys!.has(key),
  };
}
