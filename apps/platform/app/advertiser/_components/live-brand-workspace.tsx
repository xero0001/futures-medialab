"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Button, ContentBadge, SearchField, SectionMessage, Skeleton,
  Tab, TabList, TabListItem, TabPanel, Table, TableBody, TableCell,
  TableHead, TableHeadCell, TableRow, Typography,
} from "@montage-ui/core";
import {
  IconArrowLeft, IconArrowRight, IconCalendar, IconCheck, IconClock,
  IconFolder, IconInbox, IconLock, IconMegaphone, IconPlus, IconSparkle,
} from "@montage-ui/icon";
import type { Locale } from "../../_components/landing-copy";
import { WorkspaceProvider } from "../../_components/workspace/workspace-provider";
import { WorkspaceShell } from "../../_components/workspace/workspace-shell";
import { StatusBadge, type StatusTone } from "../../_components/workspace/status-badge";
import shellStyles from "../../_components/workspace/workspace-shell.module.css";
import { authClient } from "../../../lib/auth-client";
import type { BrandCampaign, BrandCampaignDetail, BrandCampaignRoute, BrandWorkspace } from "../../../lib/brand-workspace-types";
import { LiveRequestWizard } from "./live-request-wizard";
import { OfficialProposalPanel, proposalMoney } from "./official-proposal-panel";
import { BrandProductionPanel } from "./brand-production-panel";
import { BrandReportingPanel } from "./brand-reporting-panel";
import { BrandBillingPanel } from "./brand-billing-panel";
import { settlementMoney } from "../../../lib/settlement-display";
import styles from "./live-brand-workspace.module.css";

export type LiveBrandWorkspaceMode = "home" | "campaigns" | "detail" | "library" | "billing" | "new";
type Account = { organizationName: string; userName: string; status: "PENDING" | "ACTIVE" };
type Copy = (ko: string, en: string, zh: string) => string;
const copyFor = (locale: Locale): Copy => (ko, en, zh) => ({ ko, en, zh })[locale];
const hrefFor = (path: string, locale: Locale) => `${path}${path.includes("?") ? "&" : "?"}lang=${locale}`;
const campaignPath = (id: string) => `/advertiser/campaign/${encodeURIComponent(id)}`;

function dateLabel(value: string | null, locale: Locale, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale, {
    year: "numeric", month: "short", day: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } as const : {}),
  }).format(date);
}

function amountLabel(campaign: BrandCampaign, locale: Locale) {
  if (campaign.budgetAmount === null) return copyFor(locale)("미입력", "Not entered", "未填写");
  const amount = Number(campaign.budgetAmount);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat(locale, { style: "currency", currency: campaign.currency, maximumFractionDigits: 0 }).format(amount);
}

function statusLabel(status: BrandCampaign["status"], t: Copy) {
  const labels: Record<BrandCampaign["status"], string> = {
    DRAFT: t("작성 중", "Draft", "草稿"), REVIEW: t("접수 검토 중", "Intake review", "受理审核中"),
    RECRUITING: t("섭외 중", "Sourcing", "招募中"), IN_PROGRESS: t("진행 중", "In progress", "进行中"),
    VERIFYING: t("결과 확인 중", "Verification", "结果确认中"), SETTLING: t("정산 중", "Settlement", "结算中"),
    COMPLETED: t("완료", "Completed", "已完成"), CANCELED: t("취소", "Canceled", "已取消"),
  };
  return labels[status];
}

function hasReviewableProposal(campaign: BrandCampaign, now: number) {
  const proposal = campaign.latestProposal;
  return Boolean(proposal?.pendingItemCount && proposal.expiresAt && Date.parse(proposal.expiresAt) > now && ["REVIEW", "RECRUITING", "IN_PROGRESS"].includes(campaign.status));
}

function Status({ campaign, t }: { campaign: BrandCampaign; t: Copy }) {
  const [now] = useState(() => Date.now());
  if (campaign.status === "CANCELED") return <StatusBadge tone="red">{statusLabel(campaign.status, t)}</StatusBadge>;
  if (campaign.status === "COMPLETED") return <StatusBadge tone={campaign.invoiceSummary.issued > 0 ? "amber" : "green"}>{campaign.invoiceSummary.issued > 0 ? t("캠페인 완료 · 입금 확인 대기", "Completed · payment confirmation pending", "活动完成 · 等待收款确认") : campaign.invoiceSummary.paid > 0 ? t("캠페인 완료 · 입금 확인", "Completed · payment confirmed", "活动完成 · 收款已确认") : statusLabel(campaign.status, t)}</StatusBadge>;
  if (campaign.productionSummary.awaitingBrand > 0) return <StatusBadge tone="amber">{t("콘텐츠 검수 대기", "Content to review", "待审核内容")}</StatusBadge>;
  if (campaign.productionSummary.changesRequested > 0) return <StatusBadge tone="amber">{t("콘텐츠 수정 중", "Content revision", "内容修改中")}</StatusBadge>;
  if (campaign.productionSummary.underReview > 0) return <StatusBadge tone="blue">{t("퓨쳐스 검토 중", "Futures review", "Futures 审核中")}</StatusBadge>;
  if (campaign.productionSummary.awaitingSubmission > 0) return <StatusBadge tone="neutral">{t("콘텐츠 제작 대기", "Awaiting production", "等待制作")}</StatusBadge>;
  if (campaign.reportingSummary.published > 0) return <StatusBadge tone="green">{campaign.reportingSummary.pending > 0 ? t("성과 공개 · 업데이트 중", "Published · updating", "成效已公开 · 更新中") : campaign.reportingSummary.allMetricsPending === campaign.reportingSummary.published ? t("게시 확인 · 지표 집계 중", "Published · metrics pending", "发布已确认 · 指标统计中") : t("성과 공개 완료", "Performance published", "成效已公开")}</StatusBadge>;
  if (campaign.reportingSummary.total > 0) return <StatusBadge tone="blue">{t("게시·성과 준비 중", "Preparing performance report", "发布与成效准备中")}</StatusBadge>;
  if (campaign.productionSummary.total > 0 && campaign.productionSummary.approved === campaign.productionSummary.total) return <StatusBadge tone="green">{t("콘텐츠 승인 완료", "Content approved", "内容已批准")}</StatusBadge>;
  if (campaign.latestProposal?.status === "CHANGES_REQUESTED") return <StatusBadge tone="amber">{t("제안 수정 중", "Proposal revision", "方案修改中")}</StatusBadge>;
  if (campaign.latestProposal?.status === "REJECTED") return <StatusBadge tone="red">{t("재제안 요청", "Replacement requested", "已请求重新提案")}</StatusBadge>;
  if (hasReviewableProposal(campaign, now)) return <StatusBadge tone="amber">{t("제안 승인 대기", "Proposal to approve", "待审批方案")}</StatusBadge>;
  const tones: Record<BrandCampaign["status"], StatusTone> = { DRAFT: "neutral", REVIEW: "blue", RECRUITING: "blue", IN_PROGRESS: "blue", VERIFYING: "amber", SETTLING: "amber", COMPLETED: "green", CANCELED: "red" };
  return <StatusBadge tone={tones[campaign.status]}>{statusLabel(campaign.status, t)}</StatusBadge>;
}

