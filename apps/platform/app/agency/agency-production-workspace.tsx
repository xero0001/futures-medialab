"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button, Option, SearchField, SectionMessage, Select, Skeleton, TextArea, TextField, Typography } from "@montage-ui/core";
import { IconClock, IconUpload } from "@montage-ui/icon";
import type { AgencyProductionItem, AgencyProductionMutation, AgencyProductionResponse } from "@futures-medialab/database/production-types";
import type { Locale } from "../_components/landing-copy";
import { ProductionArtwork, ProductionBadge, productionDate, productionText, VersionContent } from "../_components/workspace/production-shared";
import styles from "../_components/workspace/production-workspace.module.css";

export function AgencyProductionWorkspace({ locale }: { locale: Locale }) {
  const t = productionText(locale);
  const [data, setData] = useState<AgencyProductionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    const controller = new AbortController();
    // This effect owns a fresh network request and its loading/error lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    fetch("/api/agency/production", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? "제작 업무를 불러오지 못했습니다.");
        return result as AgencyProductionResponse;
      })
      .then(result => { setData(result); setLoading(false); })
      .catch(reason => { if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : "제작 업무를 불러오지 못했습니다."); setLoading(false); } });
    return () => controller.abort();
  }, [refresh]);
  const items = data?.items.filter(item =>
    (filter === "all" || (filter === "action" ? item.canSubmit : item.status === filter)) &&
    `${item.campaignTitle} ${item.creatorName} ${item.deliverables}`.toLowerCase().includes(search.trim().toLowerCase()),
  ) ?? [];
  const item = items.find(value => value.id === selectedId) ?? items.find(value => value.canSubmit) ?? items[0];
  function reload() { setRefresh(value => value + 1); }
  return <section className={`${styles.workspace} ${styles.agencyWorkspace}`} aria-label={t("공식 제안 제작 업무", "Official proposal production", "正式方案制作任务")}>
    <div className={styles.heading}><div><Typography as="h2" variant="title3" weight="bold">{t("콘텐츠 제작·제출", "Content production & delivery", "内容制作与提交")}</Typography><Typography as="p" variant="body2" className={styles.muted}>{t("승인된 제안의 담당 콘텐츠를 제출하세요. 퓨쳐스 검토를 거친 버전이 브랜드에 공유됩니다.", "Submit your assigned content from approved proposals. Futures reviews each version before sharing it with the brand.", "提交已批准方案中分配的内容，每个版本由 Futures 审核后向品牌共享。")}</Typography></div>{data && <Typography variant="label1">{t(`담당 ${data.items.length}건 · 제출 가능 ${data.items.filter(value => value.canSubmit).length}건`, `${data.items.length} assigned · ${data.items.filter(value => value.canSubmit).length} ready to submit`, `已分配 ${data.items.length} 项 · 可提交 ${data.items.filter(value => value.canSubmit).length} 项`)}</Typography>}</div>
    {loading ? <div className={styles.loading} aria-label={t("제작 업무 불러오는 중", "Loading production", "正在加载制作任务")}><Skeleton width="100%" height={80} /><Skeleton width="100%" height={240} /></div> : error ? <SectionMessage variant="negative" role="alert" bottomButton={<Button variant="outlined" color="assistive" size="small" onClick={reload}>{t("다시 불러오기", "Try again", "重试")}</Button>}>{error}</SectionMessage> : !data?.items.length ? <div className={styles.empty}><IconClock /><Typography as="h3" variant="heading2" weight="bold">{t("배정된 제작 업무가 없습니다", "No production tasks assigned", "暂无分配的制作任务")}</Typography><Typography as="p" variant="body2" className={styles.muted}>{t("공식 제안의 승인이 완료되고 담당 구성이 배정되면 이곳에서 콘텐츠를 제출할 수 있습니다.", "Once a proposal is approved and items are assigned to your team, you can submit content here.", "正式方案批准并分配给贵团队后，即可在此提交内容。")}</Typography></div> : <>
      {!data.canSubmit && <SectionMessage variant="info">{t("조직 소유자와 관리자만 콘텐츠를 제출할 수 있습니다. 제출 내역은 확인할 수 있습니다.", "Only organization owners and admins can submit content. You can view submission history.", "只有组织所有者和管理员可以提交内容，您可查看提交记录。")}</SectionMessage>}
      <div className={styles.toolbar}><SearchField aria-label={t("캠페인 또는 크리에이터 검색", "Search campaigns or creators", "搜索活动或达人")} placeholder={t("캠페인 또는 크리에이터 검색", "Search campaigns or creators", "搜索活动或达人")} value={search} onChange={event => setSearch(event.target.value)} onReset={() => setSearch("")} size="medium" width="100%" /><Select aria-label={t("제작 상태", "Production status", "制作状态")} value={filter} onChange={setFilter} size="medium" width="100%"><Option value="all">{t("전체 상태", "All statuses", "全部状态")}</Option><Option value="action">{t("제출 가능", "Ready to submit", "可提交")}</Option><Option value="ADMIN_REVIEW">{t("퓨쳐스 검토 중", "Futures review", "Futures 审核中")}</Option><Option value="BRAND_REVIEW">{t("브랜드 검수 중", "Brand review", "品牌审核中")}</Option><Option value="APPROVED">{t("승인 완료", "Approved", "已批准")}</Option></Select></div>
      {!item ? <div className={styles.empty}><Typography variant="body2">{t("조건에 맞는 제작 업무가 없습니다.", "No production tasks match these filters.", "没有符合条件的制作任务。")}</Typography><Button variant="outlined" color="assistive" size="small" onClick={() => { setSearch(""); setFilter("all"); }}>{t("필터 초기화", "Clear filters", "清除筛选")}</Button></div> : <div className={styles.layout}><div className={styles.tasks}>{items.map(value => <Button key={value.id} variant="outlined" color="assistive" className={`${styles.task} ${value.id === item.id ? styles.taskActive : ""}`} sx={{ width: "100%", minWidth: 0, maxWidth: "100%", height: "auto", padding: "20px", whiteSpace: "normal", justifyContent: "flex-start", "& > span": { minWidth: 0, width: "100%", maxWidth: "100%", whiteSpace: "normal" } }} aria-pressed={value.id === item.id} onClick={() => setSelectedId(value.id)}><span className={styles.taskContent}><ProductionBadge status={value.status} locale={locale} /><Typography variant="caption1" className={styles.muted}>{value.campaignTitle}</Typography><Typography as="strong" variant="label1" weight="bold">{value.creatorName}</Typography><Typography variant="caption1">{value.deliverables}</Typography></span></Button>)}</div><AgencyProductionDetail key={`${item.id}:${item.revision}`} item={item} canSubmit={data.canSubmit} locale={locale} onRefresh={() => { setSelectedId(item.id); reload(); }} /></div>}
    </>}
  </section>;
}

