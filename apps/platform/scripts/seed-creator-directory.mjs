import assert from "node:assert/strict";
import console from "node:console";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";
import { DEMO_CREATORS } from "../lib/creator-directory.ts";

// Explicit maintenance command only. No request handler or startup hook runs it.
// Upserts exactly the known fictional fixture IDs; never deletes directory rows.
const { values } = parseArgs({
  options: {
    "env-file": { type: "string", default: "apps/platform/.env.local" },
    apply: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.log("Usage: node --experimental-strip-types apps/platform/scripts/seed-creator-directory.mjs [--env-file <ignored-file>] [--apply]");
  console.log("Without --apply, validates fixtures and prints counts without connecting to the database.");
} else {
  const fixtureIds = DEMO_CREATORS.map((creator) => creator.id);
  assert.equal(new Set(fixtureIds).size, fixtureIds.length, "Demo fixture IDs must be unique");
  for (const creator of DEMO_CREATORS) {
    assert.match(creator.id, /^demo-(youtube|tiktok|instagram|twitch|x|facebook)-[a-z0-9-]+$/);
    assert.ok(creator.name.endsWith("(Demo)"), "Every fixture must visibly identify itself as a demo");
    assert.equal(new URL(creator.profileUrl).hostname, "example.com", "Fixtures must use reserved non-live profile URLs");
  }
  const counts = Object.fromEntries(
    [...new Set(DEMO_CREATORS.map((creator) => creator.platform))].map((platform) => [
      platform, DEMO_CREATORS.filter((creator) => creator.platform === platform).length,
    ]),
  );

  if (!values.apply) {
    console.log(`DRY RUN: ${DEMO_CREATORS.length} fictional creator records; no database connection or writes.`);
    console.log(JSON.stringify(counts));
    console.log("Review the database environment, then pass --apply to upsert these exact demo IDs.");
  } else {
    const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
    const databaseRequire = createRequire(new URL("../../../packages/database/package.json", import.meta.url));
    const { config } = databaseRequire("dotenv");
    const loaded = config({ path: resolve(repositoryRoot, values["env-file"]), quiet: true, override: false });
    assert.ok(!loaded.error, "Cannot load the selected ignored environment file");
    assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured");
    const { createDatabaseClient } = await import("../../../packages/database/src/client-factory.mjs");
    const db = createDatabaseClient();

    try {
      await db.$transaction(async (tx) => {
        const conflicts = await tx.creatorDirectoryEntry.count({
          where: { id: { in: fixtureIds }, isDemo: false },
        });
        assert.equal(conflicts, 0, "Refusing to overwrite a non-demo directory entry");
        for (const creator of DEMO_CREATORS) {
          const data = {
            id: creator.id,
            platform: creator.platform,
            isDemo: true,
            isPublished: true,
            payload: creator,
          };
          await tx.creatorDirectoryEntry.upsert({
            // An ID collision with a non-demo row must fail, including races
            // after the preflight check; Prisma's unique constraint prevents it.
            where: { id: creator.id, isDemo: true },
            create: data,
            update: data,
          });
        }
      }, { maxWait: 10_000, timeout: 60_000 });
      console.log(`SEEDED: ${DEMO_CREATORS.length} fictional creator entries. No other records changed.`);
      console.log(JSON.stringify(counts));
    } catch (error) {
      // Do not print connection strings or environment values in error output.
      console.error(`Demo seed failed (${error?.code ?? error?.name ?? "unknown error"}); transaction rolled back.`);
      process.exitCode = 1;
    } finally {
      await db.$disconnect();
    }
  }
}
