"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActionArea,
  ActionAreaButton,
  Button,
  ContentBadge,
  Modal,
  ModalContainer,
  ModalContent,
  ModalNavigation,
  ModalNavigationButton,
  SearchField,
  SectionMessage,
  Skeleton,
  Tab,
  TabList,
  TabListItem,
  TabPanel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Typography,
} from "@montage-ui/core";
import {
  IconArrowLeft,
  IconArrowRight,
  IconLock,
  IconMegaphone,
  IconMegaphoneFill,
  IconPlus,
} from "@montage-ui/icon";
import { BrandSymbol } from "@futures-medialab/ui/brand-symbol";
import type { Locale } from "../../_components/landing-copy";
import { WorkspaceProvider } from "../../_components/workspace/workspace-provider";
import { WorkspaceShell } from "../../_components/workspace/workspace-shell";
import {
  StatusBadge,
  type StatusTone,
} from "../../_components/workspace/status-badge";
import shellStyles from "../../_components/workspace/workspace-shell.module.css";
import { authClient } from "../../../lib/auth-client";
import type {
  BrandCampaign,
  BrandCampaignDetail,
  BrandCampaignRoute,
  BrandWorkspace,
} from "../../../lib/brand-workspace-types";
import { requestDraftPath } from "../../../lib/brand-request-draft";
import { BrandRequestEntry } from "./brand-request-entry";
import { OfficialProposalPanel } from "./official-proposal-panel";
import { BrandProductionPanel } from "./brand-production-panel";
import { BrandReportingPanel } from "./brand-reporting-panel";
import { BrandBillingPanel } from "./brand-billing-panel";
import { BrandActionCenter } from "./brand-action-center";
import { BrandCampaignOverview } from "./brand-campaign-overview";
import { BrandCampaignLink } from "./brand-campaign-link";
import { BrandCampaignProgress } from "./brand-campaign-progress";
import { BrandDocumentsPanel } from "./brand-documents-panel";
import styles from "./live-brand-workspace.module.css";

export type LiveBrandWorkspaceMode =
  "home" | "campaigns" | "detail" | "library" | "billing" | "new";
type Account = {
  draftScope: string;
  organizationName: string;
  userName: string;
  status: "PENDING" | "ACTIVE";
};
type Copy = (ko: string, en: string, zh: string) => string;
const copyFor =
  (locale: Locale): Copy =>
  (ko, en, zh) =>
    ({ ko, en, zh })[locale];
const hrefFor = (path: string, locale: Locale) =>
  `${path}${path.includes("?") ? "&" : "?"}lang=${locale}`;
const campaignPath = (id: string) =>
  `/advertiser/campaign/${encodeURIComponent(id)}`;

function dateLabel(value: string | null, locale: Locale, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(includeTime ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
  }).format(date);
}

