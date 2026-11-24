import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkHealth, EXPECTED_MIGRATIONS, REQUIRED_TABLES } from "@/lib/health";

/** A fake database: which tables exist, which migrations have run, or unreachable. */
function fakeDb(opts: { tables?: string[]; migrations?: string[] | "none"; down?: boolean }) {
  return {
    async $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T> {
      if (opts.down) throw new Error("connect ECONNREFUSED 10.0.0.1:5432 password=secret");
      if (query.includes("to_regclass"))
        return (values[0] as string[]).map((name) => ({
          name,
          present: (opts.tables ?? [...REQUIRED_TABLES]).includes(name),
        })) as T;
      if (opts.migrations === "none") throw new Error('relation "_prisma_migrations" does not exist');
      return (opts.migrations ?? [...EXPECTED_MIGRATIONS]).map((migration_name) => ({ migration_name })) as T;
    },
  };
}

describe("health check", () => {
  it("is ok when every table exists and every migration has run", async () => {
    expect(await checkHealth(fakeDb({}))).toEqual({
      ok: true,
      database: "ok",
      missingTables: [],
      pendingMigrations: [],
    });
  });

  it("names a missing CheckResult table and the migration that creates it (a skipped db:deploy)", async () => {
    const health = await checkHealth(
      fakeDb({
        tables: REQUIRED_TABLES.filter((t) => t !== "CheckResult"),
        migrations: ["20261120213857_accounts", "20261123223629_ask_cache"],
      }),
    );
    expect(health).toEqual({
      ok: false,
      database: "ok",
      missingTables: ["CheckResult"],
      pendingMigrations: ["20261124153611_check_results"],
    });
  });

  it("reports an unreachable database without leaking the error", async () => {
    const health = await checkHealth(fakeDb({ down: true }));
    expect(health).toEqual({ ok: false, database: "unreachable", missingTables: [], pendingMigrations: [] });
    expect(JSON.stringify(health)).not.toMatch(/secret|ECONNREFUSED/);
  });

  it("with no migrations table at all, every migration is pending", async () => {
    expect((await checkHealth(fakeDb({ migrations: "none" }))).pendingMigrations).toEqual([
      ...EXPECTED_MIGRATIONS,
    ]);
  });

  it("knows every model in the schema and every committed migration", () => {
    const schema = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    const models = [...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]);
    expect([...REQUIRED_TABLES].sort()).toEqual(models.sort());
    const migrations = readdirSync(path.join(process.cwd(), "prisma", "migrations")).filter((f) =>
      /^\d+_/.test(f),
    );
    expect([...EXPECTED_MIGRATIONS]).toEqual(migrations.sort());
  });
});
