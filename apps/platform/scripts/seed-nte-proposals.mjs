import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";
import { NTE_GAME, NTE_PREFIX, NTE_SEED, nteCampaigns, nteCreators } from "./fixtures/nte-proposals.mjs";

// Explicit opt-in, additive fixtures for the three user-authorized accounts.
// Existing credentials, memberships, customer records and completed demo actions
// are never reset. The application service records actual publication/decisions.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const require = createRequire(new URL("../../../packages/database/package.json", import.meta.url));
const { values } = parseArgs({ options: { apply: { type: "boolean", default: false }, "env-file": { type: "string", default: "apps/platform/.env.local" } } });
require("dotenv").config({ path: resolve(root, values["env-file"]), quiet: true });
const db = createDatabaseClient();
const campaignId = (key) => `${NTE_PREFIX}-campaign-${key}`;
const creatorId = (key) => `${NTE_PREFIX}-creator-${key}`;
const marker = (value) => value?.demo === true && value?.seed === NTE_SEED;

async function target(tx, email, type) {
  const user = await tx.user.findUnique({ where: { email }, select: { id: true, email: true, memberships: { where: { organization: { type } }, select: { role: true, organization: { select: { id: true, type: true, status: true, metadata: true } } } } } });
  assert.ok(user && user.memberships.length === 1, `Expected exactly one ${type} membership for ${email}`);
  const { organization, role } = user.memberships[0];
  assert.equal(organization.status, "ACTIVE", `${email} must already be approved`);
  assert.ok(["OWNER", "ADMIN"].includes(role), `${email} must already be a manager`);
  if (type !== "PLATFORM") assert.equal(organization.metadata?.testWorkspaceAccess, true, `${email} must be an approved test organization`);
  return { userId: user.id, organizationId: organization.id };
}

async function inspect(tx) {
  const brand = await target(tx, "brand@brand.com", "BRAND");
  const agency = await target(tx, "agency@agency.com", "AGENCY");
  const admin = await target(tx, "admin@admin.com", "PLATFORM");
  const existing = await tx.campaign.findMany({ where: { id: { in: nteCampaigns.map((c) => campaignId(c.key)) } }, select: { id: true, brandOrganizationId: true, createdById: true, requirements: true } });
  for (const row of existing) assert.ok(row.brandOrganizationId === brand.organizationId && row.createdById === brand.userId && marker(row.requirements), "Reserved campaign ID collision; no changes made");
  assert.ok(existing.length === 0 || existing.length === nteCampaigns.length, "Partial fixture set exists; preserve it and inspect manually");
  const creators = await tx.creatorProfile.findMany({ where: { id: { in: nteCreators.map((c) => creatorId(c.key)) } }, select: { id: true, agencyOrganizationId: true, internalNotes: true } });
  for (const row of creators) assert.ok(row.agencyOrganizationId === agency.organizationId && row.internalNotes.includes(NTE_SEED), "Reserved creator ID collision; no changes made");
  if (!existing.length) assert.equal(creators.length, 0, "Partial creator set exists; preserve it and inspect manually");
  return { brand, agency, admin, existing };
}

