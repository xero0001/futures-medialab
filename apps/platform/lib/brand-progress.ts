import type {
  BrandCampaign,
  BrandCampaignDetail,
  BrandWorkspace,
} from "./brand-workspace-types";

export type BrandActionKind = "proposal" | "content" | "request" | "invoice";
export type BrandDeadlineKind =
  | "proposal-validity"
  | "content"
  | "reply"
  | "payment"
  | "proposal"
  | "recruitment";
export type BrandAction = {
  id: string;
  kind: BrandActionKind;
  title: string;
  campaignTitle: string | null;
  campaignId: string | null;
  href: string;
  dueAt: string | null;
  deadlineKind: BrandDeadlineKind;
  count: number;
  updatedAt: string;
};
export type BrandScheduleAlert = {
  campaignId: string;
  campaignTitle: string;
  kind: "proposal" | "proposal-validity" | "recruitment" | "content";
  dueAt: string;
  href: string;
};
export type BrandProgressStage =
  | "brief"
  | "intake"
  | "sourcing"
  | "proposal"
  | "production"
  | "reporting"
  | "completion";
export type BrandProgressState = {
  stage: BrandProgressStage;
  state:
    | "draft"
    | "canceled"
    | "complete"
    | "invoice"
    | "settling"
    | "reply"
    | "proposal-review"
    | "proposal-expired"
    | "proposal-revision"
    | "content-review"
    | "content-revision"
    | "futures-review"
    | "production"
    | "production-setup"
    | "reporting-review"
    | "reporting"
    | "sourcing"
    | "intake";
  owner: "brand" | "futures" | "production" | "none";
  dueAt: string | null;
  deadlineKind: BrandDeadlineKind | null;
  href: string;
};
const activeProductionStatuses = new Set(["IN_PROGRESS", "VERIFYING"]);
const pendingProposalStatuses = new Set([
  "PUBLISHED",
  "CHANGES_REQUESTED",
  "REJECTED",
]);
const proposalCampaignStatuses = new Set([
  "REVIEW",
  "RECRUITING",
  "IN_PROGRESS",
]);
const closedStatuses = new Set(["COMPLETED", "CANCELED"]);
const campaignPath = (id: string, tab?: string) =>
  `/advertiser/campaign/${encodeURIComponent(id)}${tab ? `?tab=${tab}` : ""}`;
const requestPath = (id: string) =>
  `/advertiser/requests?request=${encodeURIComponent(id)}`;
const validDate = (value: string | null | undefined): string | null =>
  value && Number.isFinite(Date.parse(value)) ? value : null;

export function isBrandProposalReviewable(
  campaign: BrandCampaign,
  now: number,
): boolean {
  const proposal = campaign.latestProposal;
  return Boolean(
    proposal &&
    proposal.pendingItemCount > 0 &&
    proposal.expiresAt &&
    Date.parse(proposal.expiresAt) > now &&
    pendingProposalStatuses.has(proposal.status) &&
    proposalCampaignStatuses.has(campaign.status),
  );
}

export function isPastBrandDeadline(
  value: string | null,
  now: number,
): boolean {
  return Boolean(
    value && Number.isFinite(Date.parse(value)) && Date.parse(value) < now,
  );
}

