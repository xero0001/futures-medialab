"use client";
import { useEffect, useRef } from "react";
import {
  ArrowRight,
  FileText,
  Inbox,
  UserRound,
  ClipboardCheck,
} from "lucide-react";
import type { AdminAction, CampaignDetail } from "../lib/types";
import {
  campaignSections,
  type CampaignSection,
} from "../lib/admin-navigation";
import { AdminButton } from "./_components/admin-button";
import { OfficialProposals } from "./official-proposals";
import { ProductionReview } from "./production-review";
import { ReportingReview } from "./reporting-review";
import { CampaignSettlement } from "./campaign-settlement";
import CampaignOperations from "./campaign-operations";
import { AdminSourcing } from "./admin-sourcing";
import { AdminCampaignDocuments } from "./admin-campaign-documents";
import { OperationsDashboard } from "./operations-dashboard";
import "./admin-workspace.css";
type Operation = {
  action: AdminAction;
  id: string;
  title: string;
  message: string;
};
const labels: Record<string, string> = {
  DRAFT: "초안·보완",
  REVIEW: "접수 검토",
  RECRUITING: "모집 중",
  IN_PROGRESS: "진행 중",
  VERIFYING: "콘텐츠 검수",
  SETTLING: "정산",
  COMPLETED: "완료",
  CANCELED: "취소",
  REQUESTED: "접수 대기",
  WAITING_BRAND: "브랜드 회신 대기",
  RESOLVED: "처리 완료",
  CLOSED: "종료",
};
const date = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      }).format(new Date(value))
    : "미등록";
