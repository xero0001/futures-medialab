"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Button,
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
} from "@montage-ui/core";
import { IconArrowRight } from "@montage-ui/icon";
import type { Locale } from "../../_components/landing-copy";
import { StatusBadge } from "../../_components/workspace/status-badge";
import type { BrandCampaign } from "../../../lib/brand-workspace-types";
import {
  getBrandScheduleItems,
  isPastBrandDeadline,
  type BrandScheduleAlert,
} from "../../../lib/brand-progress";
import styles from "./brand-campaign-overview.module.css";

export function BrandCampaignOverview({
  campaigns,
  locale,
  hasMoreCampaigns,
  children,
}: {
  campaigns: BrandCampaign[];
  locale: Locale;
  hasMoreCampaigns: boolean;
  children: ReactNode;
}) {
  const t = (ko: string, en: string, zh: string) => ({ ko, en, zh })[locale];
  const [tab, setTab] = useState("campaigns");
  const [now, setNow] = useState(() => Date.now());
  const [showAllSchedule, setShowAllSchedule] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const schedule = useMemo(
    () => getBrandScheduleItems(campaigns, now),
    [campaigns, now],
  );
  const href = (path: string) =>
    `${path}${path.includes("?") ? "&" : "?"}lang=${locale}`;
  const labels: Record<BrandScheduleAlert["kind"], string> = {
    proposal: t("제안 예정", "Proposal due", "预计提案"),
    "proposal-validity": t(
      "제안 유효기한",
      "Proposal valid until",
      "提案有效期",
    ),
    recruitment: t("모집 마감", "Recruitment closes", "招募截止"),
    content: t("콘텐츠 마감", "Content deadline", "内容截止日期"),
  };
  const dateFormat = new Intl.DateTimeFormat(
    locale === "zh" ? "zh-CN" : locale,
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  return (
    <section
      className={styles.overview}
      aria-label={t("캠페인 현황", "Campaign overview", "活动概览")}
    >
      <Tab value={tab} onValueChange={setTab}>
        <div className={styles.header}>
          <TabList
            size="medium"
            horizontalPadding={false}
            className={styles.tabs}
            aria-label={t(
              "캠페인 현황 보기",
              "Campaign overview views",
              "活动概览视图",
            )}
          >
            <TabListItem value="campaigns" onFocus={() => setTab("campaigns")}>
              {t("진행 중인 캠페인", "Active campaigns", "进行中的活动")}
            </TabListItem>
            <TabListItem value="schedule" onFocus={() => setTab("schedule")}>
              {t("진행 일정", "Schedule", "进行日程")}
            </TabListItem>
          </TabList>
          <Link className={styles.viewAll} href={href("/advertiser/campaign")}>
            {t("전체 보기", "View all", "查看全部")}
            <IconArrowRight aria-hidden="true" />
          </Link>
        </div>
        <TabPanel value="campaigns" className={styles.panel} tabIndex={0}>
          {children}
        </TabPanel>
        <TabPanel value="schedule" className={styles.panel} tabIndex={0}>
          <Table className={styles.table}>
            <caption className={styles.srOnly}>
              {t("진행 일정", "Campaign schedule", "活动日程")}
            </caption>
            <TableHead>
              <TableRow>
                <TableHeadCell scope="col">
                  {t("캠페인", "Campaign", "活动")}
                </TableHeadCell>
                <TableHeadCell scope="col">
                  {t("일정 종류", "Milestone", "日程类型")}
                </TableHeadCell>
                <TableHeadCell scope="col">
                  {t("예정일", "Due date", "预计日期")}
                </TableHeadCell>
                <TableHeadCell scope="col">
                  {t("상태", "Status", "状态")}
                </TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedule.length ? (
                schedule
                  .slice(0, showAllSchedule ? undefined : 4)
                  .map((item) => {
                    const overdue = isPastBrandDeadline(item.dueAt, now);
                    return (
                      <TableRow key={`${item.campaignId}:${item.kind}`}>
                        <TableCell>
                          <Link
                            className={styles.campaignLink}
                            href={href(item.href)}
                          >
                            {item.campaignTitle}
                          </Link>
                        </TableCell>
                        <TableCell>{labels[item.kind]}</TableCell>
                        <TableCell>
                          <time className={styles.date} dateTime={item.dueAt}>
                            {dateFormat.format(new Date(item.dueAt))}
                          </time>
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={overdue ? "amber" : "neutral"}>
                            {overdue
                              ? t(
                                  "일정 확인 필요",
                                  "Schedule update needed",
                                  "需确认日程",
                                )
                              : t("예정", "Upcoming", "预计")}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    );
                  })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className={styles.empty}>
                    {t(
                      "등록된 진행 일정이 없습니다.",
                      "No scheduled milestones yet.",
                      "暂无已登记的日程。",
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {schedule.length > 4 && (
            <div className={styles.more}>
              <Button
                variant="outlined"
                color="assistive"
                size="small"
                aria-expanded={showAllSchedule}
                onClick={() => setShowAllSchedule((value) => !value)}
              >
                {showAllSchedule
                  ? t("일정 접기", "Show fewer", "收起日程")
                  : t(
                      `일정 ${schedule.length}건 모두 보기`,
                      `View all ${schedule.length} dates`,
                      `查看全部 ${schedule.length} 项日程`,
                    )}
              </Button>
            </div>
          )}
          {hasMoreCampaigns && (
            <p className={styles.limitNote}>
              {t(
                "최근에 불러온 캠페인의 일정입니다. 이전 캠페인은 전체 목록에서 확인하세요.",
                "Showing schedules from recently loaded campaigns. See the full list for older campaigns.",
                "显示最近加载活动的日程，较早活动请查看完整列表。",
              )}
            </p>
          )}
        </TabPanel>
      </Tab>
    </section>
  );
}