export function getBrandActions(
  data: BrandWorkspace,
  now: number,
): BrandAction[] {
  const campaigns = new Map(
    data.campaigns.map((campaign) => [campaign.id, campaign]),
  );
  const result: BrandAction[] = [];
  for (const proposal of data.pendingProposals) {
    const campaign = campaigns.get(proposal.campaignId);
    if (
      !campaign ||
      campaign.latestProposal?.id !== proposal.id ||
      !isBrandProposalReviewable(campaign, now)
    )
      continue;
    result.push({
      id: `proposal:${proposal.id}`,
      kind: "proposal",
      title: proposal.title,
      campaignTitle: proposal.campaignTitle,
      campaignId: proposal.campaignId,
      href: campaignPath(proposal.campaignId, "proposal"),
      dueAt: validDate(proposal.expiresAt),
      deadlineKind: "proposal-validity",
      count: proposal.pendingItemCount,
      updatedAt: proposal.publishedAt,
    });
  }
  for (const campaign of data.campaigns) {
    if (
      !activeProductionStatuses.has(campaign.status) ||
      campaign.productionSummary.awaitingBrand <= 0
    )
      continue;
    result.push({
      id: `content:${campaign.id}`,
      kind: "content",
      title: campaign.title,
      campaignTitle: campaign.title,
      campaignId: campaign.id,
      href: campaignPath(campaign.id, "production"),
      dueAt: validDate(campaign.contentDeadline),
      deadlineKind: "content",
      count: campaign.productionSummary.awaitingBrand,
      updatedAt: campaign.updatedAt,
    });
  }
  for (const request of data.requests) {
    if (request.status !== "WAITING_BRAND") continue;
    const campaign = request.campaignId
      ? campaigns.get(request.campaignId)
      : undefined;
    const proposalDecision =
      request.waitingFor === "proposal-decision" ||
      (!request.waitingFor &&
        campaign?.requestId === request.id &&
        Boolean(campaign.latestProposal));
    if (proposalDecision) continue;
    result.push({
      id: `request:${request.id}`,
      kind: "request",
      title: request.title,
      campaignTitle: request.campaignTitle,
      campaignId: request.campaignId,
      href:
        request.waitingFor === "brief" && campaign?.status === "DRAFT"
          ? `/advertiser/campaign/new?draft=${encodeURIComponent(campaign.id)}`
          : requestPath(request.id),
      dueAt: validDate(request.dueAt),
      deadlineKind: "reply",
      count: 1,
      updatedAt: request.updatedAt,
    });
  }
  for (const invoice of data.invoices) {
    if (invoice.status !== "ISSUED") continue;
    result.push({
      id: `invoice:${invoice.id}`,
      kind: "invoice",
      title: invoice.title,
      campaignTitle: invoice.campaignTitle,
      campaignId: invoice.campaignId,
      href: campaignPath(invoice.campaignId, "settlement"),
      dueAt: validDate(invoice.dueAt),
      deadlineKind: "payment",
      count: 1,
      updatedAt: invoice.issuedAt,
    });
  }
  return result.sort((a, b) => {
    const due =
      (a.dueAt ? Date.parse(a.dueAt) : Infinity) -
      (b.dueAt ? Date.parse(b.dueAt) : Infinity);
    if (Number.isFinite(due) && due !== 0) return due;
    if (a.dueAt && !b.dueAt) return -1;
    if (!a.dueAt && b.dueAt) return 1;
    return (
      Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
      a.id.localeCompare(b.id)
    );
  });
}

