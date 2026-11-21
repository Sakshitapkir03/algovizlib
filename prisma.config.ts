import { existsSync } from "node:fs";

import { defineConfig } from "prisma/config";

// The CLI reads .env.local like Next does (never printed). Migrations use the direct (unpooled) connection when
// there is one: Neon's pooler doesn't support everything `migrate` needs.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "" },
});
