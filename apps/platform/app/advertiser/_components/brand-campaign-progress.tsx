"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Typography } from "@montage-ui/core";
import {
  ArrowRight,
  CalendarDays,
  CircleAlert,
  Clock3,
  MessageSquare,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { Locale } from "../../_components/landing-copy";
import type { BrandCampaignDetail } from "../../../lib/brand-workspace-types";
import {
  getBrandCampaignProgress,
  isPastBrandDeadline,
  type BrandDeadlineKind,
  type BrandProgressStage,
  type BrandProgressState,
} from "../../../lib/brand-progress";
import styles from "./brand-progress.module.css";

const stages: BrandProgressStage[] = [
  "brief",
  "intake",
  "sourcing",
  "proposal",
  "production",
  "reporting",
  "completion",
];
function dateLabel(value: string | null, locale: Locale) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function BrandCampaignProgress({
  detail,
  locale,
  canManage,
}: {
  detail: BrandCampaignDetail;
  locale: Locale;
  canManage: boolean;
}) {
  const t = (ko: string, en: string, zh: string) => ({ ko, en, zh })[locale];
  const campaign = detail.campaign;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const progress = getBrandCampaignProgress(detail, now);
  const canceled = campaign.status === "CANCELED";
  const draft = campaign.status === "DRAFT";
  const overdue =
    !canceled && !draft && isPastBrandDeadline(progress.dueAt, now);
  const href = (path: string) =>
    `${path}${path.includes("?") ? "&" : "?"}lang=${locale}`;
  const basePath = `/advertiser/campaign/${encodeURIComponent(campaign.id)}`;
  const requestHref = `/advertiser/requests?compose=1&campaign=${encodeURIComponent(campaign.id)}`;
  const labels: Record<BrandProgressStage, string> = {
    brief: t("요청 작성", "Brief", "填写需求"),
    intake: t("접수 검토", "Intake", "受理审核"),
    sourcing:
      campaign.type === "MANAGED"
        ? t("크리에이터 섭외", "Sourcing", "达人邀约")
        : t("파트너 모집", "Recruitment", "合作方招募"),
    proposal: t("공식 제안", "Proposal", "正式提案"),
    production: t("제작·검수", "Production", "制作与审核"),
    reporting: t("게시·성과", "Results", "发布与成效"),
    completion: t("완료·청구", "Completion", "完成与账单"),
  };
  const deadlineLabels: Record<BrandDeadlineKind, string> = {
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
  const ownerLabels = {
    brand: t("브랜드 확인 필요", "Your review is needed", "需要品牌确认"),
    futures: t("Futures 처리 중", "Futures is handling this", "Futures 处理中"),
    production: t(
      "제작진 처리 중",
      "Production team is handling this",
      "制作团队处理中",
    ),
    none: t("진행 종료", "Workflow closed", "流程已结束"),
  };
  const content: Record<
    BrandProgressState["state"],
    { title: string; description: string; action: string }
  > = {
    draft: {
      title: t(
        "브리프를 완성해 요청을 접수해 주세요",
        "Complete and submit your brief",
        "请完成并提交需求简报",
      ),
      description: t(
        "아직 Futures에 접수되지 않았습니다. 임시저장한 내용을 이어서 작성할 수 있습니다.",
        "Futures has not received this request yet. Continue editing your saved brief.",
        "Futures 尚未收到此请求，您可以继续填写已保存的草稿。",
      ),
      action: t("브리프 이어 쓰기", "Continue brief", "继续填写"),
    },
    canceled: {
      title: t(
        "취소된 캠페인입니다",
        "This campaign was canceled",
        "此活动已取消",
      ),
      description: t(
        "캠페인 진행이 종료되었습니다. 이미 공유된 자료는 문서 탭에서 확인할 수 있습니다.",
        "Campaign work has ended. Previously shared materials remain available in Documents.",
        "活动已终止，已共享资料仍可在文档中查看。",
      ),
      action: t("공유 문서 보기", "View documents", "查看共享文档"),
    },
    complete: {
      title: t(
        "캠페인이 완료되었습니다",
        "This campaign is complete",
        "此活动已完成",
      ),
      description:
        campaign.invoiceSummary.paid > 0
          ? t(
              "집행 결과와 입금 확인을 마쳤습니다. 공개된 보고서와 문서를 확인해 주세요.",
              "Results and payment confirmation are recorded. Review the published reports and documents.",
              "执行结果及收款确认已记录，请查看已公开的报告与文档。",
            )
          : t(
              "완료된 집행 결과와 공유 문서를 확인할 수 있습니다. 청구 내역은 발행되면 청구 탭에 표시됩니다.",
              "Review completed results and shared documents. Invoices appear in Billing once issued.",
              "您可以查看执行结果和共享文档，账单出具后将显示在账单页签。",
            ),
      action: t("결과 문서 보기", "View result documents", "查看结果文档"),
    },
    invoice: {
      title: t(
        "발행된 청구 내역을 확인해 주세요",
        "Review your issued invoice",
        "请查看已出具的账单",
      ),
      description: t(
        "캠페인 완료와 입금 확인은 별도로 관리됩니다. 금액·납부 기한과 입금 확인 상태를 확인해 주세요.",
        "Campaign completion and payment confirmation are tracked separately. Check the amount, due date and payment status.",
        "活动完成与收款确认分别管理，请确认金额、付款期限及收款状态。",
      ),
      action: t("청구 확인", "View invoice", "查看账单"),
    },
    settling: {
      title: t(
        "Futures가 청구 정보를 정리하고 있습니다",
        "Futures is preparing billing details",
        "Futures 正在整理账单信息",
      ),
      description: t(
        "확인된 집행 결과를 바탕으로 청구 내역을 준비합니다. 발행된 내용은 청구 탭에서 확인할 수 있습니다.",
        "Billing is being prepared from confirmed results. Issued invoices are available in Billing.",
        "将根据已确认的执行结果准备账单，已出具账单可在账单页签查看。",
      ),
      action: t("청구 탭 보기", "Open Billing", "查看账单页签"),
    },
    reply: {
      title: t(
        "요청한 자료 또는 답변이 필요합니다",
        "A reply or additional materials are needed",
        "需要回复或补充资料",
      ),
      description: t(
        "Futures가 남긴 질문과 자료 요청을 확인해 주세요. 요청함에서 회신과 파일을 전달할 수 있습니다.",
        "Check the questions from Futures. Reply and share files in the request thread.",
        "请查看 Futures 的问题，您可以在请求详情中回复并发送文件。",
      ),
      action: t("보완 요청 확인", "View requested updates", "查看补充要求"),
    },
    "proposal-review": {
      title: t(
        "공식 제안이 도착했습니다",
        "Your official proposal is ready",
        "正式提案已送达",
      ),
      description: t(
        "Futures가 선정한 크리에이터와 제작 조건·제안가를 확인해 주세요. 승인 또는 수정 요청은 제안 탭에서 진행합니다.",
        "Review the selected creators, deliverables and price. Approvals and change requests are handled in the proposal tab.",
        "请查看已选定达人、制作条件及报价，并在提案页签中批准或请求修改。",
      ),
      action: t("공식 제안 확인", "View proposal", "查看正式提案"),
    },
    "proposal-expired": {
      title: t(
        "제안의 유효기한이 지났습니다",
        "The proposal has expired",
        "提案有效期已过",
      ),
      description: t(
        "이전 조건으로 새 승인할 수 없습니다. Futures에 일정과 조건의 재확인을 요청해 주세요.",
        "New approvals are unavailable for expired terms. Ask Futures to reconfirm the schedule and conditions.",
        "无法按过期条件进行新审批，请联系 Futures 重新确认时间和条件。",
      ),
      action: t("제안 내용 보기", "View proposal details", "查看提案内容"),
    },
    "proposal-revision": {
      title: t(
        "Futures가 제안 변경을 검토하고 있습니다",
        "Futures is reviewing proposal changes",
        "Futures 正在审核提案修改",
      ),
      description: t(
        "전달한 의견에 맞춰 구성과 조건을 다시 확인합니다. 새 제안이 공유되면 변경 내용을 확인할 수 있습니다.",
        "The lineup and terms are being reviewed against your feedback. Review changes once the updated proposal is shared.",
        "将根据您的意见重新确认组合与条件，新提案共享后可查看修改内容。",
      ),
      action: t("제안·의견 보기", "View proposal & feedback", "查看提案与意见"),
    },
    "content-review": {
      title: t(
        "공유된 콘텐츠를 검토해 주세요",
        "Review the shared content",
        "请审核共享内容",
      ),
      description: t(
        "Futures의 확인을 거친 제작물이 준비되었습니다. 공개된 버전을 확인하고 승인하거나 수정 의견을 남겨 주세요.",
        "Content reviewed by Futures is ready. Review the shared version and approve it or request changes.",
        "Futures 审核后的内容已就绪，请查看共享版本并批准或提出修改意见。",
      ),
      action: t("콘텐츠 검수", "Open content review", "审核内容"),
    },
    "content-revision": {
      title: t(
        "요청한 수정 사항을 반영하고 있습니다",
        "Requested changes are being applied",
        "正在落实修改要求",
      ),
      description: t(
        "제작 과정에서 의견을 반영 중입니다. Futures가 확인한 수정본이 준비되면 다시 검토할 수 있습니다.",
        "Feedback is being incorporated during production. The revised version will be available after Futures reviews it.",
        "制作过程中正在落实意见，Futures 审核修改版本后可再次查看。",
      ),
      action: t("제작 진행 보기", "View production", "查看制作进度"),
    },
    "futures-review": {
      title: t(
        "Futures가 제작물을 확인하고 있습니다",
        "Futures is reviewing the content",
        "Futures 正在审核制作内容",
      ),
      description: t(
        "제출된 제작물의 조건과 내용을 확인하고 있습니다. 브랜드 검토가 필요한 버전은 확인 후 공유됩니다.",
        "Submitted content is being checked against the brief. Versions needing your review will be shared after this check.",
        "正在按需求检查提交内容，需要品牌审核的版本将在确认后共享。",
      ),
      action: t("제작 진행 보기", "View production", "查看制作进度"),
    },
    production: {
      title: t(
        "승인된 구성으로 콘텐츠를 제작하고 있습니다",
        "Content is being produced from the approved plan",
        "正在按批准方案制作内容",
      ),
      description: t(
        "제작진이 콘텐츠를 준비하고 있습니다. 검토할 제작물이 공유되면 홈의 처리할 일에도 표시됩니다.",
        "The production team is preparing content. Shared items needing review will also appear in your home action list.",
        "制作团队正在准备内容，需要审核的共享内容也将显示在首页待处理事项。",
      ),
      action: t("제작 일정 확인", "View production schedule", "查看制作日程"),
    },
    "production-setup": {
      title: t(
        "Futures가 제작을 준비하고 있습니다",
        "Futures is preparing production",
        "Futures 正在准备制作",
      ),
      description: t(
        "확정된 구성과 일정에 따라 제작 업무를 연결하고 있습니다. 공개된 제작 항목은 제작·검수 탭에서 확인할 수 있습니다.",
        "Production work is being organized around the confirmed plan and schedule. Shared items appear in Production & review.",
        "正在根据确定的方案及日程安排制作，共享项目可在制作与审核页签查看。",
      ),
      action: t("제작·검수 보기", "Open Production & review", "查看制作与审核"),
    },
    "reporting-review": {
      title: t(
        "게시 결과와 성과를 확인할 수 있습니다",
        "Published results are available",
        "可查看发布结果与成效",
      ),
      description:
        campaign.reportingSummary.pending > 0
          ? t(
              "공개된 성과와 추가 업데이트가 함께 진행 중입니다. 보고서별 집계 시점과 공개 버전을 확인해 주세요.",
              "Published reports are available while updates continue. Check each report’s measurement date and released version.",
              "已公开报告可查看，同时仍在更新，请确认各报告的统计时间和公开版本。",
            )
          : t(
              "Futures가 공개한 게시 결과와 성과를 확인해 주세요. 캠페인 완료는 최종 확인 후 별도로 표시됩니다.",
              "Review results released by Futures. Campaign completion is recorded separately after the final check.",
              "请查看 Futures 公开的发布结果与成效，活动将在最终确认后另行标记完成。",
            ),
      action: t("성과 확인", "View results", "查看成效"),
    },
    reporting: {
      title: t(
        "게시 결과와 성과를 준비하고 있습니다",
        "Publication results are being prepared",
        "正在准备发布结果与成效",
      ),
      description: t(
        "게시 내역과 집계 자료를 확인하는 단계입니다. Futures가 공개한 결과가 준비되면 성과 탭에 표시됩니다.",
        "Publication records and measurements are being checked. Results appear once Futures releases them.",
        "正在确认发布记录与统计资料，Futures 公开后将显示在成效页签。",
      ),
      action: t("성과 탭 보기", "Open Results", "查看成效页签"),
    },
    sourcing: {
      title:
        campaign.type === "MANAGED"
          ? t(
              "Futures가 크리에이터를 섭외하고 있습니다",
              "Futures is sourcing creators",
              "Futures 正在邀约达人",
            )
          : t(
              "Futures가 협업 파트너를 모집하고 있습니다",
              "Futures is recruiting collaboration partners",
              "Futures 正在招募合作方",
            ),
      description: t(
        "요청 조건에 맞는 구성과 가용 일정을 확인 중입니다. 선정된 크리에이터 정보는 공식 제안이 발송되면 공개됩니다.",
        "The lineup and availability are being checked against your brief. Selected creator details are shared with the official proposal.",
        "正在根据需求确认组合及可用时间，选定达人信息将在正式提案发送后公开。",
      ),
      action: t("진행 문의하기", "Ask about progress", "咨询进度"),
    },
    intake: {
      title: t(
        "Futures가 요청 내용을 확인하고 있습니다",
        "Futures is reviewing your request",
        "Futures 正在确认请求",
      ),
      description: t(
        "예산·목표·일정을 검토하고 있습니다. 추가 자료가 필요하면 이 화면과 요청함에서 안내합니다.",
        "Your budget, goals and schedule are being reviewed. Requests for more information will appear here and in your inbox.",
        "正在审核预算、目标与时间安排，如需补充资料，将在此页面和请求中心通知。",
      ),
      action: t("요청 내용 문의", "Ask about your request", "咨询请求内容"),
    },
  };
  const current = content[progress.state];
  const currentIndex = stages.indexOf(progress.stage);
  const waitingRequests = detail.requests.filter(
    (request) => request.status === "WAITING_BRAND",
  );
  const linkedIntake = campaign.requestId
    ? detail.requests.find((request) => request.id === campaign.requestId)
    : null;
  const assignee =
    campaign.intakeAssigneeName || linkedIntake?.assigneeName || null;
  const currentHref = progress.href === basePath ? requestHref : progress.href;
  const facts = [
    {
      label: t("접수일", "Submitted", "提交日期"),
      value:
        dateLabel(campaign.submittedAt, locale) ??
        (draft
          ? t("아직 접수 전", "Not submitted", "尚未提交")
          : t(
              "접수일 미등록",
              "Submission date not recorded",
              "未登记提交日期",
            )),
    },
    {
      label: t("Futures 담당자", "Futures contact", "Futures 负责人"),
      value:
        assignee ??
        (draft
          ? t("접수 후 배정", "Assigned after submission", "提交后分配")
          : canceled || campaign.status === "COMPLETED"
            ? t("담당자 정보 없음", "No contact assigned", "无负责人信息")
            : t("담당자 배정 대기", "Awaiting assignment", "等待分配负责人")),
    },
    {
      label:
        campaign.type === "MANAGED"
          ? t("제안 예정", "Proposal due", "预计提案")
          : t("모집 마감", "Recruitment closes", "招募截止"),
      value:
        dateLabel(
          campaign.type === "MANAGED"
            ? campaign.proposalDueAt
            : campaign.applicationDeadline,
          locale,
        ) ?? t("일정 미지정", "Not scheduled", "未指定日程"),
    },
    {
      label: t("콘텐츠 마감", "Content deadline", "内容截止日期"),
      value:
        dateLabel(campaign.contentDeadline, locale) ??
        t("일정 미지정", "Not scheduled", "未指定日程"),
    },
  ];

  return (
    <section
      className={styles.progressPanel}
      aria-labelledby="campaign-progress-title"
    >
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.headingLine}>
            <Typography
              as="h2"
              variant="heading1"
              weight="bold"
              id="campaign-progress-title"
            >
              {t("캠페인 진행 상황", "Campaign progress", "活动进度")}
            </Typography>
            <span
              className={`${styles.phaseBadge} ${canceled ? styles.closedBadge : ""}`}
            >
              {canceled
                ? t("취소", "Canceled", "已取消")
                : labels[progress.stage]}
            </span>
          </div>
          <Typography as="p" variant="body2" className={styles.muted}>
            {t(
              "현재 진행 단계와 다음 확인할 내용을 안내합니다.",
              "Follow the current stage and your next step.",
              "查看当前阶段及下一步需要确认的内容。",
            )}
          </Typography>
        </div>
      </div>
      <ol
        className={styles.stageList}
        tabIndex={0}
        aria-label={t("캠페인 진행 순서", "Campaign workflow", "活动流程")}
      >
        {stages.map((stage, index) => (
          <li
            key={stage}
            className={
              !canceled && stage === progress.stage
                ? styles.currentStage
                : !canceled && index < currentIndex
                  ? styles.priorStage
                  : ""
            }
            aria-current={
              !canceled && stage === progress.stage ? "step" : undefined
            }
          >
            <span>{index + 1}</span>
            <strong>{labels[stage]}</strong>
          </li>
        ))}
      </ol>
      <div
        className={`${styles.nextAction} ${overdue ? styles.nextActionLate : ""}`}
      >
        <div className={styles.nextActionCopy}>
          <span className={styles.ownerLabel}>
            <UserRound size={15} />
            {ownerLabels[progress.owner]}
          </span>
          <Typography as="h3" variant="heading2" weight="bold">
            {current.title}
          </Typography>
          <Typography as="p" variant="body2">
            {current.description}
          </Typography>
          {progress.dueAt && (
            <div className={styles.currentDeadline}>
              <CalendarDays size={15} />
              <span>
                {progress.deadlineKind
                  ? deadlineLabels[progress.deadlineKind]
                  : t("처리 목표일", "Target date", "目标日期")}
              </span>
              <time dateTime={progress.dueAt}>
                {dateLabel(progress.dueAt, locale)}
              </time>
              {overdue && (
                <strong className={styles.overdue}>
                  {progress.owner === "brand"
                    ? t("기한 지남", "Overdue", "已逾期")
                    : t(
                        "일정 확인 필요",
                        "Schedule update needed",
                        "需确认日程",
                      )}
                </strong>
              )}
            </div>
          )}
        </div>
        {!(draft && !canManage) && (
          <Button
            as={Link}
            href={href(currentHref)}
            variant={progress.owner === "brand" ? undefined : "outlined"}
            color={progress.owner === "brand" ? undefined : "assistive"}
            size="medium"
            trailingContent={<ArrowRight size={16} />}
          >
            {current.action}
          </Button>
        )}
      </div>
      {progress.state === "proposal-expired" && (
        <p className={styles.expiryHelp}>
          <CircleAlert size={16} />
          {t(
            "변경이 필요한 일정이나 조건을 Futures에 전달해 주세요.",
            "Let Futures know if the schedule or terms need to change.",
            "如需修改时间或条件，请告知 Futures。",
          )}{" "}
          <Link href={href(requestHref)}>
            {t("재확인 요청", "Request reconfirmation", "请求重新确认")}
          </Link>
        </p>
      )}
      <dl className={styles.progressFacts}>
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {campaign.reviewNote && (
        <div className={styles.reviewNote}>
          <CircleAlert size={17} />
          <div>
            <strong>
              {t("Futures 안내", "Note from Futures", "Futures 说明")}
            </strong>
            <p>{campaign.reviewNote}</p>
          </div>
        </div>
      )}
      {waitingRequests.length > 0 && !canceled && (
        <div className={styles.waitingRequests}>
          <h3>
            <MessageSquare size={17} />
            {t(
              `회신·자료 보완이 필요한 요청 ${waitingRequests.length}건`,
              `${waitingRequests.length} requests need your reply`,
              `${waitingRequests.length} 项请求需要回复或补充资料`,
            )}
          </h3>
          <ul>
            {waitingRequests.map((request) => (
              <li key={request.id}>
                <Link
                  href={href(
                    `/advertiser/requests?request=${encodeURIComponent(request.id)}`,
                  )}
                >
                  <span>{request.title}</span>
                  <ArrowRight size={16} />
                </Link>
                {request.dueAt && (
                  <time
                    dateTime={request.dueAt}
                    className={
                      isPastBrandDeadline(request.dueAt, now)
                        ? styles.overdue
                        : ""
                    }
                  >
                    <Clock3 size={13} />
                    {t("처리 목표일", "Target date", "目标日期")}{" "}
                    {dateLabel(request.dueAt, locale)}
                  </time>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!campaign.latestProposal && !canceled && (
        <p className={styles.privacyNote}>
          <ShieldCheck size={15} />
          {t(
            "크리에이터의 이름과 채널은 Futures의 공식 제안이 발송된 후 이 캠페인 안에서 공개됩니다.",
            "Creator names and channels are shared within this campaign after Futures sends the official proposal.",
            "Futures 发出正式提案后，达人姓名及频道将在此活动内公开。",
          )}
        </p>
      )}
    </section>
  );
}
