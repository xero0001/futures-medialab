"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button, Option, SearchField, Select, Typography } from "@montage-ui/core";
import { IconClock, IconArrowUpRight } from "@montage-ui/icon";
import type { BrandInvoice } from "@futures-medialab/database/settlement-types";
import type { Locale } from "../landing-copy";
import { productionText } from "./production-shared";
import { reportingDate } from "./reporting-shared";
import { StatusBadge } from "./status-badge";
import { settlementAmountFromMinor, settlementMinorUnits, settlementMoney } from "../../../lib/settlement-display";
import layout from "./production-workspace.module.css";
import styles from "./settlement-workspace.module.css";

type Header = Omit<BrandInvoice, "lines" | "documentVersion" | "versions">;
export function SettlementBadge({ status, viewer, locale }: { status: Header["status"]; viewer: "brand" | "agency"; locale: Locale }) {
  const t = productionText(locale);
  return <StatusBadge tone={status === "PAID" ? "green" : "amber"}>{viewer === "brand" ? status === "PAID" ? t("입금 확인 완료", "Payment confirmed", "收款已确认") : t("입금 확인 대기", "Awaiting payment confirmation", "等待收款确认") : status === "PAID" ? t("지급 완료", "Payout recorded", "付款已完成") : t("지급 대기", "Payout pending", "等待付款")}</StatusBadge>;
}
export function SettlementList<T extends Header>({ documents, viewer, locale, renderDocument }: { documents: T[]; viewer: "brand" | "agency"; locale: Locale; renderDocument: (document: T) => ReactNode }) {
  const t = productionText(locale);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = documents.filter(document => (filter === "all" || document.status === filter) && `${document.campaignTitle} ${document.title}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const document = filtered.find(value => value.id === selectedId) ?? filtered.find(value => value.status === "ISSUED") ?? filtered[0];
  const currencies = [...new Set(documents.map(value => value.currency))].sort();
  const totals = currencies.flatMap(currency => (["ISSUED", "PAID"] as const).map(status => ({ currency, status, count: documents.filter(value => value.currency === currency && value.status === status).length, amount: documents.filter(value => value.currency === currency && value.status === status).reduce((sum, value) => sum + (settlementMinorUnits(value.amount) ?? 0n), 0n) })));
  if (!documents.length) return <div className={layout.empty}><IconClock /><Typography as="h3" variant="heading2" weight="bold">{viewer === "brand" ? t("발행된 청구 내역이 없습니다", "No issued invoices", "暂无已出具账单") : t("발행된 지급 정산 내역이 없습니다", "No issued payout statements", "暂无已出具付款结算单")}</Typography><Typography as="p" variant="body2" className={layout.muted}>{viewer === "brand" ? t("캠페인 완료 후 퓨쳐스가 발행한 청구 금액과 입금 확인 내역이 표시됩니다.", "Invoices and payment confirmations appear here after campaign completion and issuance by Futures.", "活动完成且 Futures 出具账单后，将在此显示应付金额及收款确认记录。") : t("캠페인 완료 후 우리 조직에 발행된 정산 금액과 지급 내역을 확인할 수 있습니다.", "After campaign completion, statements issued to your organization and payout records appear here.", "活动完成后可在此查看向贵组织出具的结算金额与付款记录。")}</Typography></div>;
  return <div className={styles.workspace}>
    <div className={styles.summary}>{totals.map(total => <div key={`${total.currency}-${total.status}`} className={styles.summaryCard}><Typography variant="caption1" className={styles.muted}>{viewer === "brand" ? total.status === "ISSUED" ? t("입금 확인 대기", "Awaiting payment confirmation", "等待收款确认") : t("입금 확인 완료", "Payment confirmed", "收款已确认") : total.status === "ISSUED" ? t("지급 대기", "Payout pending", "等待付款") : t("지급 완료", "Payout recorded", "付款已完成")} · {total.count}{t("건", " statements", " 笔")}</Typography><Typography as="strong" variant="title3" weight="bold">{settlementMoney(settlementAmountFromMinor(total.amount), total.currency, locale)}</Typography></div>)}</div>
    <div className={layout.toolbar}><SearchField width="100%" size="medium" aria-label={t("캠페인 또는 문서 검색", "Search campaign or statement", "搜索活动或结算单")} placeholder={t("캠페인 또는 문서 검색", "Search campaign or statement", "搜索活动或结算单")} value={search} onChange={event => setSearch(event.target.value)} onReset={() => setSearch("")} /><Select width="100%" size="medium" aria-label={t("처리 상태", "Processing status", "处理状态")} value={filter} onChange={setFilter}><Option value="all">{t("전체 상태", "All statuses", "全部状态")}</Option><Option value="ISSUED">{viewer === "brand" ? t("입금 확인 대기", "Awaiting payment confirmation", "等待收款确认") : t("지급 대기", "Payout pending", "等待付款")}</Option><Option value="PAID">{viewer === "brand" ? t("입금 확인 완료", "Payment confirmed", "收款已确认") : t("지급 완료", "Payout recorded", "付款已完成")}</Option></Select></div>
    {!document ? <div className={layout.empty}><Typography variant="body2">{t("조건에 맞는 내역이 없습니다.", "No statements match these filters.", "暂无符合条件的记录。")}</Typography><Button size="small" variant="outlined" color="assistive" onClick={() => { setSearch(""); setFilter("all"); }}>{t("필터 초기화", "Clear filters", "清除筛选")}</Button></div> : <div className={layout.layout}><div className={layout.tasks}>{filtered.map(value => <Button key={value.id} variant="outlined" color="assistive" className={`${layout.task} ${value.id === document.id ? layout.taskActive : ""}`} sx={{ width: "100%", minWidth: 0, maxWidth: "100%", height: "auto", padding: "20px", whiteSpace: "normal", justifyContent: "flex-start", "& > span": { minWidth: 0, width: "100%", maxWidth: "100%", whiteSpace: "normal" } }} aria-pressed={value.id === document.id} onClick={() => setSelectedId(value.id)}><span className={layout.taskContent}><SettlementBadge status={value.status} viewer={viewer} locale={locale} /><Typography as="strong" variant="label1" weight="bold">{value.campaignTitle}</Typography><Typography variant="caption1" className={styles.muted}>{value.title}</Typography><Typography variant="label1" weight="bold">{settlementMoney(value.amount, value.currency, locale)}</Typography></span></Button>)}</div><div className={layout.detail}>{renderDocument(document)}</div></div>}
  </div>;
}
export function SettlementStatement({ document, viewer, locale, children, earlierIssue = false }: { document: Header; viewer: "brand" | "agency"; locale: Locale; children: ReactNode; earlierIssue?: boolean }) {
  const t = productionText(locale);
  let documentUrl: string | null = null;
  try { if (document.documentUrl) { const url = new URL(document.documentUrl); if (url.protocol === "https:" && !url.username && !url.password) documentUrl = url.href; } } catch { /* Malformed historical links stay unavailable. */ }
  const href = viewer === "brand" ? `/advertiser/campaign/${encodeURIComponent(document.campaignId)}?tab=settlement&lang=${locale}` : `/agency?section=projects&stage=settlement&campaign=${encodeURIComponent(document.campaignId)}&lang=${locale}`;
  return <article className={styles.statement}><header className={styles.statementHeader}><div>{earlierIssue ? <Typography variant="caption1" className={styles.muted}>{t("이전 발행본","Earlier issue","历史版本")}</Typography> : <SettlementBadge status={document.status} viewer={viewer} locale={locale} />}<Typography as="h3" variant="heading2" weight="bold">{document.title}</Typography><Typography variant="caption1" className={styles.muted}>{document.campaignTitle} · {t("공식 제안", "Official proposal", "正式方案")} v{document.proposalVersion}</Typography></div><div className={styles.total}><Typography variant="caption1" className={styles.muted}>{viewer === "brand" ? t("청구 금액", "Invoice total", "账单金额") : t("지급 정산 금액", "Payout total", "结算付款金额")}</Typography><Typography as="strong" variant="title3" weight="bold">{settlementMoney(document.amount, document.currency, locale)}</Typography></div></header>
    <dl className={styles.facts}><div><dt>{t("캠페인 완료", "Campaign completed", "活动完成时间")}</dt><dd>{reportingDate(document.completedAt, locale)}</dd></div><div><dt>{t("발행일", "Issued", "出具时间")}</dt><dd>{reportingDate(document.issuedAt, locale)}</dd></div><div><dt>{viewer === "brand" ? t("납부 예정일", "Payment due", "应付款时间") : t("지급 예정일", "Payout due", "预计付款时间")}</dt><dd>{document.dueAt ? reportingDate(document.dueAt, locale) : t("미지정", "Not specified", "未指定")}</dd></div>{!earlierIssue && <div><dt>{viewer === "brand" ? t("입금 확인일", "Payment confirmed", "收款确认时间") : t("지급일", "Payout date", "付款时间")}</dt><dd>{document.paidAt ? reportingDate(document.paidAt, locale) : t("확인 대기", "Awaiting confirmation", "等待确认")}</dd></div>}</dl>
    {children}
    {document.note && <div className={styles.note}><Typography variant="label1" weight="bold">{t("안내 사항", "Notes", "说明")}</Typography><Typography as="p" variant="body2">{document.note}</Typography></div>}
    <footer className={styles.footer}><Typography variant="caption1" className={styles.muted}>{viewer === "brand" ? t("퓨쳐스가 확인한 외부 입금 내역을 기준으로 표시합니다.", "Status reflects external payments confirmed by Futures.", "状态依据 Futures 确认的外部收款记录显示。") : t("퓨쳐스가 기록한 외부 지급 내역을 기준으로 표시합니다.", "Status reflects external payouts recorded by Futures.", "状态依据 Futures 记录的外部付款情况显示。")}</Typography>{viewer === "brand" ? <Link href={href}>{t("캠페인 내역", "Campaign details", "活动记录")}</Link> : <a href={href}>{t("캠페인 내역", "Campaign details", "活动记录")}</a>}{documentUrl && <a href={documentUrl} target="_blank" rel="noopener noreferrer">{t("발행 문서 열기", "Open issued document", "打开已出具文档")} <IconArrowUpRight width={14} height={14} /></a>}</footer>
  </article>;
}
