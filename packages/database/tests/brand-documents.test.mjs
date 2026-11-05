import assert from "node:assert/strict";
import test from "node:test";
import { listBrandDocumentProposals } from "../src/proposals.ts";
import { listBrandDocumentReports } from "../src/reporting.ts";

// Isolated public readers: no database client, environment or business writes.
const date = new Date("2026-10-30T00:00:00Z");
const proposal = {
  id: "proposal-1",
  campaignId: "campaign-own",
  version: 1,
  revision: 1,
  status: "SUPERSEDED",
  title: "공식 제안",
  summary: "공개 요약",
  changeSummary: "",
  terms: "공개 조건",
  currency: "KRW",
  publishedAt: date,
  expiresAt: date,
  supersededAt: date,
  campaign: {
    id: "campaign-own",
    title: "우리 캠페인",
    status: "IN_PROGRESS",
    brandOrganizationId: "brand-own",
  },
  items: [
    {
      id: "item-1",
      creatorName: "공개 이름",
      platform: "youtube",
      channelLabel: "채널",
      channelUrl: "https://example.com/channel",
      followers: 1000,
      averageViews: null,
      deliverables: "영상1",
      quantity: 1,
      unitAmount: { toFixed: () => "100.00" },
      scheduledAt: null,
      rights: "사용권",
      status: "APPROVED",
      supplierCost: "PRIVATE_COST",
      internalNotes: "PRIVATE_NOTES",
      creatorId: "PRIVATE_CREATOR_ID",
    },
  ],
  decisions: [],
  internalNote: "PRIVATE_NOTE",
};

test("document proposals query own published versions and reuse the public DTO allowlist", async () => {
  const tx = {
    campaignProposal: {
      findMany: async (query) => {
        assert.equal(query.where.campaign.brandOrganizationId, "brand-own");
        assert.equal(query.where.campaignId, "campaign-own");
        assert.deepEqual(query.where.publishedAt, { not: null });
        assert.deepEqual(query.where.status, { not: "DRAFT" });
        assert.equal(query.where.supersededAt, undefined);
        assert.equal(query.take, 101);
        assert.equal(query.select.items.select.supplierCost, undefined);
        assert.equal(query.select.items.select.internalNotes, undefined);
        assert.equal(query.select.items.select.creatorId, undefined);
        return [proposal];
      },
    },
  };
  const result = await listBrandDocumentProposals(
    tx,
    "brand-own",
    "campaign-own",
    101,
  );
  assert.equal(result[0].isLatest, false);
  assert.equal(result[0].canRespond, false);
  assert.equal(result[0].items[0].creatorName, "공개 이름");
  assert.ok(!JSON.stringify(result).includes("PRIVATE_"));
  await assert.rejects(
    () =>
      listBrandDocumentProposals(
        {
          campaignProposal: {
            findMany: async () => [{ ...proposal, status: "DRAFT" }],
          },
        },
        "brand-own",
      ),
    (error) => error.status === 404,
  );
});

const reportRow = {
  id: "submission-public-v1",
  version: 1,
  releasedTitle: "공개 보고",
  releasedPostUrl: "https://example.com/public-video",
  releasedPublishedAt: date,
  releasedMetricsAsOf: date,
  releasedMetrics: { views: 0, clicks: null },
  releasedEvidenceUrl: null,
  releasedNote: "공개 코멘트",
  releasedAt: date,
  sourceTitle: "PRIVATE_SOURCE_TITLE",
  sourcePostUrl: "https://example.com/PRIVATE_SOURCE_URL",
  sourceMetrics: { views: 987654321 },
  sourceEvidenceUrl: "PRIVATE_FILE",
  internalNote: "PRIVATE_INTERNAL",
  reportingItem: {
    id: "report-item",
    productionItemId: "production-1",
    campaignId: "campaign-own",
    status: "ADMIN_REVIEW",
    revision: 3,
    campaign: {
      title: "우리 캠페인",
      status: "IN_PROGRESS",
      coverImageUrl: null,
      requirements: {},
      brandOrganization: { status: "ACTIVE" },
      proposals: [{ id: "proposal-1" }],
    },
    productionItem: {
      campaignId: "campaign-own",
      status: "APPROVED",
      proposalItem: {
        id: "item-1",
        proposalId: "proposal-1",
        creatorName: "공개 이름",
        platform: "youtube",
        deliverables: "영상1",
        quantity: 1,
        scheduledAt: null,
        rights: "사용권",
        status: "APPROVED",
        proposal: {
          id: "proposal-1",
          campaignId: "campaign-own",
          status: "APPROVED",
          version: 1,
          publishedAt: date,
          supersededAt: null,
        },
      },
    },
    // An unreleased newer source version is deliberately not in this public latest list.
    submissions: [{ id: "submission-public-v1" }],
  },
};

test("report documents query released snapshots only and keep public v1 latest during private v2 review", async () => {
  const tx = {
    reportingSubmission: {
      findMany: async (query) => {
        assert.equal(
          query.where.reportingItem.campaign.brandOrganizationId,
          "brand-own",
        );
        assert.equal(query.where.reportingItem.campaignId, "campaign-own");
        for (const field of [
          "releasedAt",
          "releasedPublishedAt",
          "releasedPostUrl",
        ])
          assert.deepEqual(query.where[field], { not: null });
        for (const field of [
          "sourceTitle",
          "sourcePostUrl",
          "sourceMetrics",
          "sourceEvidenceUrl",
          "internalNote",
          "submittedById",
        ])
          assert.equal(query.select[field], undefined);
        assert.equal(query.take, 101);
        assert.deepEqual(query.orderBy[0], { releasedAt: "desc" });
        assert.deepEqual(
          query.select.reportingItem.select.submissions.where.releasedAt,
          { not: null },
        );
        return [reportRow];
      },
    },
  };
  const result = await listBrandDocumentReports(
    tx,
    "brand-own",
    "campaign-own",
    101,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].submission.isLatest, true);
  assert.equal(result[0].submission.title, "공개 보고");
  assert.equal(result[0].submission.metrics.views, 0);
  assert.equal(result[0].submission.metrics.clicks, null);
  assert.ok(!JSON.stringify(result).includes("PRIVATE_"));
  assert.ok(!JSON.stringify(result).includes("987654321"));
});


test("report library rejects mismatched production and proposal campaign relationships", async () => {
  for (const foreign of ["production", "proposal"]) {
    const row = structuredClone(reportRow);
    if (foreign === "production") row.reportingItem.productionItem.campaignId = "campaign-foreign";
    else row.reportingItem.productionItem.proposalItem.proposal.campaignId = "campaign-foreign";
    const tx = { reportingSubmission: { findMany: async () => [row] } };
    assert.deepEqual(await listBrandDocumentReports(tx, "brand-own", "campaign-own"), []);
  }
});
