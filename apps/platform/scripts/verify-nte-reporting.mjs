import console from "node:console";
import process from "node:process";
import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";
import {
  listBrandReportingItems,
  listAgencyReporting,
  listAdminReporting,
} from "../../../packages/database/src/reporting.ts";
import {
  NTE_REPORTING_PREFIX,
  NTE_REPORTING_SEED,
  NTE_REFERENCE_POST,
  nteReportingScenarios,
  emptyReportingMetrics,
} from "./fixtures/nte-reporting.mjs";

// No sign-in, seeding, cleanup, or business mutation. PostgreSQL itself enforces
// READ ONLY for the complete snapshot used by these service and table checks.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const require = createRequire(
  new URL("../../../packages/database/package.json", import.meta.url),
);
const { values } = parseArgs({
  options: {
    "env-file": { type: "string", default: "apps/platform/.env.local" },
    "baseline-file": {
      type: "string",
      default: "tmp/production-cleanup-baseline.json",
    },
    "qa-fixture-file": { type: "string", default: "tmp/production-qa.json" },
    output: {
      type: "string",
      default: "output/reporting-review/nte-seed-verification.json",
    },
  },
});
require("dotenv").config({
  path: resolve(root, values["env-file"]),
  quiet: true,
});
const db = createDatabaseClient();
const report = {
  checkedAt: new Date().toISOString(),
  mode: "read-only database and service verification",
  databaseWritesAllowed: false,
  seed: NTE_REPORTING_SEED,
  overall: "pending",
  scenarios: [],
  checks: [],
};
const check = (condition, code) => {
  if (!condition) throw new Error(code);
};
const canonical = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonical(child)]),
    );
  return value;
};
const equal = (actual, expected, code) =>
  check(
    JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected)),
    code,
  );
