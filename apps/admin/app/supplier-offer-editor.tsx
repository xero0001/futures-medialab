"use client";
import { useEffect, useState, type FormEvent } from "react";
import { AdminButton } from "./_components/admin-button";
import s from "./admin-sourcing.module.css";
export function SupplierOfferEditor({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<{
    type: string;
    currency: string;
    unitCap: string | null;
    updatedAt: string;
    editable: boolean;
  } | null>(null);
  const [cap, setCap] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/admin/supplier-offer?campaignId=${encodeURIComponent(campaignId)}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.message || "공고 조건을 읽지 못했습니다.");
        if (!controller.signal.aborted) {
          setData(result);
          setCap(result.unitCap ?? "");
          setError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [campaignId, revision]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!data || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/supplier-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          expectedUpdatedAt: data.updatedAt,
          unitCap: cap || null,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "저장하지 못했습니다.");
      setNotice("공급 파트너에게 표시할 단가 상한을 저장했습니다.");
      setRevision((v) => v + 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  if (data && data.type !== "OPEN_BIDDING") return null;
  return (
    <form className={s.card} onSubmit={save}>
      <h4>공급 파트너 모집 조건</h4>
      <p>
        건별 공급 단가 상한을 별도로 지정하세요. 브랜드의 총예산은 파트너에게
        공개되지 않습니다. 변경한 상한은 이후 접수에 적용됩니다.
      </p>
      <label>
        건별 공급 단가 상한 {data?.currency}
        <input
          aria-label="건별 공급 단가 상한"
          type="number"
          min="1"
          max="9999999999"
          step={data?.currency === "KRW" ? "1" : "0.01"}
          placeholder="미지정 · 조건 협의"
          value={cap}
          onChange={(e) => setCap(e.target.value)}
          disabled={busy || !data?.editable}
        />
      </label>
      <AdminButton disabled={busy || !data?.editable}>
        모집 조건 저장
      </AdminButton>
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={() => setRevision((v) => v + 1)}>
            다시 불러오기
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
