"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  FolderOpen,
  Inbox,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import type {
  AgencyActivity,
  AgencyOperationsBootstrap,
  AgencyProject,
  AgencySettlement,
} from "../../lib/agency-operations-types";
import type { Locale } from "../_components/landing-copy";
import { ProfileSelect } from "../onboarding/brand/profile-select";
import { agencyText } from "./agency-workspace-copy";
import "./agency-operations.css";

type Section =
  | "projects"
  | "invitations"
  | "creator-projects"
  | "payments"
  | "organization"
  | "notifications";
type Props = {
  locale: Locale;
  section: Section;
  onExplore: () => void;
  onApplications: () => void;
};
type Translate = (en: string, ko: string, zh: string) => string;
const platformNames: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  twitch: "Twitch",
  x: "X",
  facebook: "Facebook",
};
const closedStatuses = ["COMPLETED", "CANCELED", "CANCELLED"];

function useText(locale: Locale): Translate {
  return (en, ko, zh) => agencyText(locale, en, ko, zh);
}
function displayDate(value: string | null, locale: Locale) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
function cents(value: string) {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value)) return 0n;
  const [whole, decimal = ""] = value.replace("-", "").split(".");
  return (
    (BigInt(whole!) * 100n + BigInt(decimal.padEnd(2, "0"))) *
    (value.startsWith("-") ? -1n : 1n)
  );
}
function money(value: string | null, currency: string, locale: Locale) {
  if (value === null) return "—";
  const minor = cents(value);
  const absolute = minor < 0n ? -minor : minor;
  const decimal =
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? ".";
  return `${currency} ${minor < 0n ? "−" : ""}${new Intl.NumberFormat(locale).format(absolute / 100n)}${decimal}${String(absolute % 100n).padStart(2, "0")}`;
}
function sumMoney(rows: AgencySettlement[]) {
  const totals = new Map<string, bigint>();
  for (const row of rows)
    totals.set(
      row.currency,
      (totals.get(row.currency) ?? 0n) + cents(row.netAmount),
    );
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, total]) => ({
      currency,
      value: `${total < 0n ? "-" : ""}${(total < 0n ? -total : total) / 100n}.${String((total < 0n ? -total : total) % 100n).padStart(2, "0")}`,
    }));
}
function statusText(value: string, t: Translate) {
  const values: Record<string, [string, string, string]> = {
    ACTIVE: ["Approved", "승인 완료", "已通过"],
    PENDING: ["Pending", "확인 대기", "待确认"],
    SUBMITTED: ["Submitted", "제출 완료", "已提交"],
    SHORTLISTED: ["Shortlisted", "검토 대상", "入围"],
    ACCEPTED: ["Accepted", "선정됨", "已录用"],
    REJECTED: ["Rejected", "반려", "已拒绝"],
    WITHDRAWN: ["Withdrawn", "철회됨", "已撤回"],
    DRAFT: ["Draft", "초안", "草稿"],
    REVISION_REQUESTED: ["Revision requested", "수정 요청", "需修改"],
    APPROVED: ["Approved", "승인됨", "已批准"],
    PUBLISHED: ["Published", "게시 완료", "已发布"],
    VERIFIED: ["Verified", "검증 완료", "已核验"],
    RECRUITING: ["Recruiting", "모집 중", "招募中"],
    IN_PROGRESS: ["In progress", "진행 중", "进行中"],
    COMPLETED: ["Completed", "완료", "已完成"],
    CANCELED: ["Canceled", "취소됨", "已取消"],
    CANCELLED: ["Canceled", "취소됨", "已取消"],
    REQUESTED: ["Requested", "정산 요청", "已申请"],
    PROCESSING: ["Processing", "처리 중", "处理中"],
    PAID: ["Paid", "지급 완료", "已支付"],
  };
  return values[value] ? t(...values[value]) : value;
}
function safeUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function AgencyOperations({
  locale,
  section,
  onExplore,
  onApplications,
}: Props) {
  const t = useText(locale);
  const [data, setData] = useState<AgencyOperationsBootstrap | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/agency/operations", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setError(result.code || "UNAVAILABLE");
          setData(null);
        } else if (
          !result.organization ||
          !Array.isArray(result.projects) ||
          !Array.isArray(result.settlements) ||
          !Array.isArray(result.activity)
        ) {
          setError("UNAVAILABLE");
          setData(null);
        } else {
          setData(result);
          setError("");
        }
      })
      .catch((error) => {
        if (
          !controller.signal.aborted &&
          !(error instanceof Error && error.name === "AbortError")
        ) {
          setError("UNAVAILABLE");
          setData(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [request]);
  function reload() {
    setLoading(true);
    setError("");
    setRequest((value) => value + 1);
  }
  return (
    <div className="aop">
      <div className="aop-toolbar">
        <p className="aop-muted">
          {section === "notifications"
            ? t(
                "Recent activity from your workspace",
                "우리 조직의 최근 활동",
                "组织最近活动",
              )
            : t(
                "Your organization's workspace records",
                "우리 조직의 실제 운영 내역",
                "组织工作区记录",
              )}
        </p>
        <button
          type="button"
          className="aop-button"
          onClick={reload}
          disabled={loading}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {t("Refresh", "새로고침", "刷新")}
        </button>
      </div>
      {loading && (
        <p className="aop-loading" role="status">
          {t("Loading records…", "내역을 불러오는 중…", "正在加载记录…")}
        </p>
      )}
      {error && (
        <div className="aop-error" role="alert">
          <p>
            {error === "APPROVAL_REQUIRED"
              ? t(
                  "Organization approval is required to view these records.",
                  "조직 승인 후 운영 내역을 확인할 수 있습니다.",
                  "组织获批后可查看运营记录。",
                )
              : error === "UNAUTHORIZED"
                ? t(
                    "Please log in again to continue.",
                    "다시 로그인해 주세요.",
                    "请重新登录。",
                  )
                : t(
                    "We couldn't load these records. Please try again.",
                    "내역을 불러오지 못했습니다. 다시 시도해 주세요.",
                    "无法加载记录，请重试。",
                  )}
          </p>
          {error === "UNAUTHORIZED" ? (
            <Link className="aop-button" href={`/login?lang=${locale}`}>
              {t("Log in", "로그인", "登录")}
            </Link>
          ) : (
            <button className="aop-button" onClick={reload} type="button">
              {t("Try again", "다시 시도", "重试")}
            </button>
          )}
        </div>
      )}
      {data && !error && (
        <div aria-busy={loading}>
          <OperationSection
            key={section}
            section={section}
            data={data}
            locale={locale}
            onExplore={onExplore}
            onApplications={onApplications}
            onRefresh={reload}
          />
        </div>
      )}
    </div>
  );
}

function OperationSection({
  section,
  data,
  locale,
  onExplore,
  onApplications,
  onRefresh,
}: Props & { data: AgencyOperationsBootstrap; onRefresh: () => void }) {
  if (section === "invitations")
    return <Invitations locale={locale} onExplore={onExplore} />;
  if (section === "payments") return <Payments data={data} locale={locale} />;
  if (section === "organization")
    return <Organization data={data} locale={locale} />;
  if (section === "notifications")
    return <Activity data={data} locale={locale} />;
  return (
    <Projects
      data={data}
      locale={locale}
      creatorView={section === "creator-projects"}
      onExplore={onExplore}
      onApplications={onApplications}
      onRefresh={onRefresh}
    />
  );
}

function Tabs({
  label,
  options,
  value,
  onChange,
  children,
}: {
  label: string;
  options: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <>
      <div className="aop-tabs" role="tablist" aria-label={label}>
        {options.map((option, index) => (
          <button
            key={option.value}
            id={`${id}-${option.value}`}
            type="button"
            role="tab"
            aria-selected={value === option.value}
            aria-controls={`${id}-panel`}
            tabIndex={value === option.value ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight")
                next = (index + 1) % options.length;
              else if (event.key === "ArrowLeft")
                next = (index + options.length - 1) % options.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = options.length - 1;
              else return;
              event.preventDefault();
              onChange(options[next]!.value);
              document.getElementById(`${id}-${options[next]!.value}`)?.focus();
            }}
          >
            {option.label}
            {option.count !== undefined && <span>{option.count}</span>}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${value}`}
      >
        {children}
      </div>
    </>
  );
}
function Empty({
  title,
  body,
  children,
  icon = "folder",
}: {
  title: string;
  body?: string;
  children?: ReactNode;
  icon?: "folder" | "inbox" | "wallet";
}) {
  const Icon =
    icon === "inbox" ? Inbox : icon === "wallet" ? Wallet : FolderOpen;
  return (
    <div className="aop-empty">
      <Icon size={32} strokeWidth={1.5} aria-hidden="true" />
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      {children}
    </div>
  );
}
function Table({
  headers,
  children,
  empty,
}: {
  headers: string[];
  children?: ReactNode;
  empty?: ReactNode;
}) {
  return (
    <div className="aop-table-scroll" tabIndex={0}>
      <table className="aop-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children || (
            <tr>
              <td colSpan={headers.length}>{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function DateFilters({
  start,
  end,
  onStart,
  onEnd,
  locale,
  label,
}: {
  start: string;
  end: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  locale: Locale;
  label: string;
}) {
  const t = useText(locale);
  return (
    <fieldset className="aop-date-filter">
      <legend>{label} (UTC)</legend>
      <label>
        <span className="aop-sr-only">{t("From", "시작일", "开始日期")}</span>
        <input
          type="date"
          value={start}
          max={end || undefined}
          onChange={(event) => onStart(event.target.value)}
        />
      </label>
      <span aria-hidden="true">–</span>
      <label>
        <span className="aop-sr-only">{t("To", "종료일", "结束日期")}</span>
        <input
          type="date"
          value={end}
          min={start || undefined}
          onChange={(event) => onEnd(event.target.value)}
        />
      </label>
    </fieldset>
  );
}
function withinDate(value: string, start: string, end: string) {
  const day = value.slice(0, 10);
  return (
    (!start || day >= start) &&
    (!end || day <= end) &&
    !(start && end && start > end)
  );
}
function DateError({
  start,
  end,
  locale,
}: {
  start: string;
  end: string;
  locale: Locale;
}) {
  return start && end && start > end ? (
    <p className="aop-error-text" role="alert">
      {agencyText(
        locale,
        "The end date must be on or after the start date.",
        "종료일은 시작일 이후여야 합니다.",
        "结束日期不能早于开始日期。",
      )}
    </p>
  ) : null;
}
function Demo({ show, t }: { show: boolean; t: Translate }) {
  return show ? (
    <span className="aop-demo">{t("Demo", "예시", "示例")}</span>
  ) : null;
}

function Invitations({
  locale,
  onExplore,
}: {
  locale: Locale;
  onExplore: () => void;
}) {
  const t = useText(locale);
  const [tab, setTab] = useState("all");
  const options = [
    { value: "all", label: t("All", "전체", "全部") },
    {
      value: "pending",
      label: t("Awaiting confirmation", "확인 대기", "待确认"),
    },
    {
      value: "brand",
      label: t("Awaiting brand", "브랜드 확인 대기", "品牌待确认"),
    },
    { value: "rejected", label: t("Rejected", "거절", "已拒绝") },
    { value: "expired", label: t("Expired", "만료", "已过期") },
    {
      value: "stopped",
      label: t("Stopped by brand", "브랜드 중단", "品牌已停止"),
    },
    { value: "progress", label: t("In progress", "진행 중", "进行中") },
  ];
  return (
    <section className="aop-panel">
      <Tabs
        label={t("Invitation status", "초대 상태", "邀请状态")}
        options={options}
        value={tab}
        onChange={setTab}
      >
        <Table
          headers={[
            t("Campaign", "캠페인", "活动"),
            t("Platform account", "플랫폼 계정", "平台账号"),
            t("Deliverable", "제작물", "交付内容"),
            t("Deadline", "마감일", "截止日期"),
            t("Settlement method", "정산 방식", "结算方式"),
            t("Offer amount", "제안 금액", "报价"),
            t("Status", "상태", "状态"),
            t("Invited", "초대일", "邀请日期"),
            t("Actions", "작업", "操作"),
          ]}
          empty={
            <Empty
              icon="inbox"
              title={t(
                "Invitations are coming soon",
                "초대 기능을 준비 중입니다",
                "邀请功能即将上线",
              )}
              body={t(
                "Direct invitations are not connected yet. You can apply to published campaigns today.",
                "지정 초대는 아직 연결되지 않았습니다. 공개 캠페인은 직접 신청할 수 있습니다.",
                "定向邀请暂未接入，您可以申请已发布的活动。",
              )}
            >
              {" "}
              <button
                className="aop-button aop-primary"
                type="button"
                onClick={onExplore}
              >
                {t("Browse campaigns", "캠페인 찾기", "浏览活动")}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </Empty>
          }
        />
      </Tabs>
    </section>
  );
}

function Projects({
  data,
  locale,
  creatorView,
  onExplore,
  onApplications,
  onRefresh,
}: {
  data: AgencyOperationsBootstrap;
  locale: Locale;
  creatorView: boolean;
  onExplore: () => void;
  onApplications: () => void;
  onRefresh: () => void;
}) {
  const t = useText(locale);
  const [tab, setTab] = useState("active");
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [progress, setProgress] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const projects = data.projects.filter(
    (project) =>
      (tab === "closed") === closedStatuses.includes(project.campaignStatus),
  );
  const filtered = projects.filter(
    (project) =>
      project.campaignTitle
        .toLowerCase()
        .includes(query.toLowerCase().trim()) &&
      (!platform || project.platforms.includes(platform)) &&
      (!progress || (project.submissions[0]?.status ?? "NONE") === progress) &&
      withinDate(project.createdAt, start, end),
  );
  const options = [
    {
      value: "active",
      label: t("Active", "진행 중", "进行中"),
      count: data.projects.filter(
        (project) => !closedStatuses.includes(project.campaignStatus),
      ).length,
    },
    {
      value: "closed",
      label: t("Completed / closed", "완료 / 종료", "已完成 / 结束"),
      count: data.projects.filter((project) =>
        closedStatuses.includes(project.campaignStatus),
      ).length,
    },
  ];
  return (
    <section className="aop-panel">
      <div className="aop-panel-intro">
        <p>
          {creatorView
            ? t(
                "Submission records are tracked per application, not per creator. Creator account assignments are not connected yet.",
                "제출 내역은 신청 건별 기록입니다. 크리에이터별 계정·제작 업무 배정은 아직 연결되지 않았습니다.",
                "交付记录按申请记录管理，尚未接入达人账号与任务分配。",
              )
            : t(
                "Campaigns where your organization has been selected.",
                "우리 조직이 선정된 캠페인입니다.",
                "组织已获选的活动。",
              )}
        </p>
        <button
          type="button"
          className="aop-text-button"
          onClick={onApplications}
        >
          {t("Application history", "신청 내역", "申请记录")}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
      <Tabs
        label={t("Project status", "프로젝트 상태", "项目状态")}
        options={options}
        value={tab}
        onChange={setTab}
      >
        <div className="aop-filters">
          <label className="aop-search">
            <Search size={17} aria-hidden="true" />
            <span className="aop-sr-only">
              {t("Search campaigns", "캠페인 검색", "搜索活动")}
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("Search campaigns", "캠페인 검색", "搜索活动")}
            />
          </label>
          <ProfileSelect
            id="aop-project-platform"
            label={t("Platform", "플랫폼", "平台")}
            placeholder={t("All platforms", "전체 플랫폼", "全部平台")}
            value={platform}
            onChange={setPlatform}
            options={[
              {
                value: "",
                label: t("All platforms", "전체 플랫폼", "全部平台"),
              },
              ...Object.entries(platformNames).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
          <ProfileSelect
            id="aop-project-progress"
            label={t("Submission status", "제출 상태", "交付状态")}
            placeholder={t("All statuses", "전체 상태", "全部状态")}
            value={progress}
            onChange={setProgress}
            options={[
              { value: "", label: t("All statuses", "전체 상태", "全部状态") },
              {
                value: "NONE",
                label: t("No submission", "제출 내역 없음", "暂无交付"),
              },
              ...[
                "DRAFT",
                "SUBMITTED",
                "REVISION_REQUESTED",
                "APPROVED",
                "PUBLISHED",
                "VERIFIED",
              ].map((value) => ({ value, label: statusText(value, t) })),
            ]}
          />
          <DateFilters
            start={start}
            end={end}
            onStart={setStart}
            onEnd={setEnd}
            locale={locale}
            label={t("Application date", "신청일", "申请日期")}
          />
        </div>
        <DateError start={start} end={end} locale={locale} />
        <Table
          headers={[
            t("Campaign", "캠페인", "活动"),
            t("Platform / account", "플랫폼 / 계정", "平台 / 账号"),
            t("Deliverable", "제작물", "交付内容"),
            t("Settlement method", "정산 방식", "结算方式"),
            t("Proposed amount", "제안 금액", "提案金额"),
            t("Progress", "진행 상태", "进度"),
            t("Applied", "신청일", "申请日期"),
            t("Content deadline", "제작 마감", "交付截止"),
            t("Details", "상세", "详情"),
          ]}
          empty={
            <Empty
              title={
                data.projects.length
                  ? t(
                      "No projects match these filters",
                      "조건에 맞는 프로젝트가 없습니다",
                      "没有符合条件的项目",
                    )
                  : t(
                      "No selected projects yet",
                      "아직 선정된 프로젝트가 없습니다",
                      "暂无获选项目",
                    )
              }
              body={t(
                "Selected campaigns and their submission records will appear here.",
                "선정된 캠페인과 제출 내역이 이곳에 표시됩니다.",
                "获选活动与交付记录将显示在这里。",
              )}
            >
              {!data.projects.length && (
                <button
                  type="button"
                  className="aop-button aop-primary"
                  onClick={onExplore}
                >
                  {t("Browse campaigns", "캠페인 찾기", "浏览活动")}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </Empty>
          }
        >
          {filtered.length
            ? filtered.map((project) => (
                <tr key={project.id}>
                  <td className="aop-campaign">
                    <strong>{project.campaignTitle}</strong>
                    <Demo show={project.isDemo} t={t} />
                    <span className="aop-muted">
                      {statusText(project.campaignStatus, t)}
                    </span>
                  </td>
                  <td>
                    {project.platforms
                      .map((value) => platformNames[value] ?? value)
                      .join(", ") || "—"}
                    <span className="aop-muted aop-block">
                      {t("Account not assigned", "계정 미배정", "未分配账号")}
                    </span>
                  </td>
                  <td>
                    {project.submissions.length
                      ? t(
                          `${project.submissions.length} recent versions`,
                          `최근 ${project.submissions.length}개 버전`,
                          `最近 ${project.submissions.length} 个版本`,
                        )
                      : "—"}
                  </td>
                  <td className="aop-muted">
                    {t("Not specified", "미등록", "未指定")}
                  </td>
                  <td className="aop-money">
                    {money(project.proposedAmount, project.currency, locale)}
                  </td>
                  <td>
                    <span className="aop-status">
                      {project.submissions[0]
                        ? statusText(project.submissions[0].status, t)
                        : t("No submission", "제출 내역 없음", "暂无交付")}
                    </span>
                  </td>
                  <td className="aop-date-cell">
                    {displayDate(project.createdAt, locale)}
                  </td>
                  <td className="aop-date-cell">
                    {displayDate(project.contentDeadline, locale)}
                  </td>
                  <td>
                    <ProjectDetails
                      project={project}
                      locale={locale}
                      canSubmit={data.capabilities.contentSubmission}
                      onRefresh={onRefresh}
                    />
                  </td>
                </tr>
              ))
            : null}
        </Table>
        {data.projects.length >= data.limits.projects && (
          <p className="aop-footnote">
            {t(
              `Showing up to ${data.limits.projects} recent projects.`,
              `최근 프로젝트 최대 ${data.limits.projects}건을 표시합니다.`,
              `最多显示最近 ${data.limits.projects} 个项目。`,
            )}
          </p>
        )}
      </Tabs>
    </section>
  );
}

function ProjectDetails({
  project,
  locale,
  canSubmit,
  onRefresh,
}: {
  project: AgencyProject;
  locale: Locale;
  canSubmit: boolean;
  onRefresh: () => void;
}) {
  const t = useText(locale);
  return (
    <details className="aop-details">
      <summary>{t("View", "보기", "查看")}</summary>
      <div className="aop-detail-body">
        <h3>{project.campaignTitle}</h3>
        <p>
          {t("Selected creators", "선정 크리에이터", "获选达人")}:{" "}
          {project.creators.length
            ? project.creators.map((creator) => creator.displayName).join(", ")
            : t("Not assigned", "미배정", "未分配")}
        </p>
        {project.submissions.length ? (
          project.submissions.map((submission) => (
            <div className="aop-submission" key={submission.id}>
              <strong>
                {t("Version", "버전", "版本")} {submission.version} ·{" "}
                {statusText(submission.status, t)}
              </strong>
              <p>
                {displayDate(
                  submission.submittedAt ?? submission.updatedAt,
                  locale,
                )}
              </p>
              {submission.reviewNotes && (
                <p className="aop-pre-line">{submission.reviewNotes}</p>
              )}
              <div className="aop-inline">
                {safeUrl(submission.draftUrl) && (
                  <a
                    href={safeUrl(submission.draftUrl)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("Draft link", "초안 링크", "草稿链接")}
                  </a>
                )}
                {safeUrl(submission.publishedUrl) && (
                  <a
                    href={safeUrl(submission.publishedUrl)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("Published content", "게시된 콘텐츠", "已发布内容")}
                  </a>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="aop-muted">
            {t(
              "No content has been submitted yet.",
              "아직 제출된 콘텐츠가 없습니다.",
              "暂无交付记录。",
            )}
          </p>
        )}
        {canSubmit &&
        ["RECRUITING", "IN_PROGRESS", "VERIFYING", "SETTLING"].includes(
          project.campaignStatus,
        ) ? (
          <ContentSubmissionForm
            key={project.submissions[0]?.updatedAt ?? "first"}
            project={project}
            locale={locale}
            onSaved={onRefresh}
          />
        ) : null}
      </div>
    </details>
  );
}

function ContentSubmissionForm({
  project,
  locale,
  onSaved,
}: {
  project: AgencyProject;
  locale: Locale;
  onSaved: () => void;
}) {
  const t = useText(locale);
  const id = useId();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const latest = project.submissions[0];
  const publish = latest?.status === "APPROVED";
  const available =
    !latest ||
    ["DRAFT", "REVISION_REQUESTED", "APPROVED"].includes(latest.status);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/agency/content-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: publish ? "publishContent" : "submitDraft",
          applicationId: project.id,
          expectedSubmissionId: latest?.id ?? null,
          expectedUpdatedAt: latest?.updatedAt ?? null,
          url,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(
          result.code === "CONFLICT"
            ? t(
                "This record changed. Refresh and try again.",
                "내역이 변경되었습니다. 새로고침 후 다시 제출해 주세요.",
                "记录已更新，请刷新后重试。",
              )
            : result.code === "INVALID_STATE" || result.code === "LOCKED"
              ? t(
                  "This submission is currently locked for review.",
                  "현재 상태에서는 제출할 수 없습니다. 검토 상태를 확인해 주세요.",
                  "当前状态无法提交，请检查审核状态。",
                )
              : t(
                  "Unable to submit. Check the HTTPS link and your permissions, then try again.",
                  "제출하지 못했습니다. HTTPS 링크와 권한을 확인한 후 다시 시도해 주세요.",
                  "无法提交，请检查 HTTPS 链接和权限后重试。",
                ),
        );
        return;
      }
      onSaved();
    } catch {
      setError(
        t(
          "Connection failed. Please try again.",
          "연결에 실패했습니다. 다시 시도해 주세요.",
          "连接失败，请重试。",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  if (!available)
    return (
      <p className="aop-muted">
        {latest?.status === "VERIFIED"
          ? t(
              "Content verification is complete.",
              "콘텐츠 검증이 완료되었습니다.",
              "内容核验已完成。",
            )
          : t(
              "Your submission is under review. A new version can be submitted after a revision request.",
              "제출 내용을 검토 중입니다. 수정 요청을 받으면 새 버전을 제출할 수 있습니다.",
              "交付内容正在审核，收到修改要求后可提交新版本。",
            )}
      </p>
    );
  return (
    <form className="aop-submit-form" onSubmit={submit} aria-busy={busy}>
      <label htmlFor={id}>
        {publish
          ? t("Published content URL", "게시물 링크", "已发布内容链接")
          : t("Draft content URL", "콘텐츠 초안 링크", "内容草稿链接")}
      </label>
      <p>
        {publish
          ? t(
              "Submit the published link for final verification after your draft is approved.",
              "승인된 초안의 게시물 링크를 제출하면 운영팀이 최종 검증합니다.",
              "提交已获批草稿的发布链接以完成最终核验。",
            )
          : t(
              "Share an HTTPS link that the operations team can open. File upload is not provided here.",
              "운영팀이 열람할 수 있는 HTTPS 링크를 입력하세요. 이 화면은 파일 업로드가 아닌 링크 제출 방식입니다.",
              "请输入运营团队可访问的 HTTPS 链接。此页面不提供文件上传。",
            )}
      </p>
      <input
        id={id}
        type="url"
        pattern="https://.*"
        required
        maxLength={2048}
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://…"
        disabled={busy}
      />
      {error ? (
        <p className="aop-error-text" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="aop-button aop-primary" disabled={busy}>
        {busy
          ? t("Submitting…", "제출 중…", "提交中…")
          : publish
            ? t("Submit published link", "게시물 검증 요청", "申请发布核验")
            : t("Submit draft", "초안 제출", "提交草稿")}
      </button>
    </form>
  );
}

function Payments({
  data,
  locale,
}: {
  data: AgencyOperationsBootstrap;
  locale: Locale;
}) {
  const t = useText(locale);
  const [tab, setTab] = useState("pending");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [currency, setCurrency] = useState("");
  const groups = {
    pending: ["PENDING", "REQUESTED", "REJECTED"],
    confirmed: ["APPROVED", "PROCESSING"],
    paid: ["PAID"],
  };
  const real = data.settlements.filter(
    (row) => !row.isDemo && row.status !== "REJECTED",
  );
  const totals = sumMoney(real);
  const balances = sumMoney(
    real.filter((row) => groups.confirmed.includes(row.status)),
  );
  const rows = data.settlements.filter(
    (row) =>
      groups[tab as keyof typeof groups].includes(row.status) &&
      withinDate(row.createdAt, start, end) &&
      (!currency || row.currency === currency),
  );
  const options = [
    { value: "pending", label: t("Unsettled", "미지급", "未结算") },
    { value: "confirmed", label: t("Confirmed", "정산 확정", "已确认") },
    { value: "paid", label: t("Paid", "지급 완료", "已支付") },
  ].map((option) => ({
    ...option,
    count: data.settlements.filter((row) =>
      groups[option.value as keyof typeof groups].includes(row.status),
    ).length,
  }));
  return (
    <>
      <div className="aop-balances">
        {[
          {
            title: t("Recorded net total", "순 정산 총액", "净结算总额"),
            caption: t(
              "All non-rejected records, including paid amounts",
              "지급 완료 포함 · 반려 내역 제외",
              "包含已支付金额，不含已拒绝记录",
            ),
            values: totals,
          },
          {
            title: t(
              "Confirmed unpaid balance",
              "확정 미지급 잔액",
              "已确认未支付余额",
            ),
            caption: t(
              "Approved and processing settlements",
              "승인 및 처리 중인 정산 내역",
              "已批准及处理中的结算记录",
            ),
            values: balances,
          },
        ].map((card) => (
          <section className="aop-balance" key={card.title}>
            <span>{card.title}</span>
            <div>
              {card.values.length ? (
                card.values.map((total) => (
                  <strong key={total.currency}>
                    {money(total.value, total.currency, locale)}
                  </strong>
                ))
              ) : (
                <strong>—</strong>
              )}
            </div>
            <p>{card.caption}</p>
          </section>
        ))}
      </div>
      <div className="aop-toolbar aop-payment-note">
        <p className="aop-muted">
          {t(
            "Currency totals are separate. Demo records are excluded. Withdrawals are not connected.",
            "통화별로 집계하며 예시 내역은 제외합니다. 실제 출금 기능은 아직 연결되지 않았습니다.",
            "各币种分别汇总，不含示例记录，提现功能尚未接入。",
          )}
        </p>
        <button
          type="button"
          className="aop-button"
          disabled
          aria-describedby="aop-withdraw-note"
        >
          {t("Withdraw", "출금", "提现")}
        </button>
      </div>
      <p id="aop-withdraw-note" className="aop-sr-only">
        {t(
          "Withdrawals are not available yet.",
          "아직 출금할 수 없습니다.",
          "暂不支持提现。",
        )}
      </p>
      <section className="aop-panel">
        <Tabs
          label={t("Settlement status", "정산 상태", "结算状态")}
          options={options}
          value={tab}
          onChange={setTab}
        >
          <div className="aop-filters aop-payment-filters">
            <DateFilters
              start={start}
              end={end}
              onStart={setStart}
              onEnd={setEnd}
              locale={locale}
              label={t("Record date", "정산 등록일", "记录日期")}
            />
            <ProfileSelect
              id="aop-payment-currency"
              label={t("Currency", "통화", "币种")}
              placeholder={t("All currencies", "전체 통화", "所有币种")}
              value={currency}
              onChange={setCurrency}
              options={[
                {
                  value: "",
                  label: t("All currencies", "전체 통화", "所有币种"),
                },
                ...["USD", "KRW", "CNY"].map((value) => ({
                  value,
                  label: value,
                })),
              ]}
            />
          </div>
          <DateError start={start} end={end} locale={locale} />
          <Table
            headers={[
              t("Campaign", "캠페인", "活动"),
              t("Gross amount", "총액", "总额"),
              t("Platform fee", "플랫폼 수수료", "平台费"),
              t("Withholding", "원천징수", "代扣金额"),
              t("Net amount", "순 정산액", "净额"),
              t("Status", "상태", "状态"),
              t("Recorded", "등록일", "记录日期"),
              t("Paid on", "지급일", "支付日期"),
            ]}
            empty={
              <Empty
                icon="wallet"
                title={t(
                  "No settlement records",
                  "정산 내역이 없습니다",
                  "暂无结算记录",
                )}
                body={t(
                  "Recorded settlements will appear here when available.",
                  "정산 내역이 등록되면 이곳에서 확인할 수 있습니다.",
                  "结算记录生成后将在此显示。",
                )}
              />
            }
          >
            {rows.length
              ? rows.map((row) => (
                  <tr key={row.id}>
                    <td className="aop-campaign">
                      <strong>{row.campaignTitle}</strong>
                      <Demo show={row.isDemo} t={t} />
                    </td>
                    <td className="aop-money">
                      {money(row.grossAmount, row.currency, locale)}
                    </td>
                    <td className="aop-money">
                      {money(row.platformFeeAmount, row.currency, locale)}
                    </td>
                    <td className="aop-money">
                      {money(row.withholdingAmount, row.currency, locale)}
                    </td>
                    <td className="aop-money">
                      <strong>
                        {money(row.netAmount, row.currency, locale)}
                      </strong>
                    </td>
                    <td>
                      <span className="aop-status">
                        {statusText(row.status, t)}
                      </span>
                    </td>
                    <td className="aop-date-cell">
                      {displayDate(row.createdAt, locale)}
                    </td>
                    <td className="aop-date-cell">
                      {displayDate(row.paidAt, locale)}
                    </td>
                  </tr>
                ))
              : null}
          </Table>
          {data.settlements.length >= data.limits.settlements && (
            <p className="aop-footnote">
              {t(
                `Totals cover the latest ${data.limits.settlements} loaded records, not a lifetime ledger.`,
                `합계는 조회된 최근 ${data.limits.settlements}건 기준이며 누적 원장 총액이 아닙니다.`,
                `合计仅涵盖最近 ${data.limits.settlements} 条已加载记录，并非历史总账。`,
              )}
            </p>
          )}
        </Tabs>
      </section>
    </>
  );
}

function Organization({
  data,
  locale,
}: {
  data: AgencyOperationsBootstrap;
  locale: Locale;
}) {
  const t = useText(locale);
  const org = data.organization;
  let country = org.countryCode ?? "";
  try {
    if (country)
      country =
        new Intl.DisplayNames([locale], { type: "region" }).of(country) ??
        country;
  } catch {
    /* Keep stored country code. */
  }
  const profile = org.profile;
  const fields = [
    [
      t("Company / studio name", "회사 / 스튜디오명", "公司 / 工作室名称"),
      org.name,
    ],
    [
      t("Organization type", "조직 유형", "组织类型"),
      org.agencyType === "studio"
        ? t("Studio", "스튜디오", "工作室")
        : t("Agency company", "에이전시", "代理机构"),
    ],
    [t("Country / region", "국가 / 지역", "国家 / 地区"), country],
    [t("Contact name", "담당자명", "联系人"), profile.contactName],
    [
      t("Contact method", "연락 수단", "联系方式"),
      profile.contactValue
        ? {
            email: t("Email", "이메일", "邮箱"),
            phone: t("Phone", "전화", "电话"),
            wechat: "WeChat",
          }[profile.contactMethod]
        : "",
    ],
    [t("Contact details", "연락처", "联系信息"), profile.contactValue],
    [t("Registered address", "등록 주소", "注册地址"), profile.address],
    [
      t("Established", "설립일", "成立日期"),
      profile.establishedOn ? displayDate(profile.establishedOn, locale) : "",
    ],
    [
      t("Business license ID", "사업자 등록번호", "营业执照号码"),
      profile.businessLicenseId,
    ],
    [t("Scope of business", "사업 내용", "经营范围"), profile.scopeOfBusiness],
    [
      t("Platform contact", "플랫폼 담당자", "平台联系人"),
      profile.platformContact,
    ],
  ];
  return (
    <section className="aop-panel aop-organization">
      <div className="aop-organization-heading">
        <div>
          <h2>{org.name}</h2>
          <span className="aop-status">
            <CheckCircle2 size={15} aria-hidden="true" />
            {t("Approved organization", "승인된 조직", "已获批组织")}
          </span>
        </div>
        <a className="aop-button" href="#aop-registered-profile">
          {t("Review company profile", "회사 프로필 확인", "查看公司资料")}
        </a>
      </div>
      <p className="aop-muted">
        {org.role === "MEMBER"
          ? t(
              "Read-only profile. Restricted contact and registration details are visible to owners and administrators only.",
              "읽기 전용 프로필입니다. 연락처·사업자 정보는 소유자와 관리자만 확인할 수 있습니다.",
              "只读资料，受限联系方式与登记资料仅所有者和管理员可见。",
            )
          : t(
              "Your registered company information. Profile changes are handled through the verification process.",
              "등록된 회사 정보입니다. 정보 변경은 조직 심사 절차를 통해 진행합니다.",
              "已登记的公司资料，资料变更通过组织审核流程处理。",
            )}
      </p>
      <dl id="aop-registered-profile" className="aop-profile">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || t("Not provided", "미등록", "未提供")}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Activity({
  data,
  locale,
}: {
  data: AgencyOperationsBootstrap;
  locale: Locale;
}) {
  const t = useText(locale);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const rows = data.activity.filter((event) =>
    withinDate(event.occurredAt, start, end),
  );
  const labels: Record<AgencyActivity["kind"], string> = {
    application_created: t(
      "Application record created",
      "신청 기록 생성",
      "申请记录已创建",
    ),
    application_status: t("Application status", "신청 상태", "申请状态"),
    submission_status: t("Submission status", "제출 상태", "交付状态"),
    settlement_status: t("Settlement status", "정산 상태", "结算状态"),
    organization_review: t("Organization review", "조직 심사", "组织审核"),
  };
  return (
    <section className="aop-panel">
      <div className="aop-panel-intro">
        <p>
          {t(
            "Derived from current records, not a complete notification or event history.",
            "현재 기록에서 구성한 최근 활동이며, 전체 알림·변경 이력이 아닙니다.",
            "根据当前记录生成，并非完整通知或事件历史。",
          )}
        </p>
      </div>
      <div className="aop-filters">
        <DateFilters
          start={start}
          end={end}
          onStart={setStart}
          onEnd={setEnd}
          locale={locale}
          label={t("Activity date", "활동일", "活动日期")}
        />
      </div>
      <DateError start={start} end={end} locale={locale} />
      {rows.length ? (
        <ol className="aop-activity">
          {rows.map((event) => (
            <li key={event.id}>
              <span className="aop-activity-icon" aria-hidden="true">
                <FileText size={18} />
              </span>
              <div className="aop-activity-content">
                <div className="aop-toolbar">
                  <strong>{labels[event.kind]}</strong>
                  <time dateTime={event.occurredAt}>
                    {displayDate(event.occurredAt, locale)}
                  </time>
                </div>
                <p>
                  {event.campaignTitle ?? data.organization.name}
                  <Demo show={event.isDemo} t={t} />
                </p>
                <details className="aop-activity-details">
                  <summary>{t("View details", "상세보기", "查看详情")}</summary>
                  {event.status ? (
                    <p>
                      {t("Current status", "현재 상태", "当前状态")}:{" "}
                      <strong>{statusText(event.status, t)}</strong>
                    </p>
                  ) : (
                    <p>
                      {t(
                        "Application record created on",
                        "신청 기록 생성일",
                        "申请记录创建日期",
                      )}
                      : {displayDate(event.occurredAt, locale)}
                    </p>
                  )}
                </details>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <Empty
          icon="inbox"
          title={t(
            "No recent activity",
            "최근 활동이 없습니다",
            "暂无最近活动",
          )}
          body={t(
            "Organization, application, and settlement updates will appear here.",
            "조직·신청·정산 기록이 있으면 이곳에 표시됩니다.",
            "组织、申请与结算记录将在此显示。",
          )}
        />
      )}
    </section>
  );
}
