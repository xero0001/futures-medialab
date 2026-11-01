import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { setInterval, clearInterval } from "node:timers";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";
import {
  NTE_GAME,
  NTE_PREFIX,
  NTE_SEED,
  nteCreators,
} from "./fixtures/nte-proposals.mjs";
import { NTE_ART } from "./fixtures/nte-production.mjs";
import { nteReportingSnapshot } from "./fixtures/nte-reporting.mjs";
import {
  NTE_SETTLEMENT_PREFIX,
  NTE_SETTLEMENT_SEED,
  nteSettlementScenarios,
} from "./fixtures/nte-settlement.mjs";
import { applyNtePublicCreatorReferences } from "./fixtures/nte-public-creators.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const require = createRequire(
  new URL("../../../packages/database/package.json", import.meta.url),
);
const { values } = parseArgs({
  options: {
    apply: { type: "boolean", default: false },
    "env-file": { type: "string", default: "apps/platform/.env.local" },
  },
});
require("dotenv").config({
  path: resolve(root, values["env-file"]),
  quiet: true,
});
const db = createDatabaseClient();
// The shared serverless pool may unref idle connections. Keep this CLI alive
// until its atomic fixture transaction and explicit disconnect have completed.
const keepAlive = setInterval(() => {}, 1000);
const id = (key) => `${NTE_SETTLEMENT_PREFIX}-campaign-${key}`;

async function account(tx, email, type) {
  const row = await tx.user.findUnique({
    where: { email },
    select: {
      id: true,
      memberships: {
        where: { organization: { type } },
        select: {
          role: true,
          organization: { select: { id: true, status: true, metadata: true } },
        },
      },
    },
  });
  assert.ok(
    row && row.memberships.length === 1,
    `Expected one ${type} membership for ${email}`,
  );
  const member = row.memberships[0];
  assert.equal(member.organization.status, "ACTIVE");
  assert.ok(["OWNER", "ADMIN"].includes(member.role));
  if (type !== "PLATFORM")
    assert.equal(member.organization.metadata?.testWorkspaceAccess, true);
  return { userId: row.id, organizationId: member.organization.id };
}

async function inspect(tx) {
  const brand = await account(tx, "brand@brand.com", "BRAND");
  const agency = await account(tx, "agency@agency.com", "AGENCY");
  const admin = await account(tx, "admin@admin.com", "PLATFORM");
  const existing = await tx.campaign.findMany({
    where: { id: { in: nteSettlementScenarios.map((s) => id(s.key)) } },
    select: {
      id: true,
      brandOrganizationId: true,
      createdById: true,
      requirements: true,
    },
  });
  assert.ok(
    existing.length === 0 || existing.length === nteSettlementScenarios.length,
    "Partial reporting fixture set exists; preserve and inspect it",
  );
  for (const row of existing)
    assert.ok(
      row.brandOrganizationId === brand.organizationId &&
        row.createdById === brand.userId &&
        row.requirements?.demo === true &&
        row.requirements?.settlementSeed === NTE_SETTLEMENT_SEED,
      "Reserved fixture ID collision",
    );
  const creators = await tx.creatorProfile.findMany({
    where: {
      id: { in: nteCreators.map((c) => `${NTE_PREFIX}-creator-${c.key}`) },
    },
  });
  assert.equal(creators.length, 3, "Seed the original NTE proposals first");
  assert.ok(
    creators.every(
      (c) =>
        c.agencyOrganizationId === agency.organizationId &&
        c.internalNotes.includes(NTE_SEED),
    ),
  );
  return { brand, agency, admin, existing };
}

