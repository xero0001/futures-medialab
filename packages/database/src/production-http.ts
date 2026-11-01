import { z } from "zod";
import { productionFail } from "@futures-medialab/database/production";

export async function readProductionBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  limit = 32_768,
): Promise<T> {
  if (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim() !==
    "application/json"
  )
    productionFail(400, "INVALID_INPUT", "JSON 요청이 필요합니다.");
  const reader = request.body?.getReader();
  if (!reader) productionFail(400, "INVALID_INPUT", "요청 내용이 없습니다.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        productionFail(413, "TOO_LARGE", "요청 크기가 허용량을 초과했습니다.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    productionFail(400, "INVALID_INPUT", "요청 형식을 확인해 주세요.");
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    productionFail(
      400,
      "INVALID_INPUT",
      "콘텐츠 제목, 공개 HTTPS 링크와 사유를 확인해 주세요.",
    );
  return parsed.data;
}
