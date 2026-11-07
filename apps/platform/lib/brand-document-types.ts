import type { BrandProposal } from "@futures-medialab/database/proposal-types";
import type { BrandReportingSubmission } from "@futures-medialab/database/reporting-types";
import type { BrandInvoice } from "@futures-medialab/database/settlement-types";

export type BrandDocument = {
  id: string;
  kind: "proposal" | "report" | "invoice" | "attachment";
  title: string;
  campaignId: string | null;
  campaignTitle: string | null;
  publishedAt: string;
  version: number | null;
  status: string;
  isLatest: boolean;
  summary: string;
  sourceHref: string;
  file: {
    url: string;
    fileName: string;
    contentType: string | null;
    size: number | null;
  } | null;
  proposal?: BrandProposal;
  report?: {
    creatorName: string;
    platform: string;
    submission: BrandReportingSubmission;
  };
  invoice?: BrandInvoice;
  correctionReason?: string | null;
};

export type BrandDocumentResponse = {
  documents: BrandDocument[];
  hasMore: boolean;
};
