import "server-only";

import { auth } from "@/auth";
import { createDbRateLimiter } from "@/lib/auth/rate-limit";
import { getProgressKeys } from "@/lib/catalog/repository";
import { db } from "@/lib/db";

import { createPrismaProgressStore, type ApiResult, type ProgressApiDeps } from "./server";

let problemKeys: Set<string> | undefined;

/** The real dependencies of `/api/progress`: the session's user, Postgres, and the catalog's problem keys. */
export async function progressApiDeps(): Promise<ProgressApiDeps> {
  const session = await auth();
  const prisma = db();
  problemKeys ??= getProgressKeys();
  return {
    user: session?.user?.id ? { id: session.user.id, canSync: session.user.verified } : null,
    store: createPrismaProgressStore(prisma),
    limiter: createDbRateLimiter(prisma),
    isProblem: (key) => problemKeys!.has(key),
  };
}

export function toResponse(result: ApiResult): Response {
  if (result.status === 204) return new Response(null, { status: 204 });
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

const FORBIDDEN = () => Response.json({ error: "Cross-site request refused." }, { status: 403 });

/** JSON body of a same-origin POST, or a 403/400 response. `sendBeacon` posts text/plain, so any type is read. */
export async function readJson(request: Request, sameOrigin: boolean): Promise<unknown | Response> {
  if (!sameOrigin) return FORBIDDEN();
  const text = await request.text();
  if (text.length > 200_000) return Response.json({ error: "Too large." }, { status: 413 });
  try {
    return JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
}
