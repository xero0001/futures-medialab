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
import { operationsFilter, operationsDate } from "./operations-query";
import {
  operationKinds,
  type OperationTask,
  type OperationsResponse,
} from "./operations-types";

// A single database snapshot supplies both global counts and the filtered page.
// Current work is tied to the latest published proposal, never an old submission.
const taskCte = Prisma.sql`
WITH campaigns AS (
 SELECT c.*, o.name AS "brandName", o.status AS "brandStatus", r."assignedToId", u.name AS "assigneeName", r.id AS "intakeId"
 FROM "Campaign" c JOIN "Organization" o ON o.id=c."brandOrganizationId"
 LEFT JOIN "WorkspaceToolRequest" r ON r.id=c.requirements->'brandIntake'->>'requestId' AND r."campaignId"=c.id AND r."organizationId"=c."brandOrganizationId"
 LEFT JOIN "User" u ON u.id=r."assignedToId"
), latest AS (
 SELECT DISTINCT ON ("campaignId") id,"campaignId",status,"expiresAt","supersededAt","publishedAt",title,"updatedAt"
 FROM "CampaignProposal" WHERE "publishedAt" IS NOT NULL AND status<>'DRAFT' ORDER BY "campaignId",version DESC
), tasks AS (
 SELECT 'request:'||r.id AS id, 'request' AS kind,r.title,
 CASE WHEN COALESCE(r."inputJson"->>'operatorReplyPending','false')='true' THEN '브랜드의 새 회신을 확인하고 답변해 주세요.' WHEN r.status='REQUESTED' THEN '접수 내용을 검토하고 담당자와 다음 일정을 정해 주세요.' ELSE '브랜드 요청에 답변하거나 진행 상태를 확인해 주세요.' END AS description,
 r."campaignId",c.title AS "campaignTitle",o.name AS "brandName",r.id AS "requestId",'overview' AS section,r."assignedToId" AS "assigneeId",u.name AS "assigneeName",r."dueAt",'요청 처리 기한' AS "deadlineLabel",r."updatedAt"
 FROM "WorkspaceToolRequest" r JOIN "Organization" o ON o.id=r."organizationId"
 LEFT JOIN "Campaign" c ON c.id=r."campaignId" LEFT JOIN "User" u ON u.id=r."assignedToId"
 WHERE (r.status IN ('REQUESTED','IN_PROGRESS') OR (r.status='WAITING_BRAND' AND COALESCE(r."inputJson"->>'operatorReplyPending','false')='true')) AND o.type='BRAND' AND o.status='ACTIVE'
 AND (c.id IS NULL OR (c."brandOrganizationId"=r."organizationId" AND (r.id<>COALESCE(c.requirements->'brandIntake'->>'requestId','') OR c.status NOT IN ('DRAFT','CANCELED','COMPLETED') OR COALESCE(r."inputJson"->>'operatorReplyPending','false')='true')))
 AND (COALESCE(r."inputJson"->>'operatorReplyPending','false')='true' OR NOT (r.id=COALESCE(c.requirements->'brandIntake'->>'requestId','') AND EXISTS(SELECT 1 FROM latest l WHERE l."campaignId"=c.id)))
 UNION ALL
 SELECT 'proposal:'||p.id,'proposal',COALESCE(NULLIF(p.title,''),c.title||' 공식 제안'),
 CASE WHEN p.status='DRAFT' THEN '제안 초안을 확인하고 브랜드에 발행해 주세요.' WHEN p.status IN ('CHANGES_REQUESTED','REJECTED') THEN '브랜드 결정 내용을 확인하고 새 제안을 준비해 주세요.' WHEN p."expiresAt"<=CURRENT_TIMESTAMP THEN '제안 유효기간이 지났습니다. 새 버전과 일정을 확인해 주세요.' ELSE '브랜드 결정 대기 중입니다. 유효기간과 회신 상황을 확인해 주세요.' END,
 c.id,c.title,c."brandName",NULL,'proposal',c."assignedToId",c."assigneeName",p."expiresAt",'제안 유효기간',p."updatedAt"
 FROM "CampaignProposal" p JOIN campaigns c ON c.id=p."campaignId"
 WHERE c."brandStatus"='ACTIVE' AND c.status IN ('REVIEW','RECRUITING','IN_PROGRESS') AND (
 (p.status='DRAFT' AND NOT EXISTS(SELECT 1 FROM "CampaignProposal" newer WHERE newer."campaignId"=p."campaignId" AND newer.status='DRAFT' AND newer.version>p.version))
 OR (p.id IN (SELECT id FROM latest WHERE "supersededAt" IS NULL) AND p.status IN ('PUBLISHED','CHANGES_REQUESTED','REJECTED')))
 UNION ALL
 SELECT 'recruitment:'||c.id,'recruitment',c.title,'신청 후보를 검토하고 모집을 마감해 주세요.',c.id,c.title,c."brandName",NULL,'sourcing',c."assignedToId",c."assigneeName",c."applicationDeadline",'모집 마감',c."updatedAt"
 FROM campaigns c WHERE c."brandStatus"='ACTIVE' AND c.type='OPEN_BIDDING' AND c.status='RECRUITING'
 UNION ALL
 SELECT 'production:'||p.id,'production',i."creatorName"||' · 제작 검수','제출 원문을 확인하고 브랜드 공개본을 검토해 주세요.',c.id,c.title,c."brandName",NULL,'production',c."assignedToId",c."assigneeName",i."scheduledAt",'예정 게시일',p."updatedAt"
 FROM "ProductionItem" p JOIN "ProposalItem" i ON i.id=p."proposalItemId" JOIN latest l ON l.id=i."proposalId" AND l."campaignId"=p."campaignId" JOIN campaigns c ON c.id=p."campaignId"
 WHERE c."brandStatus"='ACTIVE' AND p.status='ADMIN_REVIEW' AND i.status='APPROVED' AND l.status='APPROVED' AND l."supersededAt" IS NULL AND c.status IN ('IN_PROGRESS','VERIFYING')
 UNION ALL
 SELECT 'reporting:'||r.id,'reporting',i."creatorName"||' · 성과 검토','게시 링크와 성과 제출본을 검토하고 공개해 주세요.',c.id,c.title,c."brandName",NULL,'reporting',c."assignedToId",c."assigneeName",NULL,'기한 미설정',r."updatedAt"
 FROM "ReportingItem" r JOIN "ProductionItem" p ON p.id=r."productionItemId" AND p."campaignId"=r."campaignId" JOIN "ProposalItem" i ON i.id=p."proposalItemId" JOIN latest l ON l.id=i."proposalId" AND l."campaignId"=r."campaignId" JOIN campaigns c ON c.id=r."campaignId"
 WHERE c."brandStatus"='ACTIVE' AND r.status='ADMIN_REVIEW' AND p.status='APPROVED' AND i.status='APPROVED' AND l.status='APPROVED' AND l."supersededAt" IS NULL AND c.status IN ('IN_PROGRESS','VERIFYING')
 UNION ALL
 SELECT 'production-prepare:'||c.id,'production',c.title||' · 제작 준비','승인된 공식 제안의 제작 항목을 준비하고 수행 파트너를 배정해 주세요.',c.id,c.title,c."brandName",NULL,'production',c."assignedToId",c."assigneeName",c."contentDeadline",'콘텐츠 마감',c."updatedAt"
 FROM campaigns c JOIN latest l ON l."campaignId"=c.id
 WHERE c."brandStatus"='ACTIVE' AND c.status IN ('IN_PROGRESS','VERIFYING') AND l.status='APPROVED' AND l."supersededAt" IS NULL
 AND EXISTS(SELECT 1 FROM "ProposalItem" i LEFT JOIN "ProductionItem" p ON p."proposalItemId"=i.id WHERE i."proposalId"=l.id AND i.status='APPROVED' AND (p.id IS NULL OR (p.status='AWAITING_SUBMISSION' AND p."supplierOrganizationId" IS NULL)))
 UNION ALL
 SELECT 'reporting-prepare:'||c.id,'reporting',c.title||' · 성과 등록 준비','승인된 콘텐츠의 게시·성과 항목을 준비해 주세요.',c.id,c.title,c."brandName",NULL,'reporting',c."assignedToId",c."assigneeName",NULL,'기한 미설정',c."updatedAt"
 FROM campaigns c JOIN latest l ON l."campaignId"=c.id
 WHERE c."brandStatus"='ACTIVE' AND c.status IN ('IN_PROGRESS','VERIFYING') AND l.status='APPROVED' AND l."supersededAt" IS NULL
 AND EXISTS(SELECT 1 FROM "ProductionItem" p JOIN "ProposalItem" i ON i.id=p."proposalItemId" LEFT JOIN "ReportingItem" r ON r."productionItemId"=p.id WHERE p."campaignId"=c.id AND i."proposalId"=l.id AND i.status='APPROVED' AND p.status='APPROVED' AND r.id IS NULL)
 UNION ALL
 SELECT 'completion:'||c.id,'settlement',c.title||' · 완료 조건 확인','콘텐츠·성과·공급가를 최종 확인한 뒤 캠페인을 완료해 주세요.',c.id,c.title,c."brandName",NULL,'settlement',c."assignedToId",c."assigneeName",NULL,'기한 미설정',c."updatedAt"
 FROM campaigns c JOIN latest l ON l."campaignId"=c.id
 WHERE c."brandStatus"='ACTIVE' AND c.status IN ('IN_PROGRESS','VERIFYING','SETTLING') AND l.status='APPROVED' AND l."supersededAt" IS NULL
 AND NOT EXISTS(SELECT 1 FROM "CampaignCompletion" done WHERE done."campaignId"=c.id)
 AND EXISTS(SELECT 1 FROM "ProposalItem" i WHERE i."proposalId"=l.id)
 AND NOT EXISTS(SELECT 1 FROM "ProposalItem" i LEFT JOIN "ProductionItem" p ON p."proposalItemId"=i.id LEFT JOIN "ReportingItem" r ON r."productionItemId"=p.id WHERE i."proposalId"=l.id AND (i.status<>'APPROVED' OR p.status IS DISTINCT FROM 'APPROVED' OR r.status IS DISTINCT FROM 'PUBLISHED'))
 UNION ALL
 SELECT 'invoice-draft:'||i.id,'settlement',i.title||' · 청구 발행','브랜드 청구 초안의 수신 조직·금액·기한을 확인하고 발행해 주세요.',c.id,c.title,c."brandName",NULL,'settlement',c."assignedToId",c."assigneeName",i."dueAt",'납부 기한',i."updatedAt"
 FROM "BrandInvoice" i JOIN campaigns c ON c.id=i."campaignId" WHERE i.status='DRAFT' AND i."brandOrganizationId"=c."brandOrganizationId"
 UNION ALL
 SELECT 'payout-draft:'||p.id,'settlement',p.title||' · 지급 발행','파트너 지급 초안의 수신 조직·금액·기한을 확인하고 발행해 주세요.',c.id,c.title,c."brandName",NULL,'settlement',c."assignedToId",c."assigneeName",p."dueAt",'지급 예정일',p."updatedAt"
 FROM "AgencyPayout" p JOIN campaigns c ON c.id=p."campaignId" WHERE p.status='DRAFT'
 UNION ALL
 SELECT 'settlement-prepare:'||c.id,'settlement',c.title||' · 청구·지급 준비','완료된 캠페인의 브랜드 청구와 파트너 지급 초안을 준비해 주세요.',c.id,c.title,c."brandName",NULL,'settlement',c."assignedToId",c."assigneeName",NULL,'기한 미설정',c."updatedAt"
 FROM campaigns c JOIN "CampaignCompletion" done ON done."campaignId"=c.id
 WHERE NOT EXISTS(SELECT 1 FROM "BrandInvoice" i WHERE i."campaignId"=c.id)
 UNION ALL
 SELECT 'invoice:'||i.id,'invoice',i.title,'발행된 브랜드 청구의 외부 입금 결과를 확인해 주세요.',c.id,c.title,c."brandName",NULL,'settlement',c."assignedToId",c."assigneeName",i."dueAt",'납부 기한',i."updatedAt"
 FROM "BrandInvoice" i JOIN campaigns c ON c.id=i."campaignId" WHERE i.status='ISSUED' AND i."brandOrganizationId"=c."brandOrganizationId"
 UNION ALL
 SELECT 'payout:'||p.id,'payout',p.title,'파트너 지급의 외부 처리 결과를 확인해 주세요.',c.id,c.title,c."brandName",NULL,'settlement',c."assignedToId",c."assigneeName",p."dueAt",'지급 예정일',p."updatedAt"
 FROM "AgencyPayout" p JOIN campaigns c ON c.id=p."campaignId" WHERE p.status='ISSUED'
)`;
type RawTask = Omit<OperationTask, "dueAt" | "updatedAt"> & {
  dueAt: Date | null;
  updatedAt: Date;
};
export function adminOperationsApi(request: Request) {
  return boundary(async () => {
    if (request.method !== "GET")
      return json({ message: "허용되지 않은 요청입니다." }, 405);
    const admin = await requireAdmin(request.headers);
    await rateLimit(admin, "operations-read", 120);
    let filter;
    try {
      filter = operationsFilter(new URL(request.url).searchParams);
    } catch {
      fail(400, "INVALID_FILTER", "검색 조건을 확인해 주세요.");
    }
    const now = new Date(),
      soon = new Date(now.getTime() + 48 * 60 * 60 * 1000),
      pageSize = 30;
    const scope = filter.campaignId
      ? Prisma.sql`WHERE "campaignId"=${filter.campaignId}`
      : Prisma.empty;
    const conditions: Prisma.Sql[] = [];
    if (filter.campaignId)
      conditions.push(Prisma.sql`"campaignId"=${filter.campaignId}`);
    if (filter.kind !== "all") conditions.push(Prisma.sql`kind=${filter.kind}`);
    if (filter.assignee === "mine")
      conditions.push(Prisma.sql`"assigneeId"=${admin.userId}`);
    if (filter.assignee === "unassigned")
      conditions.push(Prisma.sql`"assigneeId" IS NULL`);
    if (filter.deadline === "overdue")
      conditions.push(Prisma.sql`"dueAt"<${now}`);
    if (filter.deadline === "soon")
      conditions.push(Prisma.sql`"dueAt">=${now} AND "dueAt"<=${soon}`);
    if (filter.q)
      conditions.push(
        Prisma.sql`strpos(lower(concat_ws(' ',title,"campaignTitle","brandName","assigneeName")),lower(${filter.q}))>0`,
      );
    const where = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      : Prisma.empty;
    const result = await getDatabase().$transaction(
      async (tx) => {
        await recheckAdmin(tx, admin);
        const countRows = await tx.$queryRaw<
          {
            kind: string;
            total: bigint;
            mine: bigint;
            unassigned: bigint;
            overdue: bigint;
            soon: bigint;
          }[]
        >(
          Prisma.sql`${taskCte} SELECT kind,count(*) AS total,count(*) FILTER(WHERE "assigneeId"=${admin.userId}) AS mine,count(*) FILTER(WHERE "assigneeId" IS NULL) AS unassigned,count(*) FILTER(WHERE "dueAt"<${now}) AS overdue,count(*) FILTER(WHERE "dueAt">=${now} AND "dueAt"<=${soon}) AS soon FROM tasks ${scope} GROUP BY kind`,
        );
        const counts = {
          total: 0,
          mine: 0,
          unassigned: 0,
          overdue: 0,
          soon: 0,
          byKind: Object.fromEntries(
            operationKinds.map((k) => [k, 0]),
          ) as OperationsResponse["counts"]["byKind"],
        };
        for (const row of countRows) {
          if (!operationKinds.includes(row.kind as OperationTask["kind"]))
            continue;
          for (const key of [
            "total",
            "mine",
            "unassigned",
            "overdue",
            "soon",
          ] as const)
            counts[key] += Number(row[key]);
          counts.byKind[row.kind as OperationTask["kind"]] = Number(row.total);
        }
        const totals = await tx.$queryRaw<{ count: bigint }[]>(
          Prisma.sql`${taskCte} SELECT count(*) FROM tasks ${where}`,
        );
        const total = Number(totals[0]?.count ?? 0),
          page = Math.min(
            filter.page,
            Math.max(1, Math.ceil(total / pageSize)),
          );
        const rows = await tx.$queryRaw<RawTask[]>(
          Prisma.sql`${taskCte} SELECT * FROM tasks ${where} ORDER BY "dueAt" ASC NULLS LAST,"updatedAt" ASC,id ASC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        );
        return {
          items: rows.map((row) => ({
            ...row,
            dueAt: operationsDate(row.dueAt),
            updatedAt: operationsDate(row.updatedAt)!,
          })),
          total,
          page,
          pageSize,
          hasMore: page * pageSize < total,
          counts,
          asOf: now.toISOString(),
        } satisfies OperationsResponse;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 20000,
      },
    );
    return json(result);
  });
}
