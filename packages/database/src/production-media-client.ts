import { put } from "@vercel/blob/client";
import {
  PRODUCTION_VIDEO_MAX_BYTES,
  PRODUCTION_VIDEO_TYPES,
} from "@futures-medialab/database/production-media-shared";
export async function uploadProductionVideo(
  endpoint: string,
  productionItemId: string,
  expectedRevision: number,
  file: File,
  signal: AbortSignal,
  onProgress: (percentage: number) => void,
): Promise<string> {
  if (
    !(PRODUCTION_VIDEO_TYPES as readonly string[]).includes(file.type) ||
    file.size > PRODUCTION_VIDEO_MAX_BYTES ||
    file.size < 12
  )
    throw new Error("200MB 이하의 MP4 또는 WebM 파일을 선택해 주세요.");
  async function post(body: unknown) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "동영상을 업로드하지 못했습니다.");
    return data;
  }
  const pending = await post({
    action: "prepare",
    productionItemId,
    expectedRevision,
    filename: file.name,
    contentType: file.type,
    size: file.size,
  });
  await put(pending.pathname, file, {
    token: pending.token,
    access: "private",
    contentType: file.type,
    multipart: true,
    abortSignal: signal,
    onUploadProgress: ({ percentage }) => onProgress(percentage),
  });
  const result = await post({ action: "complete", id: pending.id });
  return result.url;
}
