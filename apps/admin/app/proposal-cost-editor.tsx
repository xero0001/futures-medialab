"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { AdminProposal } from "@futures-medialab/database/proposal-types";
import { AdminButton } from "./_components/admin-button";
import s from "./official-proposals.module.css";

export function ProposalCostEditor({
  proposal,
  busy,
  onSave,
}: {
  proposal: AdminProposal;
  busy: boolean;
  onSave: (
    items: { itemId: string; supplierCost: string }[],
    reason: string,
  ) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [costs, setCosts] = useState(() =>
    Object.fromEntries(
      proposal.items.map((item) => [item.id, item.supplierCost ?? ""]),
    ),
  );
  const [reason, setReason] = useState("");
  const dirty = Boolean(
    reason ||
    proposal.items.some(
      (item) => (costs[item.id] ?? "") !== (item.supplierCost ?? ""),
    ),
  );
  useEffect(() => {
    const guard = (event: Event) => {
      if (
        busy ||
        (dirty &&
          !window.confirm(
            "저장하지 않은 공급가 변경 사항을 버리고 이동할까요?",
          ))
      )
        event.preventDefault();
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("admin:navigate", guard);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("admin:navigate", guard);
      window.removeEventListener("beforeunload", unload);
    };
  }, [busy, dirty]);
  const missing = proposal.items.filter(
    (item) => !item.supplierCost || Number(item.supplierCost) <= 0,
  ).length;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave(
      proposal.items.map((item) => ({
        itemId: item.id,
        supplierCost: costs[item.id] ?? "",
      })),
      reason,
    );
  }
  return (
    <section className={s.costSection} aria-label="내부 공급가 관리">
      <div className={s.costHeading}>
        <div>
          <h4>내부 공급가</h4>
          <p>
            {missing
              ? `${missing}개 항목의 공급가가 미확정입니다. 캠페인 완료 전에 확정해 주세요.`
              : "항목 총공급가를 확인했습니다."}
          </p>
        </div>
        {proposal.canEditCosts ? (
          <AdminButton
            disabled={busy}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "접기" : "공급가 보완"}
          </AdminButton>
        ) : null}
      </div>
      {open ? (
        <form className={s.costForm} onSubmit={submit}>
          <p>
            브랜드 제안 금액·조건·승인 이력은 유지됩니다. 변경 사유와 이전
            공급가는 내부 변경 이력에 보관합니다.
          </p>
          {proposal.items.map((item) => (
            <label key={item.id}>
              {item.creatorName} · {item.platform} · {item.quantity}건의
              총공급가 ({proposal.currency})
              <input
                value={costs[item.id] ?? ""}
                onChange={(event) =>
                  setCosts((previous) => ({
                    ...previous,
                    [item.id]: event.target.value,
                  }))
                }
                required
                inputMode="decimal"
                pattern="(?:0|[1-9][0-9]{0,12})(?:[.][0-9]{1,2})?"
                disabled={busy}
                aria-label={`${item.creatorName} 총공급가`}
              />
            </label>
          ))}
          <label>
            변경 사유
            <textarea
              required
              minLength={2}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
            />
          </label>
          <label className={s.costConfirm}>
            <input type="checkbox" required disabled={busy} />
            수량을 다시 곱하지 않는 항목별 총공급가를 확인했습니다.
          </label>
          <div className={s.actions}>
            <AdminButton
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              취소
            </AdminButton>
            <AdminButton className="primary" disabled={busy}>
              {busy ? "저장 중…" : "내부 공급가 저장"}
            </AdminButton>
          </div>
        </form>
      ) : null}
    </section>
  );
}
