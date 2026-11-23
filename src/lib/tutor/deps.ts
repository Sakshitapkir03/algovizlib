import "server-only";

import { auth } from "@/auth";
import { createDbRateLimiter } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";

import { readTutorConfig } from "./config";
import { createTutorModel, type TutorModel } from "./model";
import type { TutorDeps } from "./service";
import { createDbCache, createDbUsage } from "./usage";

let model: TutorModel | undefined;

/** The real dependencies: the session, Postgres for counts and cached answers, and the configured model. */
export async function tutorDeps(sameOrigin: boolean): Promise<TutorDeps> {
  const config = readTutorConfig();
  const session = config.enabled ? await auth() : null;
  const prisma = db();
  return {
    config,
    user: session?.user?.id ? { id: session.user.id, verified: session.user.verified } : null,
    sameOrigin,
    limiter: createDbRateLimiter(prisma),
    usage: createDbUsage(prisma),
    cache: createDbCache(prisma),
    // Made on first use, so a request refused before the model is needed never touches the key.
    model: () => (model ??= createTutorModel(config)),
    now: Date.now,
  };
}
