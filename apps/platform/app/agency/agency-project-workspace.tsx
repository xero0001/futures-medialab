"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, SectionMessage, Skeleton, Tab, TabList, TabListItem, TabPanel, Typography } from "@montage-ui/core";
import { IconArrowLeft, IconClock } from "@montage-ui/icon";
import type { Locale } from "../_components/landing-copy";
import type { AgencyAssignedCampaign, AgencyProjectsResponse, AgencyProjectStage } from "../../lib/agency-projects-types";
import { productionText } from "../_components/workspace/production-shared";
import { StatusBadge } from "../_components/workspace/status-badge";
import { AgencyProductionWorkspace } from "./agency-production-workspace";
import { AgencyReportingWorkspace } from "./agency-reporting-workspace";
import { AgencySettlementWorkspace } from "./agency-settlement-workspace";
import { AgencyOperations } from "./agency-operations";
import { AgencyProjectIdentity, AgencyProjectsOverview, projectPresentation } from "./agency-projects-overview";
import styles from "./agency-projects-overview.module.css";

type Stage = "overview" | AgencyProjectStage;
type LoadedProjects = { scope: string | null; data: AgencyProjectsResponse | null; error: string };
export function AgencyProjectWorkspace({ locale, onExplore, onApplications }: { locale: Locale; onExplore: () => void; onApplications: () => void }) {
  const t = productionText(locale), params = useSearchParams();
  const campaignId = params.get("campaign");
  const validId = campaignId === null || /^[a-zA-Z0-9_-]{1,120}$/.test(campaignId);
  const requestedStage = params.get("stage");
  const stage: Stage = ["production", "reporting", "settlement", "records"].includes(requestedStage ?? "") ? requestedStage as AgencyProjectStage : campaignId !== null ? "production" : "overview";
  const [result, setResult] = useState<LoadedProjects | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!validId) return;
    const controller = new AbortController();
    const path = `/api/agency/projects${campaignId === null ? "" : `?campaignId=${encodeURIComponent(campaignId)}`}`;
    fetch(path, { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "담당 캠페인을 불러오지 못했습니다.");
      if (!Array.isArray(body.projects) || !body.organization) throw new Error("담당 캠페인을 불러오지 못했습니다.");
      return body as AgencyProjectsResponse;
    }).then(data => { if (!controller.signal.aborted) setResult({ scope: campaignId, data, error: "" }); }).catch(error => { if (!controller.signal.aborted) setResult({ scope: campaignId, data: null, error: error instanceof Error ? error.message : "담당 캠페인을 불러오지 못했습니다." }); });
    return () => controller.abort();
  }, [campaignId, validId, revision]);
  const current = result?.scope === campaignId ? result : null;
  const data = current?.data ?? null;
  const selected = campaignId === null ? null : data?.projects.find(project => project.campaignId === campaignId) ?? null;
  function navigate(next: Stage, projectId: string | null = campaignId) {
    const url = new URL(window.location.href);
    url.searchParams.set("section", "projects");
    if (next === "overview") { url.searchParams.delete("stage"); url.searchParams.delete("campaign"); }
    else { url.searchParams.set("stage", next); if (projectId === null) url.searchParams.delete("campaign"); else url.searchParams.set("campaign", projectId); }
    window.history.pushState(null, "", url);
  }
  function reload() { setResult(null); setRevision(value => value + 1); }
  function refreshSummary() { setRevision(value => value + 1); }
  function open(project: AgencyAssignedCampaign, next: AgencyProjectStage) { navigate(next, project.campaignId); window.scrollTo({ top: 0, behavior: "auto" }); }
  const back = <Button size="small" variant="outlined" color="assistive" onClick={() => navigate("overview")}><IconArrowLeft />{t("전체 담당 캠페인", "All assigned campaigns", "全部负责活动")}</Button>;
  if (!validId) return <SectionMessage variant="negative" role="alert" bottomButton={back}>{t("캠페인 주소를 확인해 주세요.", "Check the campaign address.", "请检查活动地址。")}</SectionMessage>;
  if (!current) return <div className={styles.workspace} role="status" aria-label={t("담당 캠페인 불러오는 중", "Loading assigned campaigns", "正在加载负责的活动")}><Skeleton width="100%" height={120} /><Skeleton width="100%" height={260} /></div>;
  if (current.error || !data || (campaignId !== null && !selected)) return <SectionMessage variant="negative" role="alert" bottomButton={<div className={styles.actions}>{back}<Button size="small" variant="outlined" color="assistive" onClick={reload}>{t("다시 불러오기", "Try again", "重试")}</Button></div>}>{current.error || t("이 캠페인의 배정 내역을 확인할 수 없습니다.", "This campaign assignment is unavailable.", "无法查看此活动的分配记录。")}</SectionMessage>;
  const presentation = selected ? projectPresentation(selected, t) : null;
  const available = !selected || (stage !== "overview" && selected.availableStages.includes(stage));
  return <section className={styles.workspace}>
    {selected ? <div className={styles.selected}><div className={styles.selectedTop}>{back}{presentation && <div className={styles.badges}><StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge>{selected.isDemo && <StatusBadge tone="neutral">{t("시연", "Demo", "演示")}</StatusBadge>}</div>}</div><AgencyProjectIdentity project={selected} locale={locale} heading="h2" /><Typography as="p" variant="body2" className={styles.muted}>{t("선택한 캠페인에서 우리 조직에 배정된 업무만 표시합니다.", "Showing only your organization's assigned work for this campaign.", "仅显示此活动中分配给本组织的任务。")}</Typography></div> : stage !== "overview" ? <div className={styles.context}>{back}<Typography variant="body2" className={styles.muted}>{t("전체 담당 캠페인의 업무를 보고 있습니다.", "Showing tasks across all assigned campaigns.", "正在查看全部负责活动的任务。")}</Typography></div> : null}
    <Tab value={stage} onValueChange={value => navigate(value as Stage)} disableScrollMoveOnChange>
      <TabList aria-label={t("캠페인 업무", "Campaign tasks", "活动任务")} size="medium">
        <TabListItem value="overview">{t("담당 캠페인", "Assigned campaigns", "负责的活动")}</TabListItem>
        <TabListItem value="production">{t("제작·검수", "Production & review", "制作与审核")}</TabListItem>
        <TabListItem value="reporting">{t("게시·성과", "Publication & performance", "发布与成效")}</TabListItem>
        <TabListItem value="settlement">{t("정산", "Settlement", "结算")}</TabListItem>
        <TabListItem value="records">{t("이전 신청 프로젝트", "Earlier application projects", "历史申请项目")}</TabListItem>
      </TabList>
      <TabPanel value={stage} mountMode="always" sx={{ paddingTop: "24px" }}>
        {stage === "overview" ? <AgencyProjectsOverview data={data} locale={locale} onOpen={open} onRefresh={reload} onExplore={onExplore} /> : !available ? <PendingStage stage={stage} locale={locale} /> : stage === "production" ? <AgencyProductionWorkspace key={campaignId ?? "all"} locale={locale} campaignId={campaignId ?? undefined} onChanged={refreshSummary} /> : stage === "reporting" ? <AgencyReportingWorkspace key={campaignId ?? "all"} locale={locale} campaignId={campaignId ?? undefined} onChanged={refreshSummary} /> : stage === "settlement" ? <AgencySettlementWorkspace key={campaignId ?? "all"} locale={locale} campaignId={campaignId ?? undefined} /> : <AgencyOperations key={campaignId ?? "all"} locale={locale} section="projects" campaignId={campaignId ?? undefined} onExplore={onExplore} onApplications={onApplications} />}
      </TabPanel>
    </Tab>
  </section>;
}
function PendingStage({ stage, locale }: { stage: AgencyProjectStage; locale: Locale }) {
  const t = productionText(locale);
  const copy = {
    production: [t("제작 배정을 준비하고 있습니다", "Production assignment pending", "正在准备制作分配"), t("공식 제안 승인과 담당 구성 배정이 완료되면 이 캠페인의 제작 업무가 표시됩니다.", "Production tasks appear after proposal approval and assignment to your team.", "正式方案批准并分配给贵团队后，将显示此活动的制作任务。")],
    reporting: [t("게시·성과 업무가 준비되지 않았습니다", "Reporting is not ready yet", "发布与成效任务尚未准备"), t("이 캠페인의 담당 콘텐츠가 승인되면 게시 링크와 지표를 등록할 수 있습니다.", "You can register published links and metrics once your assigned content is approved.", "此活动的负责内容获批后，可登记发布链接和指标。")],
    settlement: [t("아직 발행된 정산이 없습니다", "No payout statement issued yet", "尚未出具结算单"), t("캠페인 완료 후 우리 조직에 발행된 지급 정산 내역이 표시됩니다.", "Statements issued to your organization appear after campaign completion.", "活动完成后，将显示向本组织出具的付款结算记录。")],
    records: [t("선정된 신청 기록이 없습니다", "No accepted application record", "暂无获选申请记录"), t("공식 제안으로 배정된 캠페인은 제작·검수와 게시·성과 탭에서 확인할 수 있습니다.", "Assignments through official proposals are available in production and reporting tabs.", "通过正式方案分配的任务可在制作与发布成效标签页查看。")],
  }[stage];
  return <div className={styles.empty}><IconClock /><Typography as="h3" variant="heading2" weight="bold">{copy[0]}</Typography><Typography as="p" variant="body2" className={styles.muted}>{copy[1]}</Typography></div>;
}