try {
  const preflight = await inspect(db);
  if (!values.apply) {
    console.log(JSON.stringify({ mode: "read-only", accountsVerified: 3, campaignsToCreate: preflight.existing.length ? 0 : nteCampaigns.length, creatorsToCreate: preflight.existing.length ? 0 : nteCreators.length, seed: NTE_SEED, existingDataPreserved: true }, null, 2));
  } else if (preflight.existing.length) {
    console.log("PRESERVED existing NTE demo campaigns and their current decisions; no reset performed.");
  } else {
    const { applyAdminProposalMutation, applyBrandProposalDecision } = await import("@futures-medialab/database/proposals");
    const now = new Date();
    const afterDays = (days) => new Date(now.getTime() + days * 86_400_000);
    const result = await db.$transaction(async (tx) => {
      const { brand, agency, admin, existing } = await inspect(tx);
      assert.equal(existing.length, 0, "Fixtures were created concurrently; rerun to preserve them");
      for (const [index, creator] of nteCreators.entries()) {
        await tx.creatorProfile.create({ data: {
          id: creatorId(creator.key), agencyOrganizationId: agency.organizationId,
          displayName: creator.name, countryCode: "KR", primaryLanguage: "KO",
          channels: [{ platform: creator.platform, name: creator.name, url: creator.channelUrl, followers: [160000, 85000, 42000][index] }],
          categories: ["gaming", "entertainment"],
          internalNotes: `${NTE_SEED} · 가상 내부 시연 인물. 공급사 연락처·가격은 브랜드 비공개.`,
        } });
      }
      const seeded = [];
      for (const campaign of nteCampaigns) {
        const id = campaignId(campaign.key);
        const requestId = `${NTE_PREFIX}-request-${campaign.key}`;
        const contentDate = afterDays(campaign.desiredDays);
        const platforms = [...new Set(campaign.items.map((item) => nteCreators.find((creator) => creator.key === item.creator).platform))];
        await tx.campaign.create({ data: {
          id, brandOrganizationId: brand.organizationId, createdById: brand.userId,
          type: "MANAGED", status: campaign.state === "DRAFT" ? "REVIEW" : "RECRUITING",
          title: campaign.title, summary: campaign.summary, currency: "KRW",
          budgetAmount: campaign.budgetAmount, platforms, regions: ["KR"], categories: ["gaming"],
          contentDeadline: contentDate, publishedAt: campaign.state === "DRAFT" ? null : now,
          briefUrl: NTE_GAME.officialUrl,
          requirements: { demo: true, seed: NTE_SEED, game: NTE_GAME,
            brandBrief: { genre: NTE_GAME.genre, goal: campaign.goal, contentFormat: campaign.format, creatorCount: campaign.items.length, desiredDate: contentDate.toISOString().slice(0, 10), note: campaign.note, compositionPreference: "balanced" },
            brandIntake: { requestId, submittedAt: now.toISOString() },
          },
        } });
        await tx.workspaceToolRequest.create({ data: {
          id: requestId, organizationId: brand.organizationId, userId: brand.userId,
          campaignId: id, assignedToId: admin.userId, tool: "campaign",
          title: `${campaign.title} · 맞춤 제안`, status: "IN_PROGRESS", dueAt: afterDays(2),
          inputJson: { demo: true, seed: NTE_SEED, route: "managed", kind: "campaign-intake", submittedAt: now.toISOString(), input: campaign.summary },
        } });
        const application = await tx.campaignApplication.create({ data: {
          id: `${NTE_PREFIX}-application-${campaign.key}`, campaignId: id,
          agencyOrganizationId: agency.organizationId, submittedById: agency.userId,
          status: "SHORTLISTED", currency: "KRW", proposedAmount: (Number(campaign.budgetAmount) * 0.6).toFixed(2),
          proposal: "[내부 시연] 이환 콘텐츠를 위한 공급 파트너 제안입니다. 공식 브랜드 제안과 별도로 운영팀이 검토하는 자료입니다.",
          rosterSnapshot: [], creators: { create: campaign.items.map((item) => ({ creatorId: creatorId(item.creator), deliverables: [{ description: item.deliverables, quantity: item.quantity }] })) },
        } });
        await tx.auditLog.create({ data: { actorId: admin.userId, action: "admin.demo.nte.seed", entityType: "Campaign", entityId: id, payload: { seed: NTE_SEED, demo: true, applicationId: application.id, reason: "사용자 요청에 따른 이환 내부 시연 데이터" } } });
        await applyAdminProposalMutation(tx, admin.userId, { action: "createDraft", campaignId: id, clientRequestId: randomUUID() });
        let proposal = await tx.campaignProposal.findFirstOrThrow({ where: { campaignId: id, status: "DRAFT" } });
        await applyAdminProposalMutation(tx, admin.userId, { action: "saveDraft", campaignId: id, proposalId: proposal.id, expectedRevision: proposal.revision, clientRequestId: randomUUID(), data: {
          title: `${campaign.title} · 공식 제안서`, summary: campaign.goal,
          changeSummary: "최초 제안 · 내부 시연용", expiresAt: afterDays(14).toISOString(),
          terms: "내부 시연용 가상 제안입니다. 표시 금액은 부가세 별도이며 실제 계약·제작 확정·송금·정산을 실행하지 않습니다. 게시 전 초안 검수 1회와 수정 1회를 포함합니다. 2차 광고 집행·원본 제공·독점권은 포함하지 않으며 별도 협의합니다.",
          items: campaign.items.map((item) => {
            const creator = nteCreators.find((entry) => entry.key === item.creator);
            const index = nteCreators.indexOf(creator);
            return { creatorId: creatorId(creator.key), creatorName: creator.name, platform: creator.platform, channelLabel: creator.name, channelUrl: creator.channelUrl,
              followers: [160000, 85000, 42000][index], averageViews: [42000, 22000, 18000][index],
              deliverables: item.deliverables, quantity: item.quantity, unitAmount: item.unitPrice,
              scheduledAt: contentDate.toISOString(), rights: "크리에이터 채널 게시 및 브랜드 공식 채널 링크 공유. 2차 편집·광고 소재 활용은 별도 협의.",
              supplierCost: (Number(item.unitPrice) * 0.6).toFixed(2), internalNotes: `${NTE_SEED}: 시연용 공급 단가·섭외 메모. 브랜드 응답에 포함하지 않습니다.` };
          }),
        } });
        proposal = await tx.campaignProposal.findUniqueOrThrow({ where: { id: proposal.id } });
        if (campaign.state !== "DRAFT") {
          await applyAdminProposalMutation(tx, admin.userId, { action: "publish", campaignId: id, proposalId: proposal.id, expectedRevision: proposal.revision, clientRequestId: randomUUID() });
          proposal = await tx.campaignProposal.findUniqueOrThrow({ where: { id: proposal.id }, include: { items: true } });
          if (["APPROVED", "CHANGES_REQUESTED"].includes(campaign.state)) {
            await applyBrandProposalDecision(tx, brand, { action: "decide", proposalId: proposal.id, expectedRevision: proposal.revision, clientRequestId: randomUUID(),
              decision: campaign.state === "APPROVED" ? "APPROVE" : "REQUEST_CHANGES", itemIds: proposal.items.map((item) => item.id),
              message: campaign.changeReason || "[내부 시연] 제안 구성·금액·일정·사용권을 확인했습니다. 실제 계약이나 지급이 발생하지 않는 시연 승인입니다." });
          }
        }
        seeded.push({ campaignId: id, proposalId: proposal.id, title: campaign.title, state: campaign.state });
      }
      return seeded;
    }, { isolationLevel: "Serializable", timeout: 60_000 });
    console.log(JSON.stringify({ seed: NTE_SEED, createdCampaigns: result.length, createdCreators: nteCreators.length, campaigns: result }, null, 2));
  }
} catch (error) {
  // Never dump a Prisma error with connection/auth details.
  console.error(error instanceof assert.AssertionError ? error.message : `NTE seed failed (${error.code || error.name})`);
  process.exitCode = 1;
} finally { await db.$disconnect(); }
