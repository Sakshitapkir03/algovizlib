/**
 * The health check (`GET /api/health`): can the app reach its database, does every table it needs exist, and has every
 * committed migration run? A skipped `pnpm db:deploy` shows up here as a missing table and a pending migration,
 * instead of as a feature failing later. Reports names only, never connection details or error text.
 */

/** Every model in prisma/schema.prisma (a test keeps this in sync). */
export const REQUIRED_TABLES = [
  "User",
  "Account",
  "Session",
  "VerificationToken",
  "AuthToken",
  "RateLimit",
  "Progress",
  "AskCache",
  "CheckResult",
  "ReviewState",
] as const;

/** Every folder in prisma/migrations (a test keeps this in sync). */
export const EXPECTED_MIGRATIONS = [
  "20261120213857_accounts",
  "20261123223629_ask_cache",
  "20261124153611_check_results",
  "20261124205333_review_state",
] as const;

export type Health = {
  ok: boolean;
  database: "ok" | "unreachable";
  missingTables: string[];
  pendingMigrations: string[];
};

type RawClient = { $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T> };

export async function checkHealth(client: RawClient): Promise<Health> {
  try {
    const tables = await client.$queryRawUnsafe<{ name: string; present: boolean }[]>(
      `SELECT t AS name, to_regclass(format('%I', t)) IS NOT NULL AS present FROM unnest($1::text[]) AS t`,
      [...REQUIRED_TABLES],
    );
    const missingTables = tables.filter((t) => !t.present).map((t) => t.name);
    let applied: string[] = [];
    try {
      const rows = await client.$queryRawUnsafe<{ migration_name: string }[]>(
        `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
      );
      applied = rows.map((r) => r.migration_name);
    } catch {
      // No migrations table at all: every migration is pending.
    }
    const pendingMigrations = EXPECTED_MIGRATIONS.filter((m) => !applied.includes(m));
    return {
      ok: missingTables.length === 0 && pendingMigrations.length === 0,
      database: "ok",
      missingTables,
      pendingMigrations,
    };
  } catch {
    return { ok: false, database: "unreachable", missingTables: [], pendingMigrations: [] };
  }
}
