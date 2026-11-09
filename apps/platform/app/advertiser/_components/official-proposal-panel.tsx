"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ActionArea, ActionAreaButton, Button, Checkbox, ContentBadge,
  Modal, ModalContainer, ModalContent, ModalNavigation, ModalNavigationButton,
  Option, SectionMessage, Select, TextArea, Typography,
} from "@montage-ui/core";
import { IconArrowUpRight, IconCheck, IconClock, IconLock } from "@montage-ui/icon";
import type { BrandProposal, BrandProposalItem, BrandProposalMutation, ProposalDecisionKind } from "@futures-medialab/database/proposal-types";
import type { Locale } from "../../_components/landing-copy";
import { StatusBadge } from "../../_components/workspace/status-badge";
import styles from "./official-proposal-panel.module.css";
import { ProposalChannelAvatar } from "./proposal-channel-avatar";

type Copy = (ko: string, en: string, zh: string) => string;
const copyFor = (locale: Locale): Copy => (ko, en, zh) => ({ ko, en, zh })[locale];
const statusLabel = (status: BrandProposal["status"], t: Copy) => ({
  PUBLISHED: t("승인 대기", "Awaiting approval", "待审批"),
  APPROVED: t("승인 완료", "Approved", "已批准"),
  CHANGES_REQUESTED: t("수정 요청", "Changes requested", "已请求修改"),
  REJECTED: t("재제안 요청", "Replacement requested", "已请求重新提案"),
  SUPERSEDED: t("이전 버전", "Previous version", "历史版本"),
})[status];
const itemStatusLabel = (status: BrandProposalItem["status"], t: Copy) => ({
  PENDING: t("확인 대기", "Pending", "待确认"),
  APPROVED: t("승인 완료", "Approved", "已批准"),
  CHANGES_REQUESTED: t("수정 요청", "Changes requested", "已请求修改"),
  REJECTED: t("재제안 요청", "Replacement requested", "已请求重新提案"),
})[status];
const decisionLabel = (kind: ProposalDecisionKind, t: Copy) => ({
  APPROVE: t("구성 승인", "Items approved", "已批准项目"),
  REQUEST_CHANGES: t("수정 요청", "Changes requested", "已请求修改"),
  REJECT: t("재제안 요청", "Replacement requested", "已请求重新提案"),
})[kind];

export function proposalMoney(value: string, currency: BrandProposal["currency"], locale: Locale) {
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount) : "—";
}

function dateLabel(value: string | null, locale: Locale) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function publicChannel(value: string) {
  try {
    const url = new URL(value);
    return url.hostname !== "example.invalid" && (url.protocol === "https:" || url.protocol === "http:") ? url.href : null;
  } catch { return null; }
}

