import { PrismaClient } from "@prisma/client";

const globalForDatabase = globalThis as unknown as {
  futuresMedialabDatabase?: PrismaClient;
};

export function getDatabase() {
  if (!globalForDatabase.futuresMedialabDatabase) {
    globalForDatabase.futuresMedialabDatabase = new PrismaClient();
  }

  return globalForDatabase.futuresMedialabDatabase;
}