export function getBrandScheduleItems(
  campaigns: BrandCampaign[],
  now: number,
): BrandScheduleAlert[] {
  const result: BrandScheduleAlert[] = [];
  for (const campaign of campaigns) {
    if (closedStatuses.has(campaign.status) || campaign.status === "DRAFT")
      continue;
    const proposal = campaign.latestProposal;
    if (
      proposal &&
      proposalCampaignStatuses.has(campaign.status) &&
      pendingProposalStatuses.has(proposal.status) &&
      proposal.pendingItemCount > 0 &&
      proposal.expiresAt &&
      Date.parse(proposal.expiresAt) <= now
    ) {
      result.push({
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        kind: "proposal-validity",
        dueAt: proposal.expiresAt,
        href: campaignPath(campaign.id),
      });
      continue;
    }
    const proposalPending =
      ["REVIEW", "RECRUITING"].includes(campaign.status) &&
      !campaign.latestProposal &&
      !["WAITING_BRAND", "CLOSED"].includes(campaign.intakeStatus ?? "");
    const kind = proposalPending
      ? campaign.type === "MANAGED"
        ? "proposal"
        : "recruitment"
      : "content";
    const value = proposalPending
      ? campaign.type === "MANAGED"
        ? campaign.proposalDueAt
        : campaign.applicationDeadline
      : activeProductionStatuses.has(campaign.status) &&
          (campaign.productionSummary.total >
            campaign.productionSummary.approved ||
            (campaign.latestProposal?.status === "APPROVED" &&
              campaign.productionSummary.total === 0)) &&
          campaign.productionSummary.awaitingBrand === 0
        ? campaign.contentDeadline
        : null;
    if (!validDate(value)) continue;
    result.push({
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      kind,
      dueAt: value!,
      href: campaignPath(campaign.id),
    });
  }
  return result.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

function campaignStage(campaign: BrandCampaign): BrandProgressStage {
  if (campaign.status === "DRAFT") return "brief";
  if (["COMPLETED", "SETTLING"].includes(campaign.status)) return "completion";
  if (
    campaign.productionSummary.total > 0 &&
    campaign.productionSummary.approved < campaign.productionSummary.total
  )
    return "production";
  if (
    campaign.status === "VERIFYING" ||
    campaign.reportingSummary.total > 0 ||
    (campaign.productionSummary.total > 0 &&
      campaign.productionSummary.approved === campaign.productionSummary.total)
  )
    return "reporting";
  if (
    campaign.productionSummary.total > 0 ||
    campaign.latestProposal?.status === "APPROVED"
  )
    return "production";
  if (campaign.latestProposal) return "proposal";
  if (campaign.status === "IN_PROGRESS") return "production";
  return campaign.status === "RECRUITING" ? "sourcing" : "intake";
}

export function getBrandCampaignProgress(
  detail: BrandCampaignDetail,
  now: number,
): BrandProgressState {
  const campaign = detail.campaign;
  const stage = campaignStage(campaign);
  const state = (
    value: BrandProgressState["state"],
    owner: BrandProgressState["owner"],
    href: string,
    dueAt: string | null = null,
    deadlineKind: BrandDeadlineKind | null = null,
  ): BrandProgressState => ({
    stage,
    state: value,
    owner,
    href,
    dueAt: validDate(dueAt),
    deadlineKind,
  });
  if (campaign.status === "CANCELED")
    return state("canceled", "none", campaignPath(campaign.id, "documents"));
  if (campaign.status === "DRAFT")
    return state(
      "draft",
      "brand",
      `/advertiser/campaign/new?draft=${encodeURIComponent(campaign.id)}`,
    );
  const invoice = detail.invoices
    .filter((item) => item.status === "ISSUED")
    .sort(
      (a, b) =>
        (a.dueAt ? Date.parse(a.dueAt) : Infinity) -
        (b.dueAt ? Date.parse(b.dueAt) : Infinity),
    )[0];
  if (campaign.status === "COMPLETED")
    return invoice
      ? state(
          "invoice",
          "brand",
          campaignPath(campaign.id, "settlement"),
          invoice.dueAt,
          "payment",
        )
      : state("complete", "none", campaignPath(campaign.id, "documents"));
  if (campaign.status === "SETTLING")
    return invoice
      ? state(
          "invoice",
          "brand",
          campaignPath(campaign.id, "settlement"),
          invoice.dueAt,
          "payment",
        )
      : state("settling", "futures", campaignPath(campaign.id, "settlement"));
  if (
    campaign.intakeStatus === "WAITING_BRAND" &&
    campaign.requestId &&
    campaign.intakeWaitingFor !== "proposal-decision" &&
    (campaign.intakeWaitingFor || !campaign.latestProposal)
  )
    return state(
      "reply",
      "brand",
      requestPath(campaign.requestId),
      campaign.intakeDueAt,
      "reply",
    );
  if (
    activeProductionStatuses.has(campaign.status) &&
    campaign.productionSummary.awaitingBrand > 0
  )
    return state(
      "content-review",
      "brand",
      campaignPath(campaign.id, "production"),
      campaign.contentDeadline,
      "content",
    );
  if (isBrandProposalReviewable(campaign, now))
    return state(
      "proposal-review",
      "brand",
      campaignPath(campaign.id, "proposal"),
      campaign.latestProposal?.expiresAt ?? null,
      "proposal-validity",
    );
  const proposal = campaign.latestProposal;
  if (
    proposal &&
    pendingProposalStatuses.has(proposal.status) &&
    proposal.pendingItemCount > 0 &&
    proposal.expiresAt &&
    Date.parse(proposal.expiresAt) <= now
  )
    return state(
      "proposal-expired",
      "futures",
      campaignPath(campaign.id, "proposal"),
      proposal.expiresAt,
      "proposal-validity",
    );
  if (proposal && ["CHANGES_REQUESTED", "REJECTED"].includes(proposal.status))
    return state(
      "proposal-revision",
      "futures",
      campaignPath(campaign.id, "proposal"),
    );
  if (campaign.productionSummary.changesRequested > 0)
    return state(
      "content-revision",
      "production",
      campaignPath(campaign.id, "production"),
      campaign.contentDeadline,
      "content",
    );
  if (campaign.productionSummary.underReview > 0)
    return state(
      "futures-review",
      "futures",
      campaignPath(campaign.id, "production"),
      campaign.contentDeadline,
      "content",
    );
  if (campaign.productionSummary.awaitingSubmission > 0)
    return state(
      "production",
      "production",
      campaignPath(campaign.id, "production"),
      campaign.contentDeadline,
      "content",
    );
  if (stage === "reporting") {
    const reports = detail.performance.items.filter((item) => item.isCurrent);
    const owner = reports.some((item) => item.status === "ADMIN_REVIEW")
      ? "futures"
      : reports.some((item) =>
            ["AWAITING_SUBMISSION", "AGENCY_REVISION"].includes(item.status),
          )
        ? "production"
        : campaign.reportingSummary.published > 0
          ? "futures"
          : "production";
    return campaign.reportingSummary.published > 0
      ? state(
          "reporting-review",
          owner,
          campaignPath(campaign.id, "performance"),
        )
      : state(
          "reporting",
          owner,
          campaignPath(campaign.id, "performance"),
          campaign.contentDeadline,
          "content",
        );
  }
  if (stage === "production")
    return state(
      "production-setup",
      "futures",
      campaignPath(campaign.id, "production"),
      campaign.contentDeadline,
      "content",
    );
  if (campaign.status === "RECRUITING")
    return state(
      "sourcing",
      "futures",
      campaignPath(campaign.id),
      campaign.type === "MANAGED"
        ? campaign.proposalDueAt
        : campaign.applicationDeadline,
      campaign.type === "MANAGED" ? "proposal" : "recruitment",
    );
  return state(
    "intake",
    "futures",
    campaignPath(campaign.id),
    campaign.type === "MANAGED" ? campaign.proposalDueAt : campaign.intakeDueAt,
    campaign.type === "MANAGED" ? "proposal" : null,
  );
}
