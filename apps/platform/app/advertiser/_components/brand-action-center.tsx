"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Button, Divider, Typography } from "@montage-ui/core";
import {
  ArrowRight,
  CircleCheck,
  Clock3,
  FileCheck2,
  Gamepad2,
  Inbox,
  MessageSquare,
  ReceiptText,
} from "lucide-react";
import type { Locale } from "../../_components/landing-copy";
import type { BrandWorkspace } from "../../../lib/brand-workspace-types";
import {
  getBrandActions,
  isPastBrandDeadline,
  type BrandAction,
  type BrandActionKind,
  type BrandDeadlineKind,
} from "../../../lib/brand-progress";
import styles from "./brand-progress.module.css";

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

function ActionThumbnail({
  imageUrl,
  kind,
  overdue,
  hasCampaign,
}: {
  imageUrl: string | null;
  kind: BrandActionKind;
  overdue: boolean;
  hasCampaign: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const Icon = icons[kind];
  const Fallback = hasCampaign ? Gamepad2 : Inbox;

  return (
    <span className={styles.actionIcon} aria-hidden="true">
      <span className={styles.gameThumbnail}>
        {imageUrl && imageUrl !== failedUrl ? (
          <Image
            src={imageUrl}
            alt=""
            width={42}
            height={42}
            onError={() => setFailedUrl(imageUrl)}
          />
        ) : (
          <Fallback size={21} />
        )}
      </span>
      <span
        className={`${styles.actionKind} ${overdue ? styles.lateIcon : ""}`}
      >
        <Icon size={14} />
      </span>
    </span>
  );
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
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const actions = useMemo(() => getBrandActions(data, now), [data, now]);
  const campaignsById = useMemo(
    () => new Map(data.campaigns.map((campaign) => [campaign.id, campaign])),
    [data.campaigns],
  );

  if (!actions.length) return null;

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
  const labels: Record<BrandActionKind, string> = {
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
        <Divider />
        <ul className={styles.actionList} aria-labelledby="brand-actions-title">
          {actions.map((item) => {
            const campaign = item.campaignId
              ? campaignsById.get(item.campaignId)
              : undefined;
            const late = isPastBrandDeadline(item.dueAt, now);
            return (
              <li key={item.id} className={styles.actionRow}>
                <ActionThumbnail
                  imageUrl={campaign?.gameIconUrl ?? null}
                  kind={item.kind}
                  overdue={late}
                  hasCampaign={Boolean(item.campaignId)}
                />
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
                  <Link href={href(item.href)} className={styles.actionTitle}>
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
