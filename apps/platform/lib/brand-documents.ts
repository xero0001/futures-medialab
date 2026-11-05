import "server-only";
import { getDatabase, Prisma } from "@futures-medialab/database";
import { listBrandDocumentProposals } from "@futures-medialab/database/proposals";
import { listBrandDocumentReports } from "@futures-medialab/database/reporting";
import { listBrandInvoices } from "@futures-medialab/database/settlement";
import { getAuth } from "./auth";
import { campaignIdSchema } from "./campaign-validation";
import {
  fail,
  json,
  membership,
  rateLimit,
  workspaceBoundary,
} from "./workspace-api";
import {
  attachmentDocument,
  documentLibrary,
  invoiceDocument,
  proposalDocument,
  reportDocument,
} from "./brand-document-mapping";
import type { BrandDocumentResponse } from "./brand-document-types";

const perKindLimit = 100;
const attachmentSelect = {
  id: true,
  requestId: true,
  fileName: true,
  contentType: true,
  size: true,
  discardedAt: true,
  request: {
    select: {
      organizationId: true,
      title: true,
      campaignId: true,
      campaign: { select: { title: true, brandOrganizationId: true } },
    },
  },
  message: { select: { requestId: true, internal: true, createdAt: true } },
} satisfies Prisma.RequestAttachmentSelect;

export function brandDocuments(request: Request) {
  return workspaceBoundary(async () => {
    if (request.method !== "GET")
      return json({ message: "허용되지 않은 메서드입니다." }, 405);
    const session = await getAuth().api.getSession({
      headers: request.headers,
    });
    if (!session) fail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
    await rateLimit(session.user.id, "brand-read", 120);
    const campaignParam = new URL(request.url).searchParams.get("campaign");
    const parsed =
      campaignParam === null ? null : campaignIdSchema.safeParse(campaignParam);
    if (parsed && !parsed.success)
      fail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
    const campaignId = parsed?.success ? parsed.data : undefined;
    const result = await getDatabase().$transaction(
      async (tx): Promise<BrandDocumentResponse> => {
        const live = await tx.session.findFirst({
          where: {
            id: session.session.id,
            userId: session.user.id,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        });
        if (!live) fail(401, "UNAUTHORIZED", "로그인이 만료되었습니다.");
        const member = await membership(tx, session.user.id);
        const organizationId = member.organizationId;
        if (
          campaignId &&
          !(await tx.campaign.findFirst({
            where: { id: campaignId, brandOrganizationId: organizationId },
            select: { id: true },
          }))
        )
          fail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
        const requestScope = {
          organizationId,
          ...(campaignId
            ? { campaignId, campaign: { brandOrganizationId: organizationId } }
            : {
                OR: [
                  { campaignId: null },
                  { campaign: { brandOrganizationId: organizationId } },
                ],
              }),
        } satisfies Prisma.WorkspaceToolRequestWhereInput;
        const [proposals, reports, invoices, attachments] = await Promise.all([
          listBrandDocumentProposals(
            tx,
            organizationId,
            campaignId,
            perKindLimit + 1,
          ),
          listBrandDocumentReports(
            tx,
            organizationId,
            campaignId,
            perKindLimit + 1,
          ),
          listBrandInvoices(
            tx,
            { userId: session.user.id, organizationId },
            campaignId,
            perKindLimit + 1,
          ),
          tx.requestAttachment.findMany({
            where: {
              discardedAt: null,
              messageId: { not: null },
              request: requestScope,
              message: { is: { internal: false, request: requestScope } },
            },
            orderBy: [{ message: { createdAt: "desc" } }, { id: "asc" }],
            take: perKindLimit + 1,
            select: attachmentSelect,
          }),
        ]);
        return documentLibrary(
          [
            proposals.map(proposalDocument),
            reports.map(reportDocument),
            invoices.map(invoiceDocument),
            attachments.map((row) =>
              attachmentDocument(row, organizationId, campaignId),
            ),
          ],
          perKindLimit,
        );
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 15_000,
      },
    );
    return json(result);
  });
}
