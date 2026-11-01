import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";
import { NTE_GAME, NTE_PREFIX, NTE_SEED, nteCreators } from "./fixtures/nte-proposals.mjs";
import { NTE_ART, NTE_PRODUCTION_PREFIX, NTE_PRODUCTION_SEED, nteProductionScenarios, nteProductionNote } from "./fixtures/nte-production.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const require = createRequire(new URL("../../../packages/database/package.json", import.meta.url));
const { values } = parseArgs({ options: { apply: { type: "boolean", default: false }, "env-file": { type: "string", default: "apps/platform/.env.local" } } });
require("dotenv").config({ path: resolve(root, values["env-file"]), quiet: true });
const db = createDatabaseClient();
const id = key => `${NTE_PRODUCTION_PREFIX}-campaign-${key}`;

async function account(tx, email, type) {
  const row = await tx.user.findUnique({ where: { email }, select: { id: true, memberships: { where: { organization: { type } }, select: { role: true, organization: { select: { id: true, status: true, metadata: true } } } } } });
  assert.ok(row && row.memberships.length === 1, `Expected one ${type} membership for ${email}`);
  const member = row.memberships[0];
  assert.equal(member.organization.status, "ACTIVE");
  assert.ok(["OWNER", "ADMIN"].includes(member.role));
  if (type !== "PLATFORM") assert.equal(member.organization.metadata?.testWorkspaceAccess, true);
  return { userId: row.id, organizationId: member.organization.id };
}

async function inspect(tx) {
  const brand = await account(tx, "brand@brand.com", "BRAND");
  const agency = await account(tx, "agency@agency.com", "AGENCY");
  const admin = await account(tx, "admin@admin.com", "PLATFORM");
  const existing = await tx.campaign.findMany({ where: { id: { in: nteProductionScenarios.map(s => id(s.key)) } }, select: { id: true, brandOrganizationId: true, createdById: true, requirements: true } });
  assert.ok(existing.length === 0 || existing.length === nteProductionScenarios.length, "Partial production fixture set exists; preserve and inspect it");
  for (const row of existing) assert.ok(row.brandOrganizationId === brand.organizationId && row.createdById === brand.userId && row.requirements?.demo === true && row.requirements?.productionSeed === NTE_PRODUCTION_SEED, "Reserved fixture ID collision");
  const creators = await tx.creatorProfile.findMany({ where: { id: { in: nteCreators.map(c => `${NTE_PREFIX}-creator-${c.key}`) } } });
  assert.equal(creators.length, 3, "Seed the original NTE proposals first");
  assert.ok(creators.every(c => c.agencyOrganizationId === agency.organizationId && c.internalNotes.includes(NTE_SEED)));
  return { brand, agency, admin, existing };
}