function amountLabel(campaign: BrandCampaign, locale: Locale) {
  if (campaign.budgetAmount === null)
    return copyFor(locale)("미입력", "Not entered", "未填写");
  const amount = Number(campaign.budgetAmount);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: campaign.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusLabel(status: BrandCampaign["status"], t: Copy) {
  const labels: Record<BrandCampaign["status"], string> = {
    DRAFT: t("작성 중", "Draft", "草稿"),
    REVIEW: t("접수 검토 중", "Intake review", "受理审核中"),
    RECRUITING: t("섭외 중", "Sourcing", "招募中"),
    IN_PROGRESS: t("진행 중", "In progress", "进行中"),
    VERIFYING: t("결과 확인 중", "Verification", "结果确认中"),
    SETTLING: t("정산 중", "Settlement", "结算中"),
    COMPLETED: t("완료", "Completed", "已完成"),
    CANCELED: t("취소", "Canceled", "已取消"),
  };
  return labels[status];
}

function hasReviewableProposal(campaign: BrandCampaign, now: number) {
  const proposal = campaign.latestProposal;
  return Boolean(
    proposal?.pendingItemCount &&
    proposal.expiresAt &&
    Date.parse(proposal.expiresAt) > now &&
    ["REVIEW", "RECRUITING", "IN_PROGRESS"].includes(campaign.status),
  );
}

function Status({ campaign, t }: { campaign: BrandCampaign; t: Copy }) {
  const [now] = useState(() => Date.now());
  if (campaign.status === "CANCELED")
    return (
      <StatusBadge tone="red">{statusLabel(campaign.status, t)}</StatusBadge>
    );
  if (campaign.status === "COMPLETED")
    return (
      <StatusBadge
        tone={campaign.invoiceSummary.issued > 0 ? "amber" : "green"}
      >
        {campaign.invoiceSummary.issued > 0
          ? t(
              "캠페인 완료 · 입금 확인 대기",
              "Completed · payment confirmation pending",
              "活动完成 · 等待收款确认",
            )
          : campaign.invoiceSummary.paid > 0
            ? t(
                "캠페인 완료 · 입금 확인",
                "Completed · payment confirmed",
                "活动完成 · 收款已确认",
              )
            : statusLabel(campaign.status, t)}
      </StatusBadge>
    );
  if (campaign.productionSummary.awaitingBrand > 0)
    return (
      <StatusBadge tone="amber">
        {t("콘텐츠 검수 대기", "Content to review", "待审核内容")}
      </StatusBadge>
    );
  if (campaign.productionSummary.changesRequested > 0)
    return (
      <StatusBadge tone="amber">
        {t("콘텐츠 수정 중", "Content revision", "内容修改中")}
      </StatusBadge>
    );
  if (campaign.productionSummary.underReview > 0)
    return (
      <StatusBadge tone="blue">
        {t("퓨쳐스 검토 중", "Futures review", "Futures 审核中")}
      </StatusBadge>
    );
  if (campaign.productionSummary.awaitingSubmission > 0)
    return (
      <StatusBadge tone="neutral">
        {t("콘텐츠 제작 대기", "Awaiting production", "等待制作")}
      </StatusBadge>
    );
  if (campaign.reportingSummary.published > 0)
    return (
      <StatusBadge tone="green">
        {campaign.reportingSummary.pending > 0
          ? t(
              "성과 공개 · 업데이트 중",
              "Published · updating",
              "成效已公开 · 更新中",
            )
          : campaign.reportingSummary.allMetricsPending ===
              campaign.reportingSummary.published
            ? t(
                "게시 확인 · 지표 집계 중",
                "Published · metrics pending",
                "发布已确认 · 指标统计中",
              )
            : t("성과 공개 완료", "Performance published", "成效已公开")}
      </StatusBadge>
    );
  if (campaign.reportingSummary.total > 0)
    return (
      <StatusBadge tone="blue">
        {t(
          "게시·성과 준비 중",
          "Preparing performance report",
          "发布与成效准备中",
        )}
      </StatusBadge>
    );
  if (
    campaign.productionSummary.total > 0 &&
    campaign.productionSummary.approved === campaign.productionSummary.total
  )
    return (
      <StatusBadge tone="green">
        {t("콘텐츠 승인 완료", "Content approved", "内容已批准")}
      </StatusBadge>
    );
  if (campaign.latestProposal?.status === "CHANGES_REQUESTED")
    return (
      <StatusBadge tone="amber">
        {t("제안 수정 중", "Proposal revision", "方案修改中")}
      </StatusBadge>
    );
  if (campaign.latestProposal?.status === "REJECTED")
    return (
      <StatusBadge tone="red">
        {t("재제안 요청", "Replacement requested", "已请求重新提案")}
      </StatusBadge>
    );
  if (hasReviewableProposal(campaign, now))
    return (
      <StatusBadge tone="amber">
        {t("제안 승인 대기", "Proposal to approve", "待审批方案")}
      </StatusBadge>
    );
  const tones: Record<BrandCampaign["status"], StatusTone> = {
    DRAFT: "neutral",
    REVIEW: "blue",
    RECRUITING: "blue",
    IN_PROGRESS: "blue",
    VERIFYING: "amber",
    SETTLING: "amber",
    COMPLETED: "green",
    CANCELED: "red",
  };
  return (
    <StatusBadge tone={tones[campaign.status]}>
      {statusLabel(campaign.status, t)}
    </StatusBadge>
  );
}

export function BrandWorkspaceFrame({
  locale,
  account,
  children,
}: {
  locale: Locale;
  account: Account;
  children: ReactNode;
}) {
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
      setError(
        t(
          "로그아웃하지 못했습니다. 다시 시도해 주세요.",
          "Could not sign out. Please try again.",
          "退出失败，请重试。",
        ),
      );
      setBusy(false);
    }
  }
  return (
    <WorkspaceProvider>
      <div
        className={`${shellStyles.workspace} ${styles.workspace}`}
        lang={locale === "zh" ? "zh-CN" : locale}
      >
        <WorkspaceShell
          locale={locale}
          organizationName={account.organizationName}
          userName={account.userName}
          isGuest={false}
          busy={busy}
          onSignOut={() => void signOut()}
        />
        <main id="workspace-main" className={shellStyles.main}>
          <div className={`${shellStyles.content} ${styles.content}`}>
            {error && (
              <SectionMessage variant="negative" role="alert">
                {error}
              </SectionMessage>
            )}
            {children}
          </div>
        </main>
      </div>
    </WorkspaceProvider>
  );
}

async function readData<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      typeof body.message === "string" ? body.message : "LOAD_FAILED",
    );
  return body as T;
}

export function LiveBrandWorkspace({
  mode,
  locale,
  account,
  campaignId,
  initialRoute,
}: {
  mode: LiveBrandWorkspaceMode;
  locale: Locale;
  account: Account;
  campaignId?: string;
  initialRoute?: BrandCampaignRoute;
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
      campaignId
        ? readData<BrandCampaignDetail>(
            `/api/brand/campaigns/${encodeURIComponent(campaignId)}`,
            controller.signal,
          )
        : Promise.resolve(null),
    ])
      .then(([workspace, campaign]) => {
        if (controller.signal.aborted) return;
        setData(workspace);
        setDetail(campaign);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "LOAD_FAILED");
        setLoading(false);
      });
    return () => controller.abort();
  }, [campaignId, revision, mode, account.draftScope, initialRoute]);

  return (
    <BrandWorkspaceFrame locale={locale} account={account}>
      {loading ? (
        <LoadingState t={t} />
      ) : error ? (
        <div className={styles.loadError}>
          <SectionMessage
            variant="negative"
            role="alert"
            description={
              error === "LOAD_FAILED"
                ? t(
                    "잠시 후 다시 시도해 주세요.",
                    "Please try again shortly.",
                    "请稍后重试。",
                  )
                : error
            }
          >
            {t(
              "작업 공간을 불러오지 못했습니다.",
              "Could not load your workspace.",
              "无法加载工作区。",
            )}
          </SectionMessage>
          <Button
            variant="outlined"
            color="assistive"
            onClick={() => setRevision((value) => value + 1)}
          >
            {t("다시 불러오기", "Try again", "重试")}
          </Button>
        </div>
      ) : data ? (
        <>
          {mode === "home" && <Home data={data} locale={locale} />}
          {mode === "campaigns" && <Campaigns data={data} locale={locale} />}
          {mode === "detail" && detail && (
            <CampaignDetail
              detail={detail}
              canManage={data.permissions.canManageCampaigns}
              locale={locale}
              onRefresh={() => setRevision((value) => value + 1)}
            />
          )}
          {mode === "library" && <Library locale={locale} />}
          {mode === "billing" && (
            <>
              <PageHeading
                title={t("청구 내역", "Billing", "账单")}
                description={t(
                  "캠페인 완료 후 발행된 청구와 입금 확인 상태를 확인하세요.",
                  "Review invoices issued after campaign completion and payment confirmation status.",
                  "查看活动完成后出具的账单及收款确认状态。",
                )}
              />
              <BrandBillingPanel
                invoices={data.invoices}
                locale={locale}
                showHeading={false}
              />
            </>
          )}
          {mode === "new" &&
            (data.permissions.canManageCampaigns ? (
              <BrandRequestEntry
                key={`${account.draftScope}:${campaignId ?? "new"}:${initialRoute ?? "managed"}:${locale}`}
                campaigns={data.campaigns}
                locale={locale}
                draftScope={account.draftScope}
                initialCampaign={detail?.campaign}
                initialRoute={initialRoute}
                onClose={() =>
                  router.push(
                    href(
                      campaignId
                        ? campaignPath(campaignId)
                        : "/advertiser/campaign",
                    ),
                  )
                }
                onSaved={(result) => router.push(href(campaignPath(result.id)))}
              />
            ) : (
              <EmptyState
                icon={<IconLock />}
                title={t(
                  "캠페인 요청 권한이 필요합니다",
                  "Campaign management permission required",
                  "需要活动管理权限",
                )}
                description={t(
                  "조직 소유자 또는 관리자에게 캠페인 요청을 부탁해 주세요.",
                  "Ask an organization owner or admin to submit a campaign.",
                  "请联系组织所有者或管理员提交活动。",
                )}
              />
            ))}
        </>
      ) : null}
    </BrandWorkspaceFrame>
  );
}

