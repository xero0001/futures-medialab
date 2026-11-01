"use client";

import { useEffect, useState } from "react";
import { Button, SectionMessage, Skeleton, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow, Typography } from "@montage-ui/core";
import type { AgencySettlementResponse } from "@futures-medialab/database/settlement-types";
import type { Locale } from "../_components/landing-copy";
import { productionText } from "../_components/workspace/production-shared";
import { SettlementList, SettlementStatement } from "../_components/workspace/settlement-shared";
import { settlementMoney } from "../../lib/settlement-display";
import styles from "../_components/workspace/settlement-workspace.module.css";

export function AgencySettlementWorkspace({ locale, campaignId }: { locale: Locale; campaignId?: string }) {
  const t = productionText(locale);
  const [data, setData] = useState<AgencySettlementResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    // This effect owns a new authenticated request and its loading lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    const path = `/api/agency/settlement${campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : ""}`;
    fetch(path, { cache: "no-store", signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "지급 정산 내역을 불러오지 못했습니다.");
      return result as AgencySettlementResponse;
    }).then(result => { if (!controller.signal.aborted) { setData(result); setLoading(false); } }).catch(reason => { if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : "지급 정산 내역을 불러오지 못했습니다."); setLoading(false); } });
    return () => controller.abort();
  }, [campaignId, revision]);
  return <section className={styles.workspace}><div><Typography as="h2" variant="title3" weight="bold">{t("지급 정산 내역", "Payout statements", "付款结算记录")}</Typography><Typography as="p" variant="body2" className={styles.muted}>{t("우리 조직에 발행된 정산 항목과 지급 상태를 확인하세요.", "View settlement items and payout status issued to your organization.", "查看向本组织出具的结算项目及付款状态。")}</Typography></div>{loading ? <div role="status" aria-label={t("정산 내역 불러오는 중", "Loading payout statements", "正在加载结算记录")}><Skeleton height={100} width="100%" /><Skeleton height={220} width="100%" /></div> : error ? <SectionMessage variant="negative" role="alert" bottomButton={<Button size="small" variant="outlined" color="assistive" onClick={() => setRevision(value => value + 1)}>{t("다시 불러오기", "Try again", "重试")}</Button>}>{error}</SectionMessage> : data && <SettlementList documents={data.payouts} viewer="agency" locale={locale} renderDocument={payout => <SettlementStatement document={payout} viewer="agency" locale={locale}><div className={styles.tableWrap}><Table className={styles.table} aria-label={t("지급 정산 항목", "Payout lines", "付款结算明细")}><TableHead><TableRow><TableHeadCell>{t("항목", "Item", "项目")}</TableHeadCell><TableHeadCell>{t("수량", "Quantity", "数量")}</TableHeadCell><TableHeadCell>{t("항목별 정산 금액", "Item settlement total", "项目结算总额")}</TableHeadCell></TableRow></TableHead><TableBody>{payout.lines.map((line, index) => <TableRow key={`${line.proposalItemId}-${index}`}><TableCell><Typography as="strong" variant="label1" weight="medium">{line.creatorName}</Typography><Typography as="p" variant="caption1" className={styles.muted}>{line.platform} · {line.description}</Typography></TableCell><TableCell>{line.quantity}</TableCell><TableCell><span className={styles.money}>{settlementMoney(line.itemTotalAmount, payout.currency, locale)}</span></TableCell></TableRow>)}</TableBody></Table></div></SettlementStatement>} />}</section>;
}
