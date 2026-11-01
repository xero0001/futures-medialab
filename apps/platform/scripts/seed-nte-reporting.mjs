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
import {
  NTE_REPORTING_PREFIX,
  NTE_REPORTING_SEED,
  nteReportingScenarios,
  nteReportingSnapshot,
} from "./fixtures/nte-reporting.mjs";

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
const id = (key) => `${NTE_REPORTING_PREFIX}-campaign-${key}`;

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
    where: { id: { in: nteReportingScenarios.map((s) => id(s.key)) } },
    select: {
      id: true,
      brandOrganizationId: true,
      createdById: true,
      requirements: true,
    },
  });
  assert.ok(
    existing.length === 0 || existing.length === nteReportingScenarios.length,
    "Partial reporting fixture set exists; preserve and inspect it",
  );
  for (const row of existing)
    assert.ok(
      row.brandOrganizationId === brand.organizationId &&
        row.createdById === brand.userId &&
        row.requirements?.demo === true &&
        row.requirements?.reportingSeed === NTE_REPORTING_SEED,
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
    requestId = `${NTE_REPORTING_PREFIX}-request-${scene.key}`;
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
        reportingSeed: NTE_REPORTING_SEED,
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
        seed: NTE_REPORTING_SEED,
        kind: "campaign-intake",
        input: scene.concept,
      },
    },
  });
  await tx.campaignApplication.create({
    data: {
      id: `${NTE_REPORTING_PREFIX}-application-${scene.key}`,
      campaignId,
      agencyOrganizationId: agency.organizationId,
      submittedById: agency.userId,
      status: "SHORTLISTED",
      proposedAmount: (Number(scene.price) * 0.6).toFixed(2),
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
          supplierCost: (Number(scene.price) * 0.6).toFixed(2),
          internalNotes: `${NTE_REPORTING_SEED} 공급 비용과 비공개 내부 메모`,
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
            : nteReportingScenarios.length,
          seed: NTE_REPORTING_SEED,
          existingRecordsPreserved: true,
        },
        null,
        2,
      ),
    );
  } else {
    const proposals = await import("@futures-medialab/database/proposals");
    const production = await import("@futures-medialab/database/production");
    const {
      applyAgencyReportingMutation,
      applyAdminReportingMutation,
      ensureCampaignReportingItems,
    } = await import("@futures-medialab/database/reporting");
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
          for (const scene of nteReportingScenarios) {
            const record = await createApprovedCampaign(
              tx,
              scene,
              actors,
              { ...proposals, ...production },
              now,
            );
            const { campaignId } = record;
            await ensureCampaignReportingItems(
              tx,
              campaignId,
              actors.admin.userId,
            );
            let item = await tx.reportingItem.findFirstOrThrow({
              where: { campaignId },
            });
            const refresh = async () => {
              item = await tx.reportingItem.findUniqueOrThrow({
                where: { id: item.id },
                include: { submissions: { orderBy: { version: "desc" } } },
              });
            };
            const submit = async (version) => {
              const data = nteReportingSnapshot(scene, version, now);
              await applyAgencyReportingMutation(tx, actors.agency, {
                action: "submit",
                reportingItemId: item.id,
                expectedRevision: item.revision,
                clientRequestId: randomUUID(),
                data: {
                  ...data,
                  evidenceUrl: NTE_ART.imageSourceUrl,
                  note: `${data.note}\n\n[운영팀 전달 전용] 공급 파트너의 비공개 확인 메모입니다. 첨부 이미지는 내부 시연 참고 자료이며 실제 성과 증빙이 아닙니다. 브랜드 공개본에서는 이 메모와 참고 자료를 제외해 주세요.`,
                },
              });
              await refresh();
            };
            const release = async (version) => {
              await applyAdminReportingMutation(tx, actors.admin.userId, {
                action: "releaseToBrand",
                campaignId,
                reportingItemId: item.id,
                submissionId: item.submissions[0].id,
                expectedRevision: item.revision,
                clientRequestId: randomUUID(),
                data: nteReportingSnapshot(scene, version, now),
                internalNote:
                  "내부 시연 보고서 확인 완료. 가상 집계임을 공개 문안에 명시하고 비공개 공급 메모를 제외했습니다.",
              });
              await refresh();
            };
            if (scene.state !== "AWAITING_SUBMISSION") await submit(1);
            if (scene.state === "AGENCY_REVISION") {
              await applyAdminReportingMutation(tx, actors.admin.userId, {
                action: "requestChanges",
                campaignId,
                reportingItemId: item.id,
                submissionId: item.submissions[0].id,
                expectedRevision: item.revision,
                clientRequestId: randomUUID(),
                agencyFeedback:
                  "집계 기준 시점을 확인하고, 제공되지 않은 지표는 빈 값으로 유지해 주세요. 게시 링크가 참고 자료라는 설명도 유지해 주세요.",
                internalNote:
                  "운영팀 확인 전 보완 요청. 브랜드에는 아직 공개하지 않습니다.",
              });
              await refresh();
            }
            if (
              ["published-initial", "published", "update-review"].includes(
                scene.key,
              )
            )
              await release(1);
            if (["published", "update-review"].includes(scene.key))
              await submit(2);
            if (scene.key === "published") await release(2);
            assert.equal(item.status, scene.state);
            await tx.auditLog.create({
              data: {
                actorId: actors.admin.userId,
                action: "admin.demo.nte.reporting.seed",
                entityType: "Campaign",
                entityId: campaignId,
                payload: {
                  demo: true,
                  seed: NTE_REPORTING_SEED,
                  scenario: scene.key,
                },
              },
            });
            created.push({
              ...record,
              reportingItemId: item.id,
              state: item.status,
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
        console.log(
          "Concurrent write conflict; the seed transaction was rolled back. Retrying the same isolated fixture set.",
        );
        await delay((attempt + 1) * 1000);
      }
    }
    console.log(
      JSON.stringify({ seed: NTE_REPORTING_SEED, ...result }, null, 2),
    );
  }
} catch (error) {
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : `NTE reporting seed failed (${error.code || error.name}): check validated fixture preconditions`,
  );
  process.exitCode = 1;
} finally {
  try {
    await db.$disconnect();
  } finally {
    clearInterval(keepAlive);
  }
}
