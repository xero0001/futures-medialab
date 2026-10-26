import { z } from "zod";
import { getDatabase, Prisma } from "./client";

export type RequestActor = {
  userId: string;
  sessionId: string;
  kind: "admin" | "brand";
  organizationId?: string;
};
type DB = Prisma.TransactionClient;
export class RequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function requestFail(
  status: number,
  code: string,
  message: string,
): never {
  throw new RequestError(status, code, message);
}
export const requestId = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
const status = z.enum([
  "REQUESTED",
  "IN_PROGRESS",
  "WAITING_BRAND",
  "RESOLVED",
  "CLOSED",
]);
const priority = z.enum(["LOW", "NORMAL", "HIGH"]);
const reason = z.string().trim().min(2).max(1000);
const body = z.string().trim().min(1).max(5000);
export const createRequestSchema = z.strictObject({
  title: z.string().trim().min(2).max(160),
  tool: z.enum([
    "general",
    "campaign",
    "revision",
    "contract",
    "settlement",
    "social-data",
    "brand-insight",
    "comments",
  ]),
  campaignId: requestId.nullable(),
  body,
});
export const requestMutationSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("update"),
    version: z.number().int().nonnegative(),
    status,
    priority,
    assignedToId: requestId.nullable(),
    dueAt: z.iso.datetime({ offset: true }).nullable(),
    reason,
  }),
  z.strictObject({
    action: z.literal("message"),
    body,
    internal: z.boolean().optional(),
    attachmentIds: z
      .array(requestId)
      .max(5)
      .refine((ids) => new Set(ids).size === ids.length),
  }),
  z.strictObject({
    action: z.literal("reopen"),
    version: z.number().int().nonnegative(),
    reason,
  }),
]);
export const listRequestsSchema = z.strictObject({
  query: z.string().trim().max(160).default(""),
  status: z.union([status, z.literal("all")]).default("all"),
  priority: z.union([priority, z.literal("all")]).default("all"),
  assignee: z
    .union([requestId, z.literal("all"), z.literal("unassigned")])
    .default("all"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export async function authorizeRequestActor(tx: DB, actor: RequestActor) {
  const session = await tx.session.findFirst({
    where: {
      id: actor.sessionId,
      userId: actor.userId,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (!session) requestFail(401, "UNAUTHORIZED", "로그인이 만료되었습니다.");
  const member = await tx.organizationMember.findFirst({
    where:
      actor.kind === "admin"
        ? {
            userId: actor.userId,
            role: { in: ["OWNER", "ADMIN"] },
            organization: { type: "PLATFORM", status: "ACTIVE" },
          }
        : {
            userId: actor.userId,
            organizationId: actor.organizationId || "",
            organization: { type: "BRAND", status: { not: "SUSPENDED" } },
          },
    select: { organizationId: true },
  });
  if (!member) requestFail(403, "FORBIDDEN", "요청함 접근 권한이 없습니다.");
}
export function requestTransaction<T>(
  actor: RequestActor,
  run: (tx: DB) => Promise<T>,
) {
  return getDatabase().$transaction(
    async (tx) => {
      await authorizeRequestActor(tx, actor);
      return run(tx);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15_000,
    },
  );
}
const rowInclude = {
  organization: { select: { name: true } },
  campaign: { select: { title: true } },
  assignedTo: { select: { name: true } },
} satisfies Prisma.WorkspaceToolRequestInclude;
type Row = Prisma.WorkspaceToolRequestGetPayload<{
  include: typeof rowInclude;
}>;
function rowDto(row: Row) {
  return {
    id: row.id,
    title: row.title,
    tool: row.tool,
    status: row.status,
    priority: row.priority,
    organizationName: row.organization.name,
    campaignId: row.campaignId,
    campaignTitle: row.campaign?.title ?? null,
    assigneeId: row.assignedToId,
    assigneeName: row.assignedTo ? row.assignedTo.name || "운영팀" : null,
    dueAt: row.dueAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}
export async function ownedRequest(tx: DB, actor: RequestActor, id: string) {
  const row = await tx.workspaceToolRequest.findFirst({
    where: {
      id,
      ...(actor.kind === "brand"
        ? { organizationId: actor.organizationId || "" }
        : {}),
    },
    include: rowInclude,
  });
  if (!row) requestFail(404, "NOT_FOUND", "요청을 찾을 수 없습니다.");
  return row;
}
const object = (value: Prisma.JsonValue): Prisma.JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const field = (value: Prisma.JsonValue | undefined) =>
  typeof value === "string" ? value : "";
async function event(
  tx: DB,
  actor: RequestActor,
  id: string,
  action: string,
  detail: string,
  publicDetail?: string,
) {
  await tx.auditLog.create({
    data: {
      actorId: actor.userId,
      action: `request.${action}`,
      entityType: "WorkspaceToolRequest",
      entityId: id,
      payload: {
        detail,
        public: publicDetail !== undefined,
        publicDetail: publicDetail ?? "",
      },
    },
  });
}
export function listRequests(
  actor: RequestActor,
  filters: z.infer<typeof listRequestsSchema>,
) {
  return requestTransaction(actor, async (tx) => {
    const scope: Prisma.WorkspaceToolRequestWhereInput =
      actor.kind === "brand"
        ? { organizationId: actor.organizationId || "" }
        : {};
    const where: Prisma.WorkspaceToolRequestWhereInput = {
      ...scope,
      ...(filters.status === "all" ? {} : { status: filters.status }),
      ...(actor.kind === "admin" && filters.priority !== "all"
        ? { priority: filters.priority }
        : {}),
      ...(actor.kind === "admin" && filters.assignee !== "all"
        ? {
            assignedToId:
              filters.assignee === "unassigned" ? null : filters.assignee,
          }
        : {}),
      ...(filters.query
        ? {
            OR: [
              { title: { contains: filters.query, mode: "insensitive" } },
              {
                organization: {
                  name: { contains: filters.query, mode: "insensitive" },
                },
              },
              {
                campaign: {
                  title: { contains: filters.query, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };
    const pageSize = 20;
    const [items, total] = await Promise.all([
      tx.workspaceToolRequest.findMany({
        where,
        include: rowInclude,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (filters.page - 1) * pageSize,
        take: pageSize,
      }),
      tx.workspaceToolRequest.count({ where }),
    ]);
    const base = {
      items: items.map(rowDto),
      total,
      page: filters.page,
      pageSize,
    };
    if (actor.kind === "brand")
      return {
        ...base,
        campaigns: await tx.campaign.findMany({
          where: { brandOrganizationId: actor.organizationId },
          select: { id: true, title: true },
          orderBy: { createdAt: "desc" },
          take: 500,
        }),
      };
    const open = {
      status: { in: ["REQUESTED", "IN_PROGRESS", "WAITING_BRAND"] },
    };
    const [assignees, openCount, overdue, unassigned] = await Promise.all([
      tx.user.findMany({
        where: {
          memberships: {
            some: {
              role: { in: ["OWNER", "ADMIN"] },
              organization: { type: "PLATFORM", status: "ACTIVE" },
            },
          },
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      tx.workspaceToolRequest.count({ where: open }),
      tx.workspaceToolRequest.count({
        where: { ...open, dueAt: { lt: new Date() } },
      }),
      tx.workspaceToolRequest.count({ where: { ...open, assignedToId: null } }),
    ]);
    return {
      ...base,
      assignees: assignees.map((a) => ({ id: a.id, name: a.name || "관리자" })),
      counts: { open: openCount, overdue, unassigned },
    };
  });
}
export function requestDetail(
  actor: RequestActor,
  id: string,
  attachmentsEnabled: boolean,
) {
  return requestTransaction(actor, async (tx) => {
    const row = await ownedRequest(tx, actor, id);
    const [messages, events, pendingAttachments] = await Promise.all([
      tx.requestMessage.findMany({
        where: {
          requestId: id,
          ...(actor.kind === "brand" ? { internal: false } : {}),
        },
        include: {
          author: { select: { name: true } },
          attachments: {
            where: { discardedAt: null },
            select: { id: true, fileName: true, contentType: true, size: true },
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      tx.auditLog.findMany({
        where: {
          entityType: "WorkspaceToolRequest",
          entityId: id,
          ...(actor.kind === "brand"
            ? { payload: { path: ["public"], equals: true } }
            : {}),
        },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      tx.requestAttachment.findMany({
        where: {
          requestId: id,
          uploaderId: actor.userId,
          messageId: null,
          discardedAt: null,
        },
        select: { id: true, fileName: true, contentType: true, size: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    ]);
    const prefix =
      actor.kind === "admin"
        ? "/api/admin/requests"
        : "/api/workspace/requests";
    return {
      request: {
        ...rowDto(row),
        description: field(object(row.inputJson).input),
        attachmentsEnabled,
        pendingAttachments: pendingAttachments.map((a) => ({
          ...a,
          downloadUrl: `${prefix}/${id}/attachments/${a.id}`,
        })),
        messages: messages.map((m) => ({
          id: m.id,
          body: m.body,
          internal: m.internal,
          authorName:
            m.author.name ||
            (m.authorRole === "ADMIN" ? "운영팀" : row.organization.name),
          authorRole: m.authorRole,
          createdAt: m.createdAt.toISOString(),
          attachments: m.attachments.map((a) => ({
            ...a,
            downloadUrl: `${prefix}/${id}/attachments/${a.id}`,
          })),
        })),
        events: events.map((e) => ({
          id: e.id,
          action: e.action,
          actorName: e.actor?.name || "운영팀",
          createdAt: e.createdAt.toISOString(),
          detail: field(
            object(e.payload)[
              actor.kind === "admin" ? "detail" : "publicDetail"
            ],
          ),
        })),
      },
    };
  });
}
export function createRequest(
  actor: RequestActor,
  input: z.infer<typeof createRequestSchema>,
) {
  if (actor.kind !== "brand")
    requestFail(403, "FORBIDDEN", "브랜드만 요청을 등록할 수 있습니다.");
  return requestTransaction(actor, async (tx) => {
    if (
      input.campaignId &&
      !(await tx.campaign.findFirst({
        where: {
          id: input.campaignId,
          brandOrganizationId: actor.organizationId,
        },
        select: { id: true },
      }))
    )
      requestFail(
        400,
        "INVALID_CAMPAIGN",
        "소속 브랜드의 캠페인을 선택하세요.",
      );
    const row = await tx.workspaceToolRequest.create({
      data: {
        organizationId: actor.organizationId!,
        userId: actor.userId,
        campaignId: input.campaignId,
        title: input.title,
        tool: input.tool,
        inputJson: { input: input.body },
      },
    });
    await event(
      tx,
      actor,
      row.id,
      "created",
      "요청 접수",
      "요청이 접수되었습니다.",
    );
    return { id: row.id };
  });
}
export function mutateRequest(
  actor: RequestActor,
  id: string,
  input: z.infer<typeof requestMutationSchema>,
) {
  return requestTransaction(actor, async (tx) => {
    const row = await ownedRequest(tx, actor, id);
    if (input.action === "message") {
      if (actor.kind === "brand" && input.internal)
        requestFail(403, "FORBIDDEN", "내부 메모 작성 권한이 없습니다.");
      if (
        row.status === "CLOSED" ||
        (actor.kind === "brand" && row.status === "RESOLVED")
      )
        requestFail(
          409,
          "REQUEST_CLOSED",
          "처리 완료된 요청은 재검토를 요청한 후 답변할 수 있습니다. 종료된 요청은 새로 등록하세요.",
        );
      const attachments = await tx.requestAttachment.findMany({
        where: {
          id: { in: input.attachmentIds },
          requestId: id,
          uploaderId: actor.userId,
          messageId: null,
          discardedAt: null,
        },
        select: { id: true },
      });
      if (attachments.length !== input.attachmentIds.length)
        requestFail(
          400,
          "INVALID_ATTACHMENT",
          "현재 요청에 업로드한 파일만 첨부할 수 있습니다.",
        );
      const internal = actor.kind === "admin" && Boolean(input.internal);
      const message = await tx.requestMessage.create({
        data: {
          requestId: id,
          authorId: actor.userId,
          authorRole: actor.kind === "admin" ? "ADMIN" : "BRAND",
          body: input.body,
          internal,
        },
      });
      const attached = await tx.requestAttachment.updateMany({
        where: {
          id: { in: input.attachmentIds },
          requestId: id,
          uploaderId: actor.userId,
          messageId: null,
          discardedAt: null,
        },
        data: { messageId: message.id },
      });
      if (attached.count !== input.attachmentIds.length)
        requestFail(
          409,
          "CONFLICT",
          "첨부파일이 변경되었습니다. 새로고침 후 다시 시도하세요.",
        );
      await tx.workspaceToolRequest.update({
        where: { id },
        data: {
          version: { increment: 1 },
          ...(actor.kind === "brand" && row.status === "WAITING_BRAND"
            ? { status: "IN_PROGRESS" }
            : {}),
        },
      });
      await event(
        tx,
        actor,
        id,
        internal ? "internal_note" : "reply",
        internal ? "내부 메모 추가" : "공개 답변 추가",
        internal ? undefined : "답변이 등록되었습니다.",
      );
    } else if (input.action === "reopen") {
      if (row.status !== "RESOLVED")
        requestFail(
          409,
          "INVALID_STATE",
          "처리 완료 상태에서만 재검토를 요청할 수 있습니다.",
        );
      const result = await tx.workspaceToolRequest.updateMany({
        where: { id, version: input.version, status: "RESOLVED" },
        data: { status: "IN_PROGRESS", version: { increment: 1 } },
      });
      if (!result.count)
        requestFail(
          409,
          "CONFLICT",
          "요청이 변경되었습니다. 새로고침 후 다시 시도하세요.",
        );
      await event(
        tx,
        actor,
        id,
        "reopened",
        input.reason,
        `재검토 요청: ${input.reason}`,
      );
    } else {
      if (actor.kind !== "admin")
        requestFail(
          403,
          "FORBIDDEN",
          "관리자만 처리 정보를 변경할 수 있습니다.",
        );
      if (row.status === "CLOSED" && input.status !== "CLOSED")
        requestFail(409, "INVALID_STATE", "종료된 요청은 다시 열 수 없습니다.");
      if (
        input.assignedToId &&
        !(await tx.organizationMember.findFirst({
          where: {
            userId: input.assignedToId,
            role: { in: ["OWNER", "ADMIN"] },
            organization: { type: "PLATFORM", status: "ACTIVE" },
          },
          select: { userId: true },
        }))
      )
        requestFail(
          400,
          "INVALID_ASSIGNEE",
          "활성 관리자만 담당자로 지정할 수 있습니다.",
        );
      const result = await tx.workspaceToolRequest.updateMany({
        where: { id, version: input.version },
        data: {
          status: input.status,
          priority: input.priority,
          assignedToId: input.assignedToId,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          version: { increment: 1 },
        },
      });
      if (!result.count)
        requestFail(
          409,
          "CONFLICT",
          "요청이 변경되었습니다. 새로고침 후 다시 시도하세요.",
        );
      const labels: Record<string, string> = {
        REQUESTED: "접수",
        IN_PROGRESS: "처리 중",
        WAITING_BRAND: "브랜드 회신 대기",
        RESOLVED: "처리 완료",
        CLOSED: "종료",
      };
      await event(
        tx,
        actor,
        id,
        "updated",
        `${labels[row.status]} → ${labels[input.status]} · 우선순위 ${input.priority} · 담당 ${input.assignedToId || "미배정"} · 기한 ${input.dueAt || "미설정"}\n사유: ${input.reason}`,
        row.status !== input.status
          ? `상태 변경: ${labels[row.status]} → ${labels[input.status]}`
          : undefined,
      );
    }
    return { success: true };
  });
}
