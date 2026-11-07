"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Button,
  SearchField,
  SectionMessage,
  Skeleton,
  Typography,
} from "@montage-ui/core";
import {
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Paperclip,
  Receipt,
  RotateCcw,
  X,
} from "lucide-react";
import type {
  BrandDocument,
  BrandDocumentResponse,
} from "../../../lib/brand-document-types";
import type { BrandProposal } from "@futures-medialab/database/proposal-types";
import type { BrandInvoice } from "@futures-medialab/database/settlement-types";
import type { Locale } from "../../_components/landing-copy";
import {
  StatusBadge,
  type StatusTone,
} from "../../_components/workspace/status-badge";
import { ReportSnapshotView } from "../../_components/workspace/reporting-shared";
import { settlementMoney } from "../../../lib/settlement-display";
import styles from "./brand-documents-panel.module.css";

type Copy = (ko: string, en: string, zh: string) => string;
type Kind = BrandDocument["kind"];
const copyFor =
  (locale: Locale): Copy =>
  (ko, en, zh) =>
    ({ ko, en, zh })[locale];
const kinds: Kind[] = ["proposal", "report", "invoice", "attachment"];
const icons = {
  proposal: FileText,
  report: ChartNoAxesCombined,
  invoice: Receipt,
  attachment: Paperclip,
};
const pageSize = 12;

function kindLabel(kind: Kind, t: Copy) {
  return {
    proposal: t("공식 제안", "Proposals", "正式方案"),
    report: t("성과 보고", "Reports", "成效报告"),
    invoice: t("청구서", "Invoices", "账单"),
    attachment: t("공유 첨부", "Shared files", "共享附件"),
  }[kind];
}

function dateLabel(value: string | null, locale: Locale, withTime = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return (
    new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale, {
      dateStyle: "medium",
      ...(withTime ? { timeStyle: "short" as const } : {}),
      timeZone: "Asia/Seoul",
    }).format(new Date(value)) + (withTime ? " KST" : "")
  );
}

