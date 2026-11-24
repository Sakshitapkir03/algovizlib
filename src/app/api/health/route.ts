import "server-only";

import { db } from "@/lib/db";
import { checkHealth } from "@/lib/health";

/**
 * Is the database reachable, with every table and migration the app needs? 200 when it is, 503 when not, with the
 * missing tables and pending migrations named (run `pnpm db:deploy` against the direct URL to fix those).
 */
export async function GET() {
  const health = await checkHealth(db());
  if (!health.ok)
    console.warn(`[health] ${JSON.stringify(health)}: run "pnpm db:deploy" against the database.`);
  return Response.json(health, { status: health.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
