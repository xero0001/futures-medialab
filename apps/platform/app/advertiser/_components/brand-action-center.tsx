"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Category,
  CategoryList,
  CategoryListItem,
  Divider,
  Typography,
} from "@montage-ui/core";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleCheck,
  Clock3,
  FileCheck2,
  Inbox,
  MessageSquare,
  ReceiptText,
} from "lucide-react";
import type { Locale } from "../../_components/landing-copy";
import type { BrandWorkspace } from "../../../lib/brand-workspace-types";
import {
  getBrandActions,
  getBrandScheduleItems,
  isPastBrandDeadline,
  type BrandAction,
  type BrandActionKind,
  type BrandDeadlineKind,
} from "../../../lib/brand-progress";
import styles from "./brand-progress.module.css";

type Filter = "all" | BrandActionKind;
const kinds: Filter[] = ["all", "proposal", "content", "request", "invoice"];
const icons = {
  proposal: FileCheck2,
  content: CircleCheck,
  request: MessageSquare,
  invoice: ReceiptText,
};
function dateLabel(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function BrandActionCenter({
  data,
  locale,
}: {
  data: BrandWorkspace;
  locale: Locale;
}) {
  const t = (ko: string, en: string, zh: string) => ({ ko, en, zh })[locale];
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<Filter>("all");
  const [visibleCount, setVisibleCount] = useState(8);
  const [showAllSchedule, setShowAllSchedule] = useState(false);
  const selectFilter = (kind: Filter) => {
    setFilter(kind);
    setVisibleCount(8);
  };
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const actions = useMemo(() => getBrandActions(data, now), [data, now]);
  const schedule = useMemo(
    () => getBrandScheduleItems(data.campaigns, now),
    [data.campaigns, now],
  );
  const selected =
    filter === "all" ? actions : actions.filter((item) => item.kind === filter);
  const overdue = actions.filter((item) =>
    isPastBrandDeadline(item.dueAt, now),
  ).length;
  const soon = actions.filter(
    (item) =>
      item.dueAt &&
      Date.parse(item.dueAt) >= now &&
      Date.parse(item.dueAt) - now <= 48 * 60 * 60 * 1000,
  ).length;
  const href = (path: string) =>
    `${path}${path.includes("?") ? "&" : "?"}lang=${locale}`;
  const labels: Record<Filter, string> = {
    all: t("전체", "All", "全部"),
    proposal: t("제안 확인", "Proposals", "提案"),
    content: t("콘텐츠 검수", "Content review", "内容审核"),
    request: t("회신·자료 보완", "Replies & materials", "回复与补充资料"),
    invoice: t("청구 확인", "Invoices", "账单"),
  };
  const deadlines: Record<BrandDeadlineKind, string> = {
    "proposal-validity": t(
      "제안 유효기한",
      "Proposal valid until",
      "提案有效期",
    ),
    content: t("콘텐츠 마감", "Content deadline", "内容截止日期"),
    reply: t("요청 처리 목표일", "Request target date", "请求目标日期"),
    payment: t("납부 기한", "Payment due", "付款期限"),
    proposal: t("제안 예정", "Proposal due", "预计提案"),
    recruitment: t("모집 마감", "Recruitment closes", "招募截止"),
  };
  const description = (item: BrandAction) =>
    item.kind === "proposal"
      ? t(
          `제안 구성 ${item.count}개를 확인해 주세요.`,
          `Review ${item.count} proposal items.`,
          `请确认 ${item.count} 项提案内容。`,
        )
      : item.kind === "content"
        ? t(
            `Futures가 공유한 콘텐츠 ${item.count}건을 검토해 주세요.`,
            `Review ${item.count} items shared by Futures.`,
            `请审核 Futures 共享的 ${item.count} 项内容。`,
          )
        : item.kind === "request"
          ? t(
              "Futures의 질문과 필요한 자료를 확인해 주세요.",
              "Check the questions and materials requested by Futures.",
              "请查看 Futures 的问题和所需资料。",
            )
          : t(
              "발행된 청구의 금액과 입금 확인 상태를 확인해 주세요.",
              "Review the invoice amount and payment confirmation status.",
              "请查看已出具账单的金额及收款确认状态。",
            );
  const actionLabel = (kind: BrandActionKind) =>
    kind === "proposal"
      ? t("제안 보기", "View proposal", "查看提案")
      : kind === "content"
        ? t("검수 화면 열기", "Open content review", "打开内容审核")
        : kind === "request"
          ? t("요청 확인", "View request", "查看请求")
          : t("청구 보기", "View invoice", "查看账单");

  return (
    <div className={styles.actionCenter}>
      <section
        className={styles.actionPanel}
        aria-labelledby="brand-actions-title"
      >
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.headingLine}>
              <Typography
                as="h2"
                variant="heading1"
                weight="bold"
                id="brand-actions-title"
              >
                {t("지금 처리할 일", "Your next actions", "待处理事项")}
              </Typography>
              <span className={styles.count}>{actions.length}</span>
            </div>
            <Typography as="p" variant="body2" className={styles.muted}>
              {t(
                "확인이 필요한 업무를 기한이 빠른 순서로 모았습니다.",
                "Review outstanding work, ordered by the nearest deadline.",
                "按截止日期先后查看需要确认的事项。",
              )}
            </Typography>
          </div>
          <div
            className={styles.urgencySummary}
            aria-label={t("업무 기한 요약", "Deadline summary", "期限概览")}
          >
            <span className={overdue ? styles.overdue : ""}>
              <Clock3 size={15} />
              {t(
                `기한 지남 ${overdue}`,
                `${overdue} overdue`,
                `已逾期 ${overdue}`,
              )}
            </span>
            <span>
              {t(
                `48시간 이내 ${soon}`,
                `${soon} due within 48h`,
                `48小时内 ${soon}`,
              )}
            </span>
          </div>
        </div>
        <Category
          value={filter}
          onValueChange={(value) => selectFilter(value as Filter)}
        >
          <div className={styles.filters}>
            <CategoryList
              variant="alternative"
              size="medium"
              horizontalPadding={false}
              verticalPadding={false}
              aria-label={t("처리할 일 유형", "Action type", "事项类型")}
            >
              {kinds.map((kind) => (
                <CategoryListItem
                  key={kind}
                  value={kind}
                  id={`brand-actions-filter-${kind}`}
                  aria-controls="brand-actions-results"
                  onFocus={() => selectFilter(kind)}
                >
                  <span className={styles.categoryLabel}>
                    {labels[kind]}
                    <span className={styles.categoryCount}>
                      {kind === "all"
                        ? actions.length
                        : actions.filter((item) => item.kind === kind).length}
                    </span>
                  </span>
                </CategoryListItem>
              ))}
            </CategoryList>
          </div>
        </Category>
        <Divider />
        <div
          id="brand-actions-results"
          role="tabpanel"
          aria-labelledby={`brand-actions-filter-${filter}`}
          tabIndex={0}
        >
          <div aria-live="polite" className={styles.srOnly}>
            {t(
              `${selected.length}건의 업무`,
              `${selected.length} tasks`,
              `${selected.length} 项任务`,
            )}
          </div>
          {selected.length ? (
            <ul className={styles.actionList}>
              {selected.slice(0, visibleCount).map((item) => {
                const Icon = icons[item.kind];
                const late = isPastBrandDeadline(item.dueAt, now);
                return (
                  <li key={item.id} className={styles.actionRow}>
                    <span
                      className={`${styles.actionIcon} ${late ? styles.lateIcon : ""}`}
                    >
                      <Icon size={21} aria-hidden="true" />
                    </span>
                    <div className={styles.actionBody}>
                      <div className={styles.rowEyebrow}>
                        <span>{labels[item.kind]}</span>
                        {item.campaignTitle &&
                          item.campaignTitle !== item.title && (
                            <span className={styles.campaignLabel}>
                              {item.campaignTitle}
                            </span>
                          )}
                      </div>
                      <Link
                        href={href(item.href)}
                        className={styles.actionTitle}
                      >
                        {item.title}
                      </Link>
                      <p>{description(item)}</p>
                    </div>
                    <div className={styles.actionDeadline}>
                      {item.dueAt ? (
                        <>
                          <span>{deadlines[item.deadlineKind]}</span>
                          <time dateTime={item.dueAt}>
                            {dateLabel(item.dueAt, locale)}
                          </time>
                          {late && (
                            <strong className={styles.overdue}>
                              {t("기한 지남", "Overdue", "已逾期")}
                            </strong>
                          )}
                        </>
                      ) : (
                        <span>
                          {t("기한 미지정", "No deadline set", "未设截止日期")}
                        </span>
                      )}
                    </div>
                    <Button
                      as={Link}
                      href={href(item.href)}
                      variant="outlined"
                      color="assistive"
                      size="small"
                      trailingContent={<ArrowRight size={15} />}
                    >
                      {actionLabel(item.kind)}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.emptyActions}>
              <span>
                <Check size={23} />
              </span>
              <Typography as="strong" variant="body1" weight="bold">
                {filter === "all"
                  ? t(
                      "지금 확인할 업무가 없습니다",
                      "You’re all caught up",
                      "暂无待确认事项",
                    )
                  : t(
                      "이 유형의 대기 업무가 없습니다",
                      "No pending tasks of this type",
                      "此类型暂无待处理事项",
                    )}
              </Typography>
              <Typography as="p" variant="body2" className={styles.muted}>
                {filter === "all"
                  ? t(
                      "진행 중인 캠페인의 일정과 새 요청을 아래에서 확인하세요.",
                      "See your campaign schedules and start a new request below.",
                      "可在下方查看活动日程或发起新请求。",
                    )
                  : t(
                      "다른 유형을 선택해 업무를 확인하세요.",
                      "Select another type to see more tasks.",
                      "请选择其他类型查看事项。",
                    )}
              </Typography>
            </div>
          )}
          {selected.length > visibleCount && (
            <div className={styles.moreRow}>
              <Button
                variant="outlined"
                color="assistive"
                size="small"
                onClick={() => setVisibleCount((count) => count + 8)}
              >
                {t(
                  `업무 더 보기 (${selected.length - visibleCount})`,
                  `Show more (${selected.length - visibleCount})`,
                  `查看更多 (${selected.length - visibleCount})`,
                )}
              </Button>
            </div>
          )}
        </div>
        {(data.hasMoreCampaigns || data.hasMoreRequests) && (
          <p className={styles.limitNote}>
            {t(
              "최근에 불러온 캠페인과 요청을 기준으로 표시합니다. 전체 목록에서 이전 업무도 확인할 수 있습니다.",
              "Showing actions from recently loaded campaigns and requests. Check the full lists for older work.",
              "当前显示最近加载的活动与请求，请在完整列表中查看较早事项。",
            )}{" "}
            <Link href={href("/advertiser/campaign")}>
              {t("캠페인 목록", "Campaigns", "活动列表")}
            </Link>
            {" · "}
            <Link href={href("/advertiser/requests")}>
              {t("요청함", "Inbox", "请求中心")}
            </Link>
          </p>
        )}
      </section>
      {schedule.length > 0 && (
        <section
          className={styles.schedulePanel}
          aria-labelledby="brand-schedule-title"
        >
          <div className={styles.scheduleHeading}>
            <span className={styles.scheduleIcon}>
              <CalendarDays size={20} />
            </span>
            <div>
              <Typography
                as="h2"
                variant="label1"
                weight="bold"
                id="brand-schedule-title"
              >
                {t(
                  "Futures 진행 일정",
                  "Schedules managed by Futures",
                  "Futures 负责的日程",
                )}
              </Typography>
              <p>
                {t(
                  "제안·모집·제작의 예정일을 확인하세요. 기한이 지난 건도 함께 표시됩니다.",
                  "Track proposal, recruitment and production dates, including overdue work.",
                  "查看提案、招募和制作的预计日期，包括已逾期事项。",
                )}
              </p>
            </div>
          </div>
          <ul className={styles.scheduleList}>
            {schedule.slice(0, showAllSchedule ? undefined : 4).map((item) => (
              <li key={`${item.campaignId}:${item.kind}`}>
                <div>
                  <span>{deadlines[item.kind]}</span>
                  <Link href={href(item.href)}>{item.campaignTitle}</Link>
                </div>
                <div className={styles.scheduleDate}>
                  <time dateTime={item.dueAt}>
                    {dateLabel(item.dueAt, locale)}
                  </time>
                  {isPastBrandDeadline(item.dueAt, now) && (
                    <span className={styles.overdue}>
                      {t(
                        "일정 확인 필요",
                        "Schedule update needed",
                        "需确认日程",
                      )}
                    </span>
                  )}
                </div>
                <Link
                  href={href(item.href)}
                  className={styles.iconLink}
                  aria-label={t(
                    `${item.campaignTitle} 진행 상황 보기`,
                    `View progress for ${item.campaignTitle}`,
                    `查看 ${item.campaignTitle} 的进度`,
                  )}
                >
                  <ArrowRight size={18} />
                </Link>
              </li>
            ))}
          </ul>
          {schedule.length > 4 && (
            <button
              type="button"
              className={styles.scheduleMore}
              aria-expanded={showAllSchedule}
              onClick={() => setShowAllSchedule(!showAllSchedule)}
            >
              {showAllSchedule
                ? t("일정 접기", "Show fewer", "收起日程")
                : t(
                    `일정 ${schedule.length}건 모두 보기`,
                    `View all ${schedule.length} dates`,
                    `查看全部 ${schedule.length} 项日程`,
                  )}
            </button>
          )}
        </section>
      )}
      {!data.permissions.canManageCampaigns &&
        actions.some(
          (item) => item.kind === "proposal" || item.kind === "content",
        ) && (
          <p className={styles.permissionNote}>
            <Inbox size={15} />
            {t(
              "제안·콘텐츠의 승인과 수정 요청은 조직 관리자에게 맡겨 주세요. 공유된 내용은 확인할 수 있습니다.",
              "Organization admins handle approvals and change requests. You can review the shared content.",
              "审批及修改请求由组织管理员处理，您可以查看共享内容。",
            )}
          </p>
        )}
    </div>
  );
}
