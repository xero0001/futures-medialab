"use client";

import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow, Typography } from "@montage-ui/core";
import type { BrandInvoice } from "@futures-medialab/database/settlement-types";
import type { Locale } from "../../_components/landing-copy";
import { productionText } from "../../_components/workspace/production-shared";
import { SettlementList, SettlementStatement } from "../../_components/workspace/settlement-shared";
import { settlementMoney } from "../../../lib/settlement-display";
import styles from "../../_components/workspace/settlement-workspace.module.css";

export function BrandBillingPanel({ invoices, locale, showHeading = true }: { invoices: BrandInvoice[]; locale: Locale; showHeading?: boolean }) {
  const t = productionText(locale);
  return <section className={styles.workspace}>{showHeading && <div><Typography as="h2" variant="title3" weight="bold">{t("청구 내역", "Invoices", "账单")}</Typography><Typography as="p" variant="body2" className={styles.muted}>{t("우리 조직에 발행된 청구 금액과 입금 확인 내역을 확인하세요.", "View invoices issued to your organization and payment confirmations.", "查看向本组织出具的账单金额及收款确认记录。")}</Typography></div>}<SettlementList documents={invoices} viewer="brand" locale={locale} renderDocument={invoice => <SettlementStatement document={invoice} viewer="brand" locale={locale}><div className={styles.tableWrap}><Table className={styles.table} aria-label={t("청구 항목", "Invoice lines", "账单明细")}><TableHead><TableRow><TableHeadCell>{t("항목", "Item", "项目")}</TableHeadCell><TableHeadCell>{t("수량", "Quantity", "数量")}</TableHeadCell><TableHeadCell>{t("단가", "Unit amount", "单价")}</TableHeadCell><TableHeadCell>{t("금액", "Amount", "金额")}</TableHeadCell></TableRow></TableHead><TableBody>{invoice.lines.map((line, index) => <TableRow key={`${line.proposalItemId}-${index}`}><TableCell><Typography as="strong" variant="label1" weight="medium">{line.creatorName}</Typography><Typography as="p" variant="caption1" className={styles.muted}>{line.platform} · {line.description}</Typography></TableCell><TableCell>{line.quantity}</TableCell><TableCell><span className={styles.money}>{settlementMoney(line.unitAmount, invoice.currency, locale)}</span></TableCell><TableCell><span className={styles.money}>{settlementMoney(line.lineAmount, invoice.currency, locale)}</span></TableCell></TableRow>)}</TableBody></Table></div></SettlementStatement>} /></section>;
}
