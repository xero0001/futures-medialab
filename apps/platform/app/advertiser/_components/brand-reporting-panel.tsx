"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Option, SectionMessage, Select, Typography } from "@montage-ui/core";
import { IconClock } from "@montage-ui/icon";
import type { BrandReportingItem } from "@futures-medialab/database/reporting-types";
import type { CampaignArtwork } from "../../../lib/campaign-artwork";
import type { Locale } from "../../_components/landing-copy";
import { ProductionArtwork, productionText } from "../../_components/workspace/production-shared";
import { ReportingBadge, ReportingTotals, ReportSnapshotView } from "../../_components/workspace/reporting-shared";
import styles from "../../_components/workspace/production-workspace.module.css";
import reportStyles from "../../_components/workspace/reporting-workspace.module.css";

export function BrandReportingPanel({ items, locale, artwork, requestHref }: { items: BrandReportingItem[]; locale: Locale; artwork: CampaignArtwork; requestHref: string }) {
  const t = productionText(locale);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const item = items.find(value => value.id === selectedId) ?? items.find(value => value.isCurrent && value.latestSubmission) ?? items[0];
  const versions = item ? [...item.submissions].sort((a, b) => b.version - a.version) : [];
  const version = versions.find(value => value.id === versionId) ?? versions[0];
  const comparison = version?.id === versions[0]?.id ? versions[1] : versions[0];
  return <div className={styles.workspace}>
    <div className={styles.heading}><div><Typography as="h2" variant="title3" weight="bold">{t("게시·성과", "Publication & performance", "发布与成效")}</Typography><Typography as="p" variant="body2" className={styles.muted}>{t("퓨쳐스가 확인해 공개한 게시 링크와 성과 지표를 확인하세요.", "View published links and performance figures reviewed and shared by Futures.", "查看经 Futures 确认并公开的发布链接和成效指标。")}</Typography></div><Typography variant="label1">{t(`공개된 콘텐츠 ${items.filter(value => value.isCurrent && value.latestSubmission).length}건`, `${items.filter(value => value.isCurrent && value.latestSubmission).length} published reports`, `${items.filter(value => value.isCurrent && value.latestSubmission).length} 项已公开报告`)}</Typography></div>
    <ReportingTotals items={items} locale={locale} />
    {!item ? <div className={styles.empty}><IconClock /><Typography as="h3" variant="heading2" weight="bold">{t("아직 공개된 게시·성과 자료가 없습니다", "No publication reports shared yet", "尚未公开发布与成效资料")}</Typography><Typography as="p" variant="body2" className={styles.muted}>{t("콘텐츠 승인 이후 실제 게시 내역과 성과를 확인해 공유합니다. 집계되지 않은 수치를 0으로 표시하지 않습니다.", "After content approval, publication details and measured results are reviewed and shared. Unmeasured figures are not shown as zero.", "内容批准后将核实并共享实际发布记录与成效，未统计的指标不会显示为0。")}</Typography><Button as={Link} href={requestHref} size="small" variant="outlined" color="assistive">{t("성과 관련 문의", "Ask about results", "咨询成效")}</Button></div> : <div className={styles.layout}>
      <div className={styles.tasks} aria-label={t("성과 보고 콘텐츠", "Reported content", "成效报告内容")}>{items.map(value => <Button key={value.id} variant="outlined" color="assistive" className={`${styles.task} ${value.id === item.id ? styles.taskActive : ""}`} sx={{ width: "100%", minWidth: 0, maxWidth: "100%", height: "auto", padding: "20px", whiteSpace: "normal", justifyContent: "flex-start", "& > span": { minWidth: 0, width: "100%", maxWidth: "100%", whiteSpace: "normal" } }} aria-pressed={value.id === item.id} onClick={() => { setSelectedId(value.id); setVersionId(null); setComparing(false); }}><span className={styles.taskContent}><ReportingBadge status={value.status} locale={locale} hasPublished={Boolean(value.latestSubmission)} metricsPending={Boolean(value.latestSubmission && Object.values(value.latestSubmission.metrics).every(metric => metric === null))} /><Typography as="strong" variant="label1" weight="bold">{value.creatorName}</Typography><Typography variant="caption1" className={styles.muted}>{value.platform} · {value.deliverables}</Typography>{!value.isCurrent && <Typography variant="caption1" className={styles.muted}>{t("이전 제안 기록", "Previous proposal record", "历史方案记录")}</Typography>}</span></Button>)}</div>
      <div className={styles.detail}><section className={styles.card}><div className={styles.cardHead}><div><Typography as="h3" variant="heading2" weight="bold">{item.creatorName}</Typography><Typography variant="caption1" className={styles.muted}>{item.platform} · {item.deliverables}</Typography></div><ReportingBadge status={item.status} locale={locale} hasPublished={Boolean(item.latestSubmission)} metricsPending={Boolean(item.latestSubmission && Object.values(item.latestSubmission.metrics).every(metric => metric === null))} /></div>{!item.isCurrent && <div className={styles.feedback}><SectionMessage variant="info">{t("이전 제안의 공개 기록이며 현재 성과 합계에는 포함하지 않습니다.", "This is a previous proposal's published record and is excluded from current totals.", "此为历史方案的公开记录，不计入当前成效汇总。")}</SectionMessage></div>}</section>
        {version ? <section className={styles.card}>
          <div className={styles.versionControls}><Select aria-label={t("공개된 성과 버전", "Published report version", "公开成效版本")} value={version.id} onChange={value => { setVersionId(value); setComparing(false); }} width="100%" size="medium">{versions.map(value => <Option key={value.id} value={value.id}>v{value.version} · {value.isLatest ? t("최신 공개본", "Latest published", "最新公开版本") : t("이전 공개본", "Earlier published", "历史公开版本")}</Option>)}</Select>{comparison && <Button size="small" variant="outlined" color="assistive" onClick={() => setComparing(value => !value)}>{comparing ? t("비교 닫기", "Close comparison", "关闭比较") : t("버전 비교", "Compare versions", "版本比较")}</Button>}</div>
          {item.status !== "PUBLISHED" && <div className={styles.pendingNotice}><SectionMessage variant="info">{t("업데이트를 확인 중입니다. 아래에는 현재 공개된 버전을 표시합니다.", "An update is being reviewed. The currently published version remains available below.", "更新资料确认中，下方继续显示当前公开版本。")}</SectionMessage></div>}
          <ProductionArtwork artwork={artwork} locale={locale} />
          {comparing && comparison ? <div className={`${styles.compare} ${reportStyles.compare}`}><ReportSnapshotView data={comparison} version={comparison.version} timestamp={comparison.releasedAt} locale={locale} label={t("비교 공개본", "Comparison report", "比较公开版本")} /><ReportSnapshotView data={version} version={version.version} timestamp={version.releasedAt} locale={locale} label={t("선택 공개본", "Selected report", "所选公开版本")} /></div> : <ReportSnapshotView data={version} version={version.version} timestamp={version.releasedAt} locale={locale} label={t("퓨쳐스 공개본", "Published by Futures", "Futures 公开版本")} />}
        </section> : <div className={styles.empty}><IconClock /><Typography as="h3" variant="heading2" weight="bold">{t("게시·성과 자료를 준비하고 있습니다", "Publication report in preparation", "发布与成效资料准备中")}</Typography><Typography as="p" variant="body2" className={styles.muted}>{t("퓨쳐스가 확인해 공개하면 게시 링크와 지표를 볼 수 있습니다.", "The publication link and metrics will appear after Futures reviews and publishes them.", "经 Futures 确认并公开后即可查看发布链接与指标。")}</Typography></div>}
      </div>
    </div>}
  </div>;
}