function AgencyProductionDetail({ item, canSubmit, locale, onRefresh }: { item: AgencyProductionItem; canSubmit: boolean; locale: Locale; onRefresh: () => void }) {
  const t = productionText(locale);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const versions = [...item.submissions].sort((a, b) => b.version - a.version);
  const version = versions.find(value => value.id === versionId) ?? versions[0];
  const previous = version?.id === versions[0]?.id ? versions[1] : versions[0];
  return <div className={styles.detail}>
    <section className={styles.card}><ProductionArtwork artwork={item} locale={locale} /><div className={styles.cardHead}><div><Typography variant="caption1" className={styles.muted}>{item.campaignTitle}</Typography><Typography as="h3" variant="heading2" weight="bold">{item.creatorName}</Typography><Typography variant="caption1">{t("승인 제안", "Approved proposal", "已批准方案")} v{item.proposalVersion} · {item.platform}</Typography></div><ProductionBadge status={item.status} locale={locale} /></div><dl className={styles.scope}><div><dt>{t("제작 범위", "Deliverables", "交付内容")}</dt><dd>{item.deliverables} · {item.quantity}{t("개", " items", " 项")}</dd></div><div><dt>{t("예정 일정", "Scheduled", "计划时间")}</dt><dd>{productionDate(item.scheduledAt, locale)}</dd></div><div><dt>{t("활용 범위", "Usage rights", "使用范围")}</dt><dd>{item.rights}</dd></div></dl></section>
    {item.latestSubmission?.agencyFeedback && <SectionMessage variant="cautionary" description={item.latestSubmission.agencyFeedback}>{t("퓨쳐스 수정 의견", "Futures revision feedback", "Futures 修改意见")}</SectionMessage>}
    {item.latestSubmission?.brandDecision === "REQUEST_CHANGES" && <SectionMessage variant="cautionary" description={item.latestSubmission.brandMessage}>{t("브랜드 수정 의견", "Brand revision feedback", "品牌修改意见")}</SectionMessage>}
    {canSubmit && item.canSubmit ? <SubmissionForm key={item.revision} item={item} locale={locale} onSaved={onRefresh} /> : <SectionMessage variant={item.status === "APPROVED" ? "positive" : "info"}>{item.submitDisabledReason || t("현재 버전의 검토가 진행 중입니다.", "The current version is being reviewed.", "当前版本正在审核中。")}</SectionMessage>}
    {version ? <section className={styles.card}><div className={styles.versionControls}><Select aria-label={t("제출 버전", "Submission version", "提交版本")} value={version.id} onChange={value => { setVersionId(value); setComparing(false); }} size="medium" width="100%">{versions.map(value => <Option key={value.id} value={value.id}>v{value.version} · {productionDate(value.submittedAt, locale)}</Option>)}</Select>{previous && <Button size="small" variant="outlined" color="assistive" onClick={() => setComparing(value => !value)}>{comparing ? t("비교 닫기", "Close comparison", "关闭比较") : t("버전 비교", "Compare versions", "版本比较")}</Button>}</div>
      {comparing && previous ? <div className={styles.compare}><VersionContent version={previous} locale={locale} timestamp={previous.submittedAt} label={t("비교 제출본", "Comparison submission", "比较提交版本")} /><VersionContent version={version} locale={locale} timestamp={version.submittedAt} label={t("선택 제출본", "Selected submission", "所选提交版本")} /></div> : <VersionContent version={version} locale={locale} timestamp={version.submittedAt} label={t("제출 원본", "Submitted version", "提交原始版本")} />}
      {version.agencyFeedback && <div className={styles.feedback}><SectionMessage variant="cautionary" description={version.agencyFeedback}>{t("이 버전의 퓨쳐스 의견", "Futures feedback on this version", "Futures 对此版本的意见")}</SectionMessage></div>}
      {version.releasedAt && version.releasedTitle && version.releasedUrl ? <div className={styles.released}><VersionContent version={{ version: version.version, title: version.releasedTitle, url: version.releasedUrl, note: version.releasedNote ?? "" }} locale={locale} timestamp={version.releasedAt} label={t("브랜드에 공유된 내용", "Content shared with the brand", "向品牌共享的内容")} />{version.brandDecision && <div className={styles.feedback}><SectionMessage variant={version.brandDecision === "APPROVE" ? "positive" : "cautionary"} description={version.brandMessage || productionDate(version.brandDecidedAt, locale)}>{version.brandDecision === "APPROVE" ? t("브랜드 승인 완료", "Approved by brand", "品牌已批准") : t("브랜드 수정 요청", "Brand requested changes", "品牌请求修改")}</SectionMessage></div>}</div> : <div className={styles.feedback}><Typography variant="caption1" className={styles.muted}>{t("이 버전은 아직 브랜드에 공유되지 않았습니다.", "This version has not been shared with the brand.", "此版本尚未向品牌共享。")}</Typography></div>}
    </section> : <div className={styles.empty}><Typography variant="body2" className={styles.muted}>{t("첫 제출 후 버전과 검토 이력이 이곳에 쌓입니다.", "Version and review history will appear after the first submission.", "首次提交后将在此显示版本和审核记录。")}</Typography></div>}
  </div>;
}