export function OfficialProposalPanel({ proposals, locale, canManage, requestHref, onRefresh }: {
  proposals: BrandProposal[];
  locale: Locale;
  canManage: boolean;
  requestHref: string;
  onRefresh: () => void;
}) {
  const t = copyFor(locale);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [decision, setDecision] = useState<{ kind: "APPROVE" | "REQUEST_CHANGES"; itemIds: string[] } | null>(null);
  const [message, setMessage] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const requestAttempt = useRef<{ signature: string; id: string } | null>(null);
  const submitting = useRef(false);
  const versions = [...proposals].sort((a, b) => b.version - a.version);
  const proposal = versions.find(item => item.id === selectedVersion) ?? versions[0];

  if (!proposal) return <div className={styles.empty}>
    <IconLock aria-hidden="true" />
    <Typography as="h2" variant="heading2" weight="bold">{t("공식 제안을 준비하고 있습니다", "Your official proposal is being prepared", "正在准备正式方案")}</Typography>
    <Typography as="p" variant="body2" className={styles.muted}>{t("퓨쳐스가 캠페인에 맞는 구성을 확인한 뒤 제안을 공유합니다. 발행 전에는 크리에이터의 이름과 채널이 공개되지 않습니다.", "Futures reviews the campaign lineup before sharing an official proposal. Creator names and channels remain hidden until publication.", "Futures 确认符合活动的组合后将共享正式方案。发布前不会公开达人名称和频道。")}</Typography>
    <Button as={Link} href={requestHref} variant="outlined" color="assistive" size="small">{t("퓨쳐스에 문의", "Contact Futures", "联系 Futures")}</Button>
  </div>;

  const pendingItems = proposal.items.filter(item => item.status === "PENDING");
  const selected = pendingItems.filter(item => selectedIds === null || selectedIds.includes(item.id));
  const canRespond = canManage && proposal.isLatest && proposal.canRespond;
  const decisionItems = proposal.items.filter(item => decision?.itemIds.includes(item.id));
  const decisionReady = decision?.kind === "APPROVE" ? acknowledged : message.trim().length >= 2;

  function chooseVersion(id: string) {
    setSelectedVersion(id); setSelectedIds(null); setDecision(null);
    setMessage(""); setAcknowledged(false); setError(""); setConflict(false);
    requestAttempt.current = null;
  }
  function chooseItem(id: string, checked: boolean) {
    const current = selected.map(item => item.id);
    setSelectedIds(checked ? [...current, id] : current.filter(value => value !== id));
  }
  function openDecision(kind: "APPROVE" | "REQUEST_CHANGES") {
    if (!canRespond || !selected.length) return;
    setDecision({ kind, itemIds: selected.map(item => item.id) });
    setMessage(""); setAcknowledged(false); setError(""); setConflict(false);
    requestAttempt.current = null;
  }
  async function submitDecision() {
    if (!decision || !proposal || !canRespond || !decisionReady || submitting.current) return;
    const body = {
      action: "decide" as const,
      proposalId: proposal.id,
      expectedRevision: proposal.revision,
      decision: decision.kind,
      itemIds: decision.itemIds,
      message: message.trim(),
    };
    const signature = JSON.stringify(body);
    if (requestAttempt.current?.signature !== signature)
      requestAttempt.current = { signature, id: crypto.randomUUID() };
    const payload: BrandProposalMutation = { ...body, clientRequestId: requestAttempt.current.id };
    submitting.current = true;
    setBusy(true); setError(""); setConflict(false);
    try {
      const response = await fetch("/api/brand/proposals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) {
        setConflict(response.status === 409);
        throw new Error(typeof result.message === "string" ? result.message : t("처리하지 못했습니다. 다시 확인해 주세요.", "Could not save your decision. Please try again.", "无法保存您的决定，请重试。"));
      }
      setDecision(null);
      onRefresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("저장 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도할 수 있습니다.", "Could not confirm the saved result. You may retry the same request.", "无法确认保存结果，可重试同一请求。"));
    } finally { submitting.current = false; setBusy(false); }
  }

  return <div className={styles.panel}>
    <div className={styles.heading}>
      <div><Typography as="h2" variant="title3" weight="bold">{t("공식 제안", "Official proposal", "正式方案")}</Typography><Typography variant="body2" className={styles.muted}>{t("캠페인 구성과 견적, 진행 조건을 확인해 주세요.", "Review the lineup, quote, and campaign terms.", "请确认活动组合、报价和执行条件。")}</Typography></div>
      {versions.length > 1 && <div className={styles.version}><Select aria-label={t("제안 버전", "Proposal version", "方案版本")} value={proposal.id} onChange={chooseVersion} width="100%" size="medium">{versions.map(version => <Option key={version.id} value={version.id}>{`v${version.version} · ${version.isLatest ? t("최신 제안", "Latest", "最新") : statusLabel(version.status, t)}`}</Option>)}</Select></div>}
    </div>

    <section className={styles.hero}>
      <div className={styles.heroMain}><div className={styles.badges}><StatusBadge tone={proposal.status === "APPROVED" ? "green" : proposal.status === "REJECTED" ? "red" : proposal.status === "SUPERSEDED" ? "neutral" : "amber"}>{statusLabel(proposal.status, t)}</StatusBadge><ContentBadge size="small">v{proposal.version}</ContentBadge>{proposal.isLatest && <ContentBadge variant="outlined" size="small">{t("최신 제안", "Latest", "最新方案")}</ContentBadge>}</div><Typography as="h3" variant="heading1" weight="bold">{proposal.title}</Typography><Typography as="p" variant="body2">{proposal.summary}</Typography></div>
      <div className={styles.total}><Typography variant="label2" className={styles.muted}>{t("제안 총액", "Total proposal", "方案总额")}</Typography><Typography as="strong" variant="title2" weight="bold">{proposalMoney(proposal.totalAmount, proposal.currency, locale)}</Typography><Typography variant="caption1">{proposal.currency} · {t(`${proposal.items.length}개 구성`, `${proposal.items.length} items`, `${proposal.items.length} 项组合`)}</Typography></div>
      <div className={styles.metadata}><Typography variant="caption1">{t("발행", "Published", "发布时间")} · {dateLabel(proposal.publishedAt, locale)}</Typography><Typography variant="caption1">{t("제안 유효 기한", "Valid until", "有效期至")} · {dateLabel(proposal.expiresAt, locale)}</Typography></div>
    </section>

    {proposal.changeSummary && <SectionMessage variant="info" description={proposal.changeSummary}>{t("이전 제안에서 변경된 내용", "Changes from the previous proposal", "与上一版本相比的变更")}</SectionMessage>}
    {!canRespond && <SectionMessage variant={proposal.status === "APPROVED" ? "positive" : "info"} description={proposal.status === "APPROVED" ? t("승인한 구성과 조건으로 캠페인이 진행됩니다. 추가 요청은 퓨쳐스에 전달해 주세요.", "The campaign proceeds with the approved lineup and terms. Send any additional requests to Futures.", "活动将按已批准的组合及条件执行。如有其他需求，请联系 Futures。") : !canManage ? t("조직 소유자와 관리자만 승인하거나 수정을 요청할 수 있습니다.", "Only organization owners and admins can approve or request changes.", "只有组织所有者和管理员可以批准或请求修改。") : proposal.responseDisabledReason ?? t("현재 이 제안에 응답할 수 없습니다. 최신 제안을 확인해 주세요.", "This proposal is not accepting responses. Check the latest version.", "当前无法对此方案作出决定，请查看最新版本。")}>{proposal.status === "APPROVED" ? t("제안 승인이 완료되었습니다", "Proposal approved", "方案已批准") : !proposal.isLatest ? t("이전 버전을 보고 있습니다", "You are viewing a previous version", "您正在查看历史版本") : t("제안 확인", "Proposal review", "方案确认")}</SectionMessage>}

    <section className={styles.box}>
      <div className={styles.boxHeading}><Typography as="h3" variant="heading2" weight="bold">{t("제안 구성", "Proposed lineup", "提案组合")}</Typography>{canRespond && pendingItems.length > 0 && <div className={styles.agreement}><Checkbox id="proposal-select-all" checked={selected.length === pendingItems.length} indeterminate={selected.length > 0 && selected.length < pendingItems.length} onCheckedChange={checked => setSelectedIds(checked ? pendingItems.map(item => item.id) : [])} size="small" /><label htmlFor="proposal-select-all">{t("대기 구성 전체 선택", "Select all pending items", "选择全部待确认项目")}</label></div>}</div>
      {proposal.items.map((item) => <article key={item.id} className={styles.creator}>
        <div className={styles.identity}>
          {canRespond && item.status === "PENDING" && <Checkbox checked={selected.some(value => value.id === item.id)} onCheckedChange={checked => chooseItem(item.id, checked)} aria-label={t(`${item.creatorName} 구성 선택`, `Select ${item.creatorName}`, `选择 ${item.creatorName}`)} size="small" />}
          <ProposalChannelAvatar name={item.channelLabel || item.creatorName} channelUrl={item.channelUrl} thumbnailUrl={item.channelThumbnailUrl} alt={t(`${item.channelLabel || item.creatorName} 채널 프로필 이미지`, `${item.channelLabel || item.creatorName} channel profile image`, `${item.channelLabel || item.creatorName} 频道头像`)} />
          <div><Typography as="strong" variant="label1" weight="bold">{item.creatorName}</Typography><Typography variant="caption1" className={styles.muted}>{item.platform} · {item.channelLabel}</Typography>{publicChannel(item.channelUrl) ? <a href={publicChannel(item.channelUrl)!} className={styles.channel} target="_blank" rel="noopener noreferrer">{t("공식 채널 보기", "View channel", "查看频道")}<IconArrowUpRight /></a> : item.channelUrl.startsWith("https://example.invalid/") ? <Typography variant="caption1" className={styles.muted}>{t("시연용 채널 · 외부 연결 없음", "Demo channel · no external link", "演示频道 · 无外部链接")}</Typography> : null}<StatusBadge size="xsmall" tone={item.status === "APPROVED" ? "green" : item.status === "REJECTED" ? "red" : "amber"}>{itemStatusLabel(item.status, t)}</StatusBadge></div>
        </div>
        <div className={styles.deliverables}><Typography as="p" variant="body2" weight="medium">{item.deliverables}</Typography><Typography variant="caption1" className={styles.muted}>{t("예정 일정", "Scheduled", "计划时间")} · {dateLabel(item.scheduledAt, locale)}</Typography>{item.rights && <Typography as="p" variant="caption1" className={styles.muted}>{t("활용 범위", "Usage rights", "使用范围")} · {item.rights}</Typography>}<div className={styles.metrics}>{item.followers !== null && <Typography variant="caption1" className={styles.metric}><span className={styles.muted}>{t("팔로워", "Followers", "粉丝")}</span><span>{item.followers.toLocaleString(locale)}</span></Typography>}{item.averageViews !== null && <Typography variant="caption1" className={styles.metric}><span className={styles.muted}>{t("평균 조회", "Average views", "平均观看")}</span><span>{item.averageViews.toLocaleString(locale)}</span></Typography>}</div></div>
        <div className={styles.price}><Typography as="strong" variant="label1" weight="bold">{proposalMoney(item.totalAmount, proposal.currency, locale)}</Typography><Typography variant="caption1" className={styles.muted}>{proposalMoney(item.unitAmount, proposal.currency, locale)} × {item.quantity}</Typography></div>
      </article>)}
    </section>

    <div className={styles.summary}>
      <section className={styles.box}><div className={styles.boxHeading}><Typography as="h3" variant="heading2" weight="bold">{t("진행 조건", "Campaign terms", "执行条件")}</Typography></div><Typography as="p" variant="body2" className={styles.terms}>{proposal.terms}</Typography></section>
      <section className={styles.box}><div className={styles.boxHeading}><Typography as="h3" variant="heading2" weight="bold">{t("견적 요약", "Quote summary", "报价摘要")}</Typography></div><dl className={styles.amounts}><div><dt>{t("제안 구성", "Lineup", "提案组合")}</dt><dd>{t(`${proposal.items.length}개`, `${proposal.items.length} items`, `${proposal.items.length} 项`)}</dd></div><div><dt>{t("승인 완료", "Approved", "已批准")}</dt><dd>{t(`${proposal.items.filter(item => item.status === "APPROVED").length}개`, `${proposal.items.filter(item => item.status === "APPROVED").length} items`, `${proposal.items.filter(item => item.status === "APPROVED").length} 项`)}</dd></div><div className={styles.grandTotal}><dt>{t("총 제안 금액", "Total proposal amount", "方案总金额")}</dt><dd><Typography weight="bold">{proposalMoney(proposal.totalAmount, proposal.currency, locale)}</Typography></dd></div></dl></section>
    </div>

    {canRespond && <div className={styles.decisionBar}><div><Typography variant="label1" weight="bold">{t(`${selected.length}개 구성을 선택했습니다`, `${selected.length} items selected`, `已选择 ${selected.length} 项`)}</Typography><Typography variant="caption1" className={styles.muted}>{t("선택한 구성만 승인하거나 수정 요청할 수 있습니다.", "Approve or request changes for selected items only.", "仅对所选项目批准或请求修改。")}</Typography></div><div className={styles.decisionActions}><Button variant="outlined" color="assistive" disabled={!selected.length} onClick={() => openDecision("REQUEST_CHANGES")}>{t("수정 요청", "Request changes", "请求修改")}</Button><Button disabled={!selected.length} onClick={() => openDecision("APPROVE")} leadingContent={<IconCheck />}>{t("선택한 구성 승인", "Approve selected items", "批准所选项目")}</Button></div></div>}

    {proposal.decisions.length > 0 && <section className={styles.box}><div className={styles.boxHeading}><Typography as="h3" variant="heading2" weight="bold">{t("응답 이력", "Decision history", "决定记录")}</Typography></div><div className={styles.history}>{[...proposal.decisions].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(item => <article className={styles.historyItem} key={item.id}><span className={styles.historyIcon}>{item.decision === "APPROVE" ? <IconCheck /> : <IconClock />}</span><div><Typography variant="label1" weight="bold">{decisionLabel(item.decision, t)} · {t(`${item.itemIds.length}개 구성`, `${item.itemIds.length} items`, `${item.itemIds.length} 项组合`)}</Typography><Typography variant="caption1" className={styles.muted}>{dateLabel(item.createdAt, locale)}</Typography><Typography as="p" variant="caption1" className={styles.muted}>{proposal.items.filter(value => item.itemIds.includes(value.id)).map(value => value.creatorName).join(", ")}</Typography>{item.message && <Typography as="p" variant="body2">{item.message}</Typography>}</div></article>)}</div></section>}

    <Modal open={decision !== null} onOpenChange={open => { if (!open && !busy) setDecision(null); }}><ModalContainer size="medium" variant="popup" className={styles.dialog} disableOutsideClickClose={busy} disableEscapeKeyDownClose={busy} aria-label={decision?.kind === "APPROVE" ? t("제안 구성 승인 확인", "Confirm item approval", "确认批准所选项目") : t("제안 수정 요청", "Request proposal changes", "请求修改方案")}>
      <ModalNavigation trailingContent={<ModalNavigationButton variant="close-button" disabled={busy} aria-label={t("닫기", "Close", "关闭")} />}>{decision?.kind === "APPROVE" ? t("선택한 구성을 승인할까요?", "Approve selected items?", "批准所选项目？") : t("어떤 내용을 수정할까요?", "What should change?", "需要修改什么？")}</ModalNavigation>
      <ModalContent gap="20px" verticalPadding="bottom-only">
        <Typography as="p" variant="body2" className={styles.muted}>{decision?.kind === "APPROVE" ? t("아래 구성과 제안 조건을 확인해 주세요. 승인한 구성부터 제작을 시작하며, 나머지 구성은 계속 검토할 수 있습니다.", "Review the selected items and terms. Approved items can enter production while you review the remaining items.", "请确认所选项目及方案条件。已批准的项目可开始制作，其余项目可继续审核。") : t("선택한 구성에 대한 수정 의견을 퓨쳐스에 전달합니다. 나머지 대기 구성은 별도로 승인할 수 있습니다.", "Send Futures feedback on the selected items. Other pending items can be approved separately.", "向 Futures 提交所选项目的修改意见，其他待确认项目可另行批准。")}</Typography>
        <div className={styles.dialogSummary}><Typography variant="label1" weight="bold">{proposal.title} · v{proposal.version}</Typography>{decisionItems.map(item => <div key={item.id}><Typography variant="body2">{item.creatorName} · {item.quantity}{t("개", " items", " 项")}</Typography><Typography as="strong" variant="body2" weight="bold">{proposalMoney(item.totalAmount, proposal.currency, locale)}</Typography></div>)}<Typography variant="caption1" className={styles.muted}>{t("유효 기한", "Valid until", "有效期至")} · {dateLabel(proposal.expiresAt, locale)}</Typography></div>
        {decision?.kind === "APPROVE" ? <div className={styles.agreement}><Checkbox id="proposal-approval-confirm" checked={acknowledged} onCheckedChange={setAcknowledged} disabled={busy} /><label htmlFor="proposal-approval-confirm">{t("선택한 구성의 콘텐츠, 일정, 견적과 진행 조건을 확인했습니다.", "I have reviewed the deliverables, schedule, quote, and terms for the selected items.", "我已确认所选项目的内容、日程、报价和执行条件。")}</label></div> : <div className={styles.field}><label htmlFor="proposal-change-reason">{t("수정 요청 사유", "Reason for changes", "修改原因")} *</label><TextArea id="proposal-change-reason" value={message} onChange={event => setMessage(event.target.value)} disabled={busy} required maxLength={2000} minRows={4} width="100%" placeholder={t("변경할 구성, 콘텐츠, 일정 또는 조건을 구체적으로 알려주세요.", "Describe the lineup, deliverables, schedule, or terms to change.", "请具体说明需要修改的组合、内容、日程或条件。")}/><span className={styles.fieldHint}>{t("2자 이상 입력해 주세요.", "Enter at least 2 characters.", "请输入至少2个字符。")}</span></div>}
        {error && <SectionMessage variant="negative" role="alert" bottomButton={conflict ? <Button variant="outlined" color="assistive" size="small" onClick={onRefresh}>{t("최신 제안 다시 불러오기", "Refresh latest proposal", "重新加载最新方案")}</Button> : undefined}>{error}</SectionMessage>}
      </ModalContent>
      <ActionArea variant="neutral"><ActionAreaButton variant="alternative" disabled={busy} onClick={() => setDecision(null)}>{t("돌아가기", "Go back", "返回")}</ActionAreaButton><ActionAreaButton variant="main" loading={busy} disabled={!decisionReady || conflict} onClick={() => void submitDecision()}>{decision?.kind === "APPROVE" ? t("승인 확정", "Confirm approval", "确认批准") : t("수정 요청 보내기", "Send change request", "提交修改请求")}</ActionAreaButton></ActionArea>
    </ModalContainer></Modal>
  </div>;
}