function fileSize(size: number | null, locale: Locale) {
  if (size === null || !Number.isFinite(size) || size < 0) return "—";
  const unit = size < 1024 ? "B" : size < 1024 * 1024 ? "KB" : "MB";
  const divisor = unit === "B" ? 1 : unit === "KB" ? 1024 : 1024 * 1024;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(size / divisor)} ${unit}`;
}

function safeFileUrl(value: string) {
  if (
    /^\/api\/workspace\/requests\/[A-Za-z0-9_-]+\/attachments\/[A-Za-z0-9_-]+$/.test(
      value,
    )
  )
    return value;
  try {
    const url = new URL(value);
    if (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.hostname !== "example.invalid"
    )
      return url.href;
  } catch {
    /* Unavailable historical links remain visible as metadata only. */
  }
  return null;
}

function sourceHref(value: string, locale: Locale) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return null;
  try {
    const url = new URL(value, "https://workspace.invalid");
    if (
      url.origin !== "https://workspace.invalid" ||
      !(
        url.pathname === "/advertiser/requests" ||
        /^\/advertiser\/campaign\/[A-Za-z0-9_-]+$/.test(url.pathname)
      )
    )
      return null;
    url.searchParams.set("lang", locale);
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

function requestHref(locale: Locale, campaignId?: string) {
  const params = new URLSearchParams({ lang: locale, compose: "1" });
  if (campaignId) params.set("campaign", campaignId);
  return `/advertiser/requests?${params}`;
}

function DocumentStatus({
  document,
  locale,
}: {
  document: BrandDocument;
  locale: Locale;
}) {
  const t = copyFor(locale);
  let label = t("공개됨", "Published", "已公开");
  let tone: StatusTone = "blue";
  if (document.kind === "attachment") {
    label = t("공유됨", "Shared", "已共享");
    tone = "neutral";
  }
  if (document.kind === "invoice") {
    label =
      document.status === "PAID"
        ? t("입금 확인", "Payment confirmed", "收款已确认")
        : t("입금 확인 대기", "Awaiting payment confirmation", "等待收款确认");
    tone = document.status === "PAID" ? "green" : "amber";
  }
  if (document.kind === "invoice" && !document.isLatest) {
    label = t("이전 발행본", "Earlier issue", "历史版本");
    tone = "neutral";
  }
  if (document.kind === "proposal") {
    const states: Record<string, { label: string; tone: StatusTone }> = {
      APPROVED: { label: t("승인 완료", "Approved", "已批准"), tone: "green" },
      CHANGES_REQUESTED: {
        label: t("수정 요청", "Changes requested", "已请求修改"),
        tone: "amber",
      },
      REJECTED: {
        label: t("재제안 요청", "Replacement requested", "已请求重新提案"),
        tone: "amber",
      },
      SUPERSEDED: {
        label: t("이전 버전", "Earlier version", "历史版本"),
        tone: "neutral",
      },
    };
    if (states[document.status]) ({ label, tone } = states[document.status]);
  }
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

function DocumentIcon({ kind }: { kind: Kind }) {
  const Icon = icons[kind];
  return (
    <span className={`${styles.documentIcon} ${styles[kind]}`}>
      <Icon size={21} aria-hidden="true" />
    </span>
  );
}

function Facts({ values }: { values: { label: string; value: string }[] }) {
  return (
    <dl className={styles.facts}>
      {values.map(({ label, value }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProposalContent({
  proposal,
  locale,
}: {
  proposal: BrandProposal;
  locale: Locale;
}) {
  const t = copyFor(locale);
  return (
    <>
      <div className={styles.amountSummary}>
        <div>
          <span>{t("제안 총액", "Proposal total", "方案总额")}</span>
          <strong>
            {settlementMoney(proposal.totalAmount, proposal.currency, locale)}
          </strong>
        </div>
        <div>
          <span>{t("유효 기한", "Valid until", "有效期至")}</span>
          <b>{dateLabel(proposal.expiresAt, locale, true)}</b>
        </div>
      </div>
      {proposal.changeSummary && (
        <section className={styles.textSection}>
          <h3>{t("변경 내용", "Changes in this version", "本版本变更")}</h3>
          <p>{proposal.changeSummary}</p>
        </section>
      )}
      <section className={styles.detailSection}>
        <h3>{t("제안 구성과 조건", "Lineup and terms", "方案组合及条件")}</h3>
        <div className={styles.proposalItems}>
          {proposal.items.map((item, index) => (
            <article key={item.id} className={styles.proposalItem}>
              <div className={styles.itemHeading}>
                <span className={styles.itemNumber}>{index + 1}</span>
                <div>
                  <h4>{item.creatorName}</h4>
                  <span>
                    {item.platform}
                    {item.channelLabel ? ` · ${item.channelLabel}` : ""}
                  </span>
                </div>
                <strong>
                  {settlementMoney(item.totalAmount, proposal.currency, locale)}
                </strong>
              </div>
              <p className={styles.deliverable}>{item.deliverables}</p>
              <Facts
                values={[
                  {
                    label: t("수량", "Quantity", "数量"),
                    value: item.quantity.toLocaleString(locale),
                  },
                  {
                    label: t("단가", "Unit price", "单价"),
                    value: settlementMoney(
                      item.unitAmount,
                      proposal.currency,
                      locale,
                    ),
                  },
                  {
                    label: t("예정일", "Scheduled date", "预计日期"),
                    value: dateLabel(item.scheduledAt, locale),
                  },
                  {
                    label: t("사용권", "Usage rights", "使用权"),
                    value:
                      item.rights ||
                      t("별도 기재 없음", "Not specified", "未另行注明"),
                  },
                ]}
              />
            </article>
          ))}
        </div>
      </section>
      {proposal.terms && (
        <section className={styles.textSection}>
          <h3>{t("제안 조건", "Proposal terms", "方案条款")}</h3>
          <p>{proposal.terms}</p>
        </section>
      )}
    </>
  );
}

function InvoiceContent({
  invoice,
  locale,
  isLatest,
}: {
  invoice: BrandInvoice;
  locale: Locale;
  isLatest: boolean;
}) {
  const t = copyFor(locale);
  return (
    <>
      <div className={styles.amountSummary}>
        <div>
          <span>{t("청구 금액", "Invoice amount", "账单金额")}</span>
          <strong>
            {settlementMoney(invoice.amount, invoice.currency, locale)}
          </strong>
        </div>
        <div>
          <span>{t("납부 기한", "Due date", "付款期限")}</span>
          <b>{dateLabel(invoice.dueAt, locale)}</b>
        </div>
      </div>
      <Facts
        values={[
          {
            label: t("발행일", "Issued", "出具日期"),
            value: dateLabel(invoice.issuedAt, locale, true),
          },
          ...(isLatest
            ? [
                {
                  label: t("입금 확인일", "Payment confirmed", "收款确认日期"),
                  value: dateLabel(invoice.paidAt, locale, true),
                },
              ]
            : []),
        ]}
      />
      <section className={styles.detailSection}>
        <h3>{t("청구 항목", "Invoice items", "账单明细")}</h3>
        <div
          className={styles.tableScroll}
          tabIndex={0}
          role="region"
          aria-label={t("청구 항목 표", "Invoice items table", "账单明细表")}
        >
          <table className={styles.detailTable}>
            <thead>
              <tr>
                <th scope="col">{t("항목", "Item", "项目")}</th>
                <th scope="col">{t("수량", "Quantity", "数量")}</th>
                <th scope="col">{t("단가", "Unit price", "单价")}</th>
                <th scope="col">{t("금액", "Amount", "金额")}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line, index) => (
                <tr key={`${line.proposalItemId}-${index}`}>
                  <td>
                    <strong>{line.creatorName}</strong>
                    <span>
                      {line.platform} · {line.description}
                    </span>
                  </td>
                  <td>{line.quantity.toLocaleString(locale)}</td>
                  <td className={styles.money}>
                    {settlementMoney(line.unitAmount, invoice.currency, locale)}
                  </td>
                  <td className={styles.money}>
                    {settlementMoney(line.lineAmount, invoice.currency, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function DocumentDialog({
  document,
  locale,
  onClose,
  returnFocus,
}: {
  document: BrandDocument;
  locale: Locale;
  onClose: () => void;
  returnFocus: HTMLElement | null;
}) {
  const t = copyFor(locale);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const original = sourceHref(document.sourceHref, locale);
  const file = document.file;
  const fileHref = file ? safeFileUrl(file.url) : null;
  const download = Boolean(fileHref?.startsWith("/api/"));
  useEffect(() => {
    const element = dialog.current;
    const overflow = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      window.document.body.style.overflow = overflow;
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [returnFocus]);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <div className={styles.dialogHeading}>
        <DocumentIcon kind={document.kind} />
        <div>
          <span>
            {kindLabel(document.kind, t)}
            {document.version !== null ? ` · v${document.version}` : ""}
          </span>
          <Typography as="h2" id={titleId} variant="title3" weight="bold">
            {document.title}
          </Typography>
        </div>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label={t("문서 닫기", "Close document", "关闭文档")}
        >
          <X size={22} />
        </button>
      </div>
      <div className={styles.dialogBody}>
        <div className={styles.documentMetadata}>
          <div>
            <DocumentStatus document={document} locale={locale} />
            {!document.isLatest && document.status !== "SUPERSEDED" && (
              <StatusBadge tone="neutral">
                {t("이전 버전", "Earlier version", "历史版本")}
              </StatusBadge>
            )}
          </div>
          <time dateTime={document.publishedAt}>
            {t("공유일", "Shared", "共享日期")} ·{" "}
            {dateLabel(document.publishedAt, locale, true)}
          </time>
        </div>
        <p className={styles.campaignLabel}>
          {document.campaignTitle ||
            t(
              "캠페인 미지정 자료",
              "Files without a campaign",
              "未关联活动的资料",
            )}
        </p>
        {!document.isLatest && (
          <SectionMessage variant="info">
            {t(
              "이전에 공유된 버전입니다. 최신 내용은 목록의 최신 문서 또는 캠페인에서 확인해 주세요.",
              "This is an earlier shared version. Check the latest document or campaign for current information.",
              "此为此前共享的版本，请在最新文档或活动中查看当前内容。",
            )}
          </SectionMessage>
        )}
        {document.correctionReason && (
          <p className={styles.summary}>
            <strong>
              {t("정정 사유", "Reason for correction", "更正原因")}
            </strong>{" "}
            · {document.correctionReason}
          </p>
        )}
        {document.summary && !document.report && (
          <p className={styles.summary}>{document.summary}</p>
        )}
        {document.proposal && (
          <ProposalContent proposal={document.proposal} locale={locale} />
        )}
        {document.report && (
          <section className={styles.reportPreview}>
            <div className={styles.reportCreator}>
              <h3>{document.report.creatorName}</h3>
              <span>{document.report.platform}</span>
            </div>
            <ReportSnapshotView
              data={document.report.submission}
              locale={locale}
              version={document.report.submission.version}
              timestamp={document.report.submission.releasedAt}
              label={t(
                "공개된 성과 보고",
                "Published performance report",
                "公开成效报告",
              )}
            />
          </section>
        )}
        {document.invoice && (
          <InvoiceContent
            invoice={document.invoice}
            locale={locale}
            isLatest={document.isLatest}
          />
        )}
        {file && (
          <section className={styles.fileCard}>
            <span className={styles.fileIcon}>
              <Paperclip size={23} aria-hidden="true" />
            </span>
            <div>
              <h3>{file.fileName}</h3>
              <p>
                {[
                  file.contentType,
                  file.size !== null ? fileSize(file.size, locale) : null,
                ]
                  .filter(Boolean)
                  .join(" · ") ||
                  t("공유된 원본 자료", "Shared original file", "共享原始资料")}
              </p>
            </div>
            {fileHref && (
              <a
                href={fileHref}
                className={styles.fileAction}
                {...(download
                  ? { download: file.fileName }
                  : { target: "_blank", rel: "noopener noreferrer" })}
              >
                {download ? <Download size={17} /> : <ExternalLink size={17} />}
                {download
                  ? t("다운로드", "Download", "下载")
                  : t("원본 열기", "Open file", "打开原件")}
              </a>
            )}
          </section>
        )}
        {document.kind === "attachment" && (
          <p className={styles.attachmentHelp}>
            {t(
              "첨부 파일은 원본으로 확인할 수 있습니다. 관련 대화에서는 이 자료가 공유된 맥락을 함께 볼 수 있습니다.",
              "Open the original attachment to read its contents. The related conversation provides the context in which it was shared.",
              "可打开原始附件查看内容，并在相关对话中了解共享此资料的背景。",
            )}
          </p>
        )}
      </div>
      <div className={styles.dialogFooter}>
        <Button
          variant="outlined"
          color="assistive"
          size="medium"
          onClick={onClose}
        >
          {t("닫기", "Close", "关闭")}
        </Button>
        {original && (
          <Button
            as={Link}
            href={original}
            size="medium"
            onClick={onClose}
            trailingContent={<ChevronRight size={17} />}
          >
            {document.kind === "attachment"
              ? t("관련 대화 보기", "View conversation", "查看相关对话")
              : t("캠페인에서 보기", "View in campaign", "在活动中查看")}
          </Button>
        )}
      </div>
    </dialog>
  );
}

export function BrandDocumentsPanel({
  locale,
  campaignId,
  campaignTitle,
}: {
  locale: Locale;
  campaignId?: string;
  campaignTitle?: string;
}) {
  const t = copyFor(locale);
  const [data, setData] = useState<BrandDocumentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [kind, setKind] = useState<Kind | "all">("all");
  const [search, setSearch] = useState("");
  const [campaign, setCampaign] = useState("all");
  const [versions, setVersions] = useState("latest");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<BrandDocument | null>(null);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const titleId = useId();
  const previousCampaignId = useRef(campaignId);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setFailed(false);
      setData(null);
      setSelected(null);
      setPage(1);
      if (previousCampaignId.current !== campaignId) {
        setCampaign("all");
        previousCampaignId.current = campaignId;
      }
      const url = `/api/brand/documents${campaignId ? `?campaign=${encodeURIComponent(campaignId)}` : ""}`;
      fetch(url, { signal: controller.signal, cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error("DOCUMENTS_UNAVAILABLE");
          const result = (await response.json()) as BrandDocumentResponse;
          if (!Array.isArray(result.documents))
            throw new Error("DOCUMENTS_UNAVAILABLE");
          if (!controller.signal.aborted) {
            setData(result);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setFailed(true);
            setLoading(false);
          }
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [campaignId, revision]);

  const documents = useMemo(() => data?.documents ?? [], [data]);
  const campaignOptions = useMemo(
    () =>
      Array.from(
        new Map(
          documents
            .filter((document) => document.campaignId)
            .map((document) => [
              document.campaignId!,
              document.campaignTitle ?? document.campaignId!,
            ]),
        ).entries(),
      ).sort((a, b) => a[1].localeCompare(b[1], locale)),
    [documents, locale],
  );
  const scoped = documents.filter(
    (document) =>
      (campaign === "all" ||
        (campaign === "unassigned"
          ? document.campaignId === null
          : document.campaignId === campaign)) &&
      (versions === "all" ||
        (versions === "latest" ? document.isLatest : !document.isLatest)) &&
      `${document.title} ${document.campaignTitle ?? ""} ${document.summary} ${document.file?.fileName ?? ""}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  const filtered = scoped
    .filter((document) => kind === "all" || document.kind === kind)
    .sort(
      (a, b) =>
        (sort === "newest" ? -1 : 1) *
          (Date.parse(a.publishedAt) - Date.parse(b.publishedAt)) ||
        a.id.localeCompare(b.id),
    );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const displayed = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const activeFilters = Boolean(
    search || campaign !== "all" || kind !== "all" || versions !== "latest",
  );
  function reset() {
    setSearch("");
    setCampaign("all");
    setKind("all");
    setVersions("latest");
    setPage(1);
  }
  function open(document: BrandDocument, element: HTMLElement) {
    setTrigger(element);
    setSelected(document);
  }

  return (
    <section className={styles.workspace} aria-labelledby={titleId}>
      <div className={styles.heading}>
        <div>
          <Typography as="h2" id={titleId} variant="title3" weight="bold">
            {campaignId
              ? t("캠페인 문서", "Campaign documents", "活动文档")
              : t("공유 문서", "Shared documents", "共享文档")}
          </Typography>
          <Typography as="p" variant="body2" className={styles.muted}>
            {campaignId
              ? t(
                  "이 캠페인에 공유된 제안·성과·청구·첨부 자료를 확인하세요.",
                  "Find proposals, reports, invoices and files shared for this campaign.",
                  "查看此活动共享的方案、成效报告、账单及附件。",
                )
              : t(
                  "우리 조직에 공유된 캠페인 문서를 한곳에서 확인하세요.",
                  "Find campaign documents shared with your organization in one place.",
                  "集中查看向本组织共享的活动文档。",
                )}
          </Typography>
        </div>
        <Button
          size="small"
          variant="outlined"
          color="assistive"
          onClick={() => setRevision((value) => value + 1)}
          disabled={loading}
          leadingContent={<RotateCcw size={16} />}
        >
          {t("새로고침", "Refresh", "刷新")}
        </Button>
      </div>
      {loading ? (
        <div
          className={styles.loading}
          role="status"
          aria-label={t(
            "문서를 불러오는 중",
            "Loading documents",
            "正在加载文档",
          )}
        >
          <Skeleton width="100%" height="48px" />
          {[1, 2, 3].map((value) => (
            <Skeleton key={value} width="100%" height="72px" />
          ))}
        </div>
      ) : failed ? (
        <div className={styles.error}>
          <SectionMessage variant="negative">
            {t(
              "문서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
              "Documents could not be loaded. Please try again shortly.",
              "无法加载文档，请稍后重试。",
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
      ) : (
        <div className={styles.panel}>
          <div className={styles.filters}>
            <div className={styles.search}>
              <SearchField
                aria-label={t("문서 검색", "Search documents", "搜索文档")}
                placeholder={t(
                  "문서명·캠페인·파일명 검색",
                  "Search document, campaign or file",
                  "搜索文档、活动或文件名称",
                )}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                onReset={() => {
                  setSearch("");
                  setPage(1);
                }}
                width="100%"
                size="medium"
              />
            </div>
            {!campaignId && (
              <label className={styles.filterField}>
                <span>{t("캠페인", "Campaign", "活动")}</span>
                <select
                  aria-label={t(
                    "캠페인 필터",
                    "Filter by campaign",
                    "按活动筛选",
                  )}
                  value={campaign}
                  onChange={(event) => {
                    setCampaign(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">
                    {t("전체 캠페인", "All campaigns", "全部活动")}
                  </option>
                  {campaignOptions.map(([id, title]) => (
                    <option key={id} value={id}>
                      {title}
                    </option>
                  ))}
                  {documents.some((document) => !document.campaignId) && (
                    <option value="unassigned">
                      {t("캠페인 미지정", "Without campaign", "未关联活动")}
                    </option>
                  )}
                </select>
              </label>
            )}
            <label className={styles.filterField}>
              <span>{t("버전", "Version", "版本")}</span>
              <select
                aria-label={t(
                  "문서 버전 필터",
                  "Filter document versions",
                  "筛选文档版本",
                )}
                value={versions}
                onChange={(event) => {
                  setVersions(event.target.value);
                  setPage(1);
                }}
              >
                <option value="latest">
                  {t("최신 문서", "Latest documents", "最新文档")}
                </option>
                <option value="all">
                  {t(
                    "이전 버전 포함",
                    "Include earlier versions",
                    "包含历史版本",
                  )}
                </option>
                <option value="earlier">
                  {t("이전 버전만", "Earlier versions only", "仅历史版本")}
                </option>
              </select>
            </label>
          </div>
          <div
            className={styles.kindFilters}
            role="group"
            aria-label={t("문서 종류", "Document types", "文档类型")}
          >
            <button
              type="button"
              aria-pressed={kind === "all"}
              onClick={() => {
                setKind("all");
                setPage(1);
              }}
            >
              {t("전체", "All", "全部")}
              <span>{scoped.length}</span>
            </button>
            {kinds.map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={kind === value}
                onClick={() => {
                  setKind(value);
                  setPage(1);
                }}
              >
                {kindLabel(value, t)}
                <span>
                  {scoped.filter((document) => document.kind === value).length}
                </span>
              </button>
            ))}
          </div>
          <div className={styles.listHeading}>
            <span role="status">
              {t(
                `${filtered.length}개 문서`,
                `${filtered.length} documents`,
                `${filtered.length} 份文档`,
              )}
              {campaignId && campaignTitle ? (
                <span className={styles.listCampaign}> · {campaignTitle}</span>
              ) : null}
            </span>
            <div>
              {activeFilters && (
                <button type="button" className={styles.reset} onClick={reset}>
                  {t("필터 초기화", "Reset filters", "重置筛选")}
                </button>
              )}
              <select
                aria-label={t("문서 정렬", "Sort documents", "文档排序")}
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
              >
                <option value="newest">
                  {t("최근 공유순", "Newest shared first", "最近共享优先")}
                </option>
                <option value="oldest">
                  {t("오래된 공유순", "Oldest shared first", "较早共享优先")}
                </option>
              </select>
            </div>
          </div>
          {displayed.length ? (
            <div
              className={styles.tableScroll}
              tabIndex={0}
              role="region"
              aria-label={t(
                "공유 문서 목록",
                "Shared document list",
                "共享文档列表",
              )}
            >
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t("문서", "Document", "文档")}</th>
                    {!campaignId && (
                      <th scope="col">{t("캠페인", "Campaign", "活动")}</th>
                    )}
                    <th scope="col">{t("버전", "Version", "版本")}</th>
                    <th scope="col">{t("공유일", "Shared", "共享日期")}</th>
                    <th scope="col">{t("상태", "Status", "状态")}</th>
                    <th scope="col">
                      <span className={styles.srOnly}>
                        {t("문서 보기", "View document", "查看文档")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <button
                          type="button"
                          className={styles.documentButton}
                          onClick={(event) =>
                            open(document, event.currentTarget)
                          }
                        >
                          <DocumentIcon kind={document.kind} />
                          <span>
                            <span className={styles.documentKind}>
                              {kindLabel(document.kind, t)}
                            </span>
                            <strong>{document.title}</strong>
                            {document.file?.fileName &&
                              document.file.fileName !== document.title && (
                                <span className={styles.fileName}>
                                  {document.file.fileName}
                                </span>
                              )}
                          </span>
                        </button>
                      </td>
                      {!campaignId && (
                        <td className={styles.campaignCell}>
                          {document.campaignTitle ||
                            t("캠페인 미지정", "No campaign", "未关联活动")}
                        </td>
                      )}
                      <td>
                        <div className={styles.version}>
                          {document.version !== null ? (
                            <strong>v{document.version}</strong>
                          ) : (
                            <span>—</span>
                          )}
                          {!document.isLatest && (
                            <span>
                              {t("이전 버전", "Earlier version", "历史版本")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={styles.dateCell}>
                        <time dateTime={document.publishedAt}>
                          {dateLabel(document.publishedAt, locale)}
                        </time>
                      </td>
                      <td>
                        <DocumentStatus document={document} locale={locale} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.viewButton}
                          aria-label={t(
                            `${document.title} 상세 보기`,
                            `View ${document.title}`,
                            `查看 ${document.title}`,
                          )}
                          onClick={(event) =>
                            open(document, event.currentTarget)
                          }
                        >
                          <ChevronRight size={20} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>
                <FolderOpen size={28} />
              </span>
              <Typography as="h3" variant="heading2" weight="bold">
                {documents.length
                  ? t(
                      "조건에 맞는 문서가 없습니다",
                      "No matching documents",
                      "没有符合条件的文档",
                    )
                  : t(
                      "아직 공유된 문서가 없습니다",
                      "No documents shared yet",
                      "尚未共享文档",
                    )}
              </Typography>
              <Typography as="p" variant="body2" className={styles.muted}>
                {documents.length
                  ? t(
                      "검색어나 필터를 변경해 보세요.",
                      "Try another search term or filter.",
                      "请尝试其他搜索词或筛选条件。",
                    )
                  : t(
                      "공식 제안·성과·청구가 발행되거나 요청함에 파일이 공유되면 이곳에 모입니다.",
                      "Published proposals, reports, invoices and files shared in your inbox will appear here.",
                      "正式方案、成效报告和账单发布后，以及请求中心共享附件后，将汇集于此。",
                    )}
              </Typography>
              {documents.length ? (
                <Button
                  size="small"
                  variant="outlined"
                  color="assistive"
                  onClick={reset}
                >
                  {t("필터 초기화", "Reset filters", "重置筛选")}
                </Button>
              ) : (
                <Button
                  as={Link}
                  href={requestHref(locale, campaignId)}
                  size="small"
                  variant="outlined"
                  color="assistive"
                >
                  {t("문서 요청하기", "Request a document", "请求文档")}
                </Button>
              )}
            </div>
          )}
          {filtered.length > pageSize && (
            <div className={styles.pagination}>
              <span>
                {t(
                  `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} / ${filtered.length}개`,
                  `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length}`,
                  `第 ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} 项，共 ${filtered.length} 项`,
                )}
              </span>
              <div>
                <button
                  type="button"
                  aria-label={t("이전 페이지", "Previous page", "上一页")}
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <span>
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  aria-label={t("다음 페이지", "Next page", "下一页")}
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
          {data?.hasMore && (
            <div className={styles.moreNotice}>
              <Typography as="p" variant="caption1">
                {campaignId
                  ? t(
                      "이전 자료가 더 있습니다. 찾는 문서가 없다면 담당자에게 요청해 주세요.",
                      "More earlier files are available. Ask your contact if you cannot find a document.",
                      "还有更早的资料，如找不到所需文档，请联系负责人。",
                    )
                  : t(
                      "이전 자료가 더 있습니다. 캠페인의 문서 탭에서 범위를 좁혀 확인하거나 담당자에게 요청해 주세요.",
                      "More earlier files are available. Open a campaign’s Documents tab or ask your contact.",
                      "还有更早的资料，请在活动文档中缩小范围查看，或联系负责人。",
                    )}
              </Typography>
              <Link href={requestHref(locale, campaignId)}>
                {t("자료 문의", "Ask about files", "咨询资料")}
              </Link>
            </div>
          )}
        </div>
      )}
      {selected && (
        <DocumentDialog
          document={selected}
          locale={locale}
          onClose={() => setSelected(null)}
          returnFocus={trigger}
        />
      )}
    </section>
  );
}
