import { z } from "zod";

export function contentReferenceUrl(value: string) {
  if (value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}
export const agencyContentSchema = z.strictObject({
  action: z.enum(["submitDraft", "publishContent"]),
  applicationId: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/),
  expectedSubmissionId: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/).nullable(),
  expectedUpdatedAt: z.iso.datetime().nullable(),
  url: z.string().trim().min(1).max(2048).refine(contentReferenceUrl),
});

export function canSubmitContent(action: string, latestStatus: string | null) {
  return action === "submitDraft" ? latestStatus === null || ["DRAFT", "REVISION_REQUESTED"].includes(latestStatus)
    : action === "publishContent" && latestStatus === "APPROVED";
}