async function createApprovedCampaign(tx, scene, actors, actions, now) {
  const { brand, agency, admin } = actors;
  const {
    applyAdminProposalMutation,
    applyBrandProposalDecision,
    applyAgencyProductionMutation,
    applyAdminProductionMutation,
    applyBrandProductionMutation,
  } = actions;
  const campaignId = id(scene.key),
    creator = nteCreators.find((c) => c.key === scene.creator);
  const title = `[시연] 이환 · ${scene.title}`,
    requestId = `${NTE_SETTLEMENT_PREFIX}-request-${scene.key}`;
  const after = (days) =>
    new Date(now.getTime() + days * 86400000).toISOString();
  const deliverables =
    creator.platform === "tiktok"
      ? "이환 도시 탐험 세로 영상 30~45초 1편"
      : "이환 도시 탐험 영상 6~8분 1편";
  await tx.campaign.create({
    data: {
      id: campaignId,
      brandOrganizationId: brand.organizationId,
      createdById: brand.userId,
      type: "MANAGED",
      status: "RECRUITING",
      title,
      summary: `${scene.concept}. 승인된 콘텐츠의 게시·성과 보고를 확인하는 내부 시연입니다.`,
      coverImageUrl: NTE_ART.coverImageUrl,
      briefUrl: NTE_GAME.officialUrl,
      currency: "KRW",
      budgetAmount: scene.price,
      platforms: [creator.platform],
      regions: ["KR"],
      categories: ["gaming"],
      contentDeadline: new Date(after(7)),
      publishedAt: now,
      requirements: {
        demo: true,
        seed: NTE_SEED,
        settlementSeed: NTE_SETTLEMENT_SEED,
        game: { ...NTE_GAME, ...NTE_ART },
        brandIntake: { requestId, submittedAt: now.toISOString() },
        brandBrief: {
          genre: NTE_GAME.genre,
          goal: scene.concept,
          contentFormat: deliverables,
          creatorCount: 1,
          desiredDate: after(7).slice(0, 10),
          note: "공식 PV 참고 링크와 가상 수치로 구성한 내부 게시·성과 시연",
          compositionPreference: "balanced",
        },
      },
    },
  });
  await tx.workspaceToolRequest.create({
    data: {
      id: requestId,
      organizationId: brand.organizationId,
      userId: brand.userId,
      campaignId,
      assignedToId: admin.userId,
      tool: "campaign",
      title: `${title} · 게시·성과 요청`,
      status: "IN_PROGRESS",
      inputJson: {
        demo: true,
        seed: NTE_SETTLEMENT_SEED,
        kind: "campaign-intake",
        input: scene.concept,
      },
    },
  });
  await tx.campaignApplication.create({
    data: {
      id: `${NTE_SETTLEMENT_PREFIX}-application-${scene.key}`,
      campaignId,
      agencyOrganizationId: agency.organizationId,
      submittedById: agency.userId,
      status: "SHORTLISTED",
      proposedAmount: `${(BigInt(scene.price.split(".")[0]) * 60n) / 100n}.00`,
      currency: "KRW",
      proposal:
        "게시·성과 내부 시연용 공급 자료. 실제 계약·지급·게시를 실행하지 않습니다.",
      rosterSnapshot: [],
      creators: {
        create: {
          creatorId: `${NTE_PREFIX}-creator-${creator.key}`,
          deliverables: [{ description: deliverables, quantity: 1 }],
        },
      },
    },
  });
  await applyAdminProposalMutation(tx, admin.userId, {
    action: "createDraft",
    campaignId,
    clientRequestId: randomUUID(),
  });
  let proposal = await tx.campaignProposal.findFirstOrThrow({
    where: { campaignId, status: "DRAFT" },
  });
  await applyAdminProposalMutation(tx, admin.userId, {
    action: "saveDraft",
    campaignId,
    proposalId: proposal.id,
    expectedRevision: proposal.revision,
    clientRequestId: randomUUID(),
    data: {
      title: `${title} · 공식 제안서`,
      summary: scene.concept,
      changeSummary: "게시·성과 내부 시연용 최초 제안",
      expiresAt: after(2),
      terms:
        "내부 시연용 가상 제안입니다. 실제 계약·송금·SNS 게시를 실행하지 않습니다.",
      items: [
        {
          creatorId: `${NTE_PREFIX}-creator-${creator.key}`,
          creatorName: creator.name,
          platform: creator.platform,
          channelLabel: creator.name,
          channelUrl: creator.channelUrl,
          followers: 85000,
          averageViews: 22000,
          deliverables,
          quantity: 1,
          unitAmount: scene.price,
          scheduledAt: after(7),
          rights: "가상 게시·성과 시연. 2차 활용은 별도 협의.",
          supplierCost: `${(BigInt(scene.price.split(".")[0]) * 60n) / 100n}.00`,
          internalNotes: `${NTE_SETTLEMENT_SEED} 공급 비용과 비공개 내부 메모`,
        },
      ],
    },
  });
  proposal = await tx.campaignProposal.findUniqueOrThrow({
    where: { id: proposal.id },
  });
  await applyAdminProposalMutation(tx, admin.userId, {
    action: "publish",
    campaignId,
    proposalId: proposal.id,
    expectedRevision: proposal.revision,
    clientRequestId: randomUUID(),
  });
  proposal = await tx.campaignProposal.findUniqueOrThrow({
    where: { id: proposal.id },
    include: { items: true },
  });
  await applyBrandProposalDecision(tx, brand, {
    action: "decide",
    proposalId: proposal.id,
    expectedRevision: proposal.revision,
    clientRequestId: randomUUID(),
    decision: "APPROVE",
    itemIds: proposal.items.map((p) => p.id),
    message: "[내부 시연] 게시·성과 흐름 확인을 위한 제안 승인입니다.",
  });
  let production = await tx.productionItem.findFirstOrThrow({
    where: { campaignId },
  });
  await applyAgencyProductionMutation(tx, agency, {
    action: "submit",
    productionItemId: production.id,
    expectedRevision: production.revision,
    clientRequestId: randomUUID(),
    title: `[시연 구성안] ${scene.title}`,
    url: NTE_ART.imageSourceUrl,
    note: "공식 이미지를 참고한 가상 도시 탐험 구성안. 게시 링크와 성과 검수 흐름을 시연하기 위한 자료입니다.",
  });
  production = await tx.productionItem.findUniqueOrThrow({
    where: { id: production.id },
    include: { submissions: { orderBy: { version: "desc" } } },
  });
  await applyAdminProductionMutation(tx, admin.userId, {
    action: "releaseToBrand",
    campaignId,
    productionItemId: production.id,
    submissionId: production.submissions[0].id,
    expectedRevision: production.revision,
    clientRequestId: randomUUID(),
    title: `[시연 구성안] ${scene.title}`,
    url: NTE_ART.imageSourceUrl,
    note: "이환 도시의 일상과 이상 현상을 소개하는 구성안입니다. 내부 시연용이며 실제 제작 영상이 아닙니다.",
    internalNote:
      "내부 시연 구성안 확인. 게시·성과는 별도 관리자 검토 후 공개합니다.",
  });
  production = await tx.productionItem.findUniqueOrThrow({
    where: { id: production.id },
    include: { submissions: { orderBy: { version: "desc" } } },
  });
  await applyBrandProductionMutation(tx, brand, {
    action: "approve",
    productionItemId: production.id,
    submissionId: production.submissions[0].id,
    expectedRevision: production.revision,
    clientRequestId: randomUUID(),
    message: "[내부 시연] 구성안 확인 완료. 게시·성과 보고 단계로 진행합니다.",
  });
  return { campaignId, productionItemId: production.id };
}

