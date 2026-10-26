"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { CampaignOperationsData } from "../lib/types";
import "./campaign-operations.css";

type Application = CampaignOperationsData["applications"][number];
type Mutation = (input: Record<string, unknown>) => Promise<void>;
const names: Record<string, string> = { SUBMITTED: "제출 · 검토 대기", REVISION_REQUESTED: "수정 요청", APPROVED: "승인", PUBLISHED: "게시 · 검증 대기", VERIFIED: "게시물 검증 완료", DRAFT: "미확인", CONFIRMED: "참고 계약 확인", REQUESTED: "정산 검토 대기", REJECTED: "반려", PENDING: "대기", ACCEPTED: "선정됨", SHORTLISTED: "검토 대상", WITHDRAWN: "철회", PROCESSING: "처리 중", PAID: "지급 완료(기존 기록)" };
const statusName = (value: string) => names[value] ?? value;
const date = (value: string | null) => value ? new Date(value).toLocaleString("ko-KR") : "미등록";
const stringify = (value: unknown) => JSON.stringify(value, null, 2);

function Reference({ href, children }: { href: string | null; children: React.ReactNode }) {
  return href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={14} aria-hidden="true" /></a> : null;
}

export default function CampaignOperations({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<CampaignOperationsData | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/campaign-operations?campaignId=${encodeURIComponent(campaignId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "운영 내역을 불러오지 못했습니다.");
        if (!controller.signal.aborted) { setData(body); setError(""); setLoading(false); }
      }).catch((failure) => { if (!controller.signal.aborted) { setError(failure instanceof Error ? failure.message : "내역을 확인할 수 없습니다."); setLoading(false); } });
    return () => controller.abort();
  }, [campaignId, refresh]);
  async function mutate(input: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/campaign-operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, campaignId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "변경사항을 저장하지 못했습니다.");
      setMessage("처리 결과와 감사 이력을 저장했습니다. 실제 송금이나 전자서명은 실행되지 않습니다.");
      setLoading(true); setRefresh((value) => value + 1);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "저장 중 오류가 발생했습니다."); }
    finally { setBusy(false); }
  }
  const current = data?.campaignId === campaignId ? data : null;
  return <section className="cop" aria-label="캠페인 상세 운영" aria-busy={loading || busy}>
    <div className="cop-heading"><div><h3>심사 자료 · 프로젝트 운영</h3><p>제안서에서 콘텐츠 검토와 정산 승인까지 한곳에서 확인합니다.</p></div>
      <button type="button" disabled={loading || busy} onClick={() => { setLoading(true); setRefresh((value) => value + 1); }}><RefreshCw size={16} aria-hidden="true" /> 새로고침</button></div>
    {error ? <p className="cop-error" role="alert">{error}</p> : null}
    {message ? <p className="cop-message" role="status">{message}</p> : null}
    {loading ? <p role="status">운영 내역을 불러오는 중입니다…</p> : null}
    {current ? <>
      <dl className="cop-context"><div><dt>대상 지역</dt><dd>{current.regions.join(", ") || "미지정"}</dd></div><div><dt>카테고리</dt><dd>{current.categories.join(", ") || "미지정"}</dd></div><div><dt>팔로워 조건</dt><dd>{current.followerMin?.toLocaleString() ?? "제한 없음"} ~ {current.followerMax?.toLocaleString() ?? "제한 없음"}</dd></div><div><dt>콘텐츠 마감</dt><dd>{date(current.contentDeadline)}</dd></div></dl>
      <div className="cop-links"><Reference href={current.briefUrl}>캠페인 브리프 열기</Reference></div>
      <details className="cop-source"><summary>세부 요구사항 · 정산 조건 · 운영 요청</summary><div className="cop-source-grid">{[["요구사항", current.requirements], ["정산 조건", current.settlementPolicy], ["운영 요청", current.managedRequest]].map(([label, value]) => <div key={String(label)}><h4>{String(label)}</h4><pre>{stringify(value)}</pre></div>)}</div></details>
      <p className="cop-notice">계약은 외부에서 합의한 문서의 참고 기록입니다. 정산은 내부 검토 기록이며 전자서명·송금·지급 완료 처리는 제공하지 않습니다.</p>
      {current.applications.length ? current.applications.map((application) => <ApplicationOperations key={`${application.id}:${application.contract?.version}:${application.settlement?.version}:${application.submissions[0]?.updatedAt}`} application={application} editable={["RECRUITING", "IN_PROGRESS", "VERIFYING", "SETTLING"].includes(current.status) && application.status === "ACCEPTED"} busy={busy || loading} mutate={mutate} />) : <p className="cop-empty">아직 접수된 신청이 없습니다.</p>}
      {current.totalApplications > current.applications.length ? <p>최근 {current.applications.length}건 / 전체 {current.totalApplications}건을 표시합니다.</p> : null}
    </> : null}
  </section>;
}

