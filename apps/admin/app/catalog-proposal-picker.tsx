"use client";

import { FormSelect } from "@futures-medialab/ui/form-select";
import { useEffect, useRef, useState } from "react";
import { InfluencerAvatar } from "./_components/influencer-avatar";
import { AdminButton } from "./_components/admin-button";
import {
  affiliationNames,
  availabilityNames,
  type CatalogRecord,
  type CatalogList,
} from "../lib/creator-catalog-model";
import {
  proposalAmount,
  proposalCents,
  proposalMoneySchema,
} from "@futures-medialab/database/proposal-validation";
import s from "./creator-catalog.module.css";
type Selection = {
  catalogCreatorId: string;
  catalogRateVersion: number | null;
  creatorName: string;
  platform: string;
  channelLabel: string;
  channelUrl: string;
  channelThumbnailUrl: string | null;
  followers: string;
  averageViews: string;
  unitAmount?: string;
  supplierCost?: string;
  rights?: string;
  quantity?: string;
  deliverables?: string;
};
export function CatalogProposalPicker({
  currency,
  selected,
  onClear,
  onPick,
}: {
  currency: string;
  selected: boolean;
  onClear: () => void;
  onPick: (selection: Selection) => void;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [list, setList] = useState<CatalogList | null>(null),
    [person, setPerson] = useState<CatalogRecord | null>(null),
    [channelIndex, setChannelIndex] = useState(0),
    [rateIndex, setRateIndex] = useState(-1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);
      setError("");
      fetch(
        "/api/admin/creators?" +
          new URLSearchParams({
            q: query,
            active: "yes",
            purpose: "proposal",
            page: String(page),
          }),
        { cache: "no-store", signal: controller.signal },
      )
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw new Error(body.message || "검색에 실패했습니다.");
          return body as CatalogList;
        })
        .then((body) => {
          if (!controller.signal.aborted) setList(body);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, page]);
  function choose() {
    if (!person) return;
    const channel = person.channels[channelIndex];
    if (!channel) return;
    const rate = person.rates[rateIndex],
      qty = rate?.minUnits ?? 1;
    if (
      rate?.validUntil &&
      rate.validUntil <
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date())
    ) {
      setError(
        "유효기간이 지난 가격입니다. 가격표를 갱신하거나 조건·가격 직접 입력을 선택해 주세요.",
      );
      return;
    }
    const cost = rate
      ? proposalAmount(proposalCents(rate.supplyUnit) * BigInt(qty))
      : "";
    if (cost && !proposalMoneySchema.safeParse(cost).success) {
      setError("합계 공급가가 입력 범위를 초과합니다.");
      return;
    }
    onPick({
      catalogCreatorId: person.id,
      catalogRateVersion: rate ? person.rateVersion : null,
      creatorName: person.displayName,
      platform: channel.platform,
      channelLabel: channel.name,
      channelUrl: channel.url,
      channelThumbnailUrl: channel.thumbnailUrl,
      followers: String(channel.followers ?? ""),
      averageViews: String(channel.averageViews ?? ""),
      ...(rate
        ? {
            quantity: String(qty),
            unitAmount: rate.sellUnit,
            supplierCost: cost,
            rights: rate.rights,
            deliverables: rate.format,
          }
        : {}),
    });
    setOpen(false);
  }
  return (
    <>
      <div className={s.actions}>
        <AdminButton
          type="button"
          onClick={() => {
            setPerson(null);
            setQuery("");
            setPage(1);
            setOpen(true);
          }}
        >
          인플루언서 DB에서 선택
        </AdminButton>
        {selected ? (
          <AdminButton type="button" onClick={onClear}>
            인플루언서 연결 해제
          </AdminButton>
        ) : null}
      </div>
      <dialog
        ref={dialog}
        aria-label="인플루언서 선택"
        className={s.dialog}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
      >
        <div className={s.row}>
          <h3>인플루언서 선택</h3>
          <AdminButton type="button" onClick={() => setOpen(false)}>
            닫기
          </AdminButton>
        </div>
        {error ? (
          <p role="alert" className="admin-alert error">
            {error}
          </p>
        ) : null}
        <label className={s.field}>
          이름·장르·파트너 검색
          <input
            value={query}
            maxLength={120}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
              setPerson(null);
            }}
          />
        </label>
        <div className={s.choices} aria-busy={busy}>
          {list?.items.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={person?.id === p.id}
              onClick={() => {
                setPerson(p);
                setRateIndex(-1);
                setChannelIndex(0);
              }}
            >
              <InfluencerAvatar
                name={p.displayName}
                thumbnailUrl={p.channels[0]?.thumbnailUrl}
                size={36}
              />
              <span>
                {p.displayName}
                <small className={s.sub}>
                  {p.partnerName || affiliationNames[p.affiliation]}
                </small>
              </span>
            </button>
          ))}
          {list && !list.total ? (
            <p>
              검색 결과가 없습니다.{" "}
              <a
                href="/?tab=creators"
                target="_blank"
                rel="noopener noreferrer"
              >
                인플루언서 DB에서 등록
              </a>
            </p>
          ) : null}
        </div>
        {list && list.total > list.pageSize ? (
          <div className={s.actions}>
            <AdminButton
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((v) => v - 1)}
            >
              이전
            </AdminButton>
            <span>
              {list.page} / {Math.ceil(list.total / list.pageSize)}
            </span>
            <AdminButton
              type="button"
              disabled={list.page * list.pageSize >= list.total}
              onClick={() => setPage((v) => v + 1)}
            >
              다음
            </AdminButton>
          </div>
        ) : null}
        {person ? (
          <>
            <div className={s.identity}>
              <InfluencerAvatar
                name={person.displayName}
                thumbnailUrl={person.channels[channelIndex]?.thumbnailUrl}
                size={56}
              />
              <div>
                <h4>{person.displayName}</h4>
                <small className={s.sub}>
                  {person.channels[channelIndex]?.name}
                </small>
              </div>
            </div>
            <p>
              가용성 {availabilityNames[person.availability]} ·{" "}
              {person.availabilityNote || "등록된 일정 메모 없음"}
            </p>
            {person.conflicts ? <p>경쟁·독점 제한 {person.conflicts}</p> : null}
            {person.staleAvailability || person.stalePrice ? (
              <p className={s.warning}>
                가격 또는 가용성이 미확인 상태이거나 확인 후 90일이 지났습니다.
              </p>
            ) : null}
            <label className={s.field}>
              공개할 채널
              <FormSelect
                value={channelIndex}
                onChange={(e) => setChannelIndex(Number(e.target.value))}
              >
                {person.channels.map((c, i) => (
                  <option value={i} key={c.url}>
                    {c.platform} · {c.name}
                  </option>
                ))}
              </FormSelect>
            </label>
            <label className={s.field}>
              가격표 항목
              <FormSelect
                value={rateIndex}
                onChange={(e) => setRateIndex(Number(e.target.value))}
              >
                <option value="-1">조건·가격 직접 입력</option>
                {person.rates.map((r, i) =>
                  r.currency === currency ? (
                    <option key={i} value={i}>
                      {r.format} · {r.currency} {r.sellUnit} · 최소 {r.minUnits}
                      건{r.validUntil ? " · 유효 " + r.validUntil : ""}
                    </option>
                  ) : null,
                )}
              </FormSelect>
            </label>
            <AdminButton
              type="button"
              className="primary"
              disabled={!person.channels[channelIndex]}
              onClick={choose}
            >
              제안 초안에 반영
            </AdminButton>
          </>
        ) : null}
      </dialog>
    </>
  );
}