try {
  const preflight = await inspect(db);
  if (!values.apply) {
    console.log(
      JSON.stringify(
        {
          mode: "read-only",
          accountsVerified: 3,
          campaignsToCreate: preflight.existing.length
            ? 0
            : nteSettlementScenarios.length,
          seed: NTE_SETTLEMENT_SEED,
          existingRecordsPreserved: true,
        },
        null,
        2,
      ),
    );
  } else {
    const proposals = await import("@futures-medialab/database/proposals");
    const production = await import("@futures-medialab/database/production");
    const { applyAgencyReportingMutation, applyAdminReportingMutation } =
      await import("@futures-medialab/database/reporting");
    const { listAdminSettlement, applyAdminSettlementMutation } =
      await import("@futures-medialab/database/settlement");
    const seedTransaction = () =>
      db.$transaction(
        async (tx) => {
          const actors = await inspect(tx);
          if (actors.existing.length)
            return {
              mode: "preserved",
              scenarios: actors.existing.map((row) => ({ campaignId: row.id })),
            };
          const now = new Date(),
            created = [];
          for (const scene of nteSettlementScenarios) {
            const { campaignId } = await createApprovedCampaign(
              tx,
              scene,
              actors,
              { ...proposals, ...production },
              now,
            );
            let report = await tx.reportingItem.findFirstOrThrow({
              where: { campaignId },
            });
            const data = nteReportingSnapshot(scene, 2, now);
            await applyAgencyReportingMutation(tx, actors.agency, {
              action: "submit",
              reportingItemId: report.id,
              expectedRevision: report.revision,
              clientRequestId: randomUUID(),
              data,
            });
            report = await tx.reportingItem.findUniqueOrThrow({
              where: { id: report.id },
              include: { submissions: true },
            });
            await applyAdminReportingMutation(tx, actors.admin.userId, {
              action: "releaseToBrand",
              campaignId,
              reportingItemId: report.id,
              submissionId: report.submissions[0].id,
              expectedRevision: report.revision,
              clientRequestId: randomUUID(),
              data,
              internalNote: "내부 시연 성과 공개 확인. 실제 지표가 아닙니다.",
            });
            await applyNtePublicCreatorReferences(tx, actors.admin.userId, [
              campaignId,
            ]);
            let finance = await listAdminSettlement(
              tx,
              actors.admin.userId,
              campaignId,
            );
            assert.equal(
              finance.canComplete,
              true,
              finance.completionProblems.join("; "),
            );
            const mutate = async (input) => {
              finance = await applyAdminSettlementMutation(
                tx,
                actors.admin.userId,
                { campaignId, clientRequestId: randomUUID(), ...input },
              );
            };
            if (scene.key !== "ready") {
              await mutate({
                action: "completeCampaign",
                expectedReadinessToken: finance.readinessToken,
                note: "[내부 시연] 콘텐츠 승인과 게시·성과 공개를 확인했습니다. 실제 협업 완료를 뜻하지 않습니다.",
              });
              await mutate({
                action: "prepare",
                completionId: finance.completion.id,
                supplierCostBasis: "ITEM_TOTAL",
              });
              const document = (kind) => ({
                title: `[시연] 이환 · ${scene.title} · ${kind}`,
                note: "내부 시연용 가상 내역입니다. 실제 청구, 세금계산서 발급, 입금 또는 송금이 아닙니다. 모든 금액과 처리 상태는 테스트 데이터입니다.",
                dueAt: new Date(now.getTime() + 14 * 86400000).toISOString(),
                documentUrl: null,
                internalNote:
                  "비공개 시연 확인 메모 · 공급가를 브랜드에 공개하지 않습니다.",
              });
              await mutate({
                action: "saveBrandInvoice",
                invoiceId: finance.invoice.id,
                expectedRevision: finance.invoice.revision,
                data: document("브랜드 청구"),
              });
              for (const payout of finance.payouts)
                await mutate({
                  action: "saveAgencyPayout",
                  payoutId: payout.id,
                  expectedRevision: payout.revision,
                  data: document("에이전시 지급"),
                });
              if (["issued", "paid"].includes(scene.key)) {
                await mutate({
                  action: "issueBrandInvoice",
                  invoiceId: finance.invoice.id,
                  expectedRevision: finance.invoice.revision,
                });
                for (const payout of finance.payouts)
                  await mutate({
                    action: "issueAgencyPayout",
                    payoutId: payout.id,
                    expectedRevision: payout.revision,
                  });
              }
              if (scene.key === "paid") {
                const payment = (doc) => ({
                  paidAt: new Date().toISOString(),
                  reference: `DEMO-NTE-${doc.id}`,
                  amount: doc.amount,
                  currency: doc.currency,
                  internalNote:
                    "테스트용 외부 처리 확인 기록입니다. 실제 금융거래는 발생하지 않았습니다.",
                });
                await mutate({
                  action: "recordBrandPayment",
                  invoiceId: finance.invoice.id,
                  expectedRevision: finance.invoice.revision,
                  data: payment(finance.invoice),
                });
                for (const payout of finance.payouts)
                  await mutate({
                    action: "recordAgencyPayment",
                    payoutId: payout.id,
                    expectedRevision: payout.revision,
                    data: payment(payout),
                  });
              }
              assert.equal(finance.invoice.status, scene.state);
              assert.ok(finance.payouts.every((p) => p.status === scene.state));
            }
            await tx.auditLog.create({
              data: {
                actorId: actors.admin.userId,
                action: "admin.demo.nte.settlement.seed",
                entityType: "Campaign",
                entityId: campaignId,
                payload: {
                  demo: true,
                  seed: NTE_SETTLEMENT_SEED,
                  scenario: scene.key,
                },
              },
            });
            created.push({
              campaignId,
              completionId: finance.completion?.id ?? null,
              invoiceStatus: finance.invoice?.status ?? null,
              payoutStatuses: finance.payouts.map((p) => p.status),
            });
          }
          return { mode: "created", scenarios: created };
        },
        { isolationLevel: "Serializable", timeout: 240000 },
      );
    let result;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await seedTransaction();
        break;
      } catch (error) {
        if (error.code !== "P2034" || attempt === 2) throw error;
        await delay((attempt + 1) * 1000);
      }
    }
    console.log(
      JSON.stringify({ seed: NTE_SETTLEMENT_SEED, ...result }, null, 2),
    );
  }
} catch (error) {
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : `NTE settlement seed failed (${error.code || error.name}): check validated fixture preconditions`,
  );
  process.exitCode = 1;
} finally {
  try {
    await db.$disconnect();
  } finally {
    clearInterval(keepAlive);
  }
}
