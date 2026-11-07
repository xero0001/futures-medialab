"use client";

import { FormSelect } from "@futures-medialab/ui/form-select";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { AdminButton } from "./_components/admin-button";
import {
  affiliationNames,
  availabilityNames,
  acceptanceNames,
  catalogPlatforms,
  blankProfile,
  blankRate,
  blankChannel,
  catalogMutation,
  type CatalogDetail,
  type CatalogList,
  type CatalogOptions,
  type CatalogProfile,
  type CatalogRate,
  type CatalogRecord,
  type CatalogChannel,
} from "../lib/creator-catalog-model";
import s from "./creator-catalog.module.css";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store" });
  const body = await response.json();
  if (!response.ok) {
    if (response.status === 401) window.location.assign("/login");
    throw new Error(body.message || "요청을 처리하지 못했습니다.");
  }
  return body as T;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={s.field}>
      {label}
      {children}
    </label>
  );
}
function labelOptions<T extends string>(names: Record<T, string>) {
  return (
    <>
      {(Object.entries(names) as [T, string][]).map(([v, l]) => (
        <option value={v} key={v}>
          {l}
        </option>
      ))}
    </>
  );
}
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeZone: "Asia/Seoul",
      }).format(new Date(value))
    : "미확인";
function useDirtyGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: Event) => {
      if (!window.confirm("작성한 내용을 저장하지 않고 이동할까요?"))
        event.preventDefault();
    };
    const unload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("admin:navigate", guard);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("admin:navigate", guard);
      window.removeEventListener("beforeunload", unload);
    };
  }, [dirty]);
}
const guard = () =>
  window.dispatchEvent(new Event("admin:navigate", { cancelable: true }));
