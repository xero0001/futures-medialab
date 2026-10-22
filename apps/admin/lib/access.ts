import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabase, Prisma } from "@futures-medialab/database";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuth } from "./auth";

type Database = ReturnType<typeof getDatabase> | Prisma.TransactionClient;
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: privateHeaders });
export class AdminError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, code: string, message: string): never {
  throw new AdminError(status, code, message);
}
export async function boundary(work: () => Promise<Response>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AdminError)
      return json({ code: error.code, message: error.message }, error.status);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2034", "P2002"].includes(error.code)
    )
      return json(
        {
          code: "CONFLICT",
          message: "데이터가 변경되었습니다. 새로고침 후 다시 시도하세요.",
        },
        409,
      );
    console.error("admin_request_failed");
    return json(
      {
        code: "UNAVAILABLE",
        message: "관리자 서비스를 일시적으로 사용할 수 없습니다.",
      },
      503,
    );
  }
}
export async function adminMembership(database: Database, userId: string) {
  const member = await database.organizationMember.findFirst({
    where: {
      userId,
      role: { in: ["OWNER", "ADMIN"] },
      organization: { type: "PLATFORM", status: "ACTIVE" },
    },
    select: { organizationId: true, role: true },
  });
  if (!member) fail(403, "FORBIDDEN", "플랫폼 관리자 권한이 필요합니다.");
  return member;
}
export async function requireAdmin(requestHeaders: Headers) {
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) fail(401, "UNAUTHORIZED", "관리자 로그인이 필요합니다.");
  await adminMembership(getDatabase(), session.user.id);
  return {
    userId: session.user.id,
    sessionId: session.session.id,
    name: session.user.name || session.user.email,
  };
}
export type Admin = Awaited<ReturnType<typeof requireAdmin>>;
export async function recheckAdmin(tx: Database, admin: Admin) {
  const live = await tx.session.findFirst({
    where: {
      id: admin.sessionId,
      userId: admin.userId,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (!live) fail(401, "UNAUTHORIZED", "세션이 만료되었습니다.");
  await adminMembership(tx, admin.userId);
}
export async function requireAdminPage() {
  try {
    return await requireAdmin(await headers());
  } catch (error) {
    if (error instanceof AdminError)
      redirect(error.status === 401 ? "/login" : "/login?denied=1");
    throw error;
  }
}
export function verifyOrigin(request: Request) {
  const base = getAuth().options.baseURL;
  if (typeof base !== "string") throw new Error("Admin origin missing");
  const site = request.headers.get("sec-fetch-site");
  if (
    request.headers.get("origin") !== new URL(base).origin ||
    (site !== null && site !== "same-origin")
  )
    fail(403, "INVALID_ORIGIN", "허용되지 않은 요청입니다.");
}
export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  if (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim() !==
    "application/json"
  )
    fail(400, "INVALID_INPUT", "JSON 요청이 필요합니다.");
  const reader = request.body?.getReader();
  if (!reader) fail(400, "INVALID_INPUT", "요청 내용이 없습니다.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) {
        await reader.cancel();
        fail(413, "TOO_LARGE", "요청 내용이 너무 큽니다.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    fail(400, "INVALID_INPUT", "요청 내용을 확인하세요.");
  }
  const result = schema.safeParse(body);
  if (!result.success)
    fail(400, "INVALID_INPUT", "입력값을 확인하세요. 조치 사유는 필수입니다.");
  return result.data;
}
export async function rateLimit(admin: Admin, bucket: string, limit: number) {
  const key = `admin:${bucket}:${admin.userId}`,
    now = BigInt(Date.now()),
    cutoff = now - 60_000n;
  const rows = await getDatabase().$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("id", "key", "count", "lastRequest") VALUES (${randomUUID()}, ${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."lastRequest" <= ${cutoff} THEN 1 ELSE LEAST("RateLimit"."count" + 1, ${limit + 1}) END,
      "lastRequest" = CASE WHEN "RateLimit"."lastRequest" <= ${cutoff} THEN ${now} ELSE "RateLimit"."lastRequest" END RETURNING "count"`;
  if (!rows[0] || rows[0].count > limit)
    fail(429, "RATE_LIMITED", "잠시 후 다시 시도하세요.");
}