function SubmissionForm({ item, locale, onSaved }: { item: AgencyProductionItem; locale: Locale; onSaved: () => void }) {
  const t = productionText(locale), id = useId();
  const [title, setTitle] = useState(item.latestSubmission?.title ?? "");
  const [url, setUrl] = useState(item.latestSubmission?.url ?? "");
  const [note, setNote] = useState(item.latestSubmission?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  const lock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !item.canSubmit) return;
    if (title.trim().length < 2) { setError(t("제목을 2자 이상 입력해 주세요.", "Enter a title with at least 2 characters.", "请输入至少2个字符的标题。")); return; }
    try { const parsed = new URL(url.trim()); if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error(); }
    catch { setError(t("확인할 수 있는 HTTPS 콘텐츠 링크를 입력해 주세요.", "Enter a valid HTTPS content link.", "请输入可访问的 HTTPS 内容链接。")); return; }
    const values = { action: "submit" as const, productionItemId: item.id, expectedRevision: item.revision, title: title.trim(), url: url.trim(), note: note.trim() };
    const signature = JSON.stringify(values);
    if (attempt.current?.signature !== signature) attempt.current = { signature, id: crypto.randomUUID() };
    const payload: AgencyProductionMutation = { ...values, clientRequestId: attempt.current.id };
    lock.current = true; setBusy(true); setError(""); setConflict(false);
    try {
      const response = await fetch("/api/agency/production", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) { setConflict(response.status === 409); throw new Error(result.message ?? t("제출하지 못했습니다.", "Could not submit content.", "无法提交内容。")); }
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("잠시 후 다시 시도해 주세요.", "Please try again shortly.", "请稍后重试。")); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className={styles.card}><div className={styles.cardHead}><div><Typography as="h3" variant="heading2" weight="bold">{t("새 버전 제출", "Submit a new version", "提交新版本")} · v{(item.latestSubmission?.version ?? 0) + 1}</Typography><Typography variant="body2" className={styles.muted}>{t("제출한 버전은 기록으로 남으며, 퓨쳐스가 검토 후 브랜드에 공유합니다.", "Each submission is kept in history and shared with the brand after Futures review.", "每次提交均保留记录，由 Futures 审核后向品牌共享。")}</Typography></div></div><form className={styles.form} onSubmit={event => void submit(event)}>
    <div className={styles.field}><label htmlFor={`${id}-title`}>{t("콘텐츠 제목", "Content title", "内容标题")} *</label><TextField id={`${id}-title`} width="100%" value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required disabled={busy} placeholder={t("콘텐츠를 식별할 수 있는 제목", "A descriptive content title", "用于识别内容的标题")} /></div>
    <div className={styles.field}><label htmlFor={`${id}-url`}>{t("콘텐츠 링크", "Content link", "内容链接")} *</label><TextField id={`${id}-url`} type="url" width="100%" value={url} onChange={event => setUrl(event.target.value)} maxLength={2048} required disabled={busy} placeholder="https://" /><span className={styles.fieldHint}>{t("검토 가능한 HTTPS 링크를 입력하고 접근 권한을 확인해 주세요.", "Use an HTTPS link and ensure reviewers have access.", "请使用 HTTPS 链接并确认审核人员具有访问权限。")}</span></div>
    <div className={styles.field}><label htmlFor={`${id}-note`}>{t("구성·원고 및 전달 사항", "Script and production notes", "脚本及制作说明")}</label><TextArea id={`${id}-note`} width="100%" minRows={6} maxLength={4000} value={note} onChange={event => setNote(event.target.value)} disabled={busy} placeholder={t("영상 구성, 원고, 반영한 수정 사항을 입력해 주세요.", "Describe the script, structure, and changes included in this version.", "请说明视频结构、脚本以及本版本已处理的修改。")} /></div>
    {error && <SectionMessage variant="negative" role="alert" bottomButton={conflict ? <Button size="small" variant="outlined" color="assistive" onClick={onSaved}>{t("최신 상태 확인", "Refresh status", "刷新状态")}</Button> : undefined}>{error}</SectionMessage>}
    <div className={styles.formActions}><Button type="submit" leadingContent={<IconUpload />} loading={busy} disabled={conflict || title.trim().length < 2 || !url.trim()}>{t("퓨쳐스 검토에 제출", "Submit to Futures", "提交至 Futures 审核")}</Button></div>
  </form></section>;
}
