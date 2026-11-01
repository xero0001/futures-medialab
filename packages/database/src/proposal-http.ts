import { z } from "zod";
import { proposalFail } from "@futures-medialab/database/proposals";

export async function readProposalBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  limit = 32_768,
): Promise<T> {
  if (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim() !==
    "application/json"
  )
    proposalFail(400, "INVALID_INPUT", "JSON 요청이 필요합니다.");
  const reader = request.body?.getReader();
  if (!reader) proposalFail(400, "INVALID_INPUT", "요청 내용이 없습니다.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        proposalFail(413, "TOO_LARGE", "요청 크기가 허용량을 초과했습니다.");
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
    proposalFail(400, "INVALID_INPUT", "요청 형식을 확인해 주세요.");
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    proposalFail(
      400,
      "INVALID_INPUT",
      "제안 항목, 금액, 일정과 사유를 확인해 주세요.",
    );
  return parsed.data;
}
