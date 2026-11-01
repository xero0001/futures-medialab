import { z } from "zod";
import { productionFail } from "@futures-medialab/database/production";
import { readProductionBody } from "@futures-medialab/database/production-http";

export async function readReportingBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  limit = 32_768,
): Promise<T> {
  // Reuse bounded, streaming JSON transport; keep reporting validation copy specific.
  const input: unknown = await readProductionBody(request, z.unknown(), limit);
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    productionFail(
      400,
      "INVALID_INPUT",
      "게시 링크, 게시·집계 시각과 성과 지표를 확인해 주세요.",
    );
  return parsed.data;
}
