import "server-only";
import { getDatabase, Prisma } from "@futures-medialab/database";
import { get } from "@vercel/blob";
import { z } from "zod";
import {
  boundary,
  fail,
  json,
  privateHeaders,
  rateLimit,
  readBody,
  recheckAdmin,
  requireAdmin,
  verifyOrigin,
} from "./access";
import {
  publicationProblems,
  record,
  reviewReason,
  submittedProfile,
  text,
} from "./verification";
import type { Bootstrap, CampaignDetail, OrganizationDetail } from "./types";
import { safeOperationUrl } from "./campaign-operations-validation";

const idSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
const actionSchema = z.strictObject({
  action: z.enum([
    "approveOrganization",
    "requestOrganizationChanges",
    "suspendOrganization",
    "publishCampaign",
    "returnCampaign",
    "closeCampaign",
    "revokeUserSessions",
  ]),
  id: idSchema,
  reason: z.string().trim().min(2).max(1000),
});
export function bootstrap(request: Request) {
  return boundary(async () => {
    const admin = await requireAdmin(request.headers);
    await rateLimit(admin, "read", 120);
    const result = await getDatabase().$transaction(
      async (tx) => {
        await recheckAdmin(tx, admin);
        const [
          users,
          organizations,
          campaigns,
          audits,
          userCount,
          orgCount,
          pendingCount,
          reviewCount,
          recruitingCount,
          applicationCount,
        ] = await Promise.all([
          tx.user.findMany({
            orderBy: { createdAt: "desc" },
            take: 200,
            select: {
              id: true,
              name: true,
              email: true,
              emailVerified: true,
              createdAt: true,
              memberships: {
                select: {
                  role: true,
                  organization: {
                    select: { name: true, type: true, status: true },
                  },
                },
              },
            },
          }),
          tx.organization.findMany({
            where: { type: { in: ["BRAND", "AGENCY"] } },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take: 200,
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
              countryCode: true,
              metadata: true,
              createdAt: true,
              _count: { select: { members: true } },
            },
          }),
          tx.campaign.findMany({
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take: 200,
            select: {
              id: true,
              title: true,
              summary: true,
              status: true,
              platforms: true,
              currency: true,
              budgetAmount: true,
              applicationDeadline: true,
              createdAt: true,
              requirements: true,
              brandOrganization: { select: { name: true, status: true } },
              _count: { select: { applications: true } },
            },
          }),
          tx.auditLog.findMany({
            where: { action: { startsWith: "admin." } },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
              id: true,
              action: true,
              entityType: true,
              entityId: true,
              payload: true,
              createdAt: true,
              actor: { select: { name: true, email: true } },
            },
          }),
          tx.user.count(),
          tx.organization.count({
            where: { type: { in: ["BRAND", "AGENCY"] } },
          }),
          tx.organization.count({
            where: { type: { in: ["BRAND", "AGENCY"] }, status: "PENDING" },
          }),
          tx.campaign.count({ where: { status: "REVIEW" } }),
          tx.campaign.count({ where: { status: "RECRUITING" } }),
          tx.campaignApplication.count(),
        ]);
        return {
          counts: {
            users: userCount,
            organizations: orgCount,
            pendingOrganizations: pendingCount,
            reviewCampaigns: reviewCount,
            recruitingCampaigns: recruitingCount,
            applications: applicationCount,
          },
          users: users.map(({ memberships, createdAt, ...user }) => ({
            ...user,
            createdAt: createdAt.toISOString(),
            organizations: memberships.map(({ organization, role }) => ({
              ...organization,
              role,
            })),
          })),
          organizations: organizations.map(
            ({ metadata, createdAt, _count, ...org }) => ({
              ...org,
              createdAt: createdAt.toISOString(),
              submitted: submittedProfile(org.type, metadata),
              testAccess: record(metadata).testWorkspaceAccess === true,
              reviewReason: reviewReason(metadata),
              memberCount: _count.members,
            }),
          ),
          campaigns: campaigns.map(
            ({
              createdAt,
              applicationDeadline,
              budgetAmount,
              brandOrganization,
              _count,
              requirements,
              ...campaign
            }) => ({
              ...campaign,
              summary: campaign.summary.slice(0, 500),
              createdAt: createdAt.toISOString(),
              applicationDeadline: applicationDeadline?.toISOString() ?? null,
              budgetAmount: budgetAmount?.toFixed(2) ?? null,
              brandName: brandOrganization.name,
              brandStatus: brandOrganization.status,
              applicationCount: _count.applications,
              reviewReason: reviewReason(requirements),
            }),
          ),
          audits: audits.map(({ actor, payload, createdAt, ...audit }) => ({
            ...audit,
            createdAt: createdAt.toISOString(),
            actorName: actor?.name || actor?.email || "삭제된 계정",
            reason: text(record(payload).reason),
          })),
          limit: 200,
        } satisfies Bootstrap;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 15_000,
      },
    );
    return json(result);
  });
}
export function organizationDetail(request: Request, id: string) {
  return boundary(async () => {
    if (!idSchema.safeParse(id).success)
      fail(404, "NOT_FOUND", "조직을 찾을 수 없습니다.");
    const admin = await requireAdmin(request.headers);
    await rateLimit(admin, "read", 120);
    const org = await getDatabase().organization.findFirst({
      where: { id, type: { in: ["BRAND", "AGENCY"] } },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        metadata: true,
        countryCode: true,
        businessNumber: true,
        websiteUrl: true,
        agencyDocuments: {
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            fileName: true,
            kind: true,
            state: true,
            size: true,
            createdAt: true,
          },
        },
      },
    });
    if (!org) fail(404, "NOT_FOUND", "조직을 찾을 수 없습니다.");
    const metadata = record(org.metadata);
    const profile =
      org.type === "AGENCY"
        ? record(metadata.agencyProfile ?? metadata.agencyProfileDraft)
        : metadata;
    const fields: [string, unknown][] = [
      ["국가", org.countryCode ?? profile.countryCode],
      ["웹사이트", org.websiteUrl],
      ["사업자 번호", profile.businessLicenseId ?? org.businessNumber],
      ["조직 유형", metadata.agencyType],
      ["주소", profile.address],
      ["설립일", profile.establishedOn],
      ["업종", profile.industry],
      ["회사 규모", profile.companySize],
      ["담당자", profile.contactName],
      ["연락 방법", profile.contactMethod],
      ["연락처", profile.contactValue],
      [
        "전화번호",
        `${text(profile.phoneDialCode)} ${text(profile.phoneNumber)}`.trim(),
      ],
      ["사업 범위", profile.scopeOfBusiness],
      ["플랫폼 담당자", profile.platformContact],
      ["메모", profile.note],
      [
        "제출일",
        metadata.agencyProfileSubmittedAt ?? metadata.profileCompletedAt,
      ],
      ["최근 심사 사유", reviewReason(metadata)],
    ];
    await recheckAdmin(getDatabase(), admin);
    return json({
      id: org.id,
      name: org.name,
      type: org.type,
      status: org.status,
      fields: fields.map(([label, value]) => ({
        label,
        value: text(value) || "—",
      })),
      documents: org.agencyDocuments.map((doc) => ({
        ...doc,
        createdAt: doc.createdAt.toISOString(),
      })),
    } satisfies OrganizationDetail);
  });
}
export function campaignDetail(request: Request, id: string) {
  return boundary(async () => {
    if (!idSchema.safeParse(id).success)
      fail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
    const admin = await requireAdmin(request.headers);
    await rateLimit(admin, "read", 120);
    const campaign = await getDatabase().campaign.findUnique({
      where: { id },
      select: {
        id: true,
        summary: true,
        regions: true, categories: true, followerMin: true, followerMax: true,
        title: true, status: true, platforms: true, currency: true, budgetAmount: true, applicationDeadline: true, createdAt: true,
        brandOrganization: { select: { name: true, status: true } },
        briefUrl: true, contentDeadline: true, requirements: true, settlementPolicy: true, managedRequest: true,
        _count: { select: { applications: true } },
        applications: {
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            status: true,
            proposal: true,
            proposedAmount: true,
            currency: true,
            createdAt: true,
            agencyOrganizationId: true,
            rosterSnapshot: true,
            creators: { orderBy: { creatorId: "asc" }, take: 100, select: { deliverables: true,
              creator: { select: { id: true, agencyOrganizationId: true, displayName: true, channels: true, categories: true } } } },
            agencyOrganization: { select: { name: true, status: true } },
          },
        },
      },
    });
    if (!campaign) fail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
    await recheckAdmin(getDatabase(), admin);
    return json({
      id,
      summary: campaign.summary,
      regions: campaign.regions, categories: campaign.categories, followerMin: campaign.followerMin, followerMax: campaign.followerMax,
      campaign: { id, title: campaign.title, summary: campaign.summary, status: campaign.status,
        brandName: campaign.brandOrganization.name, brandStatus: campaign.brandOrganization.status,
        platforms: campaign.platforms, currency: campaign.currency, budgetAmount: campaign.budgetAmount?.toFixed(2) ?? null,
        applicationDeadline: campaign.applicationDeadline?.toISOString() ?? null, createdAt: campaign.createdAt.toISOString(),
        applicationCount: campaign._count.applications, reviewReason: reviewReason(campaign.requirements) },
      briefUrl: safeOperationUrl(campaign.briefUrl), contentDeadline: campaign.contentDeadline?.toISOString() ?? null,
      requirements: campaign.requirements, settlementPolicy: campaign.settlementPolicy, managedRequest: campaign.managedRequest,
      total: campaign._count.applications,
      applications: campaign.applications.map(
        ({
          agencyOrganization,
          proposedAmount,
          createdAt,
          agencyOrganizationId,
          creators,
          ...application
        }) => ({
          ...application,
          agencyName: agencyOrganization.name,
          agencyStatus: agencyOrganization.status,
          proposedAmount: proposedAmount?.toFixed(2) ?? null,
          createdAt: createdAt.toISOString(),
          creators: creators.filter(({ creator }) => creator.agencyOrganizationId === agencyOrganizationId)
            .map(({ creator, deliverables }) => ({ id: creator.id, name: creator.displayName, channels: creator.channels, categories: creator.categories, deliverables })),
        }),
      ),
    } satisfies CampaignDetail);
  });
}
export function action(request: Request) {
  return boundary(async () => {
    verifyOrigin(request);
    const admin = await requireAdmin(request.headers);
    await rateLimit(admin, "write", 30);
    const input = await readBody(request, actionSchema);
    await getDatabase().$transaction(
      async (tx) => {
        await recheckAdmin(tx, admin);
        let entityType: string;
        let before: string;
        let after: string;
        const reviewedAt = new Date().toISOString();
        if (
          [
            "approveOrganization",
            "requestOrganizationChanges",
            "suspendOrganization",
          ].includes(input.action)
        ) {
          entityType = "Organization";
          const org = await tx.organization.findFirst({
            where: { id: input.id, type: { in: ["BRAND", "AGENCY"] } },
            select: { type: true, status: true, metadata: true },
          });
          if (!org) fail(404, "NOT_FOUND", "관리할 수 있는 조직이 아닙니다.");
          before = org.status;
          const metadata = { ...record(org.metadata) };
          if (input.action === "approveOrganization") {
            if (
              !submittedProfile(org.type, metadata) &&
              metadata.testWorkspaceAccess !== true
            )
              fail(
                409,
                "PROFILE_REQUIRED",
                "회사 정보 제출을 먼저 완료해야 합니다.",
              );
            if (
              org.type === "AGENCY" &&
              metadata.testWorkspaceAccess !== true
            ) {
              const profile = record(metadata.agencyProfile);
              const proof = await tx.agencyDocument.findFirst({
                where: {
                  id: text(profile.businessDocumentId),
                  organizationId: input.id,
                  state: "UPLOADED",
                  kind: "BUSINESS_REGISTRATION",
                },
                select: { id: true },
              });
              if (!proof)
                fail(
                  409,
                  "DOCUMENT_REQUIRED",
                  "검증된 사업자 증빙이 필요합니다.",
                );
            }
            after = "ACTIVE";
            metadata.adminReview = {
              status: "APPROVED",
              reason: input.reason,
              reviewedAt,
            };
          } else if (input.action === "requestOrganizationChanges") {
            if (org.status !== "PENDING")
              fail(
                409,
                "INVALID_STATE",
                "승인 대기 조직에만 보완을 요청할 수 있습니다.",
              );
            after = "PENDING";
            delete metadata.agencyProfileSubmittedAt;
            delete metadata.profileCompletedAt;
            metadata.adminReview = {
              status: "CHANGES_REQUESTED",
              reason: input.reason,
              reviewedAt,
            };
          } else {
            if (org.status === "SUSPENDED")
              fail(409, "INVALID_STATE", "이미 정지된 조직입니다.");
            after = "SUSPENDED";
            metadata.adminReview = {
              status: "SUSPENDED",
              reason: input.reason,
              reviewedAt,
            };
          }
          await tx.organization.update({
            where: { id: input.id },
            data: {
              status: after as "ACTIVE" | "PENDING" | "SUSPENDED",
              metadata: metadata as Prisma.InputJsonObject,
            },
          });
        } else if (input.action === "revokeUserSessions") {
          entityType = "User";
          before = "SESSIONS_ACTIVE";
          after = "SESSIONS_REVOKED";
          if (input.id === admin.userId)
            fail(409, "SELF_ACTION", "본인 계정은 로그아웃을 이용하세요.");
          const user = await tx.user.findUnique({
            where: { id: input.id },
            select: {
              id: true,
              memberships: {
                where: { organization: { type: "PLATFORM" } },
                select: { userId: true },
              },
            },
          });
          if (!user) fail(404, "NOT_FOUND", "사용자를 찾을 수 없습니다.");
          if (user.memberships.length)
            fail(
              403,
              "PRIVILEGED_USER",
              "플랫폼 관리자 계정의 세션은 이 화면에서 변경할 수 없습니다.",
            );
          await tx.session.deleteMany({ where: { userId: input.id } });
        } else {
          entityType = "Campaign";
          const campaign = await tx.campaign.findUnique({
            where: { id: input.id },
            include: { brandOrganization: { select: { status: true } } },
          });
          if (!campaign) fail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
          before = campaign.status;
          const requirements = { ...record(campaign.requirements) };
          if (input.action === "publishCampaign") {
            const problems = publicationProblems({
              ...campaign,
              brandStatus: campaign.brandOrganization.status,
              budgetAmount: campaign.budgetAmount?.toFixed(2) ?? null,
            });
            if (problems.length)
              fail(409, "PUBLICATION_REQUIREMENTS", problems.join(" "));
            after = "RECRUITING";
            requirements.adminReview = {
              status: "APPROVED",
              reason: input.reason,
              reviewedAt,
            };
          } else if (input.action === "returnCampaign") {
            if (campaign.status !== "REVIEW")
              fail(
                409,
                "INVALID_STATE",
                "검토 요청 캠페인만 보완 요청할 수 있습니다.",
              );
            after = "DRAFT";
            requirements.adminReview = {
              status: "CHANGES_REQUESTED",
              reason: input.reason,
              reviewedAt,
            };
          } else {
            if (campaign.status !== "RECRUITING")
              fail(
                409,
                "INVALID_STATE",
                "모집 중인 캠페인만 모집을 마감할 수 있습니다.",
              );
            after = "IN_PROGRESS";
            requirements.adminReview = {
              status: "CLOSED",
              reason: input.reason,
              reviewedAt,
            };
          }
          await tx.campaign.update({
            where: { id: input.id },
            data: {
              status: after as "RECRUITING" | "DRAFT" | "IN_PROGRESS",
              requirements: requirements as Prisma.InputJsonObject,
              ...(input.action === "publishCampaign"
                ? { publishedAt: new Date() }
                : {}),
            },
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: admin.userId,
            action: `admin.${input.action}`,
            entityType,
            entityId: input.id,
            payload: { before, after, reason: input.reason },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15_000,
      },
    );
    return json({ success: true });
  });
}
export function downloadDocument(request: Request, id: string) {
  return boundary(async () => {
    if (!idSchema.safeParse(id).success)
      fail(404, "NOT_FOUND", "문서를 찾을 수 없습니다.");
    const admin = await requireAdmin(request.headers);
    await rateLimit(admin, "download", 30);
    const document = await getDatabase().agencyDocument.findFirst({
      where: { id, state: "UPLOADED", organization: { type: "AGENCY" } },
    });
    if (!document) fail(404, "NOT_FOUND", "문서를 찾을 수 없습니다.");
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    if (!token)
      fail(
        503,
        "STORAGE_UNAVAILABLE",
        "비공개 파일 저장소가 연결되지 않았습니다.",
      );
    if (
      !document.pathname.startsWith(
        `agency-documents/${document.organizationId}/`,
      ) ||
      !["application/pdf", "image/png", "image/jpeg"].includes(
        document.contentType,
      )
    )
      fail(409, "INVALID_DOCUMENT", "문서 정보를 확인해야 합니다.");
    const result = await get(document.pathname, {
      token,
      access: "private",
      useCache: false,
      abortSignal: AbortSignal.timeout(60_000),
    });
    if (!result || result.statusCode !== 200)
      fail(404, "NOT_FOUND", "문서를 찾을 수 없습니다.");
    try {
      if (
        result.blob.pathname !== document.pathname ||
        result.blob.size !== document.size ||
        result.blob.contentType !== document.contentType
      )
        fail(
          409,
          "FILE_CHANGED",
          "문서가 변경되었습니다. 다시 검증해야 합니다.",
        );
      await getDatabase().$transaction(
        async (tx) => {
          await recheckAdmin(tx, admin);
          await tx.auditLog.create({
            data: {
              actorId: admin.userId,
              action: "admin.downloadDocument",
              entityType: "AgencyDocument",
              entityId: id,
              payload: { organizationId: document.organizationId },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      await result.stream.cancel();
      throw error;
    }
    return new Response(result.stream, {
      headers: {
        ...privateHeaders,
        "Content-Type": document.contentType,
        "Content-Length": String(document.size),
        "Content-Disposition": `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(document.fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`,
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  });
}
