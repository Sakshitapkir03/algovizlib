import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * One Prisma client per server instance (reused across hot reloads in dev). `DATABASE_URL` is Neon's pooled
 * connection string in production and local Postgres in development.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function createPrismaClient(url = process.env.DATABASE_URL): PrismaClient {
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export function db(): PrismaClient {
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}
