import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { createRequire } from "node:module";
import { setInterval, clearInterval } from "node:timers";
import { parseArgs } from "node:util";
import { URL } from "node:url";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";
import { nteCampaigns, NTE_PREFIX } from "./fixtures/nte-proposals.mjs";
import {
  nteProductionScenarios,
  NTE_PRODUCTION_PREFIX,
} from "./fixtures/nte-production.mjs";
import {
  nteReportingScenarios,
  NTE_REPORTING_PREFIX,
} from "./fixtures/nte-reporting.mjs";
import {
  applyNtePublicCreatorReferences,
  NTE_CREATOR_REFERENCE_SEED,
} from "./fixtures/nte-public-creators.mjs";

const require = createRequire(
  new URL("../../../packages/database/package.json", import.meta.url),
);
require("dotenv").config({
  path: new URL("../.env.local", import.meta.url).pathname,
  quiet: true,
});
const { values } = parseArgs({
  options: { apply: { type: "boolean", default: false } },
});
const db = createDatabaseClient(),
  keepAlive = setInterval(() => {}, 1000);
const ids = [
  ...nteCampaigns.map((s) => `${NTE_PREFIX}-campaign-${s.key}`),
  ...nteProductionScenarios.map(
    (s) => `${NTE_PRODUCTION_PREFIX}-campaign-${s.key}`,
  ),
  ...nteReportingScenarios.map(
    (s) => `${NTE_REPORTING_PREFIX}-campaign-${s.key}`,
  ),
];
try {
  const result = await db.$transaction(
    async (tx) => {
      const admin = await tx.user.findUniqueOrThrow({
        where: { email: "admin@admin.com" },
        include: { memberships: { include: { organization: true } } },
      });
      assert.ok(
        admin.memberships.some(
          (m) =>
            m.organization.type === "PLATFORM" &&
            m.organization.status === "ACTIVE" &&
            ["OWNER", "ADMIN"].includes(m.role),
        ),
      );
      const brand = await tx.user.findUniqueOrThrow({
        where: { email: "brand@brand.com" },
      });
      const campaigns = await tx.campaign.findMany({
        where: { id: { in: ids } },
        select: { id: true, createdById: true, requirements: true },
      });
      assert.equal(campaigns.length, 16);
      assert.ok(
        campaigns.every(
          (c) =>
            c.createdById === brand.id &&
            c.requirements?.demo === true &&
            c.requirements?.seed === "official-proposals-nte-v1",
        ),
      );
      const updated = values.apply
        ? await applyNtePublicCreatorReferences(tx, admin.id, ids)
        : [];
      return {
        mode: values.apply ? "applied" : "read-only",
        seed: NTE_CREATOR_REFERENCE_SEED,
        checkedCampaigns: campaigns.length,
        updatedCampaigns: updated,
        productionAndApprovalHistoryPreserved: true,
      };
    },
    { isolationLevel: "Serializable", timeout: 120000 },
  );
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(
    `Creator fixture update failed (${error.code || error.name}); no partial changes were committed.`,
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
  clearInterval(keepAlive);
}
