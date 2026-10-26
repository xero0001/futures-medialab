import "server-only";
import { getDatabase, Prisma } from "@futures-medialab/database";
import { boundary, fail, json, rateLimit, readBody, recheckAdmin, requireAdmin, verifyOrigin } from "./access";
import { campaignOperationsSchema, canReviewContent, matchesSettlementBudget, safeOperationUrl, settlementAmounts } from "./campaign-operations-validation";
import type { CampaignOperationsData } from "./types";

const activeCampaignStates = ["RECRUITING", "IN_PROGRESS", "VERIFYING", "SETTLING"];
const date = (value: Date | null) => value?.toISOString() ?? null;

async function checkSettlementAgreement(tx: Prisma.TransactionClient, application: {
  campaignId: string; currency: string; proposedAmount: Prisma.Decimal | null;
  campaign: { currency: string; budgetAmount: Prisma.Decimal | null };
}, gross: string, settlementId: string | null) {
  if (application.currency !== application.campaign.currency) fail(409, "CURRENCY_CHANGED", "캠페인과 신청의 통화가 다릅니다. 합의 내용을 먼저 확인하세요.");
  const others = await tx.settlement.findMany({ where: {
    application: { campaignId: application.campaignId }, status: { not: "REJECTED" },
    ...(settlementId ? { id: { not: settlementId } } : {}),
  }, select: { currency: true, grossAmount: true } });
  if (others.some((row) => row.currency !== application.currency) || !matchesSettlementBudget(gross,
    application.proposedAmount?.toFixed(2) ?? null, application.campaign.budgetAmount?.toFixed(2) ?? null,
    others.map((row) => row.grossAmount.toFixed(2))))
    fail(409, "AMOUNT_MISMATCH", "총액은 신청 제안 금액과 일치해야 하며, 캠페인 전체 정산 합계가 예산을 넘을 수 없습니다.");
}

export function campaignOperations(request: Request) {
  return boundary(async () => {
    const campaignId = new URL(request.url).searchParams.get("campaignId") ?? "";
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(campaignId)) fail(400, "INVALID_INPUT", "캠페인을 선택하세요.");
    const admin = await requireAdmin(request.headers);
    await rateLimit(admin, "operations-read", 120);
    const result = await getDatabase().$transaction(async (tx): Promise<CampaignOperationsData> => {
      await recheckAdmin(tx, admin);
      const campaign = await tx.campaign.findUnique({ where: { id: campaignId }, select: {
        id: true, status: true, regions: true, categories: true, followerMin: true, followerMax: true,
        briefUrl: true, contentDeadline: true, requirements: true, settlementPolicy: true, managedRequest: true,
        _count: { select: { applications: true } },
        applications: { orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 100, select: {
          id: true, status: true, agencyOrganizationId: true, proposal: true, proposedAmount: true, currency: true,
          agencyOrganization: { select: { name: true } }, rosterSnapshot: true,
          creators: { orderBy: { creatorId: "asc" }, take: 100, select: { deliverables: true,
            creator: { select: { id: true, agencyOrganizationId: true, displayName: true, channels: true, categories: true } } } },
          submissions: { orderBy: { version: "desc" }, take: 20 }, contract: true, settlement: true,
        } },
      } });
      if (!campaign) fail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
      return {
        campaignId, status: campaign.status, regions: campaign.regions, categories: campaign.categories,
        followerMin: campaign.followerMin, followerMax: campaign.followerMax,
        briefUrl: safeOperationUrl(campaign.briefUrl), contentDeadline: date(campaign.contentDeadline),
        requirements: campaign.requirements, settlementPolicy: campaign.settlementPolicy, managedRequest: campaign.managedRequest,
        totalApplications: campaign._count.applications,
        applications: campaign.applications.map((application) => ({
          id: application.id, agencyName: application.agencyOrganization.name, status: application.status,
          proposal: application.proposal, proposedAmount: application.proposedAmount?.toFixed(2) ?? null,
          currency: application.currency, rosterSnapshot: application.rosterSnapshot,
          creators: application.creators.filter(({ creator }) => creator.agencyOrganizationId === application.agencyOrganizationId)
            .map(({ creator, deliverables }) => ({ id: creator.id, name: creator.displayName, channels: creator.channels, categories: creator.categories, deliverables })),
          submissions: application.submissions.map((row) => ({
            id: row.id, version: row.version, status: row.status, draftUrl: safeOperationUrl(row.draftUrl),
            publishedUrl: safeOperationUrl(row.publishedUrl), reviewNotes: row.reviewNotes,
            submittedAt: date(row.submittedAt), reviewedAt: date(row.reviewedAt), verifiedAt: date(row.verifiedAt), updatedAt: row.updatedAt.toISOString(),
          })),
          contract: application.contract ? {
            id: application.contract.id, status: application.contract.status, version: application.contract.version,
            referenceUrl: safeOperationUrl(application.contract.referenceUrl), notes: application.contract.notes,
            confirmedAt: date(application.contract.confirmedAt), updatedAt: application.contract.updatedAt.toISOString(),
          } : null,
          settlement: application.settlement ? {
            id: application.settlement.id, status: application.settlement.status, version: application.settlement.version,
            currency: application.settlement.currency, grossAmount: application.settlement.grossAmount.toFixed(2),
            platformFeeAmount: application.settlement.platformFeeAmount.toFixed(2), withholdingAmount: application.settlement.withholdingAmount.toFixed(2),
            netAmount: application.settlement.netAmount.toFixed(2), reviewNotes: application.settlement.adminReviewNotes,
            requestedAt: date(application.settlement.requestedAt), approvedAt: date(application.settlement.approvedAt),
          } : null,
        })),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 });
    return json(result);
  });
}

