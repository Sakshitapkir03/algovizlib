import "server-only";

import { auth } from "@/auth";
import { createDbRateLimiter } from "@/lib/auth/rate-limit";
import { getAllProblems } from "@/lib/catalog/repository";
import { db } from "@/lib/db";
import { progressKey } from "@/lib/progress/repository";

import { createPrismaReviewStore, type ReviewApiDeps } from "./server";

let problemKeys: Set<string> | undefined;

/** The real dependencies of `/api/review`: the session's user, Postgres, and the catalog's problem keys. */
export async function reviewApiDeps(): Promise<ReviewApiDeps> {
  const session = await auth();
  const prisma = db();
  problemKeys ??= new Set(getAllProblems().map(progressKey));
  return {
    user: session?.user?.id ? { id: session.user.id, canSync: session.user.verified } : null,
    store: createPrismaReviewStore(prisma),
    limiter: createDbRateLimiter(prisma),
    isProblem: (key) => problemKeys!.has(key),
  };
}
