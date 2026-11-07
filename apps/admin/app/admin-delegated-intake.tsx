"use client";

import { FormSelect } from "@futures-medialab/ui/form-select";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AdminButton } from "./_components/admin-button";
import styles from "./admin-delegated-intake.module.css";

type Party = {
  id: string;
  name: string;
  email?: string;
  role?: string;
  agencyBuyer?: boolean;
};
type Lookup = { items: Party[]; hasMore: boolean };
const platforms = [
  ["youtube", "YouTube"],
  ["chzzk", "치지직"],
  ["soop", "SOOP"],
  ["tiktok", "TikTok"],
  ["instagram", "Instagram"],
  ["twitch", "Twitch"],
  ["x", "X"],
  ["facebook", "Facebook"],
  ["recommend", "운영팀 추천"],
] as const;
const channels = [
  ["email", "이메일"],
  ["phone", "전화"],
  ["meeting", "미팅"],
  ["messenger", "메신저"],
  ["other", "기타"],
] as const;

function PartyPicker({
  label,
  organizationId,
  selected,
  onChange,
}: {
  label: string;
  organizationId?: string;
  selected: Party | null;
  onChange: (value: Party | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const id = useId();
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLookup(null);
      setError("");
      const params = new URLSearchParams({ q: query.trim() });
      if (organizationId) params.set("organizationId", organizationId);
      try {
        const response = await fetch(`/api/admin/delegated-intake?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 401) window.location.assign("/login");
          throw new Error(data.message || "목록을 읽지 못했습니다.");
        }
        if (!controller.signal.aborted) setLookup(data);
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "목록을 읽지 못했습니다.",
          );
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [organizationId, query, attempt]);
  const items = lookup?.items ?? [];
  const options =
    selected && !items.some((item) => item.id === selected.id)
      ? [selected, ...items]
      : items;
  return (
    <div className={styles.picker}>
      <label htmlFor={`${id}-search`}>{label} 검색</label>
      <input
        id={`${id}-search`}
        type="search"
        maxLength={140}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={organizationId ? "이름 또는 이메일" : "조직명"}
      />
      <label htmlFor={`${id}-select`}>{label}</label>
      <FormSelect
        id={`${id}-select`}
        required
        value={selected?.id ?? ""}
        onChange={(event) =>
          onChange(
            options.find((item) => item.id === event.target.value) ?? null,
          )
        }
      >
        <option value="">선택해 주세요</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
            {item.email && item.email !== item.name ? ` · ${item.email}` : ""}
            {item.role
              ? ` · ${item.role === "OWNER" ? "소유자" : "관리자"}`
              : ""}
            {item.agencyBuyer ? " · 구매자 대행사" : ""}
          </option>
        ))}
      </FormSelect>
      {error ? (
        <div role="alert" className="admin-alert error">
          {error}{" "}
          <AdminButton type="button" onClick={() => setAttempt((n) => n + 1)}>
            다시 불러오기
          </AdminButton>
        </div>
      ) : (
        <small role="status">
          {!lookup
            ? "목록을 불러오는 중…"
            : lookup.hasMore
              ? "검색어로 30건 이내로 좁혀 주세요."
              : !items.length
                ? "조건에 맞는 항목이 없습니다."
                : `${items.length}건`}
        </small>
      )}
    </div>
  );
}

export function AdminDelegatedIntake({
  onCreated,
  onCancel,
}: {
  onCreated: (campaignId: string) => void;
  onCancel?: () => void;
}) {
  const [organization, setOrganization] = useState<Party | null>(null),
    [requester, setRequester] = useState<Party | null>(null);
  const [route, setRoute] = useState<"managed" | "open">("managed");
  const [chosenPlatforms, setPlatforms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dirty = useRef(false),
    pending = useRef(false),
    retryKey = useRef("");
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (dirty.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    function beforeNavigate(event: Event) {
      if (
        pending.current ||
        (dirty.current &&
          !window.confirm("작성 중인 대리 접수 내용을 지우고 이동할까요?"))
      )
        event.preventDefault();
    }
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("admin:navigate", beforeNavigate);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("admin:navigate", beforeNavigate);
    };
  }, []);
  function togglePlatform(value: string, selected: boolean) {
    setPlatforms((current) => {
      if (!selected) return current.filter((item) => item !== value);
      if (value === "recommend") return [value];
      return [...current.filter((item) => item !== "recommend"), value];
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    if (!organization || !requester) {
      setError("브랜드와 실제 의뢰자를 선택해 주세요.");
      return;
    }
    if (!chosenPlatforms.length) {
      setError("매체를 한 개 이상 선택해 주세요.");
      return;
    }
    const form = new FormData(event.currentTarget),
      value = (name: string) => String(form.get(name) ?? "").trim();
    const regions = Array.from(
      new Set(
        value("regions")
          .toUpperCase()
          .split(/[\s,]+/)
          .filter(Boolean),
      ),
    );
    if (
      regions.length > 40 ||
      regions.some((item) => !/^[A-Z]{2}$/.test(item))
    ) {
      setError("지역은 두 글자 국가 코드로 최대 40개까지 입력해 주세요.");
      return;
    }
    const budget = Number(value("budgetAmount"));
    if (!Number.isFinite(budget) || budget <= 0 || budget > 10_000_000) {
      setError("예산은 0보다 크고 10,000,000 이하인 금액으로 입력해 주세요.");
      return;
    }
    const desiredDate = value("desiredDate"),
      now = new Date();
    if (
      desiredDate <=
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now)
    ) {
      setError("희망 게시일은 내일 이후로 선택해 주세요.");
      return;
    }
    let applicationDeadline: string | null = null;
    if (route === "open") {
      const deadline = new Date(`${value("applicationDeadline")}:00+09:00`);
      if (
        !Number.isFinite(deadline.getTime()) ||
        deadline <= now ||
        deadline >= new Date(`${desiredDate}T00:00:00+09:00`)
      ) {
        setError("모집 마감은 현재 이후, 희망 게시일 이전으로 선택해 주세요.");
        return;
      }
      applicationDeadline = deadline.toISOString();
    }
    if (!retryKey.current) retryKey.current = crypto.randomUUID();
    const brief = {
      title: value("title"),
      genre: value("genre"),
      goal: value("goal"),
      contentFormat: value("contentFormat"),
      creatorCount: Number(value("creatorCount")),
      desiredDate,
      note: value("note"),
      compositionPreference: value("compositionPreference") || null,
      budgetAmount: value("budgetAmount"),
      currency: value("currency"),
      platforms: chosenPlatforms,
      regions,
      route,
      applicationDeadline,
      clientRequestId: retryKey.current,
    };
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/delegated-intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: organization.id,
          requesterId: requester.id,
          assignToMe: form.has("assignToMe"),
          channel: value("channel"),
          reason: value("reason"),
          finalAdvertiserName: value("finalAdvertiserName"),
          brief,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) window.location.assign("/login");
        throw new Error(result.message || "대리 접수에 실패했습니다.");
      }
      dirty.current = false;
      pending.current = false;
      onCreated(result.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "네트워크 연결을 확인하고 다시 접수해 주세요.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className={styles.form}
      onChange={() => {
        dirty.current = true;
        setError("");
      }}
    >
      <fieldset disabled={busy} className={styles.section}>
        <legend>접수 정보</legend>
        <div className={styles.grid}>
          <PartyPicker
            label="브랜드"
            selected={organization}
            onChange={(item) => {
              setOrganization(item);
              setRequester(null);
            }}
          />
          {organization ? (
            <PartyPicker
              key={organization.id}
              label="실제 의뢰자"
              organizationId={organization.id}
              selected={requester}
              onChange={setRequester}
            />
          ) : (
            <div className={styles.placeholder}>
              브랜드를 선택하면 소속 소유자와 관리자를 선택할 수 있습니다.
            </div>
          )}
          <label>
            최종 광고주 {organization?.agencyBuyer ? "(필수)" : "(선택)"}
            <input
              key={organization?.id ?? "none"}
              name="finalAdvertiserName"
              maxLength={160}
              required={Boolean(organization?.agencyBuyer)}
              placeholder={
                organization?.agencyBuyer
                  ? "광고주 이름"
                  : (organization?.name ?? "광고주 이름")
              }
            />
          </label>
          <label>
            브리프 수신 경로
            <FormSelect name="channel">
              {channels.map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </FormSelect>
          </label>
          <label className={styles.full}>
            대리 접수 사유{" "}
            <textarea
              name="reason"
              required
              minLength={2}
              maxLength={1000}
              rows={2}
              placeholder="운영 이력에 남길 접수 경위를 입력하세요."
            />
          </label>
          <label className={styles.check}>
            <input type="checkbox" name="assignToMe" defaultChecked />
            나를 접수 담당자로 배정
          </label>
        </div>
      </fieldset>
      <fieldset disabled={busy} className={styles.section}>
        <legend>캠페인 브리프</legend>
        <div className={styles.grid}>
          <label>
            캠페인명
            <input name="title" required minLength={2} maxLength={160} />
          </label>
          <label>
            장르
            <input name="genre" required maxLength={120} />
          </label>
          <label className={styles.full}>
            캠페인 목표
            <textarea name="goal" required maxLength={1000} rows={2} />
          </label>
          <label>
            콘텐츠 형식
            <input
              name="contentFormat"
              required
              maxLength={160}
              placeholder="라이브 방송, 숏폼 영상 등"
            />
          </label>
          <label>
            희망 크리에이터 수
            <input
              name="creatorCount"
              required
              type="number"
              min={1}
              max={100}
              step={1}
              defaultValue={1}
            />
          </label>
          <label>
            예산
            <input
              name="budgetAmount"
              required
              type="text"
              inputMode="decimal"
              pattern="(?:0|[1-9][0-9]{0,7})(?:[.][0-9]{1,2})?"
              title="0보다 크고 10,000,000 이하인 금액을 소수 둘째 자리까지 입력하세요."
            />
          </label>
          <label>
            통화
            <FormSelect name="currency">
              <option>KRW</option>
              <option>USD</option>
              <option>CNY</option>
            </FormSelect>
          </label>
          <fieldset className={`${styles.platforms} ${styles.full}`}>
            <legend>매체 (복수 선택)</legend>
            <div>
              {platforms.map(([key, name]) => (
                <label className={styles.check} key={key}>
                  <input
                    type="checkbox"
                    checked={chosenPlatforms.includes(key)}
                    onChange={(e) => togglePlatform(key, e.target.checked)}
                  />
                  {name}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            대상 국가 (선택)
            <input name="regions" maxLength={159} placeholder="KR, JP" />
          </label>
          <label>
            구성 방향 (선택)
            <FormSelect name="compositionPreference">
              <option value="">미지정</option>
              <option value="balanced">요청 충족</option>
              <option value="reach">화제성</option>
              <option value="efficient">예산 효율</option>
            </FormSelect>
          </label>
          <label>
            진행 방식
            <FormSelect
              aria-label="진행 방식"
              value={route}
              onChange={(e) => setRoute(e.target.value as "managed" | "open")}
            >
              <option value="managed">맞춤 의뢰</option>
              <option value="open">오픈 모집</option>
            </FormSelect>
          </label>
          <label>
            희망 게시일
            <input type="date" name="desiredDate" required />
          </label>
          {route === "open" ? (
            <label>
              모집 마감 (한국 시간)
              <input
                type="datetime-local"
                name="applicationDeadline"
                required
              />
            </label>
          ) : (
            <p className={`${styles.hint} ${styles.full}`}>
              접수 시각으로부터 48시간 뒤가 최초 제안 예정 시각으로 기록됩니다.
            </p>
          )}
          <label className={styles.full}>
            추가 요청 (선택)
            <textarea name="note" rows={2} maxLength={2000} />
          </label>
        </div>
      </fieldset>
      {error ? (
        <p role="alert" className="admin-alert error">
          {error}
        </p>
      ) : null}
      <div className={styles.actions}>
        {onCancel ? (
          <AdminButton type="button" disabled={busy} onClick={onCancel}>
            취소
          </AdminButton>
        ) : null}
        <AdminButton
          type="submit"
          className="primary"
          disabled={busy || !organization || !requester}
        >
          {busy ? "접수 중…" : "대리 접수"}
        </AdminButton>
      </div>
    </form>
  );
}
