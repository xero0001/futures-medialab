import type { BrandProposal } from "@futures-medialab/database/proposal-types";
import type { BrandReportingSubmission } from "@futures-medialab/database/reporting-types";
import type {
  BrandInvoice,
  BrandInvoiceVersion,
} from "@futures-medialab/database/settlement-types";
import type { BrandDocument } from "./brand-document-types";

const campaignHref = (id: string, tab: string) =>
  `/advertiser/campaign/${encodeURIComponent(id)}?tab=${tab}`;

/** Never turn arbitrary text, credentials or executable schemes into a file action. */
export function documentFileUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
function externalFile(
  url: string | null,
  title: string,
): BrandDocument["file"] {
  const safeUrl = documentFileUrl(url);
  return safeUrl
    ? { url: safeUrl, fileName: title, contentType: null, size: null }
    : null;
}

export function proposalDocument(
  proposal: BrandProposal,
): BrandDocument | null {
  // Runtime defence complements the published-only query and the public DTO.
  if (!proposal.publishedAt || String(proposal.status) === "DRAFT") return null;
  return {
    id: `proposal:${proposal.id}`,
    kind: "proposal",
    title: proposal.title,
    campaignId: proposal.campaignId,
    campaignTitle: proposal.campaignTitle,
    publishedAt: proposal.publishedAt,
    version: proposal.version,
    status: proposal.status,
    isLatest: proposal.isLatest,
    summary: proposal.summary,
    sourceHref: campaignHref(proposal.campaignId, "proposal"),
    file: null,
    proposal,
  };
}
export function reportDocument(row: {
  campaignId: string;
  campaignTitle: string;
  creatorName: string;
  platform: string;
  submission: BrandReportingSubmission;
}): BrandDocument | null {
  const submission = row.submission;
  if (!submission.releasedAt || !submission.publishedAt || !submission.postUrl)
    return null;
  const title = submission.title || `${row.creatorName} · 성과 보고`;
  return {
    id: `report:${submission.id}`,
    kind: "report",
    title,
    campaignId: row.campaignId,
    campaignTitle: row.campaignTitle,
    publishedAt: submission.releasedAt,
    version: submission.version,
    status: "PUBLISHED",
    isLatest: submission.isLatest,
    summary: submission.note,
    sourceHref: campaignHref(row.campaignId, "performance"),
    file: externalFile(submission.evidenceUrl, title),
    report: {
      creatorName: row.creatorName,
      platform: row.platform,
      submission,
    },
  };
}
export function invoiceDocument(
  current: BrandInvoice,
  snapshot?: BrandInvoiceVersion,
): BrandDocument | null {
  const version = snapshot?.version ?? current.documentVersion ?? 1;
  const isLatest = version === (current.documentVersion ?? 1);
  const invoice = {
    ...current,
    ...snapshot,
    documentVersion: version,
    versions: [],
  };
  if (!invoice.issuedAt || !["ISSUED", "PAID"].includes(invoice.status))
    return null;
  return {
    id: `invoice:${invoice.id}:v${version}`,
    kind: "invoice",
    title: invoice.title,
    campaignId: invoice.campaignId,
    campaignTitle: invoice.campaignTitle,
    publishedAt: invoice.issuedAt,
    version,
    status: isLatest ? invoice.status : "SUPERSEDED",
    isLatest,
    summary: invoice.note,
    correctionReason: snapshot?.reason ?? null,
    sourceHref: campaignHref(invoice.campaignId, "settlement"),
    file: externalFile(invoice.documentUrl, invoice.title),
    invoice,
  };
}

export function invoiceDocuments(invoice: BrandInvoice): BrandDocument[] {
  const rows = invoice.versions?.length
    ? invoice.versions.map((version) => invoiceDocument(invoice, version))
    : [invoiceDocument(invoice)];
  return rows.filter((row): row is BrandDocument => Boolean(row));
}

export type PublishedAttachment = {
  id: string;
  requestId: string;
  fileName: string;
  contentType: string;
  size: number;
  discardedAt: Date | null;
  request: {
    organizationId: string;
    title: string;
    campaignId: string | null;
    campaign: { title: string; brandOrganizationId: string } | null;
  };
  message: { requestId: string; internal: boolean; createdAt: Date } | null;
};
export function attachmentDocument(
  row: PublishedAttachment,
  organizationId: string,
  campaignId?: string,
): BrandDocument | null {
  const request = row.request;
  if (
    row.discardedAt ||
    !row.message ||
    row.message.internal ||
    row.message.requestId !== row.requestId ||
    request.organizationId !== organizationId ||
    (request.campaignId &&
      request.campaign?.brandOrganizationId !== organizationId) ||
    (campaignId && request.campaignId !== campaignId)
  )
    return null;
  return {
    id: `attachment:${row.id}`,
    kind: "attachment",
    title: row.fileName,
    campaignId: request.campaignId,
    campaignTitle: request.campaign?.title ?? null,
    publishedAt: row.message.createdAt.toISOString(),
    version: null,
    status: "SHARED",
    isLatest: true,
    summary: request.title,
    sourceHref: `/advertiser/requests?request=${encodeURIComponent(row.requestId)}`,
    file: {
      url: `/api/workspace/requests/${encodeURIComponent(row.requestId)}/attachments/${encodeURIComponent(row.id)}`,
      fileName: row.fileName,
      contentType: row.contentType,
      size: row.size,
    },
  };
}

/** Keep every kind represented; never silently truncate an older, valid type. */
export function documentLibrary(
  buckets: Array<Array<BrandDocument | null>>,
  perKindLimit = 100,
) {
  const hasMore = buckets.some((bucket) => bucket.length > perKindLimit);
  const documents = buckets.flatMap((bucket) =>
    bucket
      .filter((item): item is BrandDocument => Boolean(item))
      .slice(0, perKindLimit),
  );
  documents.sort(
    (a, b) =>
      Date.parse(b.publishedAt) - Date.parse(a.publishedAt) ||
      a.id.localeCompare(b.id),
  );
  return { documents, hasMore };
}
