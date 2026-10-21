import type { PrismaClient } from "@prisma/client";
import { createDatabaseClient } from "./client-factory.mjs";

export { Prisma } from "@prisma/client";

const globalForDatabase = globalThis as unknown as {
  futuresMedialabDatabase?: PrismaClient;
};

export function getDatabase() {
  if (!globalForDatabase.futuresMedialabDatabase) {
    globalForDatabase.futuresMedialabDatabase = createDatabaseClient();
  }

  return globalForDatabase.futuresMedialabDatabase;
}
