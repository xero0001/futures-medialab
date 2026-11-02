"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button, Option, SearchField, SectionMessage, Select, Skeleton, TextArea, TextField, Typography } from "@montage-ui/core";
import { IconClock, IconUpload } from "@montage-ui/icon";
import type { AgencyReportingItem, AgencyReportingMutation, AgencyReportingResponse, ReportingMetrics, ReportingSnapshot } from "@futures-medialab/database/reporting-types";
import type { Locale } from "../_components/landing-copy";
import { reportingInputMetrics } from "../../lib/reporting-display";
import { ProductionArtwork, productionText } from "../_components/workspace/production-shared";
import { metricLabel, ReportingBadge, reportingDate, reportingIsoDate, reportingLocalDate, reportingMetricKeys, ReportSnapshotView } from "../_components/workspace/reporting-shared";
import styles from "../_components/workspace/production-workspace.module.css";
import reportStyles from "../_components/workspace/reporting-workspace.module.css";

export function AgencyReportingWorkspace({ locale, campaignId, onChanged }: { locale: Locale; campaignId?: string; onChanged?: () => void }) {
  const t = productionText(locale);
  const [data, setData] = useState<AgencyReportingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    const controller = new AbortController();
    // The request owns its loading and error state; derived task selection stays outside this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    const path = `/api/agency/reporting${campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : ""}`;
    fetch(path, { cache: "no-store", signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "게시·성과 업무를 불러오지 못했습니다.");
      return result as AgencyReportingResponse;
    }).then(result => { if (!controller.signal.aborted) { setData(result); setLoading(false); } }).catch(reason => {
      if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : "게시·성과 업무를 불러오지 못했습니다."); setLoading(false); }
    });
    return () => controller.abort();
  }, [campaignId, revision]);
  const items = data?.items.filter(item => (filter === "all" || (filter === "action" ? item.canSubmit : item.status === filter)) && `${item.campaignTitle} ${item.creatorName} ${item.deliverables}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ?? [];
  const item = items.find(value => value.id === selectedId) ?? items.find(value => value.canSubmit && !value.latestSubmission) ?? items[0];
  const reload = () => { setRevision(value => value + 1); onChanged?.(); };
  return <section className={styles.workspace} aria-label={t("게시·성과 제출", "Publication reporting", "发布与成效提交")}>
    <div className={styles.heading}><div><Typography as="h2" variant="title3" weight="bold">{t("게시·성과 등록", "Publication & performance reporting", "发布与成效登记")}</Typography><Typography as="p" variant="body2" className={styles.muted}>{t("승인된 콘텐츠의 게시 링크와 확인된 지표를 등록하세요. 퓨쳐스가 검토한 내용만 브랜드에 공개됩니다.", "Register published links and measured figures for approved content. Only reports reviewed by Futures are shared with the brand.", "登记已批准内容的发布链接及已确认指标，只有经 Futures 审核的内容会向品牌公开。")}</Typography></div>{data && <Typography variant="label1">{t(`담당 ${data.items.length}건`, `${data.items.length} assigned`, `已分配 ${data.items.length} 项`)}</Typography>}</div>
    {loading ? <div className={styles.loading} role="status" aria-label={t("성과 업무 불러오는 중", "Loading reports", "正在加载报告")}><Skeleton width="100%" height={80} /><Skeleton width="100%" height={240} /></div> : error ? <SectionMessage variant="negative" role="alert" bottomButton={<Button size="small" variant="outlined" color="assistive" onClick={reload}>{t("다시 불러오기", "Try again", "重试")}</Button>}>{error}</SectionMessage> : !data?.items.length ? <div className={styles.empty}><IconClock /><Typography as="h3" variant="heading2" weight="bold">{t("등록할 게시·성과 업무가 없습니다", "No publication reports to submit", "暂无待提交的发布报告")}</Typography><Typography as="p" variant="body2" className={styles.muted}>{t("담당 콘텐츠의 브랜드 승인이 완료되면 게시·성과 업무가 준비됩니다.", "Reporting tasks become available once the brand approves your assigned content.", "品牌批准所分配的内容后，将准备发布与成效任务。")}</Typography></div> : <>
      {!data.canSubmit && <SectionMessage variant="info">{t("조직 소유자와 관리자만 게시·성과를 제출할 수 있습니다.", "Only organization owners and admins can submit reports.", "只有组织所有者和管理员可以提交发布报告。")}</SectionMessage>}
      <div className={styles.toolbar}><SearchField width="100%" size="medium" aria-label={t("캠페인 또는 크리에이터 검색", "Search campaign or creator", "搜索活动或达人")} placeholder={t("캠페인 또는 크리에이터 검색", "Search campaign or creator", "搜索活动或达人")} value={search} onChange={event => setSearch(event.target.value)} onReset={() => setSearch("")} /><Select width="100%" size="medium" aria-label={t("성과 상태", "Report status", "报告状态")} value={filter} onChange={setFilter}><Option value="all">{t("전체 상태", "All statuses", "全部状态")}</Option><Option value="action">{t("등록·업데이트 가능", "Ready to submit/update", "可提交或更新")}</Option><Option value="ADMIN_REVIEW">{t("퓨쳐스 검토 중", "Futures review", "Futures 审核中")}</Option><Option value="AGENCY_REVISION">{t("수정 요청", "Revision requested", "请求修改")}</Option><Option value="PUBLISHED">{t("공개 완료", "Published", "已公开")}</Option></Select></div>
      {!item ? <div className={styles.empty}><Typography variant="body2">{t("조건에 맞는 게시·성과 업무가 없습니다.", "No reporting tasks match these filters.", "没有符合条件的发布报告任务。")}</Typography><Button size="small" variant="outlined" color="assistive" onClick={() => { setSearch(""); setFilter("all"); }}>{t("필터 초기화", "Clear filters", "清除筛选")}</Button></div> : <div className={styles.layout}><div className={styles.tasks}>{items.map(value => <Button key={value.id} variant="outlined" color="assistive" className={`${styles.task} ${value.id === item.id ? styles.taskActive : ""}`} sx={{ width: "100%", minWidth: 0, maxWidth: "100%", height: "auto", padding: "20px", whiteSpace: "normal", justifyContent: "flex-start", "& > span": { minWidth: 0, width: "100%", maxWidth: "100%", whiteSpace: "normal" } }} aria-pressed={value.id === item.id} onClick={() => setSelectedId(value.id)}><span className={styles.taskContent}><ReportingBadge status={value.status} locale={locale} hasPublished={value.submissions.some(version => Boolean(version.releasedAt))} metricsPending={Boolean(value.latestSubmission?.releasedSnapshot && Object.values(value.latestSubmission.releasedSnapshot.metrics).every(metric => metric === null))} /><Typography variant="caption1" className={styles.muted}>{value.campaignTitle}</Typography><Typography as="strong" variant="label1" weight="bold">{value.creatorName}</Typography><Typography variant="caption1">{value.platform} · {value.deliverables}</Typography></span></Button>)}</div><AgencyReportingDetail key={`${item.id}:${item.revision}`} item={item} canSubmit={data.canSubmit} locale={locale} onRefresh={() => { setSelectedId(item.id); reload(); }} /></div>}
    </>}
  </section>;
}

function AgencyReportingDetail({ item, canSubmit, locale, onRefresh }: { item: AgencyReportingItem; canSubmit: boolean; locale: Locale; onRefresh: () => void }) {
  const t = productionText(locale);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [showForm, setShowForm] = useState(["AWAITING_SUBMISSION", "AGENCY_REVISION"].includes(item.status));
  const versions = [...item.submissions].sort((a, b) => b.version - a.version);
  const version = versions.find(value => value.id === versionId) ?? versions[0];
  const comparison = version?.id === versions[0]?.id ? versions[1] : versions[0];
  return <div className={styles.detail}>
    <section className={styles.card}><ProductionArtwork artwork={item} locale={locale} /><div className={styles.cardHead}><div><Typography variant="caption1" className={styles.muted}>{item.campaignTitle}</Typography><Typography as="h3" variant="heading2" weight="bold">{item.creatorName}</Typography><Typography variant="caption1">{item.platform} · {item.deliverables}</Typography></div><ReportingBadge status={item.status} locale={locale} hasPublished={versions.some(value => Boolean(value.releasedAt))} metricsPending={Boolean(item.latestSubmission?.releasedSnapshot && Object.values(item.latestSubmission.releasedSnapshot.metrics).every(metric => metric === null))} /></div><div className={styles.feedback}><Typography variant="caption1" className={styles.muted}>{t("브랜드가 승인한 콘텐츠의 게시 내역을 등록합니다. 지표 업데이트도 매번 퓨쳐스 검토를 거칩니다.", "Report publication of brand-approved content. Every metrics update is reviewed by Futures.", "登记品牌已批准内容的发布记录，每次指标更新也将经过 Futures 审核。")}</Typography></div></section>
    {item.latestSubmission?.agencyFeedback && <SectionMessage variant="cautionary" description={item.latestSubmission.agencyFeedback}>{t("퓨쳐스 수정 의견", "Futures revision feedback", "Futures 修改意见")}</SectionMessage>}
    {canSubmit && item.canSubmit ? showForm ? <ReportingForm item={item} locale={locale} onSaved={onRefresh} onCancel={item.latestSubmission ? () => setShowForm(false) : undefined} /> : <Button variant="outlined" color="assistive" onClick={() => setShowForm(true)}>{t("게시·성과 업데이트", "Update publication report", "更新发布与成效")}</Button> : <SectionMessage variant="info">{item.submitDisabledReason || t("현재 제출본을 확인 중입니다.", "The current submission is under review.", "当前提交版本审核中。")}</SectionMessage>}
    {version ? <section className={styles.card}><div className={styles.versionControls}><Select width="100%" size="medium" aria-label={t("제출 버전", "Submission version", "提交版本")} value={version.id} onChange={value => { setVersionId(value); setComparing(false); }}>{versions.map(value => <Option key={value.id} value={value.id}>v{value.version} · {reportingDate(value.submittedAt, locale)}</Option>)}</Select>{comparison && <Button size="small" variant="outlined" color="assistive" onClick={() => setComparing(value => !value)}>{comparing ? t("비교 닫기", "Close comparison", "关闭比较") : t("버전 비교", "Compare versions", "版本比较")}</Button>}</div>
      {comparing && comparison ? <div className={`${styles.compare} ${reportStyles.compare}`}><ReportSnapshotView data={comparison} version={comparison.version} timestamp={comparison.submittedAt} locale={locale} label={t("비교 제출본", "Comparison submission", "比较提交版本")} /><ReportSnapshotView data={version} version={version.version} timestamp={version.submittedAt} locale={locale} label={t("선택 제출본", "Selected submission", "所选提交版本")} /></div> : <ReportSnapshotView data={version} version={version.version} timestamp={version.submittedAt} locale={locale} label={t("제출 원본", "Submitted version", "提交原始版本")} />}
      {version.agencyFeedback && <div className={styles.feedback}><SectionMessage variant="cautionary" description={version.agencyFeedback}>{t("이 버전의 검토 의견", "Feedback on this version", "对此版本的审核意见")}</SectionMessage></div>}
      {version.releasedSnapshot && version.releasedAt ? <div className={styles.released}><ReportSnapshotView data={version.releasedSnapshot} version={version.version} timestamp={version.releasedAt} locale={locale} label={t("브랜드에 공개된 내용", "Published to the brand", "向品牌公开的内容")} /></div> : <div className={styles.feedback}><Typography variant="caption1" className={styles.muted}>{t("이 제출본은 아직 브랜드에 공개되지 않았습니다.", "This submission has not been published to the brand.", "此提交版本尚未向品牌公开。")}</Typography></div>}
    </section> : <div className={styles.empty}><Typography variant="body2" className={styles.muted}>{t("게시 링크를 제출하면 성과 업데이트와 검토 이력이 기록됩니다.", "Submit a published link to start the report and review history.", "提交发布链接后将记录成效更新及审核历史。")}</Typography></div>}
  </div>;
}

function ReportingForm({ item, locale, onSaved, onCancel }: { item: AgencyReportingItem; locale: Locale; onSaved: () => void; onCancel?: () => void }) {
  const t = productionText(locale), id = useId(), latest = item.latestSubmission;
  const [title, setTitle] = useState(latest?.title ?? "");
  const [postUrl, setPostUrl] = useState(latest?.postUrl ?? "");
  const [publishedAt, setPublishedAt] = useState(reportingLocalDate(latest?.publishedAt));
  const [metricsAsOf, setMetricsAsOf] = useState(reportingLocalDate(latest?.metricsAsOf));
  const [metrics, setMetrics] = useState<Record<keyof ReportingMetrics, string>>(() => Object.fromEntries(reportingMetricKeys.map(key => [key, latest?.metrics[key] === null || latest?.metrics[key] === undefined ? "" : String(latest.metrics[key])])) as Record<keyof ReportingMetrics, string>);
  const [evidenceUrl, setEvidenceUrl] = useState(latest?.evidenceUrl ?? "");
  const [note, setNote] = useState(latest?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const lock = useRef(false), attempt = useRef<{ signature: string; id: string } | null>(null);
  const knownMetrics = reportingMetricKeys.some(key => metrics[key].trim() !== "");
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !item.canSubmit) return;
    // This runs only on form submission; date validation uses that event's time.
    // eslint-disable-next-line react-hooks/purity
    const submittedNow = Date.now();
    const published = latest?.publishedAt && publishedAt === reportingLocalDate(latest.publishedAt) ? latest.publishedAt : reportingIsoDate(publishedAt);
    const measured = latest?.metricsAsOf && metricsAsOf === reportingLocalDate(latest.metricsAsOf) ? latest.metricsAsOf : metricsAsOf ? reportingIsoDate(metricsAsOf) : null;
    if (!published || Date.parse(published) > submittedNow) { setError(t("실제 게시 시각을 한국 시간(KST)으로 입력해 주세요.", "Enter the actual publication time in Korean time (KST).", "请使用韩国时间(KST)输入实际发布时间。")); return; }
    if ((knownMetrics && !measured) || (metricsAsOf && !measured) || (measured && (Date.parse(measured) < Date.parse(published) || Date.parse(measured) > submittedNow))) { setError(t("지표 기준 시각은 게시 이후부터 현재 사이여야 합니다. 지표가 있으면 기준 시각도 입력해 주세요.", "Metrics time must fall between publication and now, and is required when any metric is entered.", "指标截至时间必须介于发布和当前时间之间，填写任何指标时都必须填写此时间。")); return; }
    for (const link of [postUrl, ...(evidenceUrl.trim() ? [evidenceUrl] : [])]) {
      try { const parsed = new URL(link.trim()); if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error(); }
      catch { setError(t("확인 가능한 HTTPS 링크를 입력해 주세요.", "Enter a valid HTTPS link.", "请输入有效的 HTTPS 链接。")); return; }
    }
    const counts = reportingInputMetrics(metrics);
    if (!counts) { setError(t("지표는 0 이상의 정수로 입력하고, 미집계 항목은 비워 두세요.", "Use non-negative whole numbers. Leave unmeasured metrics empty.", "指标请输入非负整数，未统计的项目请留空。")); return; }
    const data: ReportingSnapshot = { title: title.trim(), postUrl: postUrl.trim(), publishedAt: published, metricsAsOf: measured, metrics: counts, evidenceUrl: evidenceUrl.trim() || null, note: note.trim() };
    const values = { action: "submit" as const, reportingItemId: item.id, expectedRevision: item.revision, data };
    const signature = JSON.stringify(values);
    if (attempt.current?.signature !== signature) attempt.current = { signature, id: crypto.randomUUID() };
    const payload: AgencyReportingMutation = { ...values, clientRequestId: attempt.current.id };
    lock.current = true; setBusy(true); setError(""); setConflict(false);
    try {
      const response = await fetch("/api/agency/reporting", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) { setConflict(response.status === 409); throw new Error(result.message ?? t("제출하지 못했습니다.", "Could not submit the report.", "无法提交报告。")); }
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("잠시 후 다시 시도해 주세요.", "Please try again shortly.", "请稍后重试。")); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className={styles.card}><div className={styles.cardHead}><div><Typography as="h3" variant="heading2" weight="bold">{t("게시·성과 제출", "Submit publication report", "提交发布报告")} · v{(latest?.version ?? 0) + 1}</Typography><Typography variant="caption1" className={styles.muted}>{t("공개 후 지표가 바뀌면 새 버전으로 제출해 주세요.", "Submit a new version when measured results change.", "公开后指标发生变化时，请提交新版本。")}</Typography></div></div><form className={styles.form} onSubmit={handleSubmit}>
    <div className={styles.field}><label htmlFor={`${id}-title`}>{t("게시 콘텐츠 제목", "Published content title", "已发布内容标题")} *</label><TextField id={`${id}-title`} width="100%" value={title} onChange={event => setTitle(event.target.value)} maxLength={160} minLength={2} required disabled={busy} /></div>
    <div className={styles.field}><label htmlFor={`${id}-post`}>{t("게시 링크", "Published URL", "发布链接")} *</label><TextField id={`${id}-post`} width="100%" type="url" value={postUrl} onChange={event => setPostUrl(event.target.value)} maxLength={2048} placeholder="https://" required disabled={busy} /></div>
    <div className={reportStyles.fieldGrid}><div className={styles.field}><label htmlFor={`${id}-published`}>{t("게시 시각 · KST", "Publication time · KST", "发布时间 · KST")} *</label><TextField id={`${id}-published`} width="100%" type="datetime-local" value={publishedAt} onChange={event => setPublishedAt(event.target.value)} required disabled={busy} /></div><div className={styles.field}><label htmlFor={`${id}-measured`}>{t("지표 기준 시각 · KST", "Metrics as of · KST", "指标截至时间 · KST")}{knownMetrics ? " *" : ""}</label><TextField id={`${id}-measured`} width="100%" type="datetime-local" value={metricsAsOf} onChange={event => setMetricsAsOf(event.target.value)} required={knownMetrics} disabled={busy} /></div></div>
    <fieldset className={reportStyles.metricFieldset}><legend>{t("확인된 성과 지표", "Measured performance", "已确认成效指标")}</legend><Typography as="p" variant="caption1" className={styles.muted}>{t("미집계 지표는 비워 두세요. 실제 결과가 0인 경우에만 0을 입력합니다. 지표가 없어도 게시 링크는 제출할 수 있습니다.", "Leave unmeasured figures empty. Enter 0 only for a measured zero. A published link can be submitted before metrics are available.", "未统计的指标请留空，仅在实际结果为0时填写0。尚无指标时也可提交发布链接。")}</Typography><div className={reportStyles.metricInputs}>{reportingMetricKeys.map(key => <div className={styles.field} key={key}><label htmlFor={`${id}-${key}`}>{metricLabel(key, locale)}</label><TextField id={`${id}-${key}`} width="100%" inputMode="numeric" value={metrics[key]} onChange={event => setMetrics(value => ({ ...value, [key]: event.target.value }))} maxLength={16} disabled={busy} placeholder={t("미집계", "Pending", "未统计")} /></div>)}</div></fieldset>
    <div className={styles.field}><label htmlFor={`${id}-evidence`}>{t("지표 근거 자료 링크", "Evidence URL", "指标证明资料链接")}</label><TextField id={`${id}-evidence`} width="100%" type="url" value={evidenceUrl} onChange={event => setEvidenceUrl(event.target.value)} maxLength={2048} disabled={busy} placeholder="https://" /></div>
    <div className={styles.field}><label htmlFor={`${id}-note`}>{t("설명 및 전달 사항", "Notes and context", "说明及备注")}</label><TextArea id={`${id}-note`} width="100%" minRows={4} maxLength={4000} value={note} onChange={event => setNote(event.target.value)} disabled={busy} /></div>
    {error && <SectionMessage variant="negative" role="alert" bottomButton={conflict ? <Button size="small" variant="outlined" color="assistive" onClick={onSaved}>{t("최신 상태 확인", "Refresh status", "刷新状态")}</Button> : undefined}>{error}</SectionMessage>}
    <div className={styles.formActions}>{onCancel && <Button variant="outlined" color="assistive" disabled={busy} onClick={onCancel}>{t("돌아가기", "Go back", "返回")}</Button>}<Button type="submit" leadingContent={<IconUpload />} loading={busy} disabled={conflict || title.trim().length < 2 || !postUrl.trim() || !publishedAt}>{t("퓨쳐스 검토에 제출", "Submit to Futures", "提交至 Futures 审核")}</Button></div>
  </form></section>;
}