function profileOf(row: CatalogRecord): CatalogProfile {
  const base = blankProfile(row.ownerId);
  return Object.fromEntries(
    Object.keys(base).map((key) => [key, row[key as keyof CatalogProfile]]),
  ) as CatalogProfile;
}
function RateTable({ rates }: { rates: CatalogRate[] }) {
  return (
    <div className={s.table}>
      <table>
        <thead>
          <tr>
            <th>형식·통화</th>
            <th>공급 단가</th>
            <th>제안 단가</th>
            <th>최소 수량</th>
            <th>조건</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((r, i) => (
            <tr key={i}>
              <td>
                {r.format} · {r.currency}
              </td>
              <td>{r.supplyUnit}</td>
              <td>{r.sellUnit}</td>
              <td>{r.minUnits}</td>
              <td>
                {r.rights || "사용권 미기재"}
                <small className={s.sub}>
                  {[
                    r.restrictions,
                    r.validUntil && "유효 " + r.validUntil,
                    r.negotiatedUnit && "최근 협상가 " + r.negotiatedUnit,
                    r.revisionFee && "수정비 " + r.revisionFee,
                    r.vat === "INCLUDED"
                      ? "VAT 포함"
                      : r.vat === "EXCLUDED"
                        ? "VAT 별도"
                        : "",
                    r.exchangeDate && "환율 기준 " + r.exchangeDate,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function CatalogEditor({
  detail,
  options,
  mode,
  onDone,
  onCancel,
}: {
  detail: CatalogDetail | null;
  options: CatalogOptions;
  mode: "create" | "update" | "rates";
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const [profile, setProfile] = useState<CatalogProfile>(() =>
    detail ? profileOf(detail.creator) : blankProfile(options.selfId),
  );
  const [rates, setRates] = useState<CatalogRate[]>(() =>
    detail?.creator.rates.length ? detail.creator.rates : [blankRate()],
  );
  const [reason, setReason] = useState(""),
    [confirmAvailability, setConfirmAvailability] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [partners, setPartners] = useState(options.agencies),
    [roster, setRoster] = useState<CatalogOptions["roster"]>([]),
    [partnerQ, setPartnerQ] = useState("");
  const retry = useRef<{ hash: string; id: string } | null>(null);
  useDirtyGuard(dirty);
  function update<K extends keyof CatalogProfile>(
    key: K,
    value: CatalogProfile[K],
  ) {
    setDirty(true);
    setProfile((v) => ({ ...v, [key]: value }));
  }
  function setChannel<K extends keyof CatalogChannel>(
    i: number,
    key: K,
    value: CatalogChannel[K],
  ) {
    update(
      "channels",
      profile.channels.map((c, j) => (i === j ? { ...c, [key]: value } : c)),
    );
  }
  function setRate<K extends keyof CatalogRate>(
    i: number,
    key: K,
    value: CatalogRate[K],
  ) {
    setDirty(true);
    setRates((rows) =>
      rows.map((r, j) => (i === j ? { ...r, [key]: value } : r)),
    );
  }
  useEffect(() => {
    if (mode === "rates" || profile.affiliation !== "PARTNER") return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({
        view: "options",
        agency: profile.partnerOrganizationId || "",
        agencySearch: partnerQ,
      });
      request<CatalogOptions>("/api/admin/creators?" + query, {
        signal: controller.signal,
      })
        .then((v) => {
          if (!controller.signal.aborted) {
            setPartners(v.agencies);
            setRoster(v.roster);
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    }, 160);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [profile.affiliation, profile.partnerOrganizationId, partnerQ, mode]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const value =
      mode === "create"
        ? { action: "create", profile, confirmAvailability }
        : mode === "rates"
          ? {
              action: "rates",
              id: detail!.creator.id,
              revision: detail!.creator.revision,
              reason,
              rates,
            }
          : {
              action: "update",
              id: detail!.creator.id,
              revision: detail!.creator.revision,
              reason,
              profile,
              confirmAvailability,
            };
    const hash = JSON.stringify(value);
    if (retry.current?.hash !== hash)
      retry.current = { hash, id: crypto.randomUUID() };
    const result = catalogMutation.safeParse({
      ...value,
      requestId: retry.current.id,
    });
    if (!result.success) {
      setError(
        result.error.issues.some((issue) => /[가-힣]/.test(issue.message))
          ? result.error.issues
              .filter((issue) => /[가-힣]/.test(issue.message))
              .map((issue) => issue.message)
              .join(" ")
          : mode === "rates"
            ? "가격 항목의 형식·수량·금액과 변경 사유를 확인해 주세요. 금액은 소수 둘째 자리까지 입력할 수 있습니다."
            : "활동명·담당자·채널과 입력한 내용의 길이를 확인해 주세요.",
      );
      return;
    }
    setBusy(true);
    try {
      const { id } = await request<{ id: string }>("/api/admin/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      setDirty(false);
      onDone(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={s.editor} onSubmit={save}>
      <h3>
        {mode === "create"
          ? "크리에이터 등록"
          : mode === "rates"
            ? "새 가격 버전"
            : "프로필 수정"}
      </h3>
      {error ? (
        <p role="alert" className="admin-alert error">
          {error}
        </p>
      ) : null}
      <fieldset disabled={busy}>
        {mode !== "rates" ? (
          <>
            <section className={s.grid}>
              <Field label="활동명">
                <input
                  required
                  maxLength={100}
                  value={profile.displayName}
                  onChange={(e) => update("displayName", e.target.value)}
                />
              </Field>
              <Field label="소속 유형">
                <FormSelect
                  value={profile.affiliation}
                  onChange={(e) => {
                    const affiliation = e.target
                      .value as CatalogProfile["affiliation"];
                    setDirty(true);
                    setProfile((p) => ({
                      ...p,
                      affiliation,
                      partnerOrganizationId: null,
                      rosterCreatorId: null,
                    }));
                  }}
                >
                  {labelOptions(affiliationNames)}
                </FormSelect>
              </Field>
              <Field label="갱신 담당자">
                <FormSelect
                  required
                  value={profile.ownerId}
                  onChange={(e) => update("ownerId", e.target.value)}
                >
                  {options.owners.map((o) => (
                    <option value={o.id} key={o.id}>
                      {o.name}
                    </option>
                  ))}
                </FormSelect>
              </Field>
              <Field label="운영 상태">
                <FormSelect
                  value={profile.isActive ? "yes" : "no"}
                  onChange={(e) => update("isActive", e.target.value === "yes")}
                >
                  <option value="yes">활성</option>
                  <option value="no">보관</option>
                </FormSelect>
              </Field>
            </section>
            {profile.affiliation === "PARTNER" ? (
              <section className={s.grid}>
                <Field label="파트너 이름 검색">
                  <input
                    value={partnerQ}
                    maxLength={120}
                    onChange={(e) => setPartnerQ(e.target.value)}
                  />
                </Field>
                <Field label="파트너 조직">
                  <FormSelect
                    required
                    value={profile.partnerOrganizationId ?? ""}
                    onChange={(e) => {
                      const partnerOrganizationId = e.target.value || null;
                      setDirty(true);
                      setProfile((p) => ({
                        ...p,
                        partnerOrganizationId,
                        rosterCreatorId: null,
                      }));
                      setRoster([]);
                    }}
                  >
                    <option value="">조직 선택</option>
                    {profile.partnerOrganizationId &&
                    !partners.some(
                      (x) => x.id === profile.partnerOrganizationId,
                    ) ? (
                      <option value={profile.partnerOrganizationId}>
                        {detail?.creator.partnerName || "선택된 조직"}
                      </option>
                    ) : null}
                    {partners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </FormSelect>
                </Field>
                <Field label="파트너 로스터 연결">
                  <FormSelect
                    disabled={!profile.partnerOrganizationId}
                    value={profile.rosterCreatorId ?? ""}
                    onChange={(e) => {
                      const row = roster.find((r) => r.id === e.target.value);
                      setDirty(true);
                      setProfile((p) =>
                        row
                          ? {
                              ...p,
                              rosterCreatorId: row.id,
                              displayName: row.displayName,
                              genres: row.genres,
                              languages: [row.language],
                              channels: row.channels.length
                                ? row.channels
                                : p.channels,
                            }
                          : { ...p, rosterCreatorId: null },
                      );
                    }}
                  >
                    <option value="">직접 등록</option>
                    {profile.rosterCreatorId &&
                    !roster.some((r) => r.id === profile.rosterCreatorId) ? (
                      <option value={profile.rosterCreatorId}>
                        기존 연결 인물
                      </option>
                    ) : null}
                    {roster.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.displayName}
                      </option>
                    ))}
                  </FormSelect>
                </Field>
              </section>
            ) : null}
            <section>
              <div className={s.row}>
                <h4>채널·지표</h4>
                <AdminButton
                  type="button"
                  disabled={profile.channels.length >= 12}
                  onClick={() =>
                    update("channels", [...profile.channels, blankChannel()])
                  }
                >
                  채널 추가
                </AdminButton>
              </div>
              {profile.channels.map((c, i) => (
                <div className={s.card} key={i}>
                  <div className={s.row}>
                    <strong>채널 {i + 1}</strong>
                    <AdminButton
                      type="button"
                      disabled={profile.channels.length === 1}
                      onClick={() =>
                        update(
                          "channels",
                          profile.channels.filter((_, n) => n !== i),
                        )
                      }
                    >
                      채널 삭제
                    </AdminButton>
                  </div>
                  <div className={s.grid}>
                    <Field label="플랫폼">
                      <FormSelect
                        value={c.platform}
                        onChange={(e) =>
                          setChannel(
                            i,
                            "platform",
                            e.target.value as CatalogChannel["platform"],
                          )
                        }
                      >
                        {catalogPlatforms.map((platform) => (
                          <option key={platform}>{platform}</option>
                        ))}
                      </FormSelect>
                    </Field>
                    <Field label="채널명">
                      <input
                        required
                        maxLength={120}
                        value={c.name}
                        onChange={(e) => setChannel(i, "name", e.target.value)}
                      />
                    </Field>
                    <Field label="공개 채널 URL">
                      <input
                        required
                        type="url"
                        maxLength={2048}
                        value={c.url}
                        onChange={(e) => setChannel(i, "url", e.target.value)}
                      />
                    </Field>
                    {(
                      [
                        ["followers", "구독자·팔로워"],
                        ["averageViews", "평균 조회"],
                        ["averageLiveViewers", "평균 동접"],
                        ["peakLiveViewers", "최고 동접"],
                        ["shortViews", "쇼츠 평균 조회"],
                      ] as const
                    ).map(([key, label]) => (
                      <Field key={key} label={label}>
                        <input
                          type="number"
                          min="0"
                          max="2147483647"
                          step="1"
                          placeholder="미집계"
                          value={c[key] ?? ""}
                          onChange={(e) =>
                            setChannel(
                              i,
                              key,
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                            )
                          }
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              ))}
            </section>
            <section className={s.grid}>
              {(
                [
                  ["genres", "장르"],
                  ["languages", "언어"],
                  ["formats", "콘텐츠 형식"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label + " (쉼표로 구분)"}>
                  <input
                    maxLength={600}
                    value={profile[key].join(",")}
                    onChange={(e) =>
                      update(
                        key,
                        e.target.value ? e.target.value.split(",") : [],
                      )
                    }
                  />
                </Field>
              ))}
              <Field label="시청자·팬덤 특성">
                <textarea
                  maxLength={2000}
                  value={profile.audienceNotes}
                  onChange={(e) => update("audienceNotes", e.target.value)}
                />
              </Field>
            </section>
            <section>
              <h4>가용성·경쟁 제한</h4>
              <div className={s.grid}>
                <Field label="광고 진행 가능 여부">
                  <FormSelect
                    value={profile.availability}
                    onChange={(e) =>
                      update(
                        "availability",
                        e.target.value as CatalogProfile["availability"],
                      )
                    }
                  >
                    {labelOptions(availabilityNames)}
                  </FormSelect>
                </Field>
                <Field label="중국 게임 광고">
                  <FormSelect
                    value={profile.acceptsChinaGames}
                    onChange={(e) =>
                      update(
                        "acceptsChinaGames",
                        e.target.value as CatalogProfile["acceptsChinaGames"],
                      )
                    }
                  >
                    {labelOptions(acceptanceNames)}
                  </FormSelect>
                </Field>
                {(
                  [
                    ["availableFrom", "가용 시작일"],
                    ["availableThrough", "가용 종료일"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input
                      type="date"
                      value={profile[key] ?? ""}
                      onChange={(e) => update(key, e.target.value || null)}
                    />
                  </Field>
                ))}
                {(
                  [
                    ["availabilityNote", "일정·휴식 기간 메모"],
                    ["conflicts", "경쟁·독점 제한"],
                    ["riskNotes", "운영·분쟁 메모"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <textarea
                      maxLength={2000}
                      value={profile[key]}
                      onChange={(e) => update(key, e.target.value)}
                    />
                  </Field>
                ))}
              </div>
              <label className={s.check}>
                <input
                  type="checkbox"
                  checked={confirmAvailability}
                  onChange={(e) => {
                    setConfirmAvailability(e.target.checked);
                    setDirty(true);
                  }}
                />
                가용성을 확인했습니다. 오늘을 확인일로 기록합니다.
              </label>
            </section>
          </>
        ) : (
          <>
            {rates.map((r, i) => (
              <section className={s.card} key={i}>
                <div className={s.row}>
                  <strong>가격 항목 {i + 1}</strong>
                  <AdminButton
                    type="button"
                    disabled={rates.length === 1}
                    onClick={() => {
                      setRates(rates.filter((_, j) => i !== j));
                      setDirty(true);
                    }}
                  >
                    삭제
                  </AdminButton>
                </div>
                <div className={s.grid}>
                  <Field label="콘텐츠 형식">
                    <input
                      required
                      maxLength={120}
                      value={r.format}
                      onChange={(e) => setRate(i, "format", e.target.value)}
                    />
                  </Field>
                  <Field label="통화">
                    <FormSelect
                      value={r.currency}
                      onChange={(e) =>
                        setRate(
                          i,
                          "currency",
                          e.target.value as CatalogRate["currency"],
                        )
                      }
                    >
                      {["KRW", "USD", "CNY"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </FormSelect>
                  </Field>
                  {(
                    [
                      ["supplyUnit", "공급 단가"],
                      ["sellUnit", "제안 단가"],
                      ["negotiatedUnit", "최근 협상 단가"],
                      ["revisionFee", "수정비"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <input
                        required={key === "supplyUnit" || key === "sellUnit"}
                        inputMode="decimal"
                        value={r[key] ?? ""}
                        onChange={(e) =>
                          setRate(
                            i,
                            key,
                            e.target.value ||
                              (key === "supplyUnit" || key === "sellUnit"
                                ? ""
                                : null),
                          )
                        }
                      />
                    </Field>
                  ))}
                  <Field label="최소 수량">
                    <input
                      type="number"
                      required
                      min={1}
                      max={1000}
                      value={r.minUnits || ""}
                      onChange={(e) =>
                        setRate(i, "minUnits", Number(e.target.value))
                      }
                    />
                  </Field>
                  <Field label="VAT">
                    <FormSelect
                      value={r.vat}
                      onChange={(e) =>
                        setRate(i, "vat", e.target.value as CatalogRate["vat"])
                      }
                    >
                      <option value="UNSPECIFIED">미확인</option>
                      <option value="INCLUDED">포함</option>
                      <option value="EXCLUDED">별도</option>
                    </FormSelect>
                  </Field>
                  {(
                    [
                      ["validUntil", "가격 유효 종료일"],
                      ["exchangeDate", "환율 기준일"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <input
                        type="date"
                        value={r[key] ?? ""}
                        onChange={(e) =>
                          setRate(i, key, e.target.value || null)
                        }
                      />
                    </Field>
                  ))}
                  {(
                    [
                      ["rights", "사용권"],
                      ["restrictions", "경쟁 제한·추가 조건"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <textarea
                        maxLength={2000}
                        value={r[key]}
                        onChange={(e) => setRate(i, key, e.target.value)}
                      />
                    </Field>
                  ))}
                </div>
              </section>
            ))}
            <AdminButton
              type="button"
              disabled={rates.length >= 20}
              onClick={() => {
                setRates([...rates, blankRate()]);
                setDirty(true);
              }}
            >
              가격 항목 추가
            </AdminButton>
          </>
        )}
        {mode !== "create" ? (
          <Field label="변경 사유">
            <input
              required
              minLength={2}
              maxLength={500}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setDirty(true);
              }}
            />
          </Field>
        ) : null}
        <div className={s.actions}>
          <AdminButton type="submit" className="primary">
            {busy ? "저장 중…" : mode === "rates" ? "가격 버전 저장" : "저장"}
          </AdminButton>
          <AdminButton
            type="button"
            onClick={() => {
              if (guard()) onCancel();
            }}
          >
            취소
          </AdminButton>
        </div>
      </fieldset>
    </form>
  );
}
function CatalogFacts({
  detail,
  onEdit,
  onRate,
}: {
  detail: CatalogDetail;
  onEdit: () => void;
  onRate: () => void;
}) {
  const p = detail.creator;
  return (
    <>
      <div className={s.row}>
        <div>
          <span className={s.badge}>
            {affiliationNames[p.affiliation]} · {p.isActive ? "활성" : "보관"}
          </span>
          <h2>{p.displayName}</h2>
        </div>
        <div className={s.actions}>
          <AdminButton onClick={onEdit}>프로필 수정</AdminButton>
          <AdminButton className="primary" onClick={onRate}>
            새 가격 버전
          </AdminButton>
        </div>
      </div>
      {p.stalePrice || p.staleAvailability ? (
        <p className={s.warning}>
          {[p.staleAvailability ? "가용성" : "", p.stalePrice ? "가격" : ""]
            .filter(Boolean)
            .join("·")}{" "}
          갱신이 필요합니다. 마지막 확인일을 확인해 주세요.
        </p>
      ) : null}
      <dl className={s.facts}>
        {[
          ["담당자", p.ownerName],
          ["파트너", p.partnerName],
          [
            "장르 / 언어",
            [p.genres.join(", "), p.languages.join(", ")]
              .filter(Boolean)
              .join(" / "),
          ],
          ["콘텐츠 형식", p.formats.join(", ")],
          ["시청자 특성", p.audienceNotes],
          [
            "가용성",
            availabilityNames[p.availability] +
              " · 확인 " +
              date(p.availabilityCheckedAt),
          ],
          [
            "가용 일정",
            [p.availableFrom, p.availableThrough].filter(Boolean).join(" ~ "),
          ],
          ["일정 메모", p.availabilityNote],
          ["중국 게임 광고", acceptanceNames[p.acceptsChinaGames]],
          ["경쟁·독점 제한", p.conflicts],
          ["운영 메모", p.riskNotes],
        ]
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label} style={{ display: "contents" }}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      <section>
        <h3>채널·지표</h3>
        {p.channels.map((c) => (
          <p key={c.url}>
            <a target="_blank" rel="noopener noreferrer" href={c.url}>
              {c.name} ↗
            </a>{" "}
            · {c.platform}
            <small className={s.sub}>
              {[
                ["팔로워", c.followers],
                ["평균 조회", c.averageViews],
                ["평균 동접", c.averageLiveViewers],
                ["최고 동접", c.peakLiveViewers],
                ["쇼츠 평균", c.shortViews],
              ]
                .filter(([, n]) => n !== null)
                .map(([k, n]) => k + " " + n?.toLocaleString())
                .join(" · ") || "지표 미등록"}
            </small>
          </p>
        ))}
      </section>
      <section>
        <h3>가격 이력</h3>
        {!detail.history.length ? (
          <p>등록된 가격표가 없습니다.</p>
        ) : (
          detail.history.map((h, i) => (
            <details className={s.card} key={h.version} open={i === 0}>
              <summary>
                v{h.version} · {date(h.at)} · {h.author}
              </summary>
              <p>{h.reason}</p>
              <RateTable rates={h.rates} />
            </details>
          ))
        )}
      </section>
      <section>
        <h3>연결된 제안</h3>
        {detail.campaigns.length ? (
          detail.campaigns.map((c, i) => (
            <p key={i}>
              <a
                href={
                  "/?" +
                  new URLSearchParams({
                    tab: "campaigns",
                    campaign: c.id,
                    section: "proposal",
                  })
                }
              >
                {c.title} · 제안 v{c.version}
              </a>{" "}
              · {c.publishedAt ? "발행 " + date(c.publishedAt) : "비공개 초안"}
            </p>
          ))
        ) : (
          <p>연결된 제안이 없습니다.</p>
        )}
      </section>
    </>
  );
}
export function AdminCreatorCatalog({
  refreshToken = 0,
}: {
  refreshToken?: number;
}) {
  const [q, setQ] = useState(""),
    [affiliation, setAffiliation] = useState("all"),
    [active, setActive] = useState("yes"),
    [stale, setStale] = useState("all"),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState(""),
    [mode, setMode] = useState<
      "list" | "detail" | "create" | "update" | "rates"
    >("list"),
    [revision, setRevision] = useState(0),
    [list, setList] = useState<CatalogList | null>(null),
    [detail, setDetail] = useState<CatalogDetail | null>(null),
    [options, setOptions] = useState<CatalogOptions | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      async () => {
        setBusy(true);
        setError("");
        try {
          if (mode === "list") {
            const v = await request<CatalogList>(
              "/api/admin/creators?" +
                new URLSearchParams({
                  q,
                  affiliation,
                  active,
                  stale,
                  page: String(page),
                }),
              { signal: controller.signal },
            );
            if (!controller.signal.aborted) setList(v);
          } else if (mode === "detail") {
            const v = await request<CatalogDetail>(
              "/api/admin/creators?id=" + encodeURIComponent(selected),
              { signal: controller.signal },
            );
            if (!controller.signal.aborted) setDetail(v);
          } else if (mode === "create" || mode === "update") {
            const v = await request<CatalogOptions>(
              "/api/admin/creators?view=options",
              { signal: controller.signal },
            );
            if (!controller.signal.aborted) setOptions(v);
          }
        } catch (e) {
          if (!controller.signal.aborted)
            setError(e instanceof Error ? e.message : "조회 실패");
        } finally {
          if (!controller.signal.aborted) setBusy(false);
        }
      },
      mode === "list" ? 150 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    q,
    page,
    affiliation,
    active,
    stale,
    mode,
    selected,
    revision,
    refreshToken,
  ]);
  function open(id: string) {
    setSelected(id);
    setDetail(null);
    setMode("detail");
    setRevision((v) => v + 1);
  }
  return (
    <div className={s.panel} aria-busy={busy}>
      {error ? (
        <p className="admin-alert error" role="alert">
          {error}
        </p>
      ) : null}
      {mode === "list" ? (
        <>
          <div className={s.row}>
            <h2>인물 목록</h2>
            <AdminButton
              type="button"
              className="primary"
              onClick={() => {
                setOptions(null);
                setMode("create");
              }}
            >
              크리에이터 등록
            </AdminButton>
          </div>
          <div className={s.filters}>
            <Field label="이름·장르·파트너 검색">
              <input
                maxLength={120}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </Field>
            <Field label="소속">
              <FormSelect
                value={affiliation}
                onChange={(e) => {
                  setAffiliation(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">전체 소속</option>
                {labelOptions(affiliationNames)}
              </FormSelect>
            </Field>
            <Field label="상태">
              <FormSelect
                value={active}
                onChange={(e) => {
                  setActive(e.target.value);
                  setPage(1);
                }}
              >
                <option value="yes">활성</option>
                <option value="no">보관</option>
                <option value="all">전체 상태</option>
              </FormSelect>
            </Field>
            <Field label="갱신">
              <FormSelect
                value={stale}
                onChange={(e) => {
                  setStale(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">전체</option>
                <option value="yes">90일 경과·미확인</option>
              </FormSelect>
            </Field>
          </div>
          <div className={s.table}>
            <table>
              <thead>
                <tr>
                  <th>활동명</th>
                  <th>소속</th>
                  <th>장르·언어</th>
                  <th>가용성</th>
                  <th>가격 확인</th>
                  <th>담당자</th>
                </tr>
              </thead>
              <tbody>
                {list?.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <AdminButton type="button" onClick={() => open(p.id)}>
                        {p.displayName}
                      </AdminButton>
                    </td>
                    <td>
                      {affiliationNames[p.affiliation]}
                      {p.partnerName ? (
                        <small className={s.sub}>{p.partnerName}</small>
                      ) : null}
                    </td>
                    <td>
                      {p.genres.join(", ") || "—"}
                      <small className={s.sub}>{p.languages.join(", ")}</small>
                    </td>
                    <td>
                      {availabilityNames[p.availability]}
                      {p.staleAvailability ? (
                        <small className={s.sub}>갱신 필요</small>
                      ) : null}
                    </td>
                    <td>
                      {p.rateVersion
                        ? "v" + p.rateVersion + " · " + date(p.priceCheckedAt)
                        : "미등록"}
                      {p.stalePrice ? (
                        <small className={s.sub}>갱신 필요</small>
                      ) : null}
                    </td>
                    <td>{p.ownerName}</td>
                  </tr>
                ))}
                {!list?.items.length ? (
                  <tr>
                    <td colSpan={6}>
                      {busy ? "조회 중…" : "조건에 맞는 인물이 없습니다."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className={s.row}>
            <span>전체 {list?.total ?? 0}명</span>
            <div className={s.actions}>
              <AdminButton
                type="button"
                disabled={busy || (list?.page ?? 1) <= 1}
                onClick={() => setPage((list?.page ?? 1) - 1)}
              >
                이전
              </AdminButton>
              <span>
                {list?.page ?? 1} /{" "}
                {Math.max(
                  1,
                  Math.ceil((list?.total ?? 0) / (list?.pageSize ?? 20)),
                )}
              </span>
              <AdminButton
                type="button"
                disabled={
                  busy || !list || list.page * list.pageSize >= list.total
                }
                onClick={() => setPage((list?.page ?? 1) + 1)}
              >
                다음
              </AdminButton>
            </div>
          </div>
        </>
      ) : (
        <>
          <AdminButton
            type="button"
            onClick={() => {
              if (guard()) setMode("list");
            }}
          >
            ← 인물 목록
          </AdminButton>
          {mode === "detail" && detail?.creator.id === selected ? (
            <CatalogFacts
              detail={detail}
              onEdit={() => {
                setOptions(null);
                setMode("update");
              }}
              onRate={() => setMode("rates")}
            />
          ) : null}
          {(mode === "create" || mode === "update" || mode === "rates") &&
          (options || mode === "rates") ? (
            <CatalogEditor
              key={mode + ":" + selected}
              mode={mode}
              options={
                options ?? { selfId: "", owners: [], agencies: [], roster: [] }
              }
              detail={mode === "create" ? null : detail}
              onDone={open}
              onCancel={() => setMode(mode === "create" ? "list" : "detail")}
            />
          ) : null}
          {busy ? <p role="status">조회 중…</p> : null}
        </>
      )}
    </div>
  );
}
