import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Only `DATABASE_URL_TEST` is read from .env.local (the database integration tests skip without it); no other
 * key reaches the tests, so nothing can call a real API.
 */
function testDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  if (!existsSync(".env.local")) return undefined;
  const line = readFileSync(".env.local", "utf8")
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL_TEST="));
  return line?.slice("DATABASE_URL_TEST=".length).trim() || undefined;
}

const databaseUrl = testDatabaseUrl();

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": fileURLToPath(new URL("./tests/fixtures/server-only.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: databaseUrl ? { DATABASE_URL_TEST: databaseUrl } : {},
  },
});