export function BrandWorkspaceFrame({ locale, account, children }: { locale: Locale; account: Account; children: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const t = copyFor(locale);
  async function signOut() {
    setBusy(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("signout");
      window.location.assign(hrefFor("/login", locale));
    } catch {
      setError(t("로그아웃하지 못했습니다. 다시 시도해 주세요.", "Could not sign out. Please try again.", "退出失败，请重试。"));
      setBusy(false);
    }
  }
  return <WorkspaceProvider>
    <div className={`${shellStyles.workspace} ${styles.workspace}`} lang={locale === "zh" ? "zh-CN" : locale}>
      <WorkspaceShell locale={locale} organizationName={account.organizationName} userName={account.userName} isGuest={false} busy={busy} onSignOut={() => void signOut()} />
      <main id="workspace-main" className={shellStyles.main}>
        <div className={`${shellStyles.content} ${styles.content}`}>
          {error && <SectionMessage variant="negative" role="alert">{error}</SectionMessage>}
          {children}
        </div>
      </main>
    </div>
  </WorkspaceProvider>;
}

async function readData<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : "LOAD_FAILED");
  return body as T;
}

export function LiveBrandWorkspace({ mode, locale, account, campaignId, initialRoute }: {
  mode: LiveBrandWorkspaceMode; locale: Locale; account: Account; campaignId?: string; initialRoute?: BrandCampaignRoute;
}) {
  const router = useRouter();
  const t = copyFor(locale);
  const href = (path: string) => hrefFor(path, locale);
  const [data, setData] = useState<BrandWorkspace | null>(null);
  const [detail, setDetail] = useState<BrandCampaignDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    // Clear the previous request state when the authenticated API resource changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    setDetail(null);
    Promise.all([
      readData<BrandWorkspace>("/api/brand/workspace", controller.signal),
      campaignId ? readData<BrandCampaignDetail>(`/api/brand/campaigns/${encodeURIComponent(campaignId)}`, controller.signal) : Promise.resolve(null),
    ]).then(([workspace, campaign]) => {
      if (controller.signal.aborted) return;
      setData(workspace);
      setDetail(campaign);
      setLoading(false);
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : "LOAD_FAILED");
      setLoading(false);
    });
    return () => controller.abort();
  }, [campaignId, revision]);

  return <BrandWorkspaceFrame locale={locale} account={account}>
    {loading ? <LoadingState t={t} /> : error ? <div className={styles.loadError}>
      <SectionMessage variant="negative" role="alert" description={error === "LOAD_FAILED" ? t("잠시 후 다시 시도해 주세요.", "Please try again shortly.", "请稍后重试。") : error}>
        {t("작업 공간을 불러오지 못했습니다.", "Could not load your workspace.", "无法加载工作区。")}
      </SectionMessage>
      <Button variant="outlined" color="assistive" onClick={() => setRevision(value => value + 1)}>{t("다시 불러오기", "Try again", "重试")}</Button>
    </div> : data ? <>
      {mode === "home" && <Home data={data} locale={locale} />}
      {mode === "campaigns" && <Campaigns data={data} locale={locale} />}
      {mode === "detail" && detail && <CampaignDetail detail={detail} canManage={data.permissions.canManageCampaigns} locale={locale} onRefresh={() => setRevision(value => value + 1)} />}
      {mode === "library" && <Library data={data} locale={locale} />}
      {mode === "billing" && <><PageHeading title={t("청구 내역", "Billing", "账单")} description={t("캠페인 완료 후 발행된 청구와 입금 확인 상태를 확인하세요.", "Review invoices issued after campaign completion and payment confirmation status.", "查看活动完成后出具的账单及收款确认状态。")}/><BrandBillingPanel invoices={data.invoices} locale={locale} showHeading={false} /></>}
      {mode === "new" && (data.permissions.canManageCampaigns ? <LiveRequestWizard locale={locale} initialCampaign={detail?.campaign} initialRoute={initialRoute} onClose={() => router.push(href(campaignId ? campaignPath(campaignId) : "/advertiser/campaign"))} onSaved={result => router.push(href(campaignPath(result.id)))} /> : <EmptyState icon={<IconLock />} title={t("캠페인 요청 권한이 필요합니다", "Campaign management permission required", "需要活动管理权限")} description={t("조직 소유자 또는 관리자에게 캠페인 요청을 부탁해 주세요.", "Ask an organization owner or admin to submit a campaign.", "请联系组织所有者或管理员提交活动。")}/>) }
    </> : null}
  </BrandWorkspaceFrame>;
}

function LoadingState({ t }: { t: Copy }) {
  return <div className={styles.loading} role="status" aria-label={t("캠페인을 불러오는 중", "Loading campaigns", "正在加载活动")}>
    <Skeleton width="45%" height="36px" />
    <Skeleton width="65%" height="20px" />
    <div className={styles.stats}>{[1, 2, 3, 4].map(value => <Skeleton key={value} height="104px" />)}</div>
    <Skeleton width="100%" height="280px" />
  </div>;
}

function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className={styles.heading}><div><Typography as="h1" variant="title2" weight="bold">{title}</Typography><Typography as="p" variant="body2" className={styles.muted}>{description}</Typography></div>{action}</header>;
}

function NewCampaignLink({ locale, canManage }: { locale: Locale; canManage: boolean }) {
  if (!canManage) return null;
  return <Button as={Link} href={hrefFor("/advertiser/campaign/new", locale)} leadingContent={<IconPlus />} size="medium">{copyFor(locale)("새 캠페인 요청", "New campaign", "新建活动")}</Button>;
}

function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`${styles.panel} ${className}`}><div className={styles.panelHeading}><Typography as="h2" variant="heading2" weight="bold">{title}</Typography>{action}</div>{children}</section>;
}

function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className={styles.empty}><span className={styles.emptyIcon} aria-hidden="true">{icon}</span><Typography as="h3" variant="heading2" weight="bold">{title}</Typography><Typography as="p" variant="body2" className={styles.muted}>{description}</Typography>{action}</div>;
}

