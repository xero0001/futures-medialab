import "server-only";
import { getDatabase, Prisma } from "@futures-medialab/database";
import {
  boundary,
  fail,
  json,
  rateLimit,
  recheckAdmin,
  requireAdmin,
} from "./access";
import { operationsDate as iso, safeDocumentUrl } from "./operations-query";
import type {
  AdminCampaignDocument,
  AdminCampaignDocumentsResponse,
} from "./operations-types";
const limit = 100;
const statusLabels: Record<string, string> = {
  DRAFT: "비공개 초안",
  PUBLISHED: "공개됨",
  PARTIALLY_APPROVED: "일부 승인",
  APPROVED: "브랜드 승인",
  CHANGES_REQUESTED: "수정 요청",
  REJECTED: "반려",
  SUPERSEDED: "이전 버전",
  ADMIN_REVIEW: "운영팀 검토",
  AGENCY_REVISION: "파트너 보완",
  AWAITING_SUBMISSION: "제출 대기",
  ISSUED: "발행됨",
  PAID: "입금·지급 완료",
};
const label = (value: string) => statusLabels[value] ?? value;
const money = (
  value: { toFixed: (digits: number) => string },
  currency: string,
) => `${currency} ${value.toFixed(2)}`;
const detail = (label: string, value: string | null | undefined) => ({
  label,
  value: value || "미등록",
});
function file(value: string | null, name: string) {
  const url = safeDocumentUrl(value);
  return url ? { url, name } : null;
}
function metrics(value: unknown): string {
  if (!value || typeof value !== "object") return "미집계";
  const labels: Record<string, string> = {
    views: "조회",
    impressions: "노출",
    reach: "도달",
    likes: "좋아요",
    comments: "댓글",
    shares: "공유",
    saves: "저장",
    clicks: "클릭",
  };
  return Object.entries(labels)
    .map(([key, name]) => {
      const v = (value as Record<string, unknown>)[key];
      return `${name} ${typeof v === "number" ? v.toLocaleString("ko-KR") : "미집계"}`;
    })
    .join(" · ");
}
export function adminCampaignDocumentsApi(request: Request) {
  return boundary(async () => {
    if (request.method !== "GET")
      return json({ message: "허용되지 않은 요청입니다." }, 405);
    const admin = await requireAdmin(request.headers);
    await rateLimit(admin, "campaign-documents-read", 120);
    const campaignId = new URL(request.url).searchParams.get("campaignId");
    if (!campaignId || !/^[a-zA-Z0-9_-]{1,120}$/.test(campaignId))
      fail(400, "INVALID_INPUT", "캠페인을 선택해 주세요.");
    const result = await getDatabase().$transaction(
      async (tx) => {
        await recheckAdmin(tx, admin);
        const campaign = await tx.campaign.findUnique({
          where: { id: campaignId },
          select: {
            id: true,
            title: true,
            brandOrganizationId: true,
            brandOrganization: { select: { name: true } },
          },
        });
        if (!campaign) fail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
        const latestPublished = await tx.campaignProposal.findFirst({
          where: {
            campaignId,
            publishedAt: { not: null },
            status: { not: "DRAFT" },
          },
          orderBy: { version: "desc" },
          select: { id: true },
        });
        // Deliberately select document fields only: storage keys, supplier costs and internal notes are never serialized.
        const proposals = await tx.campaignProposal.findMany({
          where: { campaignId },
          orderBy: { version: "desc" },
          take: limit + 1,
          select: {
            id: true,
            title: true,
            status: true,
            version: true,
            publishedAt: true,
            updatedAt: true,
            summary: true,
            terms: true,
            changeSummary: true,
            currency: true,
            expiresAt: true,
            items: {
              orderBy: { position: "asc" },
              select: {
                creatorName: true,
                platform: true,
                deliverables: true,
                quantity: true,
                unitAmount: true,
                rights: true,
              },
            },
          },
        });
        const reports = await tx.reportingSubmission.findMany({
          where: {
            reportingItem: { campaignId, productionItem: { campaignId } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: limit + 1,
          select: {
            id: true,
            reportingItemId: true,
            version: true,
            status: true,
            submittedAt: true,
            updatedAt: true,
            releasedAt: true,
            sourceTitle: true,
            sourcePostUrl: true,
            sourceEvidenceUrl: true,
            sourceNote: true,
            sourceMetrics: true,
            releasedTitle: true,
            releasedPostUrl: true,
            releasedEvidenceUrl: true,
            releasedNote: true,
            releasedMetrics: true,
            reportingItem: {
              select: {
                productionItem: {
                  select: {
                    proposalItem: {
                      select: {
                        creatorName: true,
                        proposal: { select: { id: true, version: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        });
        const invoices = await tx.brandInvoice.findMany({
          where: {
            campaignId,
            brandOrganizationId: campaign.brandOrganizationId,
          },
          orderBy: { createdAt: "desc" },
          take: limit + 1,
          select: {
            id: true,
            title: true,
            status: true,
            issuedAt: true,
            updatedAt: true,
            documentUrl: true,
            currency: true,
            amount: true,
            note: true,
            dueAt: true,
            paidAt: true,
          },
        });
        const payouts = await tx.agencyPayout.findMany({
          where: { campaignId },
          orderBy: { createdAt: "desc" },
          take: limit + 1,
          select: {
            id: true,
            title: true,
            status: true,
            issuedAt: true,
            updatedAt: true,
            documentUrl: true,
            currency: true,
            amount: true,
            note: true,
            dueAt: true,
            paidAt: true,
            supplierOrganization: { select: { name: true } },
          },
        });
        const attachments = await tx.requestAttachment.findMany({
          where: {
            discardedAt: null,
            messageId: { not: null },
            request: {
              campaignId,
              organizationId: campaign.brandOrganizationId,
            },
            message: {
              is: {
                request: {
                  campaignId,
                  organizationId: campaign.brandOrganizationId,
                },
              },
            },
          },
          orderBy: [{ message: { createdAt: "desc" } }, { id: "asc" }],
          take: limit + 1,
          select: {
            id: true,
            requestId: true,
            fileName: true,
            size: true,
            contentType: true,
            message: {
              select: { requestId: true, internal: true, createdAt: true },
            },
            request: { select: { title: true } },
          },
        });
        const documents: AdminCampaignDocument[] = [];
        for (const p of proposals.slice(0, limit)) {
          const shared = Boolean(p.publishedAt) && p.status !== "DRAFT";
          documents.push({
            id: `proposal:${p.id}`,
            kind: "proposal",
            title: p.title || `공식 제안 v${p.version}`,
            status: label(p.status),
            version: p.version,
            scope: shared ? "brand" : "internal",
            recipient: shared ? campaign.brandOrganization.name : "운영팀",
            sharedAt: shared ? iso(p.publishedAt) : null,
            updatedAt: iso(p.updatedAt)!,
            isLatest: shared
              ? p.id === latestPublished?.id
              : p.id === proposals.find((x) => x.status === "DRAFT")?.id,
            section: "proposal",
            requestId: null,
            file: null,
            details: [
              detail("공개 요약", p.summary),
              detail("공통 조건", p.terms),
              detail("변경 내용", p.changeSummary),
              detail("유효기간", iso(p.expiresAt)),
              ...p.items.map((i, index) =>
                detail(
                  `${index + 1}. ${i.creatorName || "인물 미등록"} · ${i.platform}`,
                  `${i.deliverables} · ${i.quantity}개 · 단가 ${i.unitAmount ? money(i.unitAmount, p.currency) : "미등록"}\n사용권: ${i.rights || "미등록"}`,
                ),
              ),
            ],
          });
        }
        const reportLatest = new Map<string, number>();
        for (const r of reports) {
          const key = `${r.reportingItemId}:${r.releasedAt ? "public" : "internal"}`;
          reportLatest.set(
            key,
            Math.max(reportLatest.get(key) ?? 0, r.version),
          );
        }
        for (const r of reports.slice(0, limit)) {
          const shared = Boolean(r.releasedAt),
            item = r.reportingItem.productionItem.proposalItem;
          documents.push({
            id: `report:${r.id}`,
            kind: "report",
            title:
              (shared ? r.releasedTitle : r.sourceTitle) ||
              `${item.creatorName} 성과 보고`,
            status: shared ? "브랜드 공개" : label(r.status),
            version: r.version,
            scope: shared ? "brand" : "internal",
            recipient: shared ? campaign.brandOrganization.name : "운영팀",
            sharedAt: iso(r.releasedAt),
            updatedAt: iso(r.updatedAt)!,
            isLatest:
              r.version ===
              reportLatest.get(
                `${r.reportingItemId}:${shared ? "public" : "internal"}`,
              ),
            section: "reporting",
            requestId: null,
            file: file(
              shared ? r.releasedEvidenceUrl : r.sourceEvidenceUrl,
              "성과 참고 자료",
            ),
            details: [
              detail(
                "대상",
                `${item.creatorName} · 공식 제안 v${item.proposal.version}`,
              ),
              detail(
                shared ? "공개 게시 링크" : "제출 게시 링크",
                shared ? r.releasedPostUrl : r.sourcePostUrl,
              ),
              detail(
                "성과 지표",
                metrics(shared ? r.releasedMetrics : r.sourceMetrics),
              ),
              detail(
                shared ? "공개 안내" : "제출 설명",
                shared ? r.releasedNote : r.sourceNote,
              ),
              detail("제출일", iso(r.submittedAt)),
            ],
          });
        }
        for (const i of invoices.slice(0, limit)) {
          const shared = i.status !== "DRAFT" && Boolean(i.issuedAt);
          documents.push({
            id: `invoice:${i.id}`,
            kind: "invoice",
            title: i.title,
            status: label(i.status),
            version: null,
            scope: shared ? "brand" : "internal",
            recipient: shared ? campaign.brandOrganization.name : "운영팀",
            sharedAt: shared ? iso(i.issuedAt) : null,
            updatedAt: iso(i.updatedAt)!,
            isLatest: true,
            section: "settlement",
            requestId: null,
            file: file(i.documentUrl, "청구 원본"),
            details: [
              detail("청구 금액", money(i.amount, i.currency)),
              detail("납부 기한", iso(i.dueAt)),
              detail("공개 안내", i.note),
              detail("입금 확인일", iso(i.paidAt)),
            ],
          });
        }
        for (const p of payouts.slice(0, limit)) {
          const shared = p.status !== "DRAFT" && Boolean(p.issuedAt);
          documents.push({
            id: `payout:${p.id}`,
            kind: "payout",
            title: p.title,
            status: label(p.status),
            version: null,
            scope: shared ? "partner" : "internal",
            recipient: shared ? p.supplierOrganization.name : "운영팀",
            sharedAt: shared ? iso(p.issuedAt) : null,
            updatedAt: iso(p.updatedAt)!,
            isLatest: true,
            section: "settlement",
            requestId: null,
            file: file(p.documentUrl, "지급 원본"),
            details: [
              detail("수신 파트너", p.supplierOrganization.name),
              detail("지급 금액", money(p.amount, p.currency)),
              detail("지급 예정일", iso(p.dueAt)),
              detail("공개 안내", p.note),
              detail("지급 확인일", iso(p.paidAt)),
            ],
          });
        }
        for (const a of attachments.slice(0, limit)) {
          if (!a.message || a.message.requestId !== a.requestId) continue;
          const internal = a.message.internal;
          documents.push({
            id: `attachment:${a.id}`,
            kind: "attachment",
            title: a.fileName,
            status: internal ? "내부 첨부" : "공개 첨부",
            version: null,
            scope: internal ? "internal" : "brand",
            recipient: internal ? "운영팀" : campaign.brandOrganization.name,
            sharedAt: internal ? null : iso(a.message.createdAt),
            updatedAt: iso(a.message.createdAt)!,
            isLatest: true,
            section: "documents",
            requestId: a.requestId,
            file: {
              url: `/api/admin/requests/${encodeURIComponent(a.requestId)}/attachments/${encodeURIComponent(a.id)}`,
              name: a.fileName,
            },
            details: [
              detail("공유 요청", a.request.title),
              detail("파일 유형", a.contentType),
              detail(
                "크기",
                `${Math.max(1, Math.round(a.size / 1024)).toLocaleString()} KB`,
              ),
            ],
          });
        }
        documents.sort(
          (a, b) =>
            Date.parse(b.sharedAt ?? b.updatedAt) -
              Date.parse(a.sharedAt ?? a.updatedAt) || a.id.localeCompare(b.id),
        );
        return {
          campaignId: campaign.id,
          campaignTitle: campaign.title,
          documents,
          hasMore: [proposals, reports, invoices, payouts, attachments].some(
            (x) => x.length > limit,
          ),
          perKindLimit: limit,
        } satisfies AdminCampaignDocumentsResponse;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 20000,
      },
    );
    return json(result);
  });
}