function LoadingState({ t }: { t: Copy }) {
  return (
    <div
      className={styles.loading}
      role="status"
      aria-label={t(
        "캠페인을 불러오는 중",
        "Loading campaigns",
        "正在加载活动",
      )}
    >
      <Skeleton width="45%" height="36px" />
      <Skeleton width="65%" height="20px" />
      <div className={styles.stats}>
        {[1, 2, 3, 4].map((value) => (
          <Skeleton key={value} height="104px" />
        ))}
      </div>
      <Skeleton width="100%" height="280px" />
    </div>
  );
}

function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className={styles.heading}>
      <div>
        <Typography as="h1" variant="title2" weight="bold">
          {title}
        </Typography>
        <Typography as="p" variant="body2" className={styles.muted}>
          {description}
        </Typography>
      </div>
      {action}
    </header>
  );
}

function NewCampaignLink({
  locale,
  canManage,
}: {
  locale: Locale;
  canManage: boolean;
}) {
  if (!canManage) return null;
  return (
    <Button
      as={Link}
      href={hrefFor("/advertiser/campaign/new", locale)}
      leadingContent={<IconPlus />}
      size="medium"
    >
      {copyFor(locale)("새 캠페인 요청", "New campaign", "新建活动")}
    </Button>
  );
}

function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.panel} ${className}`}>
      <div className={styles.panelHeading}>
        <Typography as="h2" variant="heading2" weight="bold">
          {title}
        </Typography>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        {icon}
      </span>
      <Typography as="h3" variant="heading2" weight="bold">
        {title}
      </Typography>
      <Typography as="p" variant="body2" className={styles.muted}>
        {description}
      </Typography>
      {action}
    </div>
  );
}

function Home({ data, locale }: { data: BrandWorkspace; locale: Locale }) {
  const t = copyFor(locale);
  const href = (path: string) => hrefFor(path, locale);
  const active = data.campaigns
    .filter(
      (campaign) =>
        !["DRAFT", "COMPLETED", "CANCELED"].includes(campaign.status),
    )
    .slice(0, 5);
  return (
    <div className={styles.home}>
      <section
        className={styles.requestSection}
        aria-labelledby="brand-new-request-title"
      >
        <div className={styles.newRequestHeading}>
          <Typography
            as="h1"
            variant="heading1"
            weight="bold"
            id="brand-new-request-title"
          >
            {t("새 캠페인 의뢰", "Start a new campaign", "发起新活动")}
          </Typography>
        </div>
        <div className={styles.launchGrid}>
          <section className={`${styles.launchCard} ${styles.managedCard}`}>
            <div className={styles.launchTop}>
              <ContentBadge color="accent" size="small">
                MANAGED
              </ContentBadge>
              <BrandSymbol />
            </div>
            <Typography as="h2" variant="title3" weight="bold">
              {t(
                "브리프 하나로 시작하는\n맞춤 캠페인",
                "A tailored campaign,\nstarting with your brief",
                "一份简报，开启\n定制活动",
              )}
            </Typography>
            <Typography as="p" variant="body2">
              {t(
                "목표와 예산을 알려주세요. 퓨쳐스가 조건을 확인하고 제안을 준비합니다.",
                "Share your goals and budget. Futures reviews your needs and prepares a proposal.",
                "告知目标和预算，Futures 将确认需求并准备方案。",
              )}
            </Typography>
            <div className={styles.launchBottom}>
              <Typography variant="caption1">
                {t(
                  "접수 완료 후 48시간 내 제안",
                  "Proposal within 48 hours of completed intake",
                  "完整受理后48小时内提供方案",
                )}
              </Typography>
              {data.permissions.canManageCampaigns && (
                <Button
                  as={Link}
                  href={href("/advertiser/campaign/new?route=managed")}
                  size="small"
                  trailingContent={<IconArrowRight />}
                >
                  {t("요청 시작", "Start a request", "开始请求")}
                </Button>
              )}
            </div>
          </section>
          <section className={styles.launchCard}>
            <div className={styles.launchTop}>
              <ContentBadge size="small">OPEN</ContentBadge>
              <IconMegaphoneFill aria-hidden="true" />
            </div>
            <Typography as="h2" variant="heading1" weight="bold">
              {t("모집형 캠페인", "Open campaign", "公开招募活动")}
            </Typography>
            <Typography as="p" variant="body2" className={styles.muted}>
              {t(
                "모집 기간을 정하고 다양한 제안을 기다려보세요. 퓨쳐스가 검토한 제안을 전달합니다.",
                "Set a recruitment period. Futures reviews incoming submissions and shares a curated proposal.",
                "设定招募期限，Futures 审核报名并向您提交方案。",
              )}
            </Typography>
            <div className={styles.launchBottom}>
              <Typography variant="caption1" className={styles.muted}>
                {t(
                  "모집 일정에 따라 진행",
                  "Follows your recruitment schedule",
                  "按招募日程推进",
                )}
              </Typography>
              {data.permissions.canManageCampaigns && (
                <Button
                  as={Link}
                  href={href("/advertiser/campaign/new?route=open")}
                  size="small"
                  color="assistive"
                  variant="outlined"
                  trailingContent={<IconArrowRight />}
                >
                  {t("모집 요청", "Request campaign", "发起招募")}
                </Button>
              )}
            </div>
          </section>
        </div>
      </section>
      <BrandActionCenter data={data} locale={locale} />
      <BrandCampaignOverview
        campaigns={data.campaigns}
        locale={locale}
        hasMoreCampaigns={data.hasMoreCampaigns}
      >
        {active.length ? (
          <CampaignTable campaigns={active} locale={locale} compact />
        ) : (
          <EmptyState
            icon={<IconMegaphone />}
            title={t(
              "진행 중인 캠페인이 없습니다",
              "No active campaigns",
              "暂无进行中的活动",
            )}
            description={t(
              "캠페인을 요청하면 이곳에서 진행 상황을 확인할 수 있습니다.",
              "Submit a campaign to track its progress here.",
              "提交活动后可在此查看进度。",
            )}
          />
        )}
      </BrandCampaignOverview>
    </div>
  );
}

function CampaignTable({
  campaigns,
  locale,
  compact = false,
}: {
  campaigns: BrandCampaign[];
  locale: Locale;
  compact?: boolean;
}) {
  const t = copyFor(locale);
  const [now] = useState(() => Date.now());
  return (
    <div className={styles.tableWrap}>
      <Table className={styles.table}>
        <caption className={styles.srOnly}>
          {t("캠페인 목록", "Campaign list", "活动列表")}
        </caption>
        <TableHead>
          <TableRow>
            <TableHeadCell>{t("캠페인", "Campaign", "活动")}</TableHeadCell>
            <TableHeadCell>{t("진행 상태", "Status", "状态")}</TableHeadCell>
            {!compact && (
              <TableHeadCell>
                {t("요청 예산", "Requested budget", "预算")}
              </TableHeadCell>
            )}
            <TableHeadCell>
              {t("다음 단계", "Next step", "下一步")}
            </TableHeadCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow key={campaign.id}>
              <TableCell>
                <BrandCampaignLink
                  campaign={campaign}
                  locale={locale}
                  href={hrefFor(
                    campaign.status === "DRAFT" ? requestDraftPath(campaign) : `${campaignPath(campaign.id)}${campaign.status === "COMPLETED" && campaign.invoiceSummary.issued + campaign.invoiceSummary.paid > 0 ? "?tab=settlement" : campaign.reportingSummary.published > 0 && campaign.productionSummary.total === campaign.productionSummary.approved ? "?tab=performance" : campaign.productionSummary.total > 0 ? "?tab=production" : hasReviewableProposal(campaign, now) ? "?tab=proposal" : ""}`,
                    locale,
                  )}
                />
              </TableCell>
              <TableCell>
                <div className={styles.statusStack}>
                  {campaign.status === "DRAFT" ? (
                    <Link href={hrefFor(requestDraftPath(campaign), locale)}>
                      <Status campaign={campaign} t={t} />
                    </Link>
                  ) : <Status campaign={campaign} t={t} />}
                  {campaign.reportingSummary.published > 0 &&
                    campaign.productionSummary.total >
                      campaign.productionSummary.approved && (
                      <Link
                        href={hrefFor(
                          `${campaignPath(campaign.id)}?tab=performance`,
                          locale,
                        )}
                      >
                        <StatusBadge tone="green" size="small">
                          {t(
                            `성과 ${campaign.reportingSummary.published}건 공개`,
                            `${campaign.reportingSummary.published} reports published`,
                            `${campaign.reportingSummary.published} 项成效已公开`,
                          )}
                        </StatusBadge>
                      </Link>
                    )}
                </div>
              </TableCell>
              {!compact && (
                <TableCell>
                  <span className={styles.money}>
                    {amountLabel(campaign, locale)}
                  </span>
                </TableCell>
              )}
              <TableCell>
                <Typography
                  as="span"
                  variant="caption1"
                  className={styles.nextStep}
                >
                  {nextStep(campaign, t, now)}
                </Typography>
                <Typography
                  as="span"
                  variant="caption1"
                  className={styles.muted}
                >
                  {dateLabel(campaign.updatedAt, locale)}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function nextStep(campaign: BrandCampaign, t: Copy, now: number) {
  if (campaign.status === "COMPLETED" && campaign.invoiceSummary.issued > 0)
    return t(
      "청구 내역·입금 확인 대기",
      "View invoice and payment status",
      "查看账单与收款状态",
    );
  if (campaign.status === "COMPLETED" && campaign.invoiceSummary.paid > 0)
    return t(
      "입금 확인 내역 보기",
      "View payment confirmation",
      "查看收款确认记录",
    );
  if (!["COMPLETED", "CANCELED"].includes(campaign.status)) {
    if (campaign.productionSummary.awaitingBrand > 0)
      return t(
        `공유 콘텐츠 ${campaign.productionSummary.awaitingBrand}건 검수`,
        `Review ${campaign.productionSummary.awaitingBrand} shared items`,
        `审核 ${campaign.productionSummary.awaitingBrand} 项共享内容`,
      );
    if (campaign.productionSummary.changesRequested > 0)
      return t("수정본 준비 중", "Revision in preparation", "修改版本准备中");
    if (campaign.productionSummary.underReview > 0)
      return t(
        "퓨쳐스 검토 후 공유 예정",
        "Sharing after Futures review",
        "Futures 审核后共享",
      );
    if (campaign.productionSummary.awaitingSubmission > 0)
      return t(
        "승인된 구성으로 제작 준비",
        "Preparing approved deliverables",
        "准备已批准内容",
      );
    if (campaign.reportingSummary.published > 0)
      return t(
        `공개 성과 ${campaign.reportingSummary.published}건 확인`,
        `View ${campaign.reportingSummary.published} published reports`,
        `查看 ${campaign.reportingSummary.published} 项公开成效`,
      );
    if (campaign.reportingSummary.total > 0)
      return t(
        "게시 링크·지표 확인 중",
        "Checking publication and metrics",
        "发布链接与指标确认中",
      );
    if (
      campaign.productionSummary.total > 0 &&
      campaign.productionSummary.approved === campaign.productionSummary.total
    )
      return t(
        "콘텐츠 승인 내역 확인",
        "View content approvals",
        "查看内容批准记录",
      );
  }
  if (hasReviewableProposal(campaign, now))
    return t(
      "공식 제안 검토·승인",
      "Review the official proposal",
      "审核正式方案",
    );
  const steps: Record<BrandCampaign["status"], string> = {
    DRAFT: t("브리프 작성 완료", "Complete your brief", "完成简报"),
    REVIEW: t("퓨쳐스 접수 확인", "Futures intake review", "Futures 确认受理"),
    RECRUITING: t("제안 준비 중", "Preparing a proposal", "准备方案中"),
    IN_PROGRESS: t(
      "캠페인 진행 확인",
      "Follow campaign progress",
      "查看活动进度",
    ),
    VERIFYING: t("결과 확인", "Review results", "确认结果"),
    SETTLING: t("정산 진행 확인", "Follow settlement", "查看结算进度"),
    COMPLETED: t("완료 내역 확인", "View completed campaign", "查看已完成活动"),
    CANCELED: t("취소 내역 확인", "View canceled campaign", "查看已取消活动"),
  };
  return steps[campaign.status];
}

function Campaigns({ data, locale }: { data: BrandWorkspace; locale: Locale }) {
  const t = copyFor(locale);
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("status") ?? "all";
  const [now] = useState(() => Date.now());
  const [filter, setFilter] = useState(
    [
      "all",
      "active",
      "approval",
      "content-review",
      "reporting",
      "draft",
      "completed",
      "canceled",
    ].includes(initialFilter)
      ? initialFilter
      : "all",
  );
  const [search, setSearch] = useState("");
  const filters = [
    { value: "all", label: t("전체", "All", "全部") },
    { value: "approval", label: t("승인 대기", "To approve", "待审批") },
    { value: "active", label: t("진행 중", "Active", "进行中") },
    {
      value: "content-review",
      label: t("콘텐츠 검수", "Content review", "内容审核"),
    },
    {
      value: "reporting",
      label: t("성과 공개", "Published reports", "公开成效"),
    },
    { value: "draft", label: t("작성 중", "Draft", "草稿") },
    { value: "completed", label: t("완료", "Completed", "已完成") },
    { value: "canceled", label: t("취소", "Canceled", "已取消") },
  ];
  const campaigns = data.campaigns.filter(
    (campaign) =>
      (filter === "all" ||
        (filter === "reporting"
          ? campaign.reportingSummary.published > 0
          : filter === "content-review"
            ? campaign.productionSummary.awaitingBrand > 0 &&
              !["COMPLETED", "CANCELED"].includes(campaign.status)
            : filter === "approval"
              ? hasReviewableProposal(campaign, now)
              : filter === "active"
                ? !["DRAFT", "COMPLETED", "CANCELED"].includes(campaign.status)
                : campaign.status ===
                  {
                    draft: "DRAFT",
                    completed: "COMPLETED",
                    canceled: "CANCELED",
                  }[filter])) &&
      `${campaign.title} ${campaign.summary}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <>
      <Typography
        as="h1"
        variant="title2"
        weight="bold"
        id="brand-campaigns-title"
      >
        {t("캠페인", "Campaigns", "活动")}
      </Typography>
      <section
        className={styles.campaignList}
        aria-labelledby="brand-campaigns-title"
      >
        <div className={styles.listSearch}>
          <Typography
            variant="label1"
            weight="bold"
            className={styles.campaignCount}
          >
            {t(
              `전체 ${data.counts.campaigns}개 캠페인`,
              `${data.counts.campaigns} campaigns`,
              `共 ${data.counts.campaigns} 个活动`,
            )}
          </Typography>
          <div className={styles.listControls}>
            <div className={styles.campaignSearch}>
              <SearchField
                aria-label={t("캠페인 검색", "Search campaigns", "搜索活动")}
                placeholder={t(
                  "캠페인 이름이나 브리프 검색",
                  "Search name or brief",
                  "搜索活动名称或简报",
                )}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onReset={() => setSearch("")}
                size="medium"
                width="100%"
              />
            </div>
            <NewCampaignLink
              locale={locale}
              canManage={data.permissions.canManageCampaigns}
            />
          </div>
        </div>
        <Tab value={filter} onValueChange={setFilter} disableScrollMoveOnChange>
          <TabList
            size="medium"
            horizontalPadding={false}
            aria-label={t("캠페인 상태", "Campaign status", "活动状态")}
          >
            {filters.map((item) => (
              <TabListItem key={item.value} value={item.value}>
                {item.label}
              </TabListItem>
            ))}
          </TabList>
          <TabPanel
            value={filter}
            mountMode="always"
            className={styles.campaignResults}
          >
            {campaigns.length ? (
              <CampaignTable campaigns={campaigns} locale={locale} />
            ) : (
              <EmptyState
                icon={<IconMegaphone />}
                title={
                  search
                    ? t(
                        "검색 결과가 없습니다",
                        "No matching campaigns",
                        "没有搜索结果",
                      )
                    : t(
                        "표시할 캠페인이 없습니다",
                        "No campaigns to show",
                        "暂无活动",
                      )
                }
                description={
                  search
                    ? t(
                        "다른 검색어를 입력해 주세요.",
                        "Try another search term.",
                        "请尝试其他关键词。",
                      )
                    : t(
                        "캠페인을 요청하면 접수 상태와 진행 상황을 이곳에서 확인할 수 있습니다.",
                        "Submit a campaign to track its intake and progress here.",
                        "提交活动后可在此查看受理状态及进度。",
                      )
                }
                action={
                  !search && filter === "all" ? (
                    <NewCampaignLink
                      locale={locale}
                      canManage={data.permissions.canManageCampaigns}
                    />
                  ) : undefined
                }
              />
            )}
          </TabPanel>
        </Tab>
        {data.hasMoreCampaigns && (
          <Typography as="p" variant="caption1" className={styles.limitNote}>
            {t(
              "최근 캠페인부터 표시하고 있습니다. 이전 캠페인은 요청함으로 문의해 주세요.",
              "Showing recent campaigns. Contact Futures for older campaigns.",
              "当前显示近期活动，如需更早的活动请联系 Futures。",
            )}
          </Typography>
        )}
      </section>
    </>
  );
}