function Home({ data, locale }: { data: BrandWorkspace; locale: Locale }) {
  const t = copyFor(locale);
  const href = (path: string) => hrefFor(path, locale);
  const active = data.campaigns.filter(campaign => !["DRAFT", "COMPLETED", "CANCELED"].includes(campaign.status)).slice(0, 5);
  const [now] = useState(() => Date.now());
  const upcoming = data.campaigns.flatMap(campaign => {
    if (["DRAFT", "COMPLETED", "CANCELED"].includes(campaign.status)) return [];
    const dates = [
      ...(["REVIEW", "RECRUITING"].includes(campaign.status) ? [{ value: campaign.proposalDueAt, label: t("제안 예정", "Proposal due", "预计提案") }, { value: campaign.applicationDeadline, label: t("모집 마감", "Recruitment closes", "招募截止") }] : []),
      { value: campaign.contentDeadline, label: t("콘텐츠 마감", "Content due", "内容截止") },
    ].filter((item): item is { value: string; label: string } => Boolean(item.value && new Date(item.value).getTime() >= now));
    return dates.map(item => ({ ...item, campaign }));
  }).sort((a, b) => new Date(a.value).getTime() - new Date(b.value).getTime()).slice(0, 4);
  const stats = [
    { label: t("진행 중인 캠페인", "Active campaigns", "进行中的活动"), count: data.counts.activeCampaigns, icon: <IconMegaphone />, path: "/advertiser/campaign" },
    { label: t("승인 대기 제안", "Proposals to review", "待审批方案"), count: data.counts.pendingProposals, icon: <IconCheck />, path: "/advertiser/campaign?status=approval" },
    { label: t("콘텐츠 검수 대기", "Content to review", "待审核内容"), count: data.counts.waitingContentReviews, icon: <IconInbox />, path: "/advertiser/campaign?status=content-review" },
    { label: t("완료한 캠페인", "Completed campaigns", "已完成活动"), count: data.counts.completedCampaigns, icon: <IconCheck />, path: "/advertiser/campaign" },
  ];
  return <>
    <PageHeading title={t(`${data.account.name}의 작업 공간`, `${data.account.name}'s workspace`, `${data.account.name}的工作区`)} description={t("캠페인의 다음 단계와 확인할 요청을 한곳에서 관리하세요.", "Manage your campaign's next steps and requests in one place.", "集中管理活动的下一步和待确认请求。")} action={<NewCampaignLink locale={locale} canManage={data.permissions.canManageCampaigns} />} />
    <div className={styles.launchGrid}>
      <section className={`${styles.launchCard} ${styles.managedCard}`}>
        <div className={styles.launchTop}><ContentBadge color="accent" size="small">MANAGED</ContentBadge><IconSparkle aria-hidden="true" /></div>
        <Typography as="h2" variant="title3" weight="bold">{t("브리프 하나로 시작하는\n맞춤 캠페인", "A tailored campaign,\nstarting with your brief", "一份简报，开启\n定制活动")}</Typography>
        <Typography as="p" variant="body2">{t("목표와 예산을 알려주세요. 퓨쳐스가 조건을 확인하고 제안을 준비합니다.", "Share your goals and budget. Futures reviews your needs and prepares a proposal.", "告知目标和预算，Futures 将确认需求并准备方案。")}</Typography>
        <div className={styles.launchBottom}><Typography variant="caption1">{t("접수 완료 후 48시간 내 제안", "Proposal within 48 hours of completed intake", "完整受理后48小时内提供方案")}</Typography>{data.permissions.canManageCampaigns && <Button as={Link} href={href("/advertiser/campaign/new?route=managed")} size="small" trailingContent={<IconArrowRight />}>{t("요청 시작", "Start a request", "开始请求")}</Button>}</div>
      </section>
      <section className={styles.launchCard}>
        <div className={styles.launchTop}><ContentBadge size="small">OPEN</ContentBadge><IconMegaphone aria-hidden="true" /></div>
        <Typography as="h2" variant="heading1" weight="bold">{t("모집형 캠페인", "Open campaign", "公开招募活动")}</Typography>
        <Typography as="p" variant="body2" className={styles.muted}>{t("모집 기간을 정하고 다양한 제안을 기다려보세요. 퓨쳐스가 검토한 제안을 전달합니다.", "Set a recruitment period. Futures reviews incoming submissions and shares a curated proposal.", "设定招募期限，Futures 审核报名并向您提交方案。")}</Typography>
        <div className={styles.launchBottom}><Typography variant="caption1" className={styles.muted}>{t("모집 일정에 따라 진행", "Follows your recruitment schedule", "按招募日程推进")}</Typography>{data.permissions.canManageCampaigns && <Button as={Link} href={href("/advertiser/campaign/new?route=open")} size="small" color="assistive" variant="outlined" trailingContent={<IconArrowRight />}>{t("모집 요청", "Request campaign", "发起招募")}</Button>}</div>
      </section>
    </div>
    <div className={styles.stats}>{stats.map(stat => <Link className={styles.stat} key={stat.label} href={href(stat.path)}><span className={styles.statIcon}>{stat.icon}</span><div><Typography as="span" variant="label2" className={styles.muted}>{stat.label}</Typography><Typography as="strong" variant="title2" weight="bold">{stat.count.toLocaleString(locale)}</Typography></div><IconArrowRight className={styles.statArrow} aria-hidden="true" /></Link>)}</div>
    {data.invoices.some(invoice => invoice.status === "ISSUED") && <Panel title={t("확인할 청구 내역", "Invoices to review", "待查看账单")} action={<Link className={styles.textLink} href={href("/advertiser/billing")}>{t("전체 보기", "View all", "查看全部")}<IconArrowRight /></Link>}><div className={styles.approvalList}>{data.invoices.filter(invoice => invoice.status === "ISSUED").slice(0, 3).map(invoice => <article className={styles.approvalRow} key={invoice.id}><div><StatusBadge tone="amber" size="small">{t("입금 확인 대기", "Awaiting payment confirmation", "等待收款确认")}</StatusBadge><Typography as="strong" variant="label1" weight="bold">{invoice.campaignTitle}</Typography><Typography variant="caption1" className={styles.muted}>{invoice.title}</Typography></div><Typography as="strong" variant="label1" weight="bold" className={styles.money}>{settlementMoney(invoice.amount, invoice.currency, locale)}</Typography><Button as={Link} href={href(`${campaignPath(invoice.campaignId)}?tab=settlement`)} size="small">{t("청구 확인", "View invoice", "查看账单")}</Button></article>)}</div></Panel>}
    {data.counts.waitingContentReviews > 0 && <Panel title={t("확인할 콘텐츠", "Content awaiting your review", "待审核内容")} action={<Link className={styles.textLink} href={href("/advertiser/campaign?status=content-review")}>{t("전체 보기", "View all", "查看全部")}<IconArrowRight /></Link>}><div className={styles.approvalList}>{data.campaigns.filter(campaign => campaign.productionSummary.awaitingBrand > 0 && !["COMPLETED", "CANCELED"].includes(campaign.status)).slice(0, 6).map(campaign => <article className={styles.approvalRow} key={campaign.id}><div><StatusBadge tone="amber" size="small">{t(`${campaign.productionSummary.awaitingBrand}건 검수 대기`, `${campaign.productionSummary.awaitingBrand} items to review`, `${campaign.productionSummary.awaitingBrand} 项待审核`)}</StatusBadge><Typography as="strong" variant="label1" weight="bold">{campaign.title}</Typography><Typography variant="caption1" className={styles.muted}>{t("퓨쳐스가 공유한 버전을 확인해 주세요.", "Review the version shared by Futures.", "请查看 Futures 共享的版本。")}</Typography></div><Button as={Link} href={href(`${campaignPath(campaign.id)}?tab=production`)} size="small">{t("콘텐츠 검수", "Review content", "审核内容")}</Button></article>)}</div></Panel>}
    {data.pendingProposals.length > 0 && <Panel title={t("확인할 공식 제안", "Official proposals to review", "待确认的正式方案")} action={<Link className={styles.textLink} href={href("/advertiser/campaign?status=approval")}>{t("전체 보기", "View all", "查看全部")}<IconArrowRight /></Link>}><div className={styles.approvalList}>{data.pendingProposals.slice(0, 6).map(proposal => <article className={styles.approvalRow} key={proposal.id}><div><ContentBadge color="accent" size="small">v{proposal.version} · {t(`${proposal.pendingItemCount}개 구성 확인`, `${proposal.pendingItemCount} items to review`, `${proposal.pendingItemCount} 项待确认`)}</ContentBadge><Typography as="strong" variant="label1" weight="bold">{proposal.campaignTitle}</Typography><Typography as="span" variant="caption1" className={styles.muted}>{proposal.title} · {t("유효 기한", "Valid until", "有效期至")} {dateLabel(proposal.expiresAt, locale)}</Typography></div><Typography as="strong" variant="label1" weight="bold" className={styles.money}>{proposalMoney(proposal.totalAmount, proposal.currency, locale)}</Typography><Button as={Link} href={href(`${campaignPath(proposal.campaignId)}?tab=proposal`)} size="small">{t("제안 확인", "Review proposal", "查看方案")}</Button></article>)}</div></Panel>}
    <div className={styles.homeColumns}>
      <Panel title={t("진행 중인 캠페인", "Active campaigns", "进行中的活动")} action={<Link className={styles.textLink} href={href("/advertiser/campaign")}>{t("전체 보기", "View all", "查看全部")}<IconArrowRight /></Link>}>
        {active.length ? <CampaignTable campaigns={active} locale={locale} compact /> : <EmptyState icon={<IconMegaphone />} title={t("진행 중인 캠페인이 없습니다", "No active campaigns", "暂无进行中的活动")} description={t("새 캠페인을 요청하거나 작성 중인 브리프를 이어서 완성해 주세요.", "Start a new campaign or finish an existing draft.", "发起新活动或继续完成草稿。")} action={<Button as={Link} href={href("/advertiser/campaign")} variant="outlined" color="assistive" size="small">{t("캠페인 보기", "View campaigns", "查看活动")}</Button>} />}
      </Panel>
      <Panel title={t("예정된 일정", "Upcoming dates", "即将到来的日程")}>
        {upcoming.length ? <div className={styles.schedule}>{upcoming.map(({ campaign, value, label }) => <Link key={`${campaign.id}-${label}`} href={href(campaignPath(campaign.id))} className={styles.scheduleItem}><IconCalendar /><div><Typography as="span" variant="caption1" className={styles.muted}>{label}</Typography><Typography as="strong" variant="label1" weight="bold">{campaign.title}</Typography><Typography as="time" variant="caption1">{dateLabel(value, locale)}</Typography></div></Link>)}</div> : <div className={styles.noSchedule}><IconCalendar /><Typography as="p" variant="body2" className={styles.muted}>{t("등록된 일정이 없습니다.", "No scheduled dates yet.", "暂无已登记日程。")}</Typography></div>}
        <div className={styles.support}><Typography as="strong" variant="label1" weight="bold">{t("퓨쳐스에 요청하기", "Contact Futures", "联系 Futures")}</Typography><Typography as="p" variant="caption1" className={styles.muted}>{t("일정, 제안, 결과에 관한 요청을 남겨주세요.", "Send a request about schedules, proposals, or results.", "提交日程、方案或结果相关请求。")}</Typography><Link className={styles.textLink} href={href("/advertiser/requests")}>{t(`요청함 열기${data.counts.waitingBrandRequests ? ` · 확인 필요 ${data.counts.waitingBrandRequests}건` : ""}`, `Open inbox${data.counts.waitingBrandRequests ? ` · ${data.counts.waitingBrandRequests} awaiting reply` : ""}`, `打开请求中心${data.counts.waitingBrandRequests ? ` · ${data.counts.waitingBrandRequests} 项待回复` : ""}`)}<IconArrowRight /></Link></div>
      </Panel>
    </div>
    <div className={styles.privacyNote}><IconLock /><Typography variant="caption1">{t("프리뷰에서는 익명 정보만 안내하며, 캠페인 진행에 필요한 크리에이터 정보는 공식 제안에서 공개됩니다.", "Previews remain anonymous. Relevant creator details are shared only in an official campaign proposal.", "预览仅显示匿名信息；活动所需的达人信息将在正式方案中公开。")}</Typography></div>
  </>;
}

