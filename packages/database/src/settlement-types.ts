export type OfficialSettlementStatus = "DRAFT" | "ISSUED" | "PAID";
export type SettlementCurrency = "KRW" | "USD" | "CNY";
export type CampaignCompletionSummary = {
  id: string;
  campaignId: string;
  proposalId: string;
  proposalVersion: number;
  completedAt: string;
  note: string;
};
export type BrandInvoiceLine = {
  proposalItemId: string;
  creatorName: string;
  platform: string;
  description: string;
  quantity: number;
  unitAmount: string;
  lineAmount: string;
};
/** itemTotalAmount is supplierCost once per proposal item, NEVER multiplied by quantity. */
export type AgencyPayoutLine = {
  proposalItemId: string;
  creatorName: string;
  platform: string;
  description: string;
  quantity: number;
  itemTotalAmount: string;
};
type SettlementDocumentBase = {
  id: string;
  campaignId: string;
  campaignTitle: string;
  proposalVersion: number;
  status: "ISSUED" | "PAID";
  revision: number;
  currency: SettlementCurrency;
  amount: string;
  title: string;
  note: string;
  dueAt: string | null;
  documentUrl: string | null;
  issuedAt: string;
  paidAt: string | null;
  completedAt: string;
};
export type BrandInvoice = SettlementDocumentBase & {
  lines: BrandInvoiceLine[];
};
export type AgencyPayout = SettlementDocumentBase & {
  lines: AgencyPayoutLine[];
};
type AdminSettlementFields = {
  status: OfficialSettlementStatus;
  issuedAt: string | null;
  internalNote: string;
  externalPaymentReference: string | null;
  canEdit: boolean;
  canIssue: boolean;
  canRecordPayment: boolean;
  actionProblems: string[];
};
export type AdminBrandInvoice = Omit<BrandInvoice, "status" | "issuedAt"> &
  AdminSettlementFields;
export type AdminAgencyPayout = Omit<AgencyPayout, "status" | "issuedAt"> &
  AdminSettlementFields & {
    supplierOrganizationId: string;
    supplierName: string;
  };
export type BrandSettlementResponse = { invoices: BrandInvoice[] };
export type AgencySettlementResponse = { payouts: AgencyPayout[] };
export type AdminSettlementResponse = {
  campaignId: string;
  campaignTitle: string;
  campaignStatus: string;
  currency: SettlementCurrency;
  completion: CampaignCompletionSummary | null;
  readinessToken: string;
  canComplete: boolean;
  completionProblems: string[];
  canPrepare: boolean;
  preparationProblems: string[];
  supplierCostBasis: "ITEM_TOTAL";
  brandTotalAmount: string | null;
  totalSupplierAmount: string | null;
  invoice: AdminBrandInvoice | null;
  payouts: AdminAgencyPayout[];
};
export type SettlementDocumentInput = {
  title: string;
  note: string;
  dueAt: string | null;
  documentUrl: string | null;
  internalNote: string;
};
type AdminSettlementMutationBase = {
  campaignId: string;
  clientRequestId: string;
};
type DocumentMutation = AdminSettlementMutationBase & {
  expectedRevision: number;
};
type ExternalPaymentInput = {
  paidAt: string;
  reference: string;
  amount: string;
  currency: SettlementCurrency;
  internalNote: string;
};
export type AdminSettlementMutation =
  | (AdminSettlementMutationBase & {
      action: "completeCampaign";
      expectedReadinessToken: string;
      note: string;
    })
  | (AdminSettlementMutationBase & {
      action: "prepare";
      completionId: string;
      supplierCostBasis: "ITEM_TOTAL";
    })
  | (DocumentMutation & {
      action: "saveBrandInvoice";
      invoiceId: string;
      data: SettlementDocumentInput;
    })
  | (DocumentMutation & {
      action: "saveAgencyPayout";
      payoutId: string;
      data: SettlementDocumentInput;
    })
  | (DocumentMutation & { action: "issueBrandInvoice"; invoiceId: string })
  | (DocumentMutation & { action: "issueAgencyPayout"; payoutId: string })
  | (DocumentMutation & {
      action: "recordBrandPayment";
      invoiceId: string;
      data: ExternalPaymentInput;
    })
  | (DocumentMutation & {
      action: "recordAgencyPayment";
      payoutId: string;
      data: ExternalPaymentInput;
    });
