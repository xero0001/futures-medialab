import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { setInterval, clearInterval } from "node:timers";
import { fileURLToPath, URL } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";
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
  nteSettlementScenarios,
  NTE_SETTLEMENT_PREFIX,
} from "./fixtures/nte-settlement.mjs";

const base = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
const databaseRequire = createRequire(
  new URL("../../../packages/database/package.json", import.meta.url),
);
databaseRequire("dotenv").config({
  path: resolve(base, ".env.local"),
  quiet: true,
});

// Execute the real read model; HTTP/auth modules are deliberately unavailable.
// This verifier cannot create sessions, call mutations or bypass an HTTP guard.
const overrides = {
  "server-only": {},
  "@futures-medialab/database": {},
  "./auth": {
    getAuth() {
      throw new Error("HTTP authentication is outside this read-only verifier");
    },
  },
  "./workspace-api": {},
};
function compile(filename, cache = new Map()) {
  filename = resolve(base, filename);
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} };
  cache.set(filename, module.exports);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const localRequire = (specifier) => {
    if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
    if (specifier.startsWith("."))
      return compile(resolve(dirname(filename), `${specifier}.ts`), cache);
    return require(specifier);
  };
  runInThisContext(`(function(exports,require,module){${source}\n})`, {
    filename,
  })(module.exports, localRequire, module);
  return module.exports;
}
const { readAgencyAssignedCampaigns } = compile("lib/agency-projects.ts");
const db = createDatabaseClient();
const keepAlive = setInterval(() => {}, 1000);
const privateId = `${NTE_PREFIX}-campaign-private`;
const campaignIds = [
  ...nteCampaigns.map((scene) => `${NTE_PREFIX}-campaign-${scene.key}`),
  ...nteProductionScenarios.map(
    (scene) => `${NTE_PRODUCTION_PREFIX}-campaign-${scene.key}`,
  ),
  ...nteReportingScenarios.map(
    (scene) => `${NTE_REPORTING_PREFIX}-campaign-${scene.key}`,
  ),
  ...nteSettlementScenarios.map(
    (scene) => `${NTE_SETTLEMENT_PREFIX}-campaign-${scene.key}`,
  ),
];
const report = {
  checkedAt: new Date().toISOString(),
  mode: "READ ONLY transaction / actual agency assigned-campaign read model",
  overall: "pending",
  checks: [],
  campaigns: [],
};
function assertPublic(value) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(
      ![
        "supplierOrganizationId",
        "agencyOrganizationId",
        "brandOrganizationId",
        "creatorId",
        "supplierCost",
        "unitAmount",
        "amount",
        "currency",
        "budgetAmount",
        "brandInvoices",
        "lineSnapshot",
        "internalNote",
        "internalNotes",
        "sourceNote",
        "sourceUrl",
        "requirements",
        "metadata",
      ].includes(key),
      `Private field: ${key}`,
    );
    assertPublic(child);
  }
}
try {
  await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const user = await tx.user.findUniqueOrThrow({
        where: { email: "agency@agency.com" },
        select: { id: true },
      });
      const member = await tx.organizationMember.findFirstOrThrow({
        where: { userId: user.id, organization: { type: "AGENCY" } },
        orderBy: [{ createdAt: "asc" }, { organizationId: "asc" }],
        select: {
          organizationId: true,
          role: true,
          organization: { select: { status: true, metadata: true } },
        },
      });
      assert.equal(member.role, "OWNER");
      assert.equal(member.organization.status, "ACTIVE");
      assert.equal(member.organization.metadata.testWorkspaceAccess, true);
      const all = await readAgencyAssignedCampaigns(
        tx,
        member.organizationId,
        true,
      );
      const visible = all.projects.filter((row) =>
        campaignIds.includes(row.campaignId),
      );
      assert.equal(campaignIds.length, 20);
      assert.deepEqual(
        visible.map((row) => row.campaignId).sort(),
        campaignIds.filter((id) => id !== privateId).sort(),
      );
      assert.equal(visible.length, 19);
      assertPublic(all);
      assert.ok(
        visible.every((row) => row.isDemo && row.campaignType === "MANAGED"),
      );
      assert.ok(
        visible.every((row) => row.assignment.acceptedApplication === false),
      );
      assert.equal(
        visible.filter((row) => row.production.total > 0).length,
        17,
      );
      assert.equal(
        visible.reduce((sum, row) => sum + row.production.total, 0),
        19,
      );
      assert.equal(
        visible.reduce((sum, row) => sum + row.reporting.total, 0),
        10,
      );
      assert.equal(
        visible.reduce((sum, row) => sum + row.settlement.issued, 0),
        1,
      );
      assert.equal(
        visible.reduce((sum, row) => sum + row.settlement.paid, 0),
        1,
      );
      const draftSettlement = visible.find(
        (row) => row.campaignId === `${NTE_SETTLEMENT_PREFIX}-campaign-draft`,
      );
      assert.deepEqual(draftSettlement.settlement, { issued: 0, paid: 0 });
      assert.equal(
        draftSettlement.availableStages.includes("settlement"),
        false,
      );
      const exact = await readAgencyAssignedCampaigns(
        tx,
        member.organizationId,
        true,
        `${NTE_REPORTING_PREFIX}-campaign-update-review`,
      );
      assert.equal(exact.projects.length, 1);
      assert.equal(exact.projects[0].reporting.underReview, 1);
      assert.equal(exact.projects[0].reporting.publicReports, 1);
      const hidden = await readAgencyAssignedCampaigns(
        tx,
        member.organizationId,
        true,
        privateId,
      );
      assert.deepEqual(hidden.projects, []);
      const nonTest = await readAgencyAssignedCampaigns(
        tx,
        member.organizationId,
        false,
      );
      assert.equal(
        nonTest.projects.some((row) => campaignIds.includes(row.campaignId)),
        false,
      );
      const dbCampaigns = await tx.campaign.findMany({
        where: { id: { in: campaignIds } },
        select: {
          id: true,
          type: true,
          applications: {
            where: { agencyOrganizationId: member.organizationId },
            select: { status: true },
          },
        },
      });
      assert.equal(dbCampaigns.length, 20);
      assert.ok(
        dbCampaigns.every(
          (row) =>
            row.type === "MANAGED" &&
            row.applications.length === 1 &&
            row.applications[0].status === "SHORTLISTED",
        ),
      );
      report.counts = {
        existingNteCampaigns: 20,
        assignedVisibleCampaigns: 19,
        privateDraftCampaignsHidden: 1,
        assignedProductionCampaigns: 17,
        productionItems: 19,
        reportingItems: 10,
        issuedPayouts: 1,
        paidPayouts: 1,
        fabricatedAcceptedApplications: 0,
      };
      report.checks = [
        "exact 19 of 20 assigned NTE campaign IDs",
        "private unpublished proposal absent",
        "current publication and historical task scope",
        "latest public report retained during private update review",
        "draft payout absent from counts and destinations",
        "non-test agency cannot see demo records",
        "no prices, internal notes, creator/supplier/brand IDs in overview",
        "all existing NTE applications remain SHORTLISTED",
        "database enforced READ ONLY; no business or credential mutation",
      ];
      report.campaigns = visible.map((row) => ({
        campaignId: row.campaignId,
        status: row.campaignStatus,
        officialProposalItems: row.assignment.officialProposalItems,
        production: row.production,
        reporting: row.reporting,
        settlement: row.settlement,
        availableStages: row.availableStages,
      }));
      report.overall = "passed";
    },
    { isolationLevel: "RepeatableRead", timeout: 120000 },
  );
  const directory = new URL(
    "../../../output/agency-campaign-review/",
    import.meta.url,
  );
  await mkdir(directory, { recursive: true });
  await writeFile(
    new URL("nte-db-verification.json", directory),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({
      overall: report.overall,
      counts: report.counts,
      artifact: "output/agency-campaign-review/nte-db-verification.json",
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      overall: "failed",
      error:
        error instanceof assert.AssertionError
          ? error.message
          : "Read-only verification did not complete",
      code: typeof error?.code === "string" ? error.code : undefined,
    }),
  );
  process.exitCode = 1;
} finally {
  clearInterval(keepAlive);
  await db.$disconnect();
}