function CampaignTable({ campaigns, locale, compact = false }: { campaigns: BrandCampaign[]; locale: Locale; compact?: boolean }) {
  const t = copyFor(locale);
  const [now] = useState(() => Date.now());
  return <div className={styles.tableWrap}><Table className={styles.table} aria-label={t("캠페인 목록", "Campaign list", "活动列表")}><TableHead><TableRow><TableHeadCell>{t("캠페인", "Campaign", "活动")}</TableHeadCell><TableHeadCell>{t("진행 상태", "Status", "状态")}</TableHeadCell>{!compact && <TableHeadCell>{t("요청 예산", "Requested budget", "预算")}</TableHeadCell>}<TableHeadCell>{t("다음 단계", "Next step", "下一步")}</TableHeadCell></TableRow></TableHead><TableBody>{campaigns.map(campaign => <TableRow key={campaign.id}><TableCell><Link href={hrefFor(`${campaignPath(campaign.id)}${campaign.status === "COMPLETED" && campaign.invoiceSummary.issued + campaign.invoiceSummary.paid > 0 ? "?tab=settlement" : campaign.reportingSummary.published > 0 && campaign.productionSummary.total === campaign.productionSummary.approved ? "?tab=performance" : campaign.productionSummary.total > 0 ? "?tab=production" : hasReviewableProposal(campaign, now) ? "?tab=proposal" : ""}`, locale)} className={styles.campaignName}><span className={styles.campaignIcon}>{campaign.gameIconUrl ? <Image src={campaign.gameIconUrl} alt={campaign.gameName ?? t("게임", "Game", "游戏")} width={40} height={40} /> : <IconMegaphone />}</span><span><Typography as="strong" variant="label1" weight="bold">{campaign.title}</Typography><Typography as="span" variant="caption1" className={styles.muted}>{campaign.type === "MANAGED" ? "Managed" : "Open"}{campaign.platforms.length ? ` · ${campaign.platforms.join(" · ")}` : ""}</Typography></span></Link></TableCell><TableCell><div className={styles.statusStack}><Status campaign={campaign} t={t} />{campaign.reportingSummary.published > 0 && campaign.productionSummary.total > campaign.productionSummary.approved && <Link href={hrefFor(`${campaignPath(campaign.id)}?tab=performance`, locale)}><StatusBadge tone="green" size="small">{t(`성과 ${campaign.reportingSummary.published}건 공개`, `${campaign.reportingSummary.published} reports published`, `${campaign.reportingSummary.published} 项成效已公开`)}</StatusBadge></Link>}</div></TableCell>{!compact && <TableCell><span className={styles.money}>{amountLabel(campaign, locale)}</span></TableCell>}<TableCell><Typography as="span" variant="caption1" className={styles.nextStep}>{nextStep(campaign, t, now)}</Typography><Typography as="span" variant="caption1" className={styles.muted}>{dateLabel(campaign.updatedAt, locale)}</Typography></TableCell></TableRow>)}</TableBody></Table></div>;
}

