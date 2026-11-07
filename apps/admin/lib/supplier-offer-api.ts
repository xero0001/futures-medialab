import "server-only";
import { z } from "zod";
import { getDatabase, Prisma } from "@futures-medialab/database";
import {
  boundary,
  fail,
  json,
  requireAdmin,
  recheckAdmin,
  verifyOrigin,
  readBody,
  rateLimit,
} from "./access";
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/);
const schema = z.strictObject({
  campaignId: id,
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  unitCap: z
    .string()
    .regex(/^[1-9]\d{0,9}(?:\.\d{1,2})?$/)
    .nullable(),
});
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export function supplierOfferApi(request: Request) {
  return boundary(async () => {
    if (request.method === "POST") verifyOrigin(request);
    const admin = await requireAdmin(request.headers);
    await rateLimit(admin, "supplier-offer", 60);
    const input =
      request.method === "POST" ? await readBody(request, schema) : null;
    const campaignId =
      input?.campaignId ?? new URL(request.url).searchParams.get("campaignId");
    if (!id.safeParse(campaignId).success)
      fail(400, "INVALID_INPUT", "캠페인을 선택해 주세요.");
    return json(
      await getDatabase().$transaction(
        async (tx) => {
          await recheckAdmin(tx, admin);
          const campaign = await tx.campaign.findUnique({
            where: { id: campaignId! },
          });
          if (!campaign) fail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
          const requirements = record(campaign.requirements);
          const offer = record(requirements.supplierOffer);
          if (input) {
            if (
              campaign.type !== "OPEN_BIDDING" ||
              !["REVIEW", "RECRUITING"].includes(campaign.status)
            )
              fail(
                409,
                "INVALID_STATE",
                "검토·모집 중인 오픈 캠페인만 조건을 변경할 수 있습니다.",
              );
            if (campaign.updatedAt.toISOString() !== input.expectedUpdatedAt)
              fail(409, "CONFLICT", "공고 정보를 새로고침해 주세요.");
            if (
              campaign.currency === "KRW" &&
              input.unitCap &&
              !Number.isInteger(Number(input.unitCap))
            )
              fail(
                400,
                "INVALID_AMOUNT",
                "원화 단가 상한은 정수로 입력하세요.",
              );
            await tx.campaign.update({
              where: { id: campaign.id },
              data: {
                requirements: {
                  ...requirements,
                  supplierOffer: { ...offer, unitCap: input.unitCap },
                } as Prisma.InputJsonValue,
              },
            });
            await tx.auditLog.create({
              data: {
                actorId: admin.userId,
                action: "admin.supplier_offer.saved",
                entityType: "Campaign",
                entityId: campaign.id,
                payload: {
                  before: offer.unitCap ?? null,
                  after: input.unitCap,
                } as Prisma.InputJsonValue,
              },
            });
            return { success: true };
          }
          return {
            type: campaign.type,
            currency: campaign.currency,
            unitCap: typeof offer.unitCap === "string" ? offer.unitCap : null,
            updatedAt: campaign.updatedAt.toISOString(),
            editable: ["REVIEW", "RECRUITING"].includes(campaign.status),
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15000,
        },
      ),
    );
  });
}