const snapshotSafe = (value) => {
  if (!value || typeof value !== "object") return;
  const forbidden = new Set([
    "sourceTitle",
    "sourcePostUrl",
    "sourcePublishedAt",
    "sourceMetricsAsOf",
    "sourceMetrics",
    "sourceEvidenceUrl",
    "sourceNote",
    "supplierOrganizationId",
    "supplierName",
    "creatorId",
    "supplierCost",
    "internalNote",
    "internalNotes",
    "agencyFeedback",
    "submittedById",
    "adminReviewedById",
    "payloadHash",
  ]);
  for (const [key, child] of Object.entries(value)) {
    check(!forbidden.has(key), "PRIVATE_FIELD_EXPOSED");
    snapshotSafe(child);
  }
};
const campaignProjection = {
  id: true,
  status: true,
  brandOrganizationId: true,
  createdById: true,
  proposals: {
    orderBy: { id: "asc" },
    select: { id: true, status: true, revision: true, publishedAt: true },
  },
  productionItems: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      status: true,
      revision: true,
      submissions: {
        orderBy: { version: "asc" },
        select: {
          id: true,
          status: true,
          version: true,
          brandDecision: true,
          releasedAt: true,
        },
      },
    },
  },
};
function normalizedBaseline(rows) {
  return rows
    .map((row) => ({
      ...row,
      proposals: [...row.proposals].sort((a, b) => a.id.localeCompare(b.id)),
      productionItems: [...row.productionItems]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((item) => ({
          ...item,
          submissions: [...item.submissions].sort(
            (a, b) => a.version - b.version,
          ),
        })),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
async function actor(tx, email, type) {
  const user = await tx.user.findUnique({
    where: { email },
    select: {
      id: true,
      memberships: {
        where: { organization: { type } },
        select: {
          organizationId: true,
          role: true,
          organization: { select: { status: true } },
        },
      },
    },
  });
  check(user?.memberships.length === 1, "NAMED_ACCOUNT_MEMBERSHIP_CHANGED");
  const membership = user.memberships[0];
  check(
    membership.organization.status === "ACTIVE" &&
      ["OWNER", "ADMIN"].includes(membership.role),
    "NAMED_ACCOUNT_APPROVAL_CHANGED",
  );
  return { userId: user.id, organizationId: membership.organizationId };
}
try {
  const baseline = JSON.parse(
    await readFile(resolve(root, values["baseline-file"]), "utf8"),
  );
  check(
    baseline.campaigns?.length === 10 && baseline.protectedUsers?.length === 3,
    "PRESERVATION_BASELINE_REQUIRED",
  );
  const qaFile = resolve(root, values["qa-fixture-file"]);
  check(
    ((await stat(qaFile)).mode & 0o077) === 0,
    "QA_FIXTURE_MUST_REMAIN_PRIVATE",
  );
  // Credentials are never used or serialized; retain only the existing IDs.
  const rawFixture = JSON.parse(await readFile(qaFile, "utf8"));
  check(
    rawFixture.prefix === baseline.prefix,
    "QA_BASELINE_NAMESPACE_MISMATCH",
  );
  const retainedCampaignIds = [
    ...new Set(
      [
        "campaignId",
        "guardCampaignId",
        "browserCampaignId",
        "readyCampaignId",
      ].flatMap((key) =>
        typeof rawFixture[key] === "string" ? [rawFixture[key]] : [],
      ),
    ),
  ];
  check(
    retainedCampaignIds.length >= 3 &&
      retainedCampaignIds.every((id) =>
        id.startsWith(`${baseline.prefix}-campaign-`),
      ),
    "QA_CAMPAIGN_IDS_REQUIRED",
  );
  const retainedProductionIds = [
    ...new Set(
      ["browserProductionItemId", "readyProductionItemId"].flatMap((key) =>
        typeof rawFixture[key] === "string" ? [rawFixture[key]] : [],
      ),
    ),
  ];
  const result = await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const brand = await actor(tx, "brand@brand.com", "BRAND"),
        agency = await actor(tx, "agency@agency.com", "AGENCY"),
        admin = await actor(tx, "admin@admin.com", "PLATFORM");
      const scenarios = [];
      for (const scene of nteReportingScenarios) {
        const campaignId = `${NTE_REPORTING_PREFIX}-campaign-${scene.key}`;
        const campaign = await tx.campaign.findUnique({
          where: { id: campaignId },
          select: {
            id: true,
            status: true,
            brandOrganizationId: true,
            requirements: true,
            proposals: {
              where: { publishedAt: { not: null } },
              orderBy: { version: "desc" },
              take: 1,
              select: { id: true, status: true, supersededAt: true },
            },
          },
        });
        check(
          campaign?.requirements?.reportingSeed === NTE_REPORTING_SEED &&
            campaign.brandOrganizationId === brand.organizationId &&
            campaign.status === "IN_PROGRESS",
          "REPORTING_CAMPAIGN_SCOPE_INVALID",
        );
        check(
          campaign.proposals[0]?.status === "APPROVED" &&
            !campaign.proposals[0].supersededAt,
          "CURRENT_PROPOSAL_APPROVAL_REQUIRED",
        );
        const rawItems = await tx.reportingItem.findMany({
          where: { campaignId },
          include: {
            productionItem: {
              select: {
                id: true,
                status: true,
                supplierOrganizationId: true,
                proposalItem: { select: { proposalId: true, status: true } },
              },
            },
            submissions: { orderBy: { version: "desc" } },
          },
        });
        check(rawItems.length === 1, "ONE_REPORTING_ITEM_REQUIRED");
        const raw = rawItems[0];
        check(
          raw.status === scene.state &&
            raw.productionItem.status === "APPROVED" &&
            raw.productionItem.supplierOrganizationId ===
              agency.organizationId &&
            raw.productionItem.proposalItem.status === "APPROVED" &&
            raw.productionItem.proposalItem.proposalId ===
              campaign.proposals[0].id,
          "REPORTING_APPROVAL_CHAIN_INVALID",
        );
        const publicItems = await listBrandReportingItems(
          tx,
          brand.organizationId,
          campaignId,
        );
        const ownAgency = await listAgencyReporting(tx, agency, campaignId),
          adminRead = await listAdminReporting(tx, admin.userId, campaignId);
        check(
          publicItems.length === 1 &&
            ownAgency.items.length === 1 &&
            adminRead.items.length === 1,
          "REPORTING_SERVICE_SCOPE_INVALID",
        );
        const visible = publicItems[0];
        snapshotSafe(visible);
        check(
          visible.isCurrent && visible.status === scene.state,
          "REPORTING_CURRENT_STATE_MISMATCH",
        );
        const publicText = JSON.stringify(visible);
        for (const marker of [
          "운영팀 전달 전용",
          "비공개 확인 메모",
          "내부 시연 보고서 확인 완료",
          agency.organizationId,
        ])
          check(!publicText.includes(marker), "PRIVATE_MARKER_EXPOSED");
        const expectedVersions =
          scene.key === "waiting"
            ? 0
            : ["published", "update-review"].includes(scene.key)
              ? 2
              : 1;
        const expectedPublic =
          scene.key === "published"
            ? 2
            : ["published-initial", "update-review"].includes(scene.key)
              ? 1
              : 0;
        check(
          raw.submissions.length === expectedVersions &&
            visible.submissions.length === expectedPublic,
          "VERSION_COUNT_MISMATCH",
        );
        for (const submission of raw.submissions) {
          check(
            submission.sourceNote.includes("운영팀 전달 전용"),
            "PRIVATE_SOURCE_NOTE_REQUIRED",
          );
          if (!submission.releasedAt)
            check(
              !publicText.includes(submission.id),
              "UNRELEASED_VERSION_EXPOSED",
            );
          else {
            check(
              !submission.releasedNote.includes("운영팀 전달 전용") &&
                Boolean(submission.internalNote),
              "CURATED_COPY_REQUIRED",
            );
            const dto = visible.submissions.find(
              (row) => row.id === submission.id,
            );
            check(Boolean(dto), "RELEASED_VERSION_MISSING");
            equal(
              dto.metrics,
              submission.releasedMetrics,
              "RELEASED_METRICS_MISMATCH",
            );
            check(
              dto.postUrl === submission.releasedPostUrl &&
                dto.evidenceUrl === submission.releasedEvidenceUrl &&
                dto.note === submission.releasedNote,
              "RELEASED_FIELDS_MISMATCH",
            );
            if (
              submission.sourceEvidenceUrl &&
              submission.sourceEvidenceUrl !== submission.releasedEvidenceUrl
            )
              check(
                !publicText.includes(submission.sourceEvidenceUrl),
                "SOURCE_EVIDENCE_EXPOSED",
              );
          }
        }
        if (!expectedPublic)
          check(visible.latestSubmission === null, "UNRELEASED_LATEST_EXPOSED");
        else {
          const newest = raw.submissions.find((row) => row.releasedAt);
          check(
            visible.latestSubmission.id === newest.id &&
              visible.latestSubmission.isLatest &&
              visible.latestSubmission.postUrl === NTE_REFERENCE_POST,
            "LATEST_PUBLIC_VERSION_MISMATCH",
          );
          check(
            visible.latestSubmission.note.includes("가상") &&
              visible.latestSubmission.note.includes("실제 영상의 조회수"),
            "DEMO_DISCLOSURE_REQUIRED",
          );
        }
        if (scene.key === "published-initial") {
          equal(
            visible.latestSubmission.metrics,
            emptyReportingMetrics(),
            "COLLECTING_METRICS_MUST_REMAIN_NULL",
          );
          check(
            visible.latestSubmission.metricsAsOf === null,
            "COLLECTING_ASOF_MUST_REMAIN_NULL",
          );
        }
        if (scene.key === "published") {
          check(
            visible.latestSubmission.metrics.views === 34680 &&
              visible.latestSubmission.metrics.clicks === 128 &&
              visible.latestSubmission.metrics.saves === null,
            "LATEST_METRICS_INVALID",
          );
          check(
            visible.submissions[1].metrics.clicks === 0 &&
              visible.submissions[1].metrics.saves === null,
            "ZERO_AND_NULL_MUST_DIFFER",
          );
        }
        if (scene.key === "update-review") {
          check(
            raw.submissions[0].sourceMetrics.views === 34680 &&
              raw.submissions[0].releasedAt === null,
            "PRIVATE_UPDATE_REQUIRED",
          );
          check(
            visible.latestSubmission.version === 1 &&
              visible.latestSubmission.metrics.views === 18420 &&
              !publicText.includes("34680"),
            "PRIVATE_UPDATE_MUST_RETAIN_PUBLIC_V1",
          );
        }
        check(
          visible.coverImageUrl === "/demo/nte/city-key-art.jpg" &&
            visible.gameIconUrl === "/demo/nte/game-icon.png",
          "OFFICIAL_ARTWORK_REQUIRED",
        );
        scenarios.push({
          campaignId,
          state: visible.status,
          currentApprovalChain: true,
          sourceVersions: raw.submissions.length,
          publicVersions: visible.submissions.length,
          latestPublicVersion: visible.latestSubmission?.version ?? null,
          privacyVerified: true,
          sourceEvidencePresent: raw.submissions.some((row) =>
            Boolean(row.sourceEvidenceUrl),
          ),
          nullAndZeroPreserved: true,
        });
      }
      const oldRows = await tx.campaign.findMany({
        where: { id: { in: baseline.campaigns.map((row) => row.id) } },
        orderBy: { id: "asc" },
        select: campaignProjection,
      });
      equal(
        normalizedBaseline(oldRows),
        normalizedBaseline(baseline.campaigns),
        "EXISTING_NTE_CAMPAIGNS_CHANGED",
      );
      const users = await tx.user.findMany({
        where: { id: { in: baseline.protectedUsers.map((row) => row.id) } },
        orderBy: { email: "asc" },
        select: {
          id: true,
          email: true,
          name: true,
          memberships: {
            select: {
              organizationId: true,
              role: true,
              organization: {
                select: { name: true, type: true, status: true },
              },
            },
          },
        },
      });
      equal(users, baseline.protectedUsers, "EXISTING_NAMED_ACCOUNTS_CHANGED");
      const qaCounts = {
        users: await tx.user.count({ where: { id: { in: baseline.userIds } } }),
        organizations: await tx.organization.count({
          where: { id: { in: baseline.orgIds } },
        }),
        campaigns: await tx.campaign.count({
          where: { id: { startsWith: baseline.prefix } },
        }),
        productionItems: await tx.productionItem.count({
          where: { campaign: { id: { startsWith: baseline.prefix } } },
        }),
        submissions: await tx.productionSubmission.count({
          where: {
            productionItem: {
              campaign: { id: { startsWith: baseline.prefix } },
            },
          },
        }),
      };
      for (const [key, value] of Object.entries(baseline.qaCounts))
        check(qaCounts[key] >= value, "EXISTING_QA_RECORDS_MISSING");
      check(
        (await tx.campaign.count({
          where: { id: { in: retainedCampaignIds } },
        })) === retainedCampaignIds.length,
        "RETAINED_QA_CAMPAIGN_MISSING",
      );
      check(
        (await tx.productionItem.count({
          where: { id: { in: retainedProductionIds } },
        })) === retainedProductionIds.length,
        "RETAINED_QA_PRODUCTION_MISSING",
      );
      return {
        scenarios,
        preservation: {
          originalNteCampaigns: oldRows.length,
          originalNteStatesAndVersionsUnchanged: true,
          namedAccounts: users.length,
          namedAccountProfilesAndMembershipsUnchanged: true,
          existingQaNamespace: baseline.prefix,
          existingQaCounts: qaCounts,
          baselineQaCounts: baseline.qaCounts,
          retainedQaCampaignIdsVerified: retainedCampaignIds.length,
          retainedQaProductionIdsVerified: retainedProductionIds.length,
          credentialFilePreserved: true,
          credentialFileMode: "0600",
        },
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 90000 },
  );
  Object.assign(report, result, {
    overall: "passed",
    completedAt: new Date().toISOString(),
  });
  report.checks.push(
    {
      name: "six reporting scenes, approval chain, private/public boundaries and snapshot history",
      status: "passed",
    },
    {
      name: "existing ten NTE campaigns and retained QA preserved",
      status: "passed",
    },
  );
} catch (error) {
  const code = /^[A-Z0-9_]+$/.test(error?.message ?? "")
    ? error.message
    : (error?.code ?? error?.name ?? "ERROR");
  report.overall = "failed";
  report.checks.push({
    name: "read-only verification",
    status: "failed",
    code,
  });
  process.exitCode = 1;
} finally {
  await db.$disconnect();
  await mkdir(dirname(resolve(root, values.output)), { recursive: true });
  await writeFile(
    resolve(root, values.output),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