function nextStep(campaign: BrandCampaign, t: Copy, now: number) {
  if (campaign.status === "COMPLETED" && campaign.invoiceSummary.issued > 0) return t("청구 내역·입금 확인 대기", "View invoice and payment status", "查看账单与收款状态");
  if (campaign.status === "COMPLETED" && campaign.invoiceSummary.paid > 0) return t("입금 확인 내역 보기", "View payment confirmation", "查看收款确认记录");
  if (!["COMPLETED", "CANCELED"].includes(campaign.status)) {
    if (campaign.productionSummary.awaitingBrand > 0) return t(`공유 콘텐츠 ${campaign.productionSummary.awaitingBrand}건 검수`, `Review ${campaign.productionSummary.awaitingBrand} shared items`, `审核 ${campaign.productionSummary.awaitingBrand} 项共享内容`);
    if (campaign.productionSummary.changesRequested > 0) return t("수정본 준비 중", "Revision in preparation", "修改版本准备中");
    if (campaign.productionSummary.underReview > 0) return t("퓨쳐스 검토 후 공유 예정", "Sharing after Futures review", "Futures 审核后共享");
    if (campaign.productionSummary.awaitingSubmission > 0) return t("승인된 구성으로 제작 준비", "Preparing approved deliverables", "准备已批准内容");
    if (campaign.reportingSummary.published > 0) return t(`공개 성과 ${campaign.reportingSummary.published}건 확인`, `View ${campaign.reportingSummary.published} published reports`, `查看 ${campaign.reportingSummary.published} 项公开成效`);
    if (campaign.reportingSummary.total > 0) return t("게시 링크·지표 확인 중", "Checking publication and metrics", "发布链接与指标确认中");
    if (campaign.productionSummary.total > 0 && campaign.productionSummary.approved === campaign.productionSummary.total) return t("콘텐츠 승인 내역 확인", "View content approvals", "查看内容批准记录");
  }
  if (hasReviewableProposal(campaign, now)) return t("공식 제안 검토·승인", "Review the official proposal", "审核正式方案");
  const steps: Record<BrandCampaign["status"], string> = {
    DRAFT: t("브리프 작성 완료", "Complete your brief", "完成简报"), REVIEW: t("퓨쳐스 접수 확인", "Futures intake review", "Futures 确认受理"),
    RECRUITING: t("제안 준비 중", "Preparing a proposal", "准备方案中"), IN_PROGRESS: t("캠페인 진행 확인", "Follow campaign progress", "查看活动进度"),
    VERIFYING: t("결과 확인", "Review results", "确认结果"), SETTLING: t("정산 진행 확인", "Follow settlement", "查看结算进度"),
    COMPLETED: t("완료 내역 확인", "View completed campaign", "查看已完成活动"), CANCELED: t("취소 내역 확인", "View canceled campaign", "查看已取消活动"),
  };
  return steps[campaign.status];
}

