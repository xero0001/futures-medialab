import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import pg from "pg";
import process from "node:process";
import { URL } from "node:url";

function positiveInteger(value, fallback) {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("Database pool settings must be positive integers");
  }
  return parsed;
}

export function getDatabasePoolOptions(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("Invalid database connection URL");
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Database connection URL must use PostgreSQL");
  }

  const max = positiveInteger(
    url.searchParams.get("connection_limit"),
    process.env.VERCEL === "1" ? 5 : 10,
  );
  const connectionTimeoutMillis =
    1_000 *
    positiveInteger(
      url.searchParams.get("pool_timeout") ??
        url.searchParams.get("connect_timeout"),
      20,
    );
  const schema = url.searchParams.get("schema") || "public";

  for (const key of [
    "connection_limit",
    "pool_timeout",
    "connect_timeout",
    "pgbouncer",
    "schema",
  ]) {
    url.searchParams.delete(key);
  }

  return {
    schema,
    pool: {
      connectionString: url.toString(),
      max,
      connectionTimeoutMillis,
      idleTimeoutMillis: 5_000,
      allowExitOnIdle: true,
    },
  };
}

export function createDatabaseClient(databaseUrl = process.env.DATABASE_URL) {
  const { pool: options, schema } = getDatabasePoolOptions(databaseUrl);
  const pool = new pg.Pool(options);
  if (process.env.VERCEL === "1") attachDatabasePool(pool);
  const adapter = new PrismaPg(pool, { schema, disposeExternalPool: true });
  return new PrismaClient({ adapter });
}