try {
  const preflight = await inspect(db);
  if (!values.apply) {
    console.log(JSON.stringify({ mode: "read-only", accountsVerified: 3, campaignsToCreate: preflight.existing.length ? 0 : nteProductionScenarios.length, seed: NTE_PRODUCTION_SEED, existingRecordsPreserved: true }, null, 2));
  } else {
    const { applyAdminProposalMutation, applyBrandProposalDecision } = await import("@futures-medialab/database/proposals");
    const { applyAgencyProductionMutation, applyAdminProductionMutation, applyBrandProductionMutation, ensureCampaignProductionItems } = await import("@futures-medialab/database/production");
    const result = await db.$transaction(async tx => {
      const { brand, agency, admin, existing } = await inspect(tx);
      const now = new Date(), after = days => new Date(now.getTime() + days * 86400000).toISOString();
      const created = [];
      if (!existing.length) for (const scene of nteProductionScenarios) {
        const campaignId = id(scene.key), creator = nteCreators.find(c => c.key === scene.creator);
        const title = `[시연] 이환 · ${scene.title}`, requestId = `${NTE_PRODUCTION_PREFIX}-request-${scene.key}`;
        await tx.campaign.create({ data: {
          id: campaignId, brandOrganizationId: brand.organizationId, createdById: brand.userId, type: "MANAGED", status: "RECRUITING", title,
          summary: `${scene.concept}. 승인된 공식 제안 이후 에이전시 제출·관리자 검수·브랜드 승인을 확인하는 내부 시연입니다.`,
          coverImageUrl: NTE_ART.coverImageUrl, briefUrl: NTE_GAME.officialUrl,
          currency: "KRW", budgetAmount: scene.price, platforms: [creator.platform], regions: ["KR"], categories: ["gaming"], contentDeadline: new Date(after(35)), publishedAt: now,
          requirements: { demo: true, seed: NTE_SEED, productionSeed: NTE_PRODUCTION_SEED, game: { ...NTE_GAME, ...NTE_ART }, brandIntake: { requestId, submittedAt: now.toISOString() }, brandBrief: { genre: NTE_GAME.genre, goal: scene.concept, contentFormat: scene.deliverables, creatorCount: 1, desiredDate: after(35).slice(0, 10), note: "공식 이미지와 가상 구성안을 활용한 내부 제작·검수 시연", compositionPreference: "balanced" } },
        } });
        await tx.workspaceToolRequest.create({ data: { id: requestId, organizationId: brand.organizationId, userId: brand.userId, campaignId, assignedToId: admin.userId, tool: "campaign", title: `${title} · 제작 요청`, status: "IN_PROGRESS", inputJson: { demo: true, seed: NTE_PRODUCTION_SEED, kind: "campaign-intake", input: scene.concept } } });
        await tx.campaignApplication.create({ data: { id: `${NTE_PRODUCTION_PREFIX}-application-${scene.key}`, campaignId, agencyOrganizationId: agency.organizationId, submittedById: agency.userId, status: "SHORTLISTED", proposedAmount: (Number(scene.price) * 0.6).toFixed(2), currency: "KRW", proposal: "내부 시연용 공급 자료. 실제 계약·지급을 실행하지 않습니다.", rosterSnapshot: [], creators: { create: { creatorId: `${NTE_PREFIX}-creator-${creator.key}`, deliverables: [{ description: scene.deliverables, quantity: 1 }] } } } });
        await applyAdminProposalMutation(tx, admin.userId, { action: "createDraft", campaignId, clientRequestId: randomUUID() });
        let proposal = await tx.campaignProposal.findFirstOrThrow({ where: { campaignId, status: "DRAFT" } });
        await applyAdminProposalMutation(tx, admin.userId, { action: "saveDraft", campaignId, proposalId: proposal.id, expectedRevision: proposal.revision, clientRequestId: randomUUID(), data: {
          title: `${title} · 공식 제안서`, summary: scene.concept, changeSummary: "제작·검수 내부 시연용 최초 제안", expiresAt: after(14), terms: "내부 시연용 가상 제안입니다. 초안 검수 및 수정 1회, 크리에이터 채널 게시를 가정하며 실제 계약·송금·게시를 실행하지 않습니다.",
          items: [{ creatorId: `${NTE_PREFIX}-creator-${creator.key}`, creatorName: creator.name, platform: creator.platform, channelLabel: creator.name, channelUrl: creator.channelUrl, followers: 85000, averageViews: 22000, deliverables: scene.deliverables, quantity: 1, unitAmount: scene.price, scheduledAt: after(35), rights: "크리에이터 채널 게시 가정. 2차 편집·광고 소재 이용은 별도 협의.", supplierCost: (Number(scene.price) * 0.6).toFixed(2), internalNotes: `${NTE_PRODUCTION_SEED} 공급 비용과 내부 연락 메모` }],
        } });
        proposal = await tx.campaignProposal.findUniqueOrThrow({ where: { id: proposal.id } });
        await applyAdminProposalMutation(tx, admin.userId, { action: "publish", campaignId, proposalId: proposal.id, expectedRevision: proposal.revision, clientRequestId: randomUUID() });
        proposal = await tx.campaignProposal.findUniqueOrThrow({ where: { id: proposal.id }, include: { items: true } });
        await applyBrandProposalDecision(tx, brand, { action: "decide", proposalId: proposal.id, expectedRevision: proposal.revision, clientRequestId: randomUUID(), decision: "APPROVE", itemIds: proposal.items.map(p => p.id), message: "[내부 시연] 제작·검수 흐름 확인을 위한 제안 승인입니다." });
        await ensureCampaignProductionItems(tx, campaignId, admin.userId);
        let item = await tx.productionItem.findFirstOrThrow({ where: { campaignId } });
        const refresh = async () => { item = await tx.productionItem.findUniqueOrThrow({ where: { id: item.id }, include: { submissions: { orderBy: { version: "desc" } } } }); };
        const submit = async version => {
          await applyAgencyProductionMutation(tx, agency, { action: "submit", productionItemId: item.id, expectedRevision: item.revision, clientRequestId: randomUUID(), title: `[시연 구성안] ${scene.title} v${version}`, url: NTE_ART.imageSourceUrl, note: `${nteProductionNote(scene, version)}\n\n[운영팀 전달] 공식 이미지를 참고한 콘티입니다. 공급사 내부 확인 사항은 브랜드 공유본에 제외해 주세요.` });
          await refresh();
        };
        const release = async version => {
          await applyAdminProductionMutation(tx, admin.userId, { action: "releaseToBrand", campaignId, productionItemId: item.id, submissionId: item.submissions[0].id, expectedRevision: item.revision, clientRequestId: randomUUID(), title: `[시연 구성안] ${scene.title} v${version}`, url: NTE_ART.imageSourceUrl, note: nteProductionNote(scene, version), internalNote: "내부 검수: 공급사 원문 확인 및 브랜드 공개용 문안 검토 완료. 실제 집행·정산 없음." });
          await refresh();
        };
        if (scene.state !== "AWAITING_SUBMISSION") await submit(1);
        if (scene.state === "AGENCY_REVISION") {
          await applyAdminProductionMutation(tx, admin.userId, { action: "requestChanges", campaignId, productionItemId: item.id, submissionId: item.submissions[0].id, expectedRevision: item.revision, clientRequestId: randomUUID(), agencyFeedback: "첫 3초에 이환 게임명을 넣고 세로 자막 안전 영역을 확보해 주세요. 공식 이미지와 실제 플레이 장면을 구분해 주세요.", internalNote: "브랜드 공개 전 운영 검수에서 보완 필요. 공급사 내부 원문은 비공개 유지." });
        }
        if (["BRAND_REVIEW", "BRAND_REVISION", "APPROVED"].includes(scene.state)) await release(1);
        if (["BRAND_REVISION", "APPROVED"].includes(scene.state)) {
          await applyBrandProductionMutation(tx, brand, { action: "requestChanges", productionItemId: item.id, submissionId: item.submissions[0].id, expectedRevision: item.revision, clientRequestId: randomUUID(), message: "도입부를 3초로 줄이고 이환 게임명 자막과 공식 사이트 안내를 더 선명하게 보여 주세요." });
          await refresh();
        }
        if (scene.state === "APPROVED") {
          await submit(2); await release(2);
          await applyBrandProductionMutation(tx, brand, { action: "approve", productionItemId: item.id, submissionId: item.submissions[0].id, expectedRevision: item.revision, clientRequestId: randomUUID(), message: "[내부 시연] 수정 반영된 v2 구성안을 확인했습니다. 콘텐츠 검수 승인 기록이며 실제 게시·계약·정산은 실행하지 않습니다." });
        }
        await tx.auditLog.create({ data: { actorId: admin.userId, action: "admin.demo.nte.production.seed", entityType: "Campaign", entityId: campaignId, payload: { demo: true, seed: NTE_PRODUCTION_SEED, scenario: scene.state } } });
        created.push({ campaignId, productionItemId: item.id, state: scene.state });
      }
      // Add artwork to only the originally authorized NTE fixture campaigns.
      // Their proposals and decisions remain unchanged.
      const original = await tx.campaign.findMany({ where: { id: { in: ["private", "review", "revision", "approved"].map(key => `${NTE_PREFIX}-campaign-${key}`) }, brandOrganizationId: brand.organizationId }, select: { id: true, status: true, coverImageUrl: true, requirements: true } });
      for (const row of original) {
        assert.ok(row.requirements?.demo === true && row.requirements?.seed === NTE_SEED);
        const game = { ...NTE_GAME, ...NTE_ART };
        if (row.coverImageUrl !== NTE_ART.coverImageUrl || !Object.entries(game).every(([key, value]) => row.requirements.game?.[key] === value))
          await tx.campaign.update({ where: { id: row.id }, data: { coverImageUrl: NTE_ART.coverImageUrl, requirements: { ...row.requirements, game } } });
      }
      const oldApproved = original.find(row => row.id === `${NTE_PREFIX}-campaign-approved`);
      if (oldApproved && ["IN_PROGRESS", "VERIFYING"].includes(oldApproved.status) && !await tx.productionItem.count({ where: { campaignId: oldApproved.id } }))
        await ensureCampaignProductionItems(tx, oldApproved.id, admin.userId);
      return { mode: existing.length ? "preserved" : "created", scenarios: created, artworkCampaignCount: original.length + nteProductionScenarios.length };
    }, { isolationLevel: "Serializable", timeout: 120000 });
    console.log(JSON.stringify({ seed: NTE_PRODUCTION_SEED, ...result }, null, 2));
  }
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : `NTE production seed failed (${error.code || error.name}): ${error.code ? "inspect the validated seed action" : "check fixture preconditions"}`);
  process.exitCode = 1;
} finally { await db.$disconnect(); }
