import { z } from "zod";
import { productionFail } from "@futures-medialab/database/production";
import { readProductionBody } from "@futures-medialab/database/production-http";
export async function readSettlementBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  limit = 32768,
): Promise<T> {
  const input: unknown = await readProductionBody(request, z.unknown(), limit);
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    productionFail(
      400,
      "INVALID_INPUT",
      "완료·정산 항목과 처리 금액·시각을 확인해 주세요.",
    );
  return parsed.data;
}