function CampaignDetail({
  detail,
  locale,
  canManage,
  onRefresh,
}: {
  detail: BrandCampaignDetail;
  locale: Locale;
  canManage: boolean;
  onRefresh: () => void;
}) {
  const t = copyFor(locale);
  const campaign = detail.campaign;
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") ?? "overview";
  const tab = [
    "overview",
    "proposal",
    "production",
    "performance",
    "settlement",
    "documents",
  ].includes(requestedTab)
    ? requestedTab
    : "overview";
  const setTab = (value: string) =>
    router.replace(
      hrefFor(`${campaignPath(campaign.id)}?tab=${value}`, locale),
      { scroll: false },
    );
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cancelNeedsRequest, setCancelNeedsRequest] = useState(false);
  const cancelInFlight = useRef(false);
  const href = (path: string) => hrefFor(path, locale);
  const requestHref = href(
    `/advertiser/requests?compose=1&campaign=${encodeURIComponent(campaign.id)}`,
  );
  async function cancelCampaign() {
    if (!confirmCancel || cancelInFlight.current || cancelNeedsRequest) return;
    cancelInFlight.current = true;
    setBusy(true);
    setError("");
    setCancelNeedsRequest(false);
    try {
      const response = await fetch("/api/brand/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          id: campaign.id,
          expectedUpdatedAt: campaign.updatedAt,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setCancelNeedsRequest(result.code === "CANCEL_REVIEW_REQUIRED");
        throw new Error(
          result.message ??
            t("취소하지 못했습니다.", "Could not cancel.", "取消失败。"),
        );
      }
      setConfirmCancel(false);
      onRefresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("다시 시도해 주세요.", "Please try again.", "请重试。"),
      );
    } finally {
      cancelInFlight.current = false;
      setBusy(false);
    }
  }
  const tabs = [
    { value: "overview", label: t("캠페인 개요", "Overview", "活动概览") },
    {
      value: "proposal",
      label: t("제안·승인", "Proposal & approval", "方案与审批"),
    },
    {
      value: "production",
      label: t("제작·검수", "Production & review", "制作与审核"),
    },
    { value: "performance", label: t("성과", "Performance", "成效") },
    { value: "settlement", label: t("청구", "Billing", "账单") },
    { value: "documents", label: t("문서", "Documents", "文档") },
  ];
  return (
    <>
      <Link href={href("/advertiser/campaign")} className={styles.back}>
        <IconArrowLeft />
        {t("캠페인 목록", "All campaigns", "活动列表")}
      </Link>
      <PageHeading
        title={campaign.title}
        description={`${campaign.type === "MANAGED" ? "Managed" : "Open"} · ${t("최종 업데이트", "Last updated", "最后更新")} ${dateLabel(campaign.updatedAt, locale)}`}
        action={
          <div className={styles.actions}>
            <Status campaign={campaign} t={t} />
            {campaign.status === "DRAFT" && canManage ? (
              <Button
                as={Link}
                href={href(
                  requestDraftPath(campaign),
                )}
              >
                {t("브리프 이어 쓰기", "Continue brief", "继续填写简报")}
              </Button>
            ) : (
              <Button
                as={Link}
                href={requestHref}
                variant="outlined"
                color="assistive"
              >
                {t("관련 요청하기", "Send a request", "提交相关请求")}
              </Button>
            )}
          </div>
        }
      />
      {tab !== "overview" && campaign.status === "DRAFT" && (
        <SectionMessage
          variant="info"
          description={t(
            "브리프를 완성하고 접수하면 퓨쳐스가 검토를 시작합니다.",
            "Complete and submit your brief for Futures to start its review.",
            "完成并提交简报后，Futures 将开始审核。",
          )}
        >
          {t(
            "아직 접수하지 않은 캠페인입니다.",
            "This campaign has not been submitted yet.",
            "此活动尚未提交。",
          )}
        </SectionMessage>
      )}
      {tab !== "overview" && campaign.reviewNote && (
        <SectionMessage variant="cautionary" description={campaign.reviewNote}>
          {t("퓨쳐스 검토 안내", "Futures review note", "Futures 审核说明")}
        </SectionMessage>
      )}
      <Tab value={tab} onValueChange={setTab} disableScrollMoveOnChange>
        <TabList
          size="medium"
          aria-label={t("캠페인 상세", "Campaign detail", "活动详情")}
          className={styles.detailTabs}
        >
          {tabs.map((item) => (
            <TabListItem key={item.value} value={item.value}>
              {item.label}
            </TabListItem>
          ))}
        </TabList>
        <TabPanel value={tab} mountMode="always">
          {tab === "overview" ? (
            <>
              <BrandCampaignProgress
                detail={detail}
                locale={locale}
                canManage={canManage}
              />
              <div className={styles.detailColumns}>
                <Panel title={t("캠페인 브리프", "Campaign brief", "活动简报")}>
                  {campaign.coverImageUrl && (
                    <figure className={styles.briefArtwork}>
                      <Image
                        src={campaign.coverImageUrl}
                        alt={
                          campaign.gameName
                            ? `${campaign.gameName} · ${t("공식 아트워크", "official artwork", "官方美术")}`
                            : t(
                                "캠페인 게임 아트워크",
                                "Campaign game artwork",
                                "活动游戏美术",
                              )
                        }
                        width={2048}
                        height={946}
                      />
                      <figcaption>
                        <span>
                          {campaign.gameName} · © Hotta Studio / Perfect World
                        </span>
                        {campaign.gameSourceUrl && (
                          <a
                            href={campaign.gameSourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t("공식 사이트", "Official website", "官方网站")}
                          </a>
                        )}
                      </figcaption>
                    </figure>
                  )}
                  <dl className={styles.briefGrid}>
                    <BriefItem
                      label={t("목표", "Goal", "目标")}
                      value={
                        campaign.brief?.goal ||
                        t(
                          "별도 목표 미입력",
                          "No separate goal entered",
                          "尚未单独填写目标",
                        )
                      }
                    />
                    <BriefItem
                      label={t("요청 예산", "Requested budget", "请求预算")}
                      value={amountLabel(campaign, locale)}
                    />
                    <BriefItem
                      label={t("게임명", "Game name", "游戏名称")}
                      value={campaign.brief?.gameName || campaign.gameName || "—"}
                    />
                    <BriefItem
                      label={t("장르명", "Genre", "游戏类型")}
                      value={
                        campaign.brief?.genre ||
                        campaign.categories.join(", ") ||
                        "—"
                      }
                    />
                    <BriefItem
                      label={t("타깃 지역", "Target regions", "目标地区")}
                      value={campaign.regions.join(", ") || "—"}
                    />
                    <BriefItem
                      label={t("플랫폼", "Platforms", "平台")}
                      value={campaign.platforms.join(", ") || "—"}
                    />
                    <BriefItem
                      label={t("콘텐츠 형식", "Content format", "内容形式")}
                      value={campaign.brief?.contentFormat || "—"}
                    />
                    <BriefItem
                      label={t("희망 인원", "Requested creators", "期望人数")}
                      value={
                        campaign.brief?.creatorCount
                          ? t(
                              `${campaign.brief.creatorCount}명`,
                              `${campaign.brief.creatorCount} creators`,
                              `${campaign.brief.creatorCount} 人`,
                            )
                          : t("미입력", "Not entered", "未填写")
                      }
                    />
                    <BriefItem
                      label={t("희망 일정", "Preferred date", "期望日期")}
                      value={dateLabel(
                        campaign.brief?.desiredDate ?? campaign.contentDeadline,
                        locale,
                      )}
                    />
                  </dl>
                  <div className={styles.notes}>
                    <Typography as="h3" variant="label1" weight="bold">
                      {t("상세 요청", "Brief details", "详细需求")}
                    </Typography>
                    <Typography as="p" variant="body2">
                      {campaign.brief?.note || campaign.summary || "—"}
                    </Typography>
                  </div>
                  {campaign.brief?.compositionPreference && (
                    <div className={styles.preference}>
                      <Typography variant="caption1" className={styles.muted}>
                        {t("구성 선호", "Composition preference", "组合偏好")} ·{" "}
                        {
                          {
                            balanced: t("균형 중심", "Balanced", "均衡"),
                            reach: t("도달 중심", "Reach", "触达"),
                            efficient: t("효율 중심", "Efficiency", "效率"),
                          }[campaign.brief.compositionPreference]
                        }
                      </Typography>
                    </div>
                  )}
                </Panel>
                <div className={styles.sideStack}>
                  <Panel
                    title={t("연결된 요청", "Related requests", "相关请求")}
                    action={
                      <Link className={styles.textLink} href={requestHref}>
                        {t("요청함", "Inbox", "请求中心")}
                        <IconArrowRight />
                      </Link>
                    }
                  >
                    <div className={styles.relatedRequests}>
                      {detail.requests.length ? (
                        detail.requests.map((request) => (
                          <Link
                            key={request.id}
                            href={href(
                              `/advertiser/requests?request=${encodeURIComponent(request.id)}`,
                            )}
                          >
                            <Typography
                              as="strong"
                              variant="label1"
                              weight="medium"
                            >
                              {request.title}
                            </Typography>
                            <Typography
                              as="span"
                              variant="caption1"
                              className={styles.muted}
                            >
                              {dateLabel(request.updatedAt, locale)}
                            </Typography>
                          </Link>
                        ))
                      ) : (
                        <Typography
                          as="p"
                          variant="body2"
                          className={styles.muted}
                        >
                          {t(
                            "연결된 요청이 없습니다.",
                            "No related requests yet.",
                            "暂无相关请求。",
                          )}
                        </Typography>
                      )}
                    </div>
                  </Panel>
                </div>
              </div>
            </>
          ) : tab === "proposal" ? (
            <OfficialProposalPanel
              proposals={detail.proposals}
              locale={locale}
              canManage={canManage}
              requestHref={requestHref}
              onRefresh={onRefresh}
            />
          ) : tab === "production" ? (
            <BrandProductionPanel
              items={detail.deliverables}
              locale={locale}
              canManage={canManage}
              requestHref={requestHref}
              artwork={campaign}
              onRefresh={onRefresh}
            />
          ) : tab === "performance" ? (
            <BrandReportingPanel
              items={detail.performance.items}
              locale={locale}
              artwork={campaign}
              requestHref={requestHref}
            />
          ) : tab === "settlement" ? (
            <BrandBillingPanel invoices={detail.invoices} locale={locale} />
          ) : (
            <BrandDocumentsPanel
              locale={locale}
              campaignId={campaign.id}
              campaignTitle={campaign.title}
            />
          )}
        </TabPanel>
      </Tab>
      {canManage && ["DRAFT", "REVIEW"].includes(campaign.status) && (
        <div className={styles.cancelArea}>
          <Button
            variant="solid"
            color="negative"
            size="small"
            onClick={() => {
              setError("");
              setCancelNeedsRequest(false);
              setConfirmCancel(true);
            }}
          >
            {t("캠페인 취소", "Cancel campaign", "取消活动")}
          </Button>
          <Modal
            open={confirmCancel}
            onOpenChange={(open) => {
              if (!cancelInFlight.current) setConfirmCancel(open);
            }}
          >
            <ModalContainer
              variant="popup"
              size="medium"
              className={styles.cancelDialog}
              disableOutsideClickClose={busy}
              disableEscapeKeyDownClose={busy}
              aria-label={t(
                "캠페인 취소 확인",
                "Confirm campaign cancellation",
                "确认取消活动",
              )}
              aria-describedby="campaign-cancel-description"
            >
              <ModalNavigation
                trailingContent={
                  <ModalNavigationButton
                    variant="close-button"
                    disabled={busy}
                    aria-label={t("닫기", "Close", "关闭")}
                  />
                }
              >
                {t(
                  "이 캠페인을 취소할까요?",
                  "Cancel this campaign?",
                  "取消此活动？",
                )}
              </ModalNavigation>
              <ModalContent gap="16px" verticalPadding="bottom-only">
                <Typography as="p" variant="body2" weight="bold">
                  {campaign.title}
                </Typography>
                <Typography
                  as="p"
                  id="campaign-cancel-description"
                  variant="body2"
                  color="semantic.foreground.neutral.secondary"
                >
                  {t(
                    "취소하면 이 캠페인의 접수와 진행이 종료됩니다. 계속 진행하려면 유지하기를 선택해 주세요.",
                    "Canceling ends this campaign's intake and progress. Choose Keep campaign to continue.",
                    "取消后此活动的受理和执行将结束。如需继续，请选择保留活动。",
                  )}
                </Typography>
                {error && (
                  <SectionMessage
                    variant="negative"
                    role="alert"
                    bottomButton={
                      cancelNeedsRequest ? (
                        <Button
                          as={Link}
                          href={requestHref}
                          size="small"
                          variant="outlined"
                          color="assistive"
                        >
                          {t("취소 요청 남기기", "Request cancellation", "请求取消")}
                        </Button>
                      ) : (
                        <Button
                          onClick={onRefresh}
                          size="small"
                          variant="outlined"
                          color="assistive"
                        >
                          {t("최신 상태 확인", "Refresh status", "刷新状态")}
                        </Button>
                      )
                    }
                  >
                    {error}
                  </SectionMessage>
                )}
              </ModalContent>
              <ActionArea variant="neutral">
                <ActionAreaButton
                  variant="alternative"
                  disabled={busy}
                  onClick={() => setConfirmCancel(false)}
                >
                  {t("유지하기", "Keep campaign", "保留活动")}
                </ActionAreaButton>
                <ActionAreaButton
                  variant="main"
                  buttonColor="negative"
                  loading={busy}
                  disabled={busy || cancelNeedsRequest}
                  onClick={() => void cancelCampaign()}
                >
                  {t("캠페인 취소", "Cancel campaign", "取消活动")}
                </ActionAreaButton>
              </ActionArea>
            </ModalContainer>
          </Modal>
        </div>
      )}
    </>
  );
}

function BriefItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>
        <Typography variant="caption1" className={styles.muted}>
          {label}
        </Typography>
      </dt>
      <dd>
        <Typography variant="body2" weight="medium">
          {value}
        </Typography>
      </dd>
    </div>
  );
}

function Library({ locale }: { locale: Locale }) {
  const t = copyFor(locale);
  return (
    <>
      <PageHeading
        title={t("자료실", "Library", "资料库")}
        description={t(
          "공유된 제안서, 성과 보고, 청구서와 첨부 자료를 캠페인별로 확인하세요.",
          "Browse shared proposals, performance reports, invoices, and attachments by campaign.",
          "按活动查看已共享的方案、成效报告、账单及附件。",
        )}
      />
      <BrandDocumentsPanel locale={locale} />
    </>
  );
}
