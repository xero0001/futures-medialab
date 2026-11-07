export const campaignSections = [
  ["overview", "진행 개요"],
  ["sourcing", "후보·소싱"],
  ["proposal", "공식 제안"],
  ["production", "제작·검수"],
  ["reporting", "게시·성과"],
  ["documents", "문서·공유"],
  ["settlement", "청구·지급"],
  ["legacy", "기존 운영 기록"],
] as const;
export type CampaignSection = (typeof campaignSections)[number][0];
export type AdminLocation = {
  tab:
    | "overview"
    | "users"
    | "organizations"
    | "campaigns"
    | "intake"
    | "creators"
    | "games"
    | "requests"
    | "audit";
  selected: string;
  section: CampaignSection;
  request: string;
  scope: "all" | "MANAGED" | "OPEN_BIDDING";
  status: string;
  accountType: "all" | "BRAND" | "AGENCY";
};
const tabs = [
  "overview",
  "users",
  "organizations",
  "campaigns",
  "intake",
  "creators",
  "games",
  "requests",
  "audit",
];
const statuses = [
  "all",
  "DRAFT",
  "REVIEW",
  "RECRUITING",
  "IN_PROGRESS",
  "VERIFYING",
  "SETTLING",
  "COMPLETED",
  "CANCELED",
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
];
const safeId = (value: string | null) =>
  value && /^[a-zA-Z0-9_-]{1,120}$/.test(value) ? value : "";
export function parseAdminLocation(search: string): AdminLocation {
  const q = new URLSearchParams(search),
    tab = q.get("tab");
  const location: AdminLocation = {
    tab: tabs.includes(tab ?? "") ? (tab as AdminLocation["tab"]) : "overview",
    selected: "",
    section: "overview",
    request: "",
    scope: "all",
    status: "all",
    accountType: "all",
  };
  if (
    ["campaigns", "users", "organizations", "games"].includes(
      location.tab,
    )
  )
    location.selected = safeId(
      q.get(
        location.tab === "campaigns"
          ? "campaign"
          : location.tab === "games"
            ? "game"
            : "organization",
      ),
    );
  if (location.tab === "requests") location.request = safeId(q.get("request"));
  if (
    ["users", "organizations"].includes(location.tab) &&
    ["BRAND", "AGENCY"].includes(q.get("accountType") ?? "")
  )
    location.accountType = q.get("accountType") as AdminLocation["accountType"];
  if (campaignSections.some(([key]) => key === q.get("section")))
    location.section = q.get("section") as CampaignSection;
  if (["MANAGED", "OPEN_BIDDING"].includes(q.get("scope") ?? ""))
    location.scope = q.get("scope") as AdminLocation["scope"];
  const allowedStatuses =
    location.tab === "campaigns"
      ? statuses.filter(
          (value) => !["PENDING", "ACTIVE", "SUSPENDED"].includes(value),
        )
      : location.tab === "users"
        ? ["all", "PENDING", "ACTIVE", "SUSPENDED"]
        : ["all"];
  if (allowedStatuses.includes(q.get("status") ?? ""))
    location.status = q.get("status")!;
  return location;
}
export function adminLocationHref(location: AdminLocation): string {
  const q = new URLSearchParams();
  if (location.tab !== "overview") q.set("tab", location.tab);
  if (location.tab === "campaigns") {
    if (location.selected) q.set("campaign", location.selected);
    if (location.selected && location.section !== "overview")
      q.set("section", location.section);
    if (location.scope !== "all") q.set("scope", location.scope);
  }
  if (["users", "organizations"].includes(location.tab)) {
    if (location.selected) q.set("organization", location.selected);
    if (location.accountType !== "all")
      q.set("accountType", location.accountType);
  }
  if (location.tab === "games" && location.selected)
    q.set("game", location.selected);
  if (location.tab === "requests" && location.request)
    q.set("request", location.request);
  if (
    ["campaigns", "users"].includes(location.tab) &&
    location.status !== "all"
  )
    q.set("status", location.status);
  return q.size ? `/?${q.toString()}` : "/";
}