export function mutateCampaignOperations(request: Request) {
  return boundary(async () => {
    verifyOrigin(request);
    const admin = await requireAdmin(request.headers);
    await rateLimit(admin, "operations-write", 30);
    const input = await readBody(request, campaignOperationsSchema);
    await getDatabase().$transaction(async (tx) => {
      await recheckAdmin(tx, admin);
      const application = await tx.campaignApplication.findFirst({ where: { id: input.applicationId, campaignId: input.campaignId }, include: {
        agencyOrganization: { select: { status: true } }, campaign: { select: { status: true, currency: true, budgetAmount: true, brandOrganization: { select: { status: true } } } },
        submissions: { orderBy: { version: "desc" }, take: 1 }, contract: true, settlement: true,
      } });
      if (!application) fail(404, "NOT_FOUND", "신청 내역을 찾을 수 없습니다.");
      if (application.status !== "ACCEPTED" || application.agencyOrganization.status !== "ACTIVE" ||
        application.campaign.brandOrganization.status !== "ACTIVE" || !activeCampaignStates.includes(application.campaign.status))
        fail(409, "INVALID_STATE", "활성 캠페인에 선정된 승인 조직만 운영할 수 있습니다.");
      const now = new Date();
      let entityType = "CampaignApplication", entityId = application.id;
      let before: Prisma.InputJsonValue = {}, after: Prisma.InputJsonValue = {};
      if (input.action === "reviewContent") {
        const current = application.submissions[0];
        if (!current || current.id !== input.submissionId || current.updatedAt.toISOString() !== input.expectedUpdatedAt)
          fail(409, "CONFLICT", "최신 제출 내역을 새로고침한 후 검토하세요.");
        if (!canReviewContent(current.status, input.status) || (input.status === "VERIFIED" && !safeOperationUrl(current.publishedUrl)))
          fail(409, "INVALID_STATE", "현재 제출 상태에서 수행할 수 없는 검토입니다.");
        if (application.settlement && ["APPROVED", "PROCESSING", "PAID"].includes(application.settlement.status))
          fail(409, "LOCKED", "정산 승인 이후에는 콘텐츠를 변경할 수 없습니다.");
        await tx.contentSubmission.update({ where: { id: current.id }, data: {
          status: input.status, reviewNotes: input.reason, reviewedAt: now,
          verifiedAt: input.status === "VERIFIED" ? now : null,
        } });
        entityType = "ContentSubmission"; entityId = current.id;
        before = { status: current.status, reviewNotes: current.reviewNotes };
        after = { status: input.status, reviewNotes: input.reason, version: current.version };
      } else if (input.action === "saveContract") {
        const current = application.contract;
        if ((current?.version ?? null) !== input.expectedVersion) fail(409, "CONFLICT", "계약 참고 기록이 변경되었습니다.");
        if (input.status === "CONFIRMED" && !input.referenceUrl) fail(400, "INVALID_INPUT", "확인된 계약의 참고 링크를 입력하세요.");
        if (application.settlement && ["APPROVED", "PROCESSING", "PAID"].includes(application.settlement.status))
          fail(409, "LOCKED", "정산 승인 후 계약 참고 기록은 변경할 수 없습니다.");
        const values = { status: input.status, referenceUrl: input.referenceUrl || null, notes: input.notes,
          confirmedAt: input.status === "CONFIRMED" ? now : null };
        const saved = current ? await tx.campaignContract.update({ where: { id: current.id }, data: { ...values, version: { increment: 1 } } }) :
          await tx.campaignContract.create({ data: { applicationId: application.id, ...values } });
        entityType = "CampaignContract"; entityId = saved.id;
        before = current ? { status: current.status, referenceUrl: current.referenceUrl, notes: current.notes, version: current.version } : {};
        after = { ...values, confirmedAt: date(values.confirmedAt), version: saved.version };
      } else if (input.action === "prepareSettlement") {
        const current = application.settlement;
        if ((current?.version ?? null) !== input.expectedVersion) fail(409, "CONFLICT", "정산 기록이 변경되었습니다.");
        if (current && (!["PENDING", "REQUESTED", "REJECTED"].includes(current.status) || current.agencyOrganizationId !== application.agencyOrganizationId))
          fail(409, "INVALID_STATE", "수정할 수 없는 정산 기록입니다.");
        const amounts = settlementAmounts(input.grossAmount, input.platformFeeAmount, input.withholdingAmount);
        if (!amounts) fail(400, "INVALID_AMOUNT", "총액은 양수여야 하며 수수료와 공제액의 합이 총액을 넘을 수 없습니다.");
        await checkSettlementAgreement(tx, application, amounts.grossAmount, current?.id ?? null);
        const values = { ...amounts, currency: application.currency, status: "REQUESTED" as const, requestedAt: now,
          approvedAt: null, adminReviewNotes: input.reason };
        const saved = current ? await tx.settlement.update({ where: { id: current.id }, data: { ...values, version: { increment: 1 } } }) :
          await tx.settlement.create({ data: { ...values, applicationId: application.id, agencyOrganizationId: application.agencyOrganizationId } });
        entityType = "Settlement"; entityId = saved.id;
        before = current ? { status: current.status, grossAmount: current.grossAmount.toFixed(2), netAmount: current.netAmount.toFixed(2), version: current.version } : {};
        after = { ...amounts, currency: application.currency, status: "REQUESTED", version: saved.version };
      } else {
        const current = application.settlement;
        if (!current || current.version !== input.expectedVersion) fail(409, "CONFLICT", "정산 기록을 새로고침하세요.");
        if (current.status !== "REQUESTED" || current.agencyOrganizationId !== application.agencyOrganizationId || current.currency !== application.currency)
          fail(409, "INVALID_STATE", "검토 대기 중인 동일 조직·통화의 정산만 처리할 수 있습니다.");
        const amounts = settlementAmounts(current.grossAmount.toFixed(2), current.platformFeeAmount.toFixed(2), current.withholdingAmount.toFixed(2));
        if (!amounts || !current.netAmount.equals(new Prisma.Decimal(amounts.netAmount))) fail(409, "INVALID_AMOUNT", "정산 금액을 다시 확인하세요.");
        if (input.status === "APPROVED") await checkSettlementAgreement(tx, application, amounts.grossAmount, current.id);
        if (input.status === "APPROVED" && (application.contract?.status !== "CONFIRMED" || !safeOperationUrl(application.contract.referenceUrl) ||
          application.submissions[0]?.status !== "VERIFIED" || !application.submissions[0].verifiedAt || !safeOperationUrl(application.submissions[0].publishedUrl)))
          fail(409, "REVIEW_REQUIRED", "계약 참고 확인과 최신 게시물 검증을 완료한 후 정산을 승인하세요.");
        await tx.settlement.update({ where: { id: current.id }, data: { status: input.status,
          approvedAt: input.status === "APPROVED" ? now : null, adminReviewNotes: input.reason, version: { increment: 1 } } });
        entityType = "Settlement"; entityId = current.id;
        before = { status: current.status, version: current.version };
        after = { status: input.status, version: current.version + 1, netAmount: current.netAmount.toFixed(2), currency: current.currency };
      }
      await tx.auditLog.create({ data: { actorId: admin.userId, action: `admin.${input.action}`, entityType, entityId,
        payload: { reason: input.reason, campaignId: input.campaignId, applicationId: input.applicationId, before, after } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    return json({ success: true });
  });
}
