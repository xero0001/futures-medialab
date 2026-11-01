"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { ActionArea, ActionAreaButton, Button, Checkbox, Modal, ModalContainer, ModalContent, ModalNavigation, ModalNavigationButton, Option, SectionMessage, Select, TextArea, Typography } from "@montage-ui/core";
import { IconCheck, IconClock } from "@montage-ui/icon";
import type { BrandProductionItem, BrandProductionMutation } from "@futures-medialab/database/production-types";
import type { CampaignArtwork } from "../../../lib/campaign-artwork";
import type { Locale } from "../../_components/landing-copy";
import { ProductionArtwork, ProductionBadge, productionDate, productionText, VersionContent } from "../../_components/workspace/production-shared";
import styles from "../../_components/workspace/production-workspace.module.css";

export function BrandProductionPanel({ items, locale, canManage, requestHref, artwork, onRefresh }: { items: BrandProductionItem[]; locale: Locale; canManage: boolean; requestHref: string; artwork: CampaignArtwork; onRefresh: () => void }) {
  const t = productionText(locale), router = useRouter(), params = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(params.get("item"));
  const [versionId, setVersionId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [action, setAction] = useState<"approve" | "requestChanges" | null>(null);
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  const lock = useRef(false);
  const item = items.find(value => value.id === selectedId) ?? items.find(value => value.status === "BRAND_REVIEW") ?? items[0];
  if (!item) return <div className={styles.empty}><IconClock /><Typography as="h2" variant="heading2" weight="bold">{t("제작 일정이 준비되면 확인할 수 있습니다", "Production appears once the lineup is ready", "制作安排就绪后可在此查看")}</Typography><Typography as="p" variant="body2" className={styles.muted}>{t("공식 제안의 승인이 완료된 구성부터 제작이 시작됩니다. 퓨쳐스가 확인해 공유한 콘텐츠만 이곳에 표시됩니다.", "Production starts with approved proposal items. Only content reviewed and shared by Futures appears here.", "已批准的正式方案项目将进入制作，只有经 Futures 确认并共享的内容会显示在此。")}</Typography><Button as={Link} href={requestHref} variant="outlined" color="assistive" size="small">{t("진행 문의", "Ask about progress", "咨询进度")}</Button></div>;
  const versions = [...item.submissions].sort((a, b) => b.version - a.version);
  const version = versions.find(value => value.id === versionId) ?? versions[0];
  const comparison = version?.id === versions[0]?.id ? versions[1] : versions[0];
  const canRespond = Boolean(canManage && item.canRespond && version?.canRespond && version.isLatest);
  function chooseItem(id: string) {
    setSelectedId(id); setVersionId(null); setComparing(false); setError(""); setAction(null);
    router.replace(`/advertiser/campaign/${encodeURIComponent(item.campaignId)}?lang=${locale}&tab=production&item=${encodeURIComponent(id)}`, { scroll: false });
  }
  function openAction(next: "approve" | "requestChanges") {
    setAction(next); setMessage(""); setConfirmed(false); setError(""); setConflict(false); attempt.current = null;
    router.replace(`/advertiser/campaign/${encodeURIComponent(item.campaignId)}?lang=${locale}&tab=production&item=${encodeURIComponent(item.id)}`, { scroll: false });
  }
  async function submit() {
    if (!action || !version || !canRespond || lock.current || (action === "approve" ? !confirmed : message.trim().length < 2)) return;
    const body = { action, productionItemId: item.id, submissionId: version.id, expectedRevision: item.revision, message: message.trim() };
    const signature = JSON.stringify(body);
    if (attempt.current?.signature !== signature) attempt.current = { signature, id: crypto.randomUUID() };
    const payload: BrandProductionMutation = { ...body, clientRequestId: attempt.current.id };
    lock.current = true; setBusy(true); setError(""); setConflict(false);
    try {
      const response = await fetch("/api/brand/production", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) { setConflict(response.status === 409); throw new Error(result.message ?? t("처리하지 못했습니다.", "Could not save your decision.", "无法保存决定。")); }
      setAction(null); onRefresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("잠시 후 다시 시도해 주세요.", "Please try again shortly.", "请稍后重试。")); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className={styles.workspace}>
    <div className={styles.heading}><div><Typography as="h2" variant="title3" weight="bold">{t("제작·검수", "Production & review", "制作与审核")}</Typography><Typography variant="body2" className={styles.muted}>{t("공유된 콘텐츠를 확인하고, 승인 또는 수정 의견을 전달하세요.", "Review shared content and approve it or send revision feedback.", "查看共享内容并批准或提交修改意见。")}</Typography></div><Typography variant="label1">{t(`${items.filter(value => value.status === "APPROVED").length} / ${items.length}개 승인`, `${items.filter(value => value.status === "APPROVED").length} / ${items.length} approved`, `${items.filter(value => value.status === "APPROVED").length} / ${items.length} 项已批准`)}</Typography></div>
    <div className={styles.layout}><div className={styles.tasks} aria-label={t("제작 구성", "Production items", "制作项目")}>{items.map(value => <Button key={value.id} variant="outlined" color="assistive" className={`${styles.task} ${value.id === item.id ? styles.taskActive : ""}`} sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px", height: "auto", padding: "20px" }} aria-pressed={value.id === item.id} onClick={() => chooseItem(value.id)}><ProductionBadge status={value.status} locale={locale} /><Typography as="strong" variant="label1" weight="bold">{value.creatorName}</Typography><Typography variant="caption1" className={styles.muted}>{value.platform} · {value.deliverables}</Typography></Button>)}</div>
      <div className={styles.detail}><section className={styles.card}><div className={styles.cardHead}><div><Typography as="h3" variant="heading2" weight="bold">{item.creatorName}</Typography><Typography variant="caption1" className={styles.muted}>{t("승인 제안", "Approved proposal", "已批准方案")} v{item.proposalVersion} · {item.platform}</Typography></div><ProductionBadge status={item.status} locale={locale} /></div><dl className={styles.scope}><div><dt>{t("제작 범위", "Deliverables", "交付内容")}</dt><dd>{item.deliverables} · {item.quantity}{t("개", " items", " 项")}</dd></div><div><dt>{t("예정 일정", "Scheduled", "计划时间")}</dt><dd>{productionDate(item.scheduledAt, locale)}</dd></div><div><dt>{t("활용 범위", "Usage rights", "使用范围")}</dt><dd>{item.rights}</dd></div></dl></section>
        {version ? <section className={styles.card}>
          <div className={styles.versionControls}><Select aria-label={t("공유된 콘텐츠 버전", "Shared content version", "共享内容版本")} value={version.id} onChange={value => { setVersionId(value); setComparing(false); }} size="medium" width="100%">{versions.map(value => <Option key={value.id} value={value.id}>v{value.version} · {value.isLatest ? t("최신 공유본", "Latest shared version", "最新共享版本") : t("이전 공유본", "Previous shared version", "历史共享版本")}</Option>)}</Select>{comparison && <Button variant="outlined" color="assistive" size="small" onClick={() => setComparing(value => !value)}>{comparing ? t("비교 닫기", "Close comparison", "关闭比较") : t("버전 비교", "Compare versions", "版本比较")}</Button>}</div>
          <ProductionArtwork artwork={artwork} locale={locale} />
          {comparing && comparison ? <div className={styles.compare}><VersionContent version={comparison} locale={locale} timestamp={comparison.releasedAt} label={t("비교 버전", "Comparison version", "比较版本")} /><VersionContent version={version} locale={locale} timestamp={version.releasedAt} label={t("선택 버전", "Selected version", "所选版本")} /></div> : <VersionContent version={version} locale={locale} timestamp={version.releasedAt} label={t("퓨쳐스 공유본", "Shared by Futures", "Futures 共享版本")} />}
          {version.brandDecision && <div className={styles.feedback}><SectionMessage variant={version.brandDecision === "APPROVE" ? "positive" : "cautionary"} description={version.brandMessage || productionDate(version.brandDecidedAt, locale)}>{version.brandDecision === "APPROVE" ? t("이 버전은 승인되었습니다", "This version was approved", "此版本已批准") : t("이 버전에 수정을 요청했습니다", "Changes were requested for this version", "已对此版本请求修改")}</SectionMessage></div>}
          {!canRespond && <div className={styles.feedback}><SectionMessage variant="info">{!canManage ? t("소유자와 관리자만 검수 결정을 할 수 있습니다.", "Only owners and admins can approve content.", "只有所有者和管理员可以作出审核决定。") : version.responseDisabledReason ?? item.responseDisabledReason ?? t("확인용 공유본입니다. 새 공유본이 도착하면 검수할 수 있습니다.", "This shared version is read-only. Review the next version when it arrives.", "此共享版本仅供查看，新版本到达后可审核。")}</SectionMessage></div>}
          {canRespond && <div className={styles.actionBar}><Button variant="outlined" color="assistive" onClick={() => openAction("requestChanges")}>{t("수정 요청", "Request changes", "请求修改")}</Button><Button leadingContent={<IconCheck />} onClick={() => openAction("approve")}>{t("이 버전 승인", "Approve this version", "批准此版本")}</Button></div>}
        </section> : <div className={styles.empty}><IconClock /><Typography as="h3" variant="heading2" weight="bold">{t("아직 공유된 검수 콘텐츠가 없습니다", "No content has been shared for review yet", "尚未共享待审核内容")}</Typography><Typography as="p" variant="body2" className={styles.muted}>{t("제작과 퓨쳐스 검토가 끝나면 공유된 버전을 확인할 수 있습니다.", "A reviewed version will appear after production and Futures review.", "制作及 Futures 审核完成后即可查看共享版本。")}</Typography></div>}
      </div>
    </div>
    <Modal open={action !== null} onOpenChange={open => { if (!open && !busy) setAction(null); }}><ModalContainer variant="popup" size="medium" className={styles.dialog} disableOutsideClickClose={busy} disableEscapeKeyDownClose={busy} aria-label={action === "approve" ? t("콘텐츠 승인 확인", "Confirm content approval", "确认批准内容") : t("콘텐츠 수정 요청", "Request content changes", "请求修改内容")}><ModalNavigation trailingContent={<ModalNavigationButton variant="close-button" disabled={busy} aria-label={t("닫기", "Close", "关闭")} />}>{action === "approve" ? t("이 콘텐츠를 승인할까요?", "Approve this content?", "批准此内容？") : t("수정 의견을 전달해 주세요", "Send revision feedback", "请提交修改意见")}</ModalNavigation><ModalContent verticalPadding="bottom-only" gap="20px"><div className={styles.dialogSummary}><Typography variant="caption1">{item.creatorName} · v{version?.version}</Typography><Typography as="h3" variant="heading2" weight="bold">{version?.title}</Typography></div>{action === "approve" ? <div className={styles.confirm}><Checkbox id="content-approval-confirm" checked={confirmed} onCheckedChange={setConfirmed} disabled={busy} /><label htmlFor="content-approval-confirm">{t("선택한 버전의 콘텐츠와 제작 조건을 확인했습니다.", "I have reviewed this version and its production requirements.", "我已确认所选版本及制作要求。")}</label></div> : <div className={styles.field}><label htmlFor="content-revision-message">{t("수정 요청 내용", "Revision feedback", "修改意见")} *</label><TextArea id="content-revision-message" width="100%" minRows={4} maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} disabled={busy} placeholder={t("수정할 장면, 문구, 구간을 구체적으로 알려주세요.", "Describe the scenes, wording, or timestamps to change.", "请具体说明需要修改的画面、文案或时间段。")}/><span className={styles.fieldHint}>{t("2자 이상 입력해 주세요.", "Enter at least 2 characters.", "请输入至少2个字符。")}</span></div>}{error && <SectionMessage variant="negative" role="alert" bottomButton={conflict ? <Button size="small" variant="outlined" color="assistive" onClick={onRefresh}>{t("최신 상태 확인", "Refresh status", "刷新状态")}</Button> : undefined}>{error}</SectionMessage>}</ModalContent><ActionArea variant="neutral"><ActionAreaButton variant="alternative" disabled={busy} onClick={() => setAction(null)}>{t("돌아가기", "Go back", "返回")}</ActionAreaButton><ActionAreaButton variant="main" loading={busy} disabled={conflict || (action === "approve" ? !confirmed : message.trim().length < 2)} onClick={() => void submit()}>{action === "approve" ? t("승인 확정", "Confirm approval", "确认批准") : t("수정 요청 보내기", "Send change request", "提交修改请求")}</ActionAreaButton></ActionArea></ModalContainer></Modal>
  </div>;
}