function Campaigns({ data, locale }: { data: BrandWorkspace; locale: Locale }) {
  const t = copyFor(locale);
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("status") ?? "all";
  const [now] = useState(() => Date.now());
  const [filter, setFilter] = useState(["all", "active", "approval", "content-review", "reporting", "draft", "completed", "canceled"].includes(initialFilter) ? initialFilter : "all");
  const [search, setSearch] = useState("");
  const filters = [
    { value: "all", label: t("전체", "All", "全部") }, { value: "approval", label: t("승인 대기", "To approve", "待审批") }, { value: "active", label: t("진행 중", "Active", "进行中") },
    { value: "content-review", label: t("콘텐츠 검수", "Content review", "内容审核") },
    { value: "reporting", label: t("성과 공개", "Published reports", "公开成效") },
    { value: "draft", label: t("작성 중", "Draft", "草稿") }, { value: "completed", label: t("완료", "Completed", "已完成") }, { value: "canceled", label: t("취소", "Canceled", "已取消") },
  ];
  const campaigns = data.campaigns.filter(campaign => (filter === "all" || (filter === "reporting" ? campaign.reportingSummary.published > 0 : filter === "content-review" ? campaign.productionSummary.awaitingBrand > 0 && !["COMPLETED", "CANCELED"].includes(campaign.status) : filter === "approval" ? hasReviewableProposal(campaign, now) : filter === "active" ? !["DRAFT", "COMPLETED", "CANCELED"].includes(campaign.status) : campaign.status === { draft: "DRAFT", completed: "COMPLETED", canceled: "CANCELED" }[filter])) && `${campaign.title} ${campaign.summary}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <>
    <PageHeading title={t("캠페인", "Campaigns", "活动")} description={t("요청부터 결과 확인까지, 우리 조직의 캠페인을 관리하세요.", "Manage your organization's campaigns from brief to results.", "从需求到结果，管理本组织的活动。")} action={<NewCampaignLink locale={locale} canManage={data.permissions.canManageCampaigns} />} />
    <section className={styles.panel}><div className={styles.listSearch}><Typography variant="label1" weight="bold">{t(`전체 ${data.counts.campaigns}개 캠페인`, `${data.counts.campaigns} campaigns`, `共 ${data.counts.campaigns} 个活动`)}</Typography><SearchField aria-label={t("캠페인 검색", "Search campaigns", "搜索活动")} placeholder={t("캠페인 이름이나 브리프 검색", "Search name or brief", "搜索活动名称或简报")} value={search} onChange={event => setSearch(event.target.value)} onReset={() => setSearch("")} size="medium" width="100%" /></div>
      <Tab value={filter} onValueChange={setFilter} disableScrollMoveOnChange><TabList size="medium" horizontalPadding aria-label={t("캠페인 상태", "Campaign status", "活动状态")}>{filters.map(item => <TabListItem key={item.value} value={item.value}>{item.label}</TabListItem>)}</TabList><TabPanel value={filter} mountMode="always">{campaigns.length ? <CampaignTable campaigns={campaigns} locale={locale} /> : <EmptyState icon={<IconMegaphone />} title={search ? t("검색 결과가 없습니다", "No matching campaigns", "没有搜索结果") : t("표시할 캠페인이 없습니다", "No campaigns to show", "暂无活动")} description={search ? t("다른 검색어를 입력해 주세요.", "Try another search term.", "请尝试其他关键词。") : t("캠페인을 요청하면 접수 상태와 진행 상황을 이곳에서 확인할 수 있습니다.", "Submit a campaign to track its intake and progress here.", "提交活动后可在此查看受理状态及进度。")} action={!search && filter === "all" ? <NewCampaignLink locale={locale} canManage={data.permissions.canManageCampaigns} /> : undefined} />}</TabPanel></Tab>
      {data.hasMoreCampaigns && <Typography as="p" variant="caption1" className={styles.limitNote}>{t("최근 캠페인부터 표시하고 있습니다. 이전 캠페인은 요청함으로 문의해 주세요.", "Showing recent campaigns. Contact Futures for older campaigns.", "当前显示近期活动，如需更早的活动请联系 Futures。")}</Typography>}
    </section>
  </>;
}

function CampaignDetail({ detail, locale, canManage, onRefresh }: { detail: BrandCampaignDetail; locale: Locale; canManage: boolean; onRefresh: () => void }) {
  const t = copyFor(locale);
  const campaign = detail.campaign;
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") ?? "overview";
  const tab = ["overview", "proposal", "production", "performance", "settlement", "documents"].includes(requestedTab) ? requestedTab : "overview";
  const setTab = (value: string) => router.replace(hrefFor(`${campaignPath(campaign.id)}?tab=${value}`, locale), { scroll: false });
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cancelNeedsRequest, setCancelNeedsRequest] = useState(false);
  const href = (path: string) => hrefFor(path, locale);
  const requestHref = href(`/advertiser/requests?compose=1&campaign=${encodeURIComponent(campaign.id)}`);
  const inboxHref = href(detail.requests[0] ? `/advertiser/requests?request=${encodeURIComponent(detail.requests[0].id)}` : "/advertiser/requests");
  async function cancelCampaign() {
    setBusy(true); setError(""); setCancelNeedsRequest(false);
    try {
      const response = await fetch("/api/brand/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel", id: campaign.id, expectedUpdatedAt: campaign.updatedAt }) });
      const result = await response.json();
      if (!response.ok) {
        setCancelNeedsRequest(result.code === "CANCEL_REVIEW_REQUIRED");
        throw new Error(result.message ?? t("취소하지 못했습니다.", "Could not cancel.", "取消失败。"));
      }
      setConfirmCancel(false); onRefresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("다시 시도해 주세요.", "Please try again.", "请重试。")); }
    finally { setBusy(false); }
  }
  const tabs = [
    { value: "overview", label: t("캠페인 개요", "Overview", "活动概览") }, { value: "proposal", label: t("제안·승인", "Proposal & approval", "方案与审批") },
    { value: "production", label: t("제작·검수", "Production & review", "制作与审核") }, { value: "performance", label: t("성과", "Performance", "成效") }, { value: "settlement", label: t("청구", "Billing", "账单") }, { value: "documents", label: t("문서", "Documents", "文档") },
  ];
  return <>
    <Link href={href("/advertiser/campaign")} className={styles.back}><IconArrowLeft />{t("캠페인 목록", "All campaigns", "活动列表")}</Link>
    {campaign.coverImageUrl && <figure className={styles.gameArtwork}><Image src={campaign.coverImageUrl} alt={campaign.gameName ? `${campaign.gameName} · ${t("공식 아트워크", "official artwork", "官方美术")}` : t("캠페인 게임 아트워크", "Campaign game artwork", "活动游戏美术")} width={2048} height={946} priority /><figcaption><span>{campaign.gameName} · © Hotta Studio / Perfect World</span>{campaign.gameSourceUrl && <a href={campaign.gameSourceUrl} target="_blank" rel="noopener noreferrer">{t("공식 사이트", "Official website", "官方网站")}</a>}</figcaption></figure>}
    <PageHeading title={campaign.title} description={`${campaign.type === "MANAGED" ? "Managed" : "Open"} · ${t("최종 업데이트", "Last updated", "最后更新")} ${dateLabel(campaign.updatedAt, locale)}`} action={<div className={styles.actions}><Status campaign={campaign} t={t} />{campaign.status === "DRAFT" && canManage ? <Button as={Link} href={href(`/advertiser/campaign/new?draft=${encodeURIComponent(campaign.id)}`)}>{t("브리프 이어 쓰기", "Continue brief", "继续填写简报")}</Button> : <Button as={Link} href={requestHref} variant="outlined" color="assistive">{t("관련 요청하기", "Send a request", "提交相关请求")}</Button>}</div>} />
    {campaign.status === "DRAFT" && <SectionMessage variant="info" description={t("브리프를 완성하고 접수하면 퓨쳐스가 검토를 시작합니다.", "Complete and submit your brief for Futures to start its review.", "完成并提交简报后，Futures 将开始审核。")}>{t("아직 접수하지 않은 캠페인입니다.", "This campaign has not been submitted yet.", "此活动尚未提交。")}</SectionMessage>}
    {campaign.reviewNote && <SectionMessage variant="cautionary" description={campaign.reviewNote}>{t("퓨쳐스 검토 안내", "Futures review note", "Futures 审核说明")}</SectionMessage>}
    {tab === "overview" && Boolean(campaign.latestProposal?.pendingItemCount) && <SectionMessage variant="info" description={t("퓨쳐스가 공유한 공식 제안의 구성과 견적을 검토해 주세요.", "Review the lineup and quote in the official proposal shared by Futures.", "请审核 Futures 共享的正式方案中的组合及报价。")} trailingButton={<Button size="small" onClick={() => setTab("proposal")}>{t("제안 확인", "Review proposal", "查看方案")}</Button>}>{t("확인할 공식 제안이 있습니다", "An official proposal is ready for review", "有待确认的正式方案")}</SectionMessage>}
    <Tab value={tab} onValueChange={setTab} disableScrollMoveOnChange><TabList size="medium" aria-label={t("캠페인 상세", "Campaign detail", "活动详情")} className={styles.detailTabs}>{tabs.map(item => <TabListItem key={item.value} value={item.value}>{item.label}</TabListItem>)}</TabList><TabPanel value={tab} mountMode="always">
      {tab === "overview" ? <div className={styles.detailColumns}>
        <Panel title={t("캠페인 브리프", "Campaign brief", "活动简报")}>
          <dl className={styles.briefGrid}>
            <BriefItem label={t("목표", "Goal", "目标")} value={campaign.brief?.goal || t("별도 목표 미입력", "No separate goal entered", "尚未单独填写目标")} />
            <BriefItem label={t("요청 예산", "Requested budget", "请求预算")} value={amountLabel(campaign, locale)} />
            <BriefItem label={t("게임·장르", "Game / category", "游戏与类型")} value={campaign.brief?.genre || campaign.categories.join(", ") || "—"} />
            <BriefItem label={t("타깃 지역", "Target regions", "目标地区")} value={campaign.regions.join(", ") || "—"} />
            <BriefItem label={t("플랫폼", "Platforms", "平台")} value={campaign.platforms.join(", ") || "—"} />
            <BriefItem label={t("콘텐츠 형식", "Content format", "内容形式")} value={campaign.brief?.contentFormat || "—"} />
            <BriefItem label={t("희망 인원", "Requested creators", "期望人数")} value={campaign.brief?.creatorCount ? t(`${campaign.brief.creatorCount}명`, `${campaign.brief.creatorCount} creators`, `${campaign.brief.creatorCount} 人`) : t("미입력", "Not entered", "未填写")} />
            <BriefItem label={t("희망 일정", "Preferred date", "期望日期")} value={dateLabel(campaign.brief?.desiredDate ?? campaign.contentDeadline, locale)} />
          </dl>
          <div className={styles.notes}><Typography as="h3" variant="label1" weight="bold">{t("상세 요청", "Brief details", "详细需求")}</Typography><Typography as="p" variant="body2">{campaign.brief?.note || campaign.summary || "—"}</Typography></div>
          {campaign.brief?.compositionPreference && <div className={styles.preference}><Typography variant="caption1" className={styles.muted}>{t("구성 선호", "Composition preference", "组合偏好")} · {({ balanced: t("균형 중심", "Balanced", "均衡"), reach: t("도달 중심", "Reach", "触达"), efficient: t("효율 중심", "Efficiency", "效率") })[campaign.brief.compositionPreference]}</Typography></div>}
        </Panel>
        <div className={styles.sideStack}><Panel title={t("진행 정보", "Progress", "进度信息")}><dl className={styles.facts}><BriefItem label={t("진행 상태", "Status", "状态")} value={statusLabel(campaign.status, t)} /><BriefItem label={t("접수일", "Submitted", "提交日期")} value={dateLabel(campaign.submittedAt, locale, true)} /><BriefItem label={t("제안 예정", "Proposal due", "预计方案日期")} value={dateLabel(campaign.proposalDueAt, locale, true)} />{campaign.type === "OPEN_BIDDING" && <BriefItem label={t("모집 마감", "Recruitment closes", "招募截止")} value={dateLabel(campaign.applicationDeadline, locale, true)} />}</dl>{campaign.type === "OPEN_BIDDING" && <Typography as="p" variant="caption1" className={styles.limitNote}>{t("모집형 캠페인은 모집 일정에 따라 제안이 준비됩니다.", "Open campaign proposals follow the recruitment schedule.", "公开招募活动方案按招募日程准备。")}</Typography>}</Panel>
          <Panel title={t("연결된 요청", "Related requests", "相关请求")} action={<Link className={styles.textLink} href={requestHref}>{t("요청함", "Inbox", "请求中心")}<IconArrowRight /></Link>}><div className={styles.relatedRequests}>{detail.requests.length ? detail.requests.map(request => <Link key={request.id} href={href(`/advertiser/requests?request=${encodeURIComponent(request.id)}`)}><Typography as="strong" variant="label1" weight="medium">{request.title}</Typography><Typography as="span" variant="caption1" className={styles.muted}>{dateLabel(request.updatedAt, locale)}</Typography></Link>) : <Typography as="p" variant="body2" className={styles.muted}>{t("연결된 요청이 없습니다.", "No related requests yet.", "暂无相关请求。")}</Typography>}</div></Panel>
        </div>
      </div> : tab === "proposal" ? <OfficialProposalPanel proposals={detail.proposals} locale={locale} canManage={canManage} requestHref={requestHref} onRefresh={onRefresh} /> : tab === "production" ? <BrandProductionPanel items={detail.deliverables} locale={locale} canManage={canManage} requestHref={requestHref} artwork={campaign} onRefresh={onRefresh} /> : tab === "performance" ? <BrandReportingPanel items={detail.performance.items} locale={locale} artwork={campaign} requestHref={requestHref} /> : tab === "settlement" ? <BrandBillingPanel invoices={detail.invoices} locale={locale} /> : <section className={styles.panel}><PendingCampaignSection tab={tab} locale={locale} requestHref={requestHref} inboxHref={inboxHref} /></section>}
    </TabPanel></Tab>
    {canManage && ["DRAFT", "REVIEW"].includes(campaign.status) && <div className={styles.cancelArea}>{confirmCancel ? <SectionMessage variant="cautionary" description={t("취소하면 이 캠페인의 접수와 진행이 종료됩니다. 계속 진행하려면 취소하지 마세요.", "Canceling ends this campaign's intake. Keep it if you intend to continue.", "取消后此活动的受理将结束；如需继续，请保留活动。")}>{t("이 캠페인을 취소할까요?", "Cancel this campaign?", "取消此活动？")}<div className={styles.confirmActions}><Button variant="outlined" color="assistive" size="small" disabled={busy} onClick={() => setConfirmCancel(false)}>{t("유지하기", "Keep campaign", "保留活动")}</Button><Button color="negative" size="small" loading={busy} onClick={() => void cancelCampaign()}>{t("캠페인 취소", "Cancel campaign", "取消活动")}</Button></div></SectionMessage> : <Button variant="outlined" color="assistive" size="small" onClick={() => setConfirmCancel(true)}>{t("캠페인 취소", "Cancel campaign", "取消活动")}</Button>}{error && <SectionMessage variant="negative" role="alert" bottomButton={cancelNeedsRequest ? <Button as={Link} href={requestHref} size="small" variant="outlined" color="assistive">{t("취소 요청 남기기", "Request cancellation", "请求取消")}</Button> : <Button onClick={onRefresh} size="small" variant="outlined" color="assistive">{t("최신 상태 확인", "Refresh status", "刷新状态")}</Button>}>{error}</SectionMessage>}</div>}
  </>;
}

function BriefItem({ label, value }: { label: string; value: string }) {
  return <div><dt><Typography variant="caption1" className={styles.muted}>{label}</Typography></dt><dd><Typography variant="body2" weight="medium">{value}</Typography></dd></div>;
}

function PendingCampaignSection({ tab, locale, requestHref, inboxHref }: { tab: string; locale: Locale; requestHref: string; inboxHref: string }) {
  const t = copyFor(locale);
  const content = {
    proposal: { icon: <IconLock />, title: t("공식 제안은 요청함에서 확인해 주세요", "Find official proposals in your inbox", "请在请求中心查看正式方案"), description: t("퓨쳐스가 전달한 공식 제안과 첨부 자료를 요청함에서 확인할 수 있습니다. 크리에이터 정보는 해당 캠페인의 공식 제안 범위에서만 공개됩니다.", "Review official proposals and attachments shared by Futures in your inbox. Creator information is limited to this campaign’s official proposal.", "可在请求中心查看 Futures 共享的正式方案及附件。达人信息仅在本活动的正式方案范围内公开。") },
    production: { icon: <IconClock />, title: t("검수 자료와 수정 요청을 확인하세요", "Review materials and revision requests", "查看审核资料和修改请求"), description: t("공유된 콘텐츠는 요청함의 답변과 첨부 자료에서 확인해 주세요. 수정 의견도 캠페인에 연결된 요청으로 퓨쳐스에 전달할 수 있습니다.", "Find shared content in inbox replies and attachments. Send revision feedback to Futures as a request linked to this campaign.", "请在请求中心的回复及附件中查看共享内容，也可通过关联此活动的请求向 Futures 提交修改意见。") },
    performance: { icon: <IconMegaphone />, title: t("성과 보고서는 요청함에서 확인하세요", "Find performance reports in your inbox", "请在请求中心查看成效报告"), description: t("퓨쳐스가 공유한 보고서와 측정 자료를 요청함에서 확인해 주세요. 필요한 성과 지표가 있다면 이 캠페인에 연결해 요청할 수 있습니다.", "Review reports and measurement materials shared by Futures in your inbox. Request any additional metrics for this campaign.", "请在请求中心查看 Futures 共享的报告和测量资料，如需其他指标可提交关联此活动的请求。") },
    documents: { icon: <IconFolder />, title: t("공유 문서는 요청함에서 확인하세요", "Find shared documents in your inbox", "请在请求中心查看共享文档"), description: t("캠페인에 연결된 요청의 답변과 첨부 자료에서 제안서, 진행 자료, 결과 보고서를 확인할 수 있습니다. 필요한 문서는 퓨쳐스에 요청해 주세요.", "Find proposals, campaign materials, and reports in replies and attachments linked to this campaign. Request any needed documents from Futures.", "可在关联此活动的请求回复及附件中查看方案、执行资料和报告。如需其他文档，请向 Futures 提交请求。") },
  }[tab];
  if (!content) return null;
  return <EmptyState {...content} action={<div className={styles.confirmActions}><Button as={Link} href={inboxHref} size="small">{t("요청함에서 확인", "View inbox", "查看请求中心")}</Button><Button as={Link} href={requestHref} variant="outlined" color="assistive" size="small">{t("퓨쳐스에 요청하기", "Send a request", "向 Futures 提交请求")}</Button></div>} />;
}

function Library({ data, locale }: { data: BrandWorkspace; locale: Locale }) {
  const t = copyFor(locale);
  return <>
    <PageHeading title={t("자료실", "Library", "资料库")} description={t("캠페인별로 공유된 제안서와 진행 자료, 결과 보고서를 확인하세요.", "Find shared proposals, campaign materials, and reports.", "查看活动共享的方案、执行资料和结果报告。")} />
    <section className={styles.panel}><EmptyState icon={<IconFolder />} title={t("요청함에서 공유 자료를 확인하세요", "Find shared materials in your inbox", "请在请求中心查看共享资料")} description={t("필요한 자료는 캠페인과 함께 퓨쳐스에 요청해 주세요. 요청함에 전달된 답변과 첨부 자료도 확인할 수 있습니다.", "Request documents from Futures with the relevant campaign. Replies and attachments are also available in your inbox.", "请向 Futures 说明相关活动并请求资料，也可在请求中心查看回复及附件。")} action={<Button as={Link} href={hrefFor("/advertiser/requests", locale)} variant="outlined" color="assistive">{t("요청함에서 자료 확인", "Check inbox materials", "在请求中心查看资料")}</Button>} /></section>
    {data.campaigns.length > 0 && <Panel title={t("캠페인별로 확인", "Browse by campaign", "按活动查看")}><div className={styles.libraryCampaigns}>{data.campaigns.slice(0, 12).map(campaign => <Link key={campaign.id} href={hrefFor(campaignPath(campaign.id), locale)}><span className={styles.campaignIcon}><IconFolder /></span><Typography variant="label1" weight="medium">{campaign.title}</Typography><Status campaign={campaign} t={t} /><IconArrowRight /></Link>)}</div></Panel>}
  </>;
}