const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const content = (v: unknown) =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
export function AdminCampaignWorkspace({
  detail,
  section,
  userId,
  busy,
  onSection,
  onRequest,
  onOperation,
  onCommitted,
}: {
  detail: CampaignDetail;
  section: CampaignSection;
  userId: string;
  busy: boolean;
  onSection: (section: CampaignSection) => void;
  onRequest: (id: string) => void;
  onOperation: (operation: Operation) => void;
  onCommitted: () => void;
}) {
  const tabsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = tabsRef.current;
    const active = nav?.querySelector<HTMLElement>("[aria-current='page']");
    if (!nav || !active) return;
    const bounds = nav.getBoundingClientRect(),
      item = active.getBoundingClientRect();
    if (item.left < bounds.left) nav.scrollLeft += item.left - bounds.left;
    else if (item.right > bounds.right)
      nav.scrollLeft += item.right - bounds.right;
  }, [section]);
  const c = detail.campaign,
    brief = object(object(detail.requirements).brandBrief),
    intake = detail.intakeSummary;
  const delegation = object(object(detail.requirements).delegatedIntake);
  const channelLabels: Record<string, string> = {
    email: "이메일",
    meeting: "미팅",
    phone: "전화",
    messenger: "메신저",
    other: "기타",
  };
  const status =
    c.type === "MANAGED" && c.status === "RECRUITING"
      ? "소싱 중"
      : (labels[c.status] ?? c.status);
  const intakeLabel =
    intake?.waitingFor === "proposal-decision"
      ? "제안 결정 대기"
      : intake?.waitingFor === "brief"
        ? "브리프 보완 대기"
        : intake?.status
          ? (labels[intake.status] ?? intake.status)
          : "접수 의뢰 미연결";
  return (
    <div className="acw">
      <div className="acw-summary">
        <div>
          <span className={`admin-badge state-${c.status.toLowerCase()}`}>
            {status}
          </span>
          <span className="acw-route">
            {c.type === "MANAGED" ? "맞춤 의뢰" : "오픈 모집"} · {c.brandName}
          </span>
        </div>
        <div className="acw-quick">
          <span>
            <UserRound size={15} />
            {intake?.assigneeName ?? "담당자 미배정"}
          </span>
          {intake ? (
            <AdminButton type="button" onClick={() => onRequest(intake.id)}>
              <Inbox size={15} />
              연결 요청
            </AdminButton>
          ) : null}
        </div>
      </div>
      <nav ref={tabsRef} className="acw-tabs" aria-label="캠페인 운영 단계">
        {campaignSections.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-current={section === key ? "page" : undefined}
            onClick={() => onSection(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="acw-content" key={`${c.id}:${section}`}>
        {section === "overview" ? (
          <>
            <div className="acw-overview-grid">
              <section className="acw-card">
                <div className="acw-card-title">
                  <ClipboardCheck size={18} />
                  <h3>진행 및 담당</h3>
                </div>
                <dl className="acw-fields">
                  <div>
                    <dt>현재 캠페인 단계</dt>
                    <dd>{status}</dd>
                  </div>
                  <div>
                    <dt>접수 의뢰</dt>
                    <dd>{intakeLabel}</dd>
                  </div>
                  {content(delegation.requestId) && (
                    <>
                      <div>
                        <dt>실제 의뢰자</dt>
                        <dd>{content(delegation.requesterName)}</dd>
                      </div>
                      <div>
                        <dt>대리 접수 운영자</dt>
                        <dd>{content(delegation.registeredByName)}</dd>
                      </div>
                      <div>
                        <dt>최종 광고주</dt>
                        <dd>{content(delegation.finalAdvertiserName)}</dd>
                      </div>
                      <div>
                        <dt>접수 경로</dt>
                        <dd>
                          {channelLabels[content(delegation.channel)] ?? "기타"}
                        </dd>
                      </div>
                    </>
                  )}
                  <div>
                    <dt>운영 담당자</dt>
                    <dd>{intake?.assigneeName ?? "미배정"}</dd>
                  </div>
                  <div>
                    <dt>최초 제안 약속</dt>
                    <dd>
                      {c.type === "MANAGED"
                        ? date(intake?.originalProposalDueAt)
                        : "오픈 모집 캠페인"}
                    </dd>
                  </div>
                  <div>
                    <dt>현재 요청 처리 기한</dt>
                    <dd>{date(intake?.dueAt)}</dd>
                  </div>
                  <div>
                    <dt>
                      {c.type === "MANAGED" ? "희망 게시일" : "모집 마감"}
                    </dt>
                    <dd>
                      {date(
                        c.type === "MANAGED"
                          ? detail.contentDeadline
                          : c.applicationDeadline,
                      )}
                    </dd>
                  </div>
                </dl>
                {intake ? (
                  <AdminButton
                    type="button"
                    onClick={() => onRequest(intake.id)}
                  >
                    담당자·기한·회신 관리
                    <ArrowRight size={15} />
                  </AdminButton>
                ) : (
                  <p className="admin-note">
                    연결된 접수 의뢰가 없습니다. 후보와 제안 작업은 해당 탭에서
                    확인하세요.
                  </p>
                )}
              </section>
              <section className="acw-card">
                <div className="acw-card-title">
                  <FileText size={18} />
                  <h3>브리프</h3>
                </div>
                <p className="admin-pre">
                  {detail.summary || "등록된 요약이 없습니다."}
                </p>
                <dl className="acw-fields">
                  <div>
                    <dt>예산</dt>
                    <dd>
                      {c.budgetAmount
                        ? `${c.currency} ${Number(c.budgetAmount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                        : "미등록"}
                    </dd>
                  </div>
                  <div>
                    <dt>매체</dt>
                    <dd>{c.platforms.join(" · ") || "미등록"}</dd>
                  </div>
                  <div>
                    <dt>지역</dt>
                    <dd>{detail.regions.join(" · ") || "미지정"}</dd>
                  </div>
                  {[
                    ["장르", brief.genre],
                    ["목표", brief.goal],
                    ["콘텐츠 형식", brief.contentFormat],
                    ["크리에이터 수", brief.creatorCount],
                    [
                      "구성 방향",
                      (
                        {
                          balanced: "요청 충족",
                          reach: "화제성",
                          efficient: "예산 효율",
                        } as Record<string, string>
                      )[content(brief.compositionPreference)],
                    ],
                    ["추가 요청", brief.note],
                  ]
                    .filter(([, v]) => content(v))
                    .map(([label, v]) => (
                      <div key={String(label)}>
                        <dt>{String(label)}</dt>
                        <dd>{content(v)}</dd>
                      </div>
                    ))}
                </dl>
                {detail.briefUrl ? (
                  <a href={detail.briefUrl} target="_blank" rel="noreferrer">
                    브리프 자료 열기 ↗
                  </a>
                ) : null}
              </section>
            </div>
            {c.reviewReason ? (
              <p className="admin-note">최근 검토 사유: {c.reviewReason}</p>
            ) : null}
            {c.status === "REVIEW" || c.status === "RECRUITING" ? (
              <section className="acw-card">
                <h3>접수 및 소싱 관리</h3>
                <div className="admin-actions">
                  {c.status === "REVIEW" ? (
                    <>
                      <AdminButton
                        type="button"
                        className="primary"
                        disabled={busy || c.brandStatus !== "ACTIVE"}
                        onClick={() =>
                          onOperation({
                            action: "publishCampaign",
                            id: c.id,
                            title:
                              c.type === "MANAGED"
                                ? "맞춤 제안 승인 · 소싱 시작"
                                : "캠페인 승인 · 공개",
                            message:
                              c.type === "MANAGED"
                                ? "브리프를 확인하고 맞춤 소싱을 시작합니다. 공식 제안의 인물과 조건은 별도 발행 후 브랜드에 공개됩니다."
                                : "승인된 에이전시가 캠페인을 조회하고 신청할 수 있게 공개합니다. 모집 마감과 예산을 확인해 주세요.",
                          })
                        }
                      >
                        {c.type === "MANAGED"
                          ? "승인 · 소싱 시작"
                          : "승인 · 에이전시에 공개"}
                      </AdminButton>
                      <AdminButton
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onOperation({
                            action: "returnCampaign",
                            id: c.id,
                            title: "캠페인 보완 요청",
                            message:
                              "캠페인을 비공개 초안으로 돌려보내고 연결된 의뢰에 보완 사유를 전달합니다. 브랜드가 수정 후 재접수할 수 있습니다.",
                          })
                        }
                      >
                        보완 요청
                      </AdminButton>
                    </>
                  ) : (
                    <AdminButton
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        onOperation({
                          action: "closeCampaign",
                          id: c.id,
                          title:
                            c.type === "MANAGED"
                              ? "소싱 완료 · 진행 단계로 변경"
                              : "캠페인 모집 마감",
                          message:
                            "캠페인을 진행 단계로 변경합니다. 공식 제안의 발행과 브랜드 승인은 별도로 확인해야 합니다.",
                        })
                      }
                    >
                      {c.type === "MANAGED" ? "소싱 완료 · 진행" : "모집 마감"}
                    </AdminButton>
                  )}
                </div>
              </section>
            ) : null}
            {!["CANCELED", "COMPLETED"].includes(c.status) && (
              <section className="acw-card">
                <h3>캠페인 종료</h3>
                <AdminButton
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onOperation({
                      action: "cancelCampaign",
                      id: c.id,
                      title: "캠페인 취소",
                      message:
                        "취소 사유와 이미 발생한 비용의 처리 방법을 기록해 주세요. 취소하면 새 신청·제작·성과 등록이 중단되고 기존 기록은 보관됩니다.",
                    })
                  }
                >
                  캠페인 취소
                </AdminButton>
              </section>
            )}
            <OperationsDashboard
              userId={userId}
              campaignId={c.id}
              compact
              onCampaign={(_, target) => onSection(target)}
              onRequest={onRequest}
            />
          </>
        ) : null}
        {section === "sourcing" ? (
          <AdminSourcing
            campaignId={c.id}
            onChanged={onCommitted}
            onProposal={() => onSection("proposal")}
          />
        ) : null}
        {section === "proposal" ? (
          <OfficialProposals
            campaignId={c.id}
            campaignTitle={c.title}
            campaignCurrency={c.currency}
            campaignStatus={c.status}
            brandActive={c.brandStatus === "ACTIVE"}
            onCommitted={onCommitted}
          />
        ) : null}
        {section === "production" ? (
          <ProductionReview campaignId={c.id} />
        ) : null}
        {section === "reporting" ? <ReportingReview campaignId={c.id} /> : null}
        {section === "documents" ? (
          <AdminCampaignDocuments
            campaignId={c.id}
            onNavigate={onSection}
            onRequest={onRequest}
          />
        ) : null}
        {section === "settlement" ? (
          <CampaignSettlement
            campaignId={c.id}
            onCampaignCompleted={onCommitted}
          />
        ) : null}
        {section === "legacy" ? (
          <CampaignOperations campaignId={c.id} includeDelivery={false} />
        ) : null}
      </div>
    </div>
  );
}
