"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  FileText,
  LockKeyhole,
  Pencil,
  RefreshCw,
  Send,
  WalletCards,
  X,
} from "lucide-react";
import type {
  AdminAgencyPayout,
  AdminBrandInvoice,
  AdminSettlementMutation,
  AdminSettlementResponse,
  SettlementDocumentInput,
} from "@futures-medialab/database/settlement-types";
import { AdminButton } from "./_components/admin-button";
import s from "./campaign-settlement.module.css";

type MutationInput = AdminSettlementMutation extends infer T
  ? T extends AdminSettlementMutation
    ? Omit<T, "clientRequestId">
    : never
  : never;
type Document = AdminBrandInvoice | AdminAgencyPayout;
type Action =
  | { kind: "complete" | "prepare"; data: AdminSettlementResponse }
  | {
      kind: "edit" | "issue" | "reissue" | "payment";
      document: Document;
      campaignId: string;
    };
const isPayout = (document: Document): document is AdminAgencyPayout =>
  "supplierOrganizationId" in document;
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      }).format(new Date(value))
    : "미등록";
const localDate = (value: string | null) =>
  value
    ? new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 16)
    : "";
const isoDate = (value: string) => new Date(`${value}+09:00`).toISOString();
function money(value: string | null, currency: string) {
  if (value === null || !/^\d+(?:\.\d{1,2})?$/.test(value)) return "확인 필요";
  const [whole, fraction = ""] = value.split(".");
  return `${currency} ${BigInt(whole!).toLocaleString("ko-KR")}.${fraction.padEnd(2, "0")}`;
}
function minor(value: string): bigint | null {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
}
function Status({ document }: { document: Document }) {
  const payout = isPayout(document);
  return (
    <span
      className={s.badge}
      data-tone={
        document.status === "PAID"
          ? "green"
          : document.status === "ISSUED"
            ? "blue"
            : undefined
      }
    >
      {document.status === "DRAFT"
        ? "비공개 초안"
        : document.status === "ISSUED"
          ? "발행 완료"
          : payout
            ? "외부 지급 완료 기록"
            : "외부 입금 확인 기록"}
    </span>
  );
}
function DocumentLink({ value }: { value: string | null }) {
  if (!value) return null;
  let safe = false;
  try {
    const url = new URL(value);
    safe =
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hostname.endsWith(".invalid");
  } catch {
    return null;
  }
  if (!safe) return <span className={s.muted}>시연 문서 · 외부 연결 없음</span>;
  return (
    <a
      className={s.link}
      href={value}
      target="_blank"
      rel="noopener noreferrer"
    >
      정산 참고 문서
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  );
}
function PublicDocument({
  document,
  draft,
}: {
  document: Document;
  draft?: SettlementDocumentInput;
}) {
  const payout = isPayout(document),
    content = draft ?? document;
  return (
    <div className={s.publicDocument}>
      <span className={s.eyebrow}>
        {payout ? "담당 에이전시 공개 내용" : "브랜드 공개 내용"}
      </span>
      <div className={s.row}>
        <h4>{content.title || "문서 제목"}</h4>
        <strong className={s.amount}>
          {money(document.amount, document.currency)}
        </strong>
      </div>
      <p className={s.muted}>
        {document.campaignTitle} · 공식 제안 v{document.proposalVersion}
      </p>
      <div className={s.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>승인된 항목</th>
              <th>수량</th>
              <th>{payout ? "항목 총액" : "단가"}</th>
              {!payout ? <th>청구 금액</th> : null}
            </tr>
          </thead>
          <tbody>
            {payout
              ? document.lines.map((line) => (
                  <tr key={line.proposalItemId}>
                    <td>
                      <strong>{line.creatorName}</strong>
                      <small>
                        {line.platform} · {line.description}
                      </small>
                    </td>
                    <td>{line.quantity}</td>
                    <td>{money(line.itemTotalAmount, document.currency)}</td>
                  </tr>
                ))
              : document.lines.map((line) => (
                  <tr key={line.proposalItemId}>
                    <td>
                      <strong>{line.creatorName}</strong>
                      <small>
                        {line.platform} · {line.description}
                      </small>
                    </td>
                    <td>{line.quantity}</td>
                    <td>{money(line.unitAmount, document.currency)}</td>
                    <td>{money(line.lineAmount, document.currency)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <div className={s.dates}>
        <span>캠페인 완료 {date(document.completedAt)}</span>
        <span>
          {payout ? "지급 예정" : "납부 기한"} {date(content.dueAt)}
        </span>
        {document.issuedAt ? <span>발행 {date(document.issuedAt)}</span> : null}
        {document.paidAt ? (
          <span>
            {payout ? "지급" : "입금"} 확인 {date(document.paidAt)}
          </span>
        ) : null}
      </div>
      <DocumentLink value={content.documentUrl} />
      {content.note ? <p className={s.pre}>{content.note}</p> : null}
    </div>
  );
}
function Problems({ values }: { values: string[] }) {
  return values.length ? (
    <ul className={s.problems}>
      {values.map((value) => (
        <li key={value}>{value}</li>
      ))}
    </ul>
  ) : null;
}
function DocumentCard({
  document,
  busy,
  onAction,
}: {
  document: Document;
  busy: boolean;
  onAction: (action: Action) => void;
}) {
  const payout = isPayout(document),
    base = { document, campaignId: document.campaignId };
  return (
    <article className={s.documentCard}>
      <div className={s.row}>
        <div>
          <span className={s.eyebrow}>
            {payout ? "에이전시 지급 내역" : "브랜드 청구서"}
          </span>
          <h4>{payout ? document.supplierName : "브랜드 청구"}</h4>
        </div>
        <Status document={document} />
      </div>
      <PublicDocument document={document} />
      {!payout && document.versions.length > 0 && (
        <details className={s.internal}>
          <summary>청구서 발행 이력 · 현재 v{document.documentVersion}</summary>
          {document.versions.map((version) => (
            <details key={version.version} className={s.historyEntry}>
              <summary>
                v{version.version} ·{" "}
                {version.version === document.documentVersion
                  ? "현재 발행본"
                  : "이전 발행본"}{" "}
                · {date(version.issuedAt)}
              </summary>
              {version.reason && <p>정정 사유 · {version.reason}</p>}
              <PublicDocument
                document={{
                  ...document,
                  ...version,
                  paidAt:
                    version.version === document.documentVersion
                      ? document.paidAt
                      : null,
                }}
              />
            </details>
          ))}
        </details>
      )}
      {document.internalNote || document.externalPaymentReference ? (
        <details className={s.internal}>
          <summary>
            <LockKeyhole size={15} />
            운영팀 전용 기록
          </summary>
          {document.internalNote ? (
            <p className={s.pre}>{document.internalNote}</p>
          ) : null}
          {document.externalPaymentReference ? (
            <p>외부 처리 참조: {document.externalPaymentReference}</p>
          ) : null}
          <small>
            내부 메모와 외부 처리 참조는 브랜드·에이전시에 공개되지 않습니다.
          </small>
        </details>
      ) : null}
      <Problems values={document.actionProblems} />
      <div className={s.actions}>
        {document.canEdit ? (
          <AdminButton
            type="button"
            disabled={busy}
            onClick={() => onAction({ ...base, kind: "edit" })}
          >
            <Pencil size={15} />
            초안 편집
          </AdminButton>
        ) : null}
        {document.canIssue ? (
          <AdminButton
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => onAction({ ...base, kind: "issue" })}
          >
            <Send size={15} />
            {payout ? "에이전시 발행 검토" : "브랜드 발행 검토"}
          </AdminButton>
        ) : null}
        {!payout && document.canReissue && (
          <AdminButton
            type="button"
            disabled={busy}
            onClick={() => onAction({ ...base, kind: "reissue" })}
          >
            <Pencil size={15} />
            청구서 정정·재발행
          </AdminButton>
        )}
        {document.canRecordPayment ? (
          <AdminButton
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => onAction({ ...base, kind: "payment" })}
          >
            <CheckCheck size={15} />
            {payout ? "외부 지급 완료 기록" : "외부 입금 확인 기록"}
          </AdminButton>
        ) : null}
      </div>
    </article>
  );
}
function DialogForm({
  action,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  action: Action;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: MutationInput) => void;
}) {
  const document = "document" in action ? action.document : null;
  const payout = document ? isPayout(document) : false;
  const [title, setTitle] = useState(document?.title ?? "");
  const [note, setNote] = useState(
    action.kind === "complete" ? "" : (document?.note ?? ""),
  );
  const [dueAt, setDueAt] = useState(localDate(document?.dueAt ?? null));
  const [documentUrl, setDocumentUrl] = useState(document?.documentUrl ?? "");
  const [internalNote, setInternalNote] = useState(
    document?.internalNote ?? "",
  );
  const [reason, setReason] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [localError, setLocalError] = useState("");
  const heading =
    action.kind === "reissue"
      ? "브랜드 청구서 정정·재발행"
      : action.kind === "complete"
        ? "캠페인 완료 확인"
        : action.kind === "prepare"
          ? "청구·지급 초안 준비"
          : action.kind === "edit"
            ? payout
              ? "에이전시 지급 초안 편집"
              : "브랜드 청구 초안 편집"
            : action.kind === "issue"
              ? payout
                ? "에이전시 지급 내역 발행"
                : "브랜드 청구서 발행"
              : payout
                ? "외부 지급 완료 기록"
                : "외부 입금 확인 기록";
  const draft = (): SettlementDocumentInput => ({
    title,
    note,
    dueAt:
      dueAt === localDate(document?.dueAt ?? null)
        ? (document?.dueAt ?? null)
        : dueAt
          ? isoDate(dueAt)
          : null,
    documentUrl: documentUrl.trim() || null,
    internalNote,
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setLocalError("");
    if (action.kind === "complete") {
      onSubmit({
        action: "completeCampaign",
        campaignId: action.data.campaignId,
        expectedReadinessToken: action.data.readinessToken,
        note,
      });
      return;
    }
    if (action.kind === "prepare") {
      if (action.data.completion)
        onSubmit({
          action: "prepare",
          campaignId: action.data.campaignId,
          completionId: action.data.completion.id,
          supplierCostBasis: "ITEM_TOTAL",
        });
      return;
    }
    if (!("document" in action)) return;
    const doc = action.document,
      base = { campaignId: action.campaignId, expectedRevision: doc.revision };
    if (action.kind === "reissue" && !isPayout(doc)) {
      const { title, note, dueAt, documentUrl } = draft();
      onSubmit({
        ...base,
        action: "reissueBrandInvoice",
        invoiceId: doc.id,
        reason,
        data: { title, note, dueAt, documentUrl },
      });
      return;
    }
    if (action.kind === "edit") {
      onSubmit(
        isPayout(doc)
          ? {
              ...base,
              action: "saveAgencyPayout",
              payoutId: doc.id,
              data: draft(),
            }
          : {
              ...base,
              action: "saveBrandInvoice",
              invoiceId: doc.id,
              data: draft(),
            },
      );
      return;
    }
    if (action.kind === "issue") {
      onSubmit(
        isPayout(doc)
          ? { ...base, action: "issueAgencyPayout", payoutId: doc.id }
          : { ...base, action: "issueBrandInvoice", invoiceId: doc.id },
      );
      return;
    }
    const paymentTime = Date.parse(`${paidAt}+09:00`);
    if (
      minor(amount.trim()) === null ||
      minor(amount.trim()) !== minor(doc.amount)
    ) {
      setLocalError(
        "실제 처리한 금액을 발행 금액과 동일하게 입력하세요. 일부 입금·지급은 이 기록으로 처리할 수 없습니다.",
      );
      return;
    }
    if (
      !Number.isFinite(paymentTime) ||
      paymentTime > Date.now() ||
      !doc.issuedAt ||
      paymentTime <
        Date.parse(
          !isPayout(doc)
            ? (doc.versions.at(-1)?.issuedAt ?? doc.issuedAt)
            : doc.issuedAt,
        )
    ) {
      setLocalError("처리 시각은 문서 발행 이후부터 현재 사이로 입력하세요.");
      return;
    }
    const data = {
      amount: amount.trim(),
      currency: doc.currency,
      paidAt: isoDate(paidAt),
      reference,
      internalNote,
    };
    onSubmit(
      isPayout(doc)
        ? { ...base, action: "recordAgencyPayment", payoutId: doc.id, data }
        : { ...base, action: "recordBrandPayment", invoiceId: doc.id, data },
    );
  }
  return (
    <form onSubmit={submit}>
      <div className={s.dialogHeader}>
        <div>
          <h2 id="settlement-dialog-title">{heading}</h2>
          <p>
            {document?.campaignTitle ??
              ("data" in action ? action.data.campaignTitle : "")}
          </p>
        </div>
        <AdminButton
          type="button"
          className="icon"
          disabled={busy}
          aria-label="정산 검토 창 닫기"
          onClick={onClose}
        >
          <X size={18} />
        </AdminButton>
      </div>
      <fieldset className={s.fieldset} disabled={busy}>
        {action.kind === "complete" ? (
          <>
            <div className={s.notice}>
              <CheckCircle2 size={18} />
              <p>
                현재 공식 제안의 전체 콘텐츠 승인·최신 성과 공개와 청구
                금액·공급 비용·지급 대상 확정이 필요합니다. 완료하면 제작·성과
                수정은 종료되고 청구·지급 내역을 준비할 수 있습니다.
              </p>
            </div>
            <div className={s.totals}>
              <div>
                <span>확정 브랜드 청구 합계</span>
                <strong>
                  {money(action.data.brandTotalAmount, action.data.currency)}
                </strong>
              </div>
              <div>
                <span>확정 에이전시 지급 합계 · 내부</span>
                <strong>
                  {money(action.data.totalSupplierAmount, action.data.currency)}
                </strong>
              </div>
            </div>
            <label className={s.field}>
              완료 안내
              <textarea
                rows={4}
                required
                minLength={2}
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="완료한 범위와 결과 안내를 입력하세요."
              />
            </label>
            <label className={s.check}>
              <input type="checkbox" required />
              최신 콘텐츠·성과 공개 내역과 확정 금액·지급 대상을 확인했으며
              캠페인을 완료합니다.
            </label>
          </>
        ) : null}
        {action.kind === "prepare" ? (
          <>
            <div className={s.totals}>
              <div>
                <span>브랜드 청구 합계</span>
                <strong>
                  {money(action.data.brandTotalAmount, action.data.currency)}
                </strong>
              </div>
              <div>
                <span>에이전시 지급 합계 · 내부</span>
                <strong>
                  {money(action.data.totalSupplierAmount, action.data.currency)}
                </strong>
              </div>
            </div>
            <p className={s.notice}>
              브랜드는 승인된 단가 × 수량을 기준으로 청구합니다. 공급 비용은
              제안 항목별 총액이며 수량을 다시 곱하지 않습니다. 각 에이전시에는
              해당 조직의 지급 내역만 발행됩니다.
            </p>
            <label className={s.check}>
              <input type="checkbox" required />
              공급 비용이 항목별 총액임을 확인했습니다. 이 기준으로 비공개
              초안을 준비합니다.
            </label>
          </>
        ) : null}
        {document && (action.kind === "edit" || action.kind === "reissue") ? (
          <>
            <div className={s.notice}>
              <LockKeyhole size={18} />
              <p>
                {action.kind === "reissue"
                  ? "승인된 금액과 항목을 유지하고 새 발행본을 브랜드에 전달합니다. 이전 발행본도 자료실에 보관합니다."
                  : "금액과 항목은 완료 시점의 승인 내역을 따릅니다. 초안은 운영팀이 검토합니다."}
              </p>
            </div>
            <label className={s.field}>
              공개 문서 제목
              <input
                required
                minLength={2}
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <div className={s.grid}>
              <label className={s.field}>
                {payout ? "지급 예정 시각" : "납부 기한"} · 한국 시간
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                />
              </label>
              <label className={s.field}>
                공개 참고 문서 URL · 선택
                <input
                  type="url"
                  maxLength={2048}
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  placeholder="https://"
                />
              </label>
            </div>
            <label className={s.field}>
              수신 조직에 공개할 안내
              <textarea
                rows={4}
                maxLength={4000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            {action.kind === "reissue" ? (
              <>
                <label className={s.field}>
                  브랜드에 공개할 정정 사유
                  <textarea
                    rows={3}
                    required
                    minLength={2}
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <label className={s.check}>
                  <input type="checkbox" required />새 발행본의 내용과 공개
                  사유를 확인했습니다.
                </label>
              </>
            ) : (
              <>
                {" "}
                <label className={s.field}>
                  내부 메모 · 운영팀 전용
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                  />
                </label>
              </>
            )}
            <PublicDocument
              document={document}
              draft={{
                title,
                note,
                dueAt: dueAt ? `${dueAt}+09:00` : null,
                documentUrl,
                internalNote,
              }}
            />
          </>
        ) : null}
        {document && action.kind === "issue" ? (
          <>
            <p className={s.notice}>
              발행하면 아래 내용이 {payout ? "해당 에이전시" : "브랜드"}에
              공개됩니다.{" "}
              {payout
                ? "발행본을 보관하고 외부 지급 결과를 기록합니다."
                : "미입금 청구서의 안내·기한·문서 링크는 새 버전으로 정정할 수 있습니다."}
            </p>
            <PublicDocument document={document} />
            <label className={s.check}>
              <input type="checkbox" required />
              수신 조직·금액·항목·기한·공개 안내를 확인했으며 이 내역을
              발행합니다.
            </label>
          </>
        ) : null}
        {document && action.kind === "payment" ? (
          <>
            <p className={s.notice}>
              외부에서 완료한 {payout ? "지급" : "입금"} 사실을 기록합니다. 이
              화면에서는 송금이나 결제를 실행하지 않습니다.
            </p>
            <div className={s.paymentAmount}>
              <span>발행 금액</span>
              <strong>{money(document.amount, document.currency)}</strong>
            </div>
            <div className={s.grid}>
              <label className={s.field}>
                실제 처리 금액 · {document.currency}
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?"
                  required
                  maxLength={30}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={document.amount}
                />
              </label>
              <label className={s.field}>
                실제 처리 시각 · 한국 시간
                <input
                  type="datetime-local"
                  step="1"
                  required
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                />
              </label>
            </div>
            <label className={s.field}>
              외부 처리 참조 · 운영팀 전용
              <input
                required
                minLength={2}
                maxLength={200}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="외부 처리 내역을 식별할 참조번호"
              />
            </label>
            <label className={s.field}>
              내부 처리 메모
              <textarea
                rows={3}
                maxLength={2000}
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
              />
            </label>
            <label className={s.check}>
              <input type="checkbox" required />
              외부 처리 내역의 금액·통화·시각을 확인했으며 완료 사실을
              기록합니다.
            </label>
          </>
        ) : null}
      </fieldset>
      {localError || error ? (
        <p className={s.error} role="alert">
          {localError || error}
        </p>
      ) : null}
      <div className={s.actions}>
        <AdminButton type="button" disabled={busy} onClick={onClose}>
          취소
        </AdminButton>
        <AdminButton className="primary" disabled={busy}>
          {busy
            ? "처리 중…"
            : action.kind === "complete"
              ? "캠페인 완료"
              : action.kind === "prepare"
                ? "비공개 초안 준비"
                : action.kind === "edit"
                  ? "초안 저장"
                  : action.kind === "reissue"
                    ? "정정본 재발행"
                    : action.kind === "issue"
                      ? "확인한 내역 발행"
                      : "외부 처리 완료 기록"}
        </AdminButton>
      </div>
    </form>
  );
}
function ActionDialog({
  action,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  action: Action | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: MutationInput) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (action) dialog.current?.showModal();
    else dialog.current?.close();
  }, [action]);
  return (
    <dialog
      ref={dialog}
      className={s.dialog}
      aria-labelledby="settlement-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {action ? (
        <DialogForm
          key={
            "document" in action
              ? `${action.kind}:${action.document.id}:${action.document.revision}`
              : `${action.kind}:${action.data.readinessToken}`
          }
          action={action}
          busy={busy}
          error={error}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </dialog>
  );
}
async function request(
  path: string,
  input?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<AdminSettlementResponse> {
  const response = await fetch(path, {
    cache: "no-store",
    signal,
    method: input ? "POST" : "GET",
    ...(input
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      : {}),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) window.location.assign("/login");
    throw new Error(
      typeof body.message === "string"
        ? body.message
        : "완료·정산 내역을 처리하지 못했습니다.",
    );
  }
  return body as AdminSettlementResponse;
}
export function CampaignSettlement({
  campaignId,
  onCampaignCompleted,
}: {
  campaignId: string;
  onCampaignCompleted?: () => void;
}) {
  const [data, setData] = useState<AdminSettlementResponse | null>(null),
    [selectedPayoutId, setSelectedPayoutId] = useState("");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [action, setAction] = useState<Action | null>(null);
  const pending = useRef(false),
    retries = useRef(new Map<string, string>());
  const current = data?.campaignId === campaignId ? data : null;
  const selectedPayout =
    current?.payouts.find((payout) => payout.id === selectedPayoutId) ??
    current?.payouts[0];
  useEffect(() => {
    const controller = new AbortController();
    request(
      `/api/admin/settlement?campaignId=${encodeURIComponent(campaignId)}`,
      undefined,
      controller.signal,
    )
      .then((body) => {
        if (!controller.signal.aborted) {
          setData(body);
          setError("");
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "정산 내역을 불러오지 못했습니다.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [campaignId, reload]);
  function refresh() {
    if (busy) return;
    setLoading(true);
    setError("");
    setNotice("");
    setReload((value) => value + 1);
  }
  async function mutate(input: MutationInput) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const fingerprint = JSON.stringify(input),
      clientRequestId = retries.current.get(fingerprint) ?? crypto.randomUUID();
    retries.current.set(fingerprint, clientRequestId);
    try {
      const result = await request("/api/admin/settlement", {
        ...input,
        clientRequestId,
      });
      retries.current.delete(fingerprint);
      setData(result);
      setAction(null);
      if (input.action === "completeCampaign") onCampaignCompleted?.();
      setNotice(
        input.action === "completeCampaign"
          ? "캠페인을 완료했습니다. 청구·지급 내역을 준비할 수 있습니다."
          : input.action === "prepare"
            ? "브랜드 청구서와 담당 에이전시별 지급 초안을 준비했습니다."
            : input.action === "reissueBrandInvoice"
              ? "정정한 청구서를 브랜드에 재발행했습니다."
              : input.action.startsWith("save")
                ? "비공개 초안을 저장했습니다."
                : input.action.startsWith("issue")
                  ? "확인한 내역을 수신 조직에 발행했습니다."
                  : "외부 처리 완료 사실을 기록했습니다. 송금·결제는 실행되지 않았습니다.",
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "정산 처리를 저장하지 못했습니다.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      id="admin-campaign-settlement"
      className={s.workspace}
      aria-label="캠페인 완료·정산"
      aria-busy={loading || busy}
    >
      <div className={s.heading}>
        <div>
          <h3>캠페인 완료·정산</h3>
          <p>
            최신 공개 성과를 확인해 캠페인을 완료하고, 브랜드 청구와 에이전시
            지급 내역을 각각 발행합니다.
          </p>
        </div>
        <AdminButton type="button" disabled={busy || loading} onClick={refresh}>
          <RefreshCw size={16} />
          새로고침
        </AdminButton>
      </div>
      {error ? (
        <div className={s.error} role="alert">
          <p>{error}</p>
          <p>처리 내역이 변경되었다면 최신 내용을 불러온 뒤 다시 확인하세요.</p>
          {!action && !busy ? (
            <AdminButton type="button" onClick={refresh}>
              최신 내용 불러오기
            </AdminButton>
          ) : null}
        </div>
      ) : null}
      {notice ? (
        <p className={s.success} role="status">
          {notice}
        </p>
      ) : null}
      {loading && !current ? (
        <p className={s.empty} role="status">
          완료 조건과 정산 내역을 확인하는 중입니다…
        </p>
      ) : null}
      {current ? (
        <>
          <div className={s.completion}>
            <div className={s.row}>
              <div>
                <h4>{current.completion ? "캠페인 완료" : "완료 조건 확인"}</h4>
                <p className={s.muted}>
                  {current.completion
                    ? `공식 제안 v${current.completion.proposalVersion} · ${date(current.completion.completedAt)}`
                    : "전체 콘텐츠 승인·최신 성과 공개와 청구 금액·공급 비용·지급 대상 확정이 필요합니다."}
                </p>
              </div>
              {current.completion ? (
                <CheckCircle2 size={24} className={s.completeIcon} />
              ) : (
                <AdminButton
                  type="button"
                  className="primary"
                  disabled={!current.canComplete || loading || busy}
                  onClick={() => setAction({ kind: "complete", data: current })}
                >
                  완료 검토
                </AdminButton>
              )}
            </div>
            {current.completion ? (
              <p className={s.pre}>{current.completion.note}</p>
            ) : (
              <Problems values={current.completionProblems} />
            )}
          </div>
          {current.completion && !current.invoice ? (
            <div className={s.prepare}>
              <WalletCards size={28} />
              <h4>청구·지급 초안을 준비하세요</h4>
              <p>
                브랜드의 승인 금액과 항목별 공급 비용을 기준으로 수신 조직별
                문서를 만듭니다.
              </p>
              <Problems values={current.preparationProblems} />
              <AdminButton
                type="button"
                className="primary"
                disabled={!current.canPrepare || loading || busy}
                onClick={() => setAction({ kind: "prepare", data: current })}
              >
                청구·지급 초안 검토
              </AdminButton>
            </div>
          ) : null}
          {current.invoice ? (
            <>
              <div className={s.totals}>
                <div>
                  <span>브랜드 청구 합계</span>
                  <strong>
                    {money(current.brandTotalAmount, current.currency)}
                  </strong>
                </div>
                <div>
                  <span>에이전시 지급 합계 · 운영팀 전용</span>
                  <strong>
                    {money(current.totalSupplierAmount, current.currency)}
                  </strong>
                </div>
              </div>
              <DocumentCard
                document={current.invoice}
                busy={busy || loading}
                onAction={setAction}
              />
            </>
          ) : null}
          {current.payouts.length ? (
            <div className={s.payouts}>
              <h4>
                <FileText size={18} />
                에이전시별 지급 내역
              </h4>
              <nav className={s.tabs} aria-label="지급 대상 에이전시">
                {current.payouts.map((payout) => (
                  <button
                    type="button"
                    key={payout.id}
                    disabled={busy || loading}
                    aria-pressed={selectedPayout?.id === payout.id}
                    onClick={() => setSelectedPayoutId(payout.id)}
                  >
                    {payout.supplierName}
                    <Status document={payout} />
                  </button>
                ))}
              </nav>
              {selectedPayout ? (
                <DocumentCard
                  document={selectedPayout}
                  busy={busy || loading}
                  onAction={setAction}
                />
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
      <ActionDialog
        action={action}
        busy={busy}
        error={action ? error : ""}
        onClose={() => {
          if (!busy) {
            setAction(null);
            setError("");
          }
        }}
        onSubmit={(input) => void mutate(input)}
      />
    </section>
  );
}