function ApplicationOperations({ application, editable, busy, mutate }: { application: Application; editable: boolean; busy: boolean; mutate: Mutation }) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [validation, setValidation] = useState("");
  const latest = application.submissions[0];
  const contract = application.contract;
  const settlement = application.settlement;
  const locked = !!settlement && ["APPROVED", "PROCESSING", "PAID"].includes(settlement.status);
  async function act(input: Record<string, unknown>) {
    if (reason.trim().length < 2) { setValidation("처리 사유를 2자 이상 입력하세요."); return; }
    setValidation("");
    await mutate({ ...input, applicationId: application.id, reason });
  }
  function saveContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    void act({ action: "saveContract", expectedVersion: contract?.version ?? null, status: values.get("status"), referenceUrl: values.get("referenceUrl"), notes: values.get("notes") });
  }
  function prepareSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    void act({ action: "prepareSettlement", expectedVersion: settlement?.version ?? null, grossAmount: values.get("grossAmount"), platformFeeAmount: values.get("platformFeeAmount"), withholdingAmount: values.get("withholdingAmount") });
  }
  return <details className="cop-application" open={application.status === "ACCEPTED"}>
    <summary><strong>{application.agencyName}</strong><span>{statusName(application.status)}</span><span>{application.currency} {application.proposedAmount ?? "금액 미제안"}</span></summary>
    <div className="cop-body">
      <h4>신청 제안서</h4><p className="cop-preline">{application.proposal || "제안 내용 없음"}</p>
      <details className="cop-source"><summary>참여 크리에이터 · 제작물 제안 ({application.creators.length}명)</summary>
        {application.creators.map((creator) => <div key={creator.id}><strong>{creator.name}</strong><p>{creator.categories.join(", ")}</p><pre>{stringify({ 채널: creator.channels, 제작물: creator.deliverables })}</pre></div>)}
        <h4>신청 시 명단 원본</h4><pre>{stringify(application.rosterSnapshot)}</pre>
      </details>
      {!editable ? <p className="cop-notice">선정된 신청의 활성 캠페인에서만 운영 처리를 할 수 있습니다.</p> : <label className="cop-field" htmlFor={`${id}-reason`}>공통 처리 사유 <span>(필수 · 감사 이력에 저장)</span><textarea id={`${id}-reason`} rows={2} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="검토 결과와 변경 사유를 입력하세요." /></label>}
      {validation ? <p className="cop-error" role="alert">{validation}</p> : null}
      <h4>콘텐츠 검토</h4>
      {application.submissions.length ? application.submissions.map((submission, index) => <div className="cop-submission" key={submission.id}>
        <strong>버전 {submission.version} · {statusName(submission.status)}{index === 0 ? " · 최신" : ""}</strong><p>제출 {date(submission.submittedAt)}{submission.reviewedAt ? ` · 검토 ${date(submission.reviewedAt)}` : ""}</p>
        <div className="cop-links"><Reference href={submission.draftUrl}>초안 보기</Reference><Reference href={submission.publishedUrl}>게시물 보기</Reference></div>
        {submission.reviewNotes ? <p className="cop-preline">검토 의견: {submission.reviewNotes}</p> : null}
        {index === 0 && editable && !locked && ["SUBMITTED", "PUBLISHED"].includes(submission.status) ? <div className="cop-actions">
          <button type="button" disabled={busy} onClick={() => void act({ action: "reviewContent", submissionId: submission.id, expectedUpdatedAt: submission.updatedAt, status: submission.status === "SUBMITTED" ? "APPROVED" : "VERIFIED" })}>{submission.status === "SUBMITTED" ? "초안 승인" : "게시물 검증 완료"}</button>
          <button type="button" disabled={busy} onClick={() => void act({ action: "reviewContent", submissionId: submission.id, expectedUpdatedAt: submission.updatedAt, status: "REVISION_REQUESTED" })}>수정 요청</button>
        </div> : null}
      </div>) : <p className="cop-empty">에이전시의 콘텐츠 제출을 기다리고 있습니다.</p>}
      {application.submissions.length >= 20 ? <p>최근 20개 제출 버전만 표시합니다.</p> : null}
      <div className="cop-forms">
        <form onSubmit={saveContract}><h4>계약 참고 기록</h4><p>서명된 원문은 외부에서 관리하며 여기서는 링크와 확인 내역만 남깁니다.</p>
          <fieldset disabled={!editable || busy || locked}>
            <label className="cop-field" htmlFor={`${id}-contract-url`}>문서 참고 링크<input id={`${id}-contract-url`} name="referenceUrl" type="url" maxLength={2048} placeholder="https://…" defaultValue={contract?.referenceUrl ?? ""} /></label>
            <label className="cop-field" htmlFor={`${id}-contract-status`}>확인 상태<select id={`${id}-contract-status`} name="status" defaultValue={contract?.status ?? "DRAFT"}><option value="DRAFT">미확인</option><option value="CONFIRMED">외부 합의 문서 확인</option></select></label>
            <label className="cop-field" htmlFor={`${id}-contract-notes`}>계약 메모<textarea id={`${id}-contract-notes`} name="notes" rows={3} maxLength={4000} defaultValue={contract?.notes ?? ""} /></label>
            <button type="submit">계약 참고 기록 저장</button>
          </fieldset>{contract?.confirmedAt ? <p>확인일 {date(contract.confirmedAt)}</p> : null}
        </form>
        <form onSubmit={prepareSettlement}><h4>정산 검토 기록</h4><p>통화: {application.currency} · 총액 − 수수료 − 공제액 = 예정 지급액</p>
          {settlement ? <p className="cop-status">{statusName(settlement.status)} · 예정 지급액 {settlement.currency} {settlement.netAmount}</p> : null}
          <fieldset disabled={!editable || busy || locked}>
            {[["grossAmount", "총액 (제안 금액 기준)", application.proposedAmount ?? settlement?.grossAmount ?? ""], ["platformFeeAmount", "플랫폼 수수료", settlement?.platformFeeAmount ?? "0.00"], ["withholdingAmount", "기타 공제액", settlement?.withholdingAmount ?? "0.00"]].map(([name, label, value]) => <label key={name} className="cop-field" htmlFor={`${id}-${name}`}>{label}<input id={`${id}-${name}`} name={name} type="text" inputMode="decimal" pattern="(?:0|[1-9][0-9]{0,15})(?:\.[0-9]{1,2})?" required readOnly={name === "grossAmount" && application.proposedAmount !== null} defaultValue={value} /></label>)}
            <button type="submit">금액 저장 · 검토 대기</button>
          </fieldset>
          {settlement?.reviewNotes ? <p className="cop-preline">검토 의견: {settlement.reviewNotes}</p> : null}
          {editable && settlement?.status === "REQUESTED" ? <div className="cop-actions">
            <button type="button" disabled={busy || contract?.status !== "CONFIRMED" || latest?.status !== "VERIFIED"} onClick={() => void act({ action: "reviewSettlement", expectedVersion: settlement.version, status: "APPROVED" })}>정산 승인 (송금 아님)</button>
            <button type="button" disabled={busy} onClick={() => void act({ action: "reviewSettlement", expectedVersion: settlement.version, status: "REJECTED" })}>정산 반려</button>
          </div> : null}
          <p>승인 조건: 계약 참고 확인 + 최신 게시물 검증 완료</p>
        </form>
      </div>
    </div>
  </details>;
}
