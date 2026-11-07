"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { TextField, TextArea, useToast } from "@montage-ui/core";
import { FormSelect } from "@futures-medialab/ui/form-select";
import { AdminButton } from "./_components/admin-button";
import {
  blankGame,
  gameLanguages,
  gameMutationSchema,
  validGameThumbnail,
  type AdminGame,
  type GameList,
  type GameProfile,
  type GameLocale,
} from "../lib/game-catalog-model";
import s from "./game-catalog.module.css";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/games${path}`, {
    ...options,
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) window.location.assign("/login");
    throw new Error(body.message || "게임 정보를 불러오지 못했습니다.");
  }
  return body;
}
const navigate = () =>
  window.dispatchEvent(new Event("admin:navigate", { cancelable: true }));
const date = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
function Thumbnail({ url, large = false }: { url: string; large?: boolean }) {
  const [failed, setFailed] = useState("");
  const valid = validGameThumbnail(url) && failed !== url;
  return (
    <span className={`${s.thumbnail} ${large ? s.large : ""}`}>
      {valid ? (
        <Image
          src={url}
          alt="게임 썸네일"
          width={large ? 112 : 48}
          height={large ? 112 : 48}
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setFailed(url)}
        />
      ) : (
        <span>{large ? "이미지 미리보기" : "게임"}</span>
      )}
      {large && failed === url && <small>이미지를 불러올 수 없습니다</small>}
    </span>
  );
}
function GameEditor({
  game,
  onSaved,
  onCancel,
  onReload,
}: {
  game: AdminGame | null;
  onSaved: (game: AdminGame) => void;
  onCancel: () => void;
  onReload: () => void;
}) {
  const [profile, setProfile] = useState<GameProfile>(() =>
    game
      ? {
          title: game.title,
          thumbnailUrl: game.thumbnailUrl,
          verified: game.verified,
          aliases: game.aliases,
          localizations: game.localizations,
        }
      : blankGame(),
  );
  const [aliases, setAliases] = useState(profile.aliases.join("\n"));
  const [reason, setReason] = useState("");
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef<{ body: string; id: string } | null>(null);
  const toast = useToast();
  useEffect(() => {
    if (!dirty && !busy) return;
    const guard = (event: Event) => {
      if (
        busy ||
        !window.confirm(
          "저장하지 않은 변경사항이 있습니다. 이 화면을 나갈까요?",
        )
      )
        event.preventDefault();
    };
    const unload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("admin:navigate", guard);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("admin:navigate", guard);
      window.removeEventListener("beforeunload", unload);
    };
  }, [dirty, busy]);
  function update<K extends keyof GameProfile>(key: K, value: GameProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
    setDirty(true);
    setError("");
  }
  function localized(
    locale: GameLocale,
    key: "title" | "officialUrl",
    value: string,
  ) {
    update(
      "localizations",
      profile.localizations.map((l) =>
        l.locale === locale ? { ...l, [key]: value } : l,
      ),
    );
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const value = {
      ...profile,
      aliases: aliases
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean),
    };
    const body = JSON.stringify(value);
    if (request.current?.body !== body)
      request.current = { body, id: crypto.randomUUID() };
    const parsed = gameMutationSchema.safeParse(
      game
        ? {
            action: "update",
            id: game.id,
            expectedUpdatedAt: game.updatedAt,
            reason,
            profile: value,
          }
        : { action: "create", requestId: request.current!.id, profile: value },
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<{ game: AdminGame }>("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      setDirty(false);
      toast({
        variant: "positive",
        content: game ? "게임 정보를 수정했습니다." : "게임을 등록했습니다.",
      });
      onSaved(result.game);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "저장하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={s.panel} onSubmit={save} noValidate>
      <div className={s.heading}>
        <div>
          <h2>{game ? "게임 정보 수정" : "새 게임 등록"}</h2>
          <p>
            언어별 공식명과 모든 언어에 공통으로 사용할 썸네일을 입력하세요.
          </p>
        </div>
        <AdminButton
          type="button"
          disabled={busy}
          onClick={() => {
            if (navigate()) onCancel();
          }}
        >
          목록으로
        </AdminButton>
      </div>
      {game && (
        <div className={s.meta}>
          연결 캠페인 {game.campaignCount}개 ·{" "}
          {game.organizationName
            ? `${game.organizationName}에서 직접 등록`
            : "운영자 등록"}{" "}
          · 최근 수정 {date(game.updatedAt)}
        </div>
      )}
      <fieldset disabled={busy} className={s.form}>
        <section className={s.section}>
          <h3>기본 정보</h3>
          <div className={s.grid}>
            <div className={s.field}>
              <label htmlFor="game-title">대표 게임명</label>
              <TextField
                id="game-title"
                value={profile.title}
                onChange={(e) => update("title", e.target.value)}
                maxLength={120}
                width="100%"
                placeholder="예: 이환"
              />
              <small>
                목록 표시와 번역이 없는 언어의 기본 이름으로 사용됩니다.
              </small>
            </div>
            <div className={s.field}>
              <label htmlFor="game-verified">검색 공개 상태</label>
              <FormSelect
                id="game-verified"
                value={profile.verified ? "verified" : "pending"}
                onChange={(e) =>
                  update("verified", e.target.value === "verified")
                }
              >
                <option value="verified">공식 게임 · 전체 브랜드 공개</option>
                <option value="pending">검토 중</option>
              </FormSelect>
              <small>
                {profile.verified
                  ? "저장하면 모든 브랜드가 게임명 검색에서 선택할 수 있습니다."
                  : game?.organizationName
                    ? "직접 등록한 브랜드에서만 검색할 수 있습니다."
                    : "공식 게임으로 승인하기 전까지 브랜드 검색에 노출되지 않습니다."}
              </small>
            </div>
          </div>
        </section>
        <section className={s.section}>
          <h3>언어별 공식 게임명</h3>
          <p>
            공식 명칭을 확인한 언어만 입력하세요. 입력하지 않은 언어는 대표
            게임명으로 표시됩니다.
          </p>
          <div className={s.languages}>
            {gameLanguages.map(([locale, label]) => {
              const row = profile.localizations.find(
                (v) => v.locale === locale,
              )!;
              return (
                <div className={s.language} key={locale}>
                  <h4>
                    {label}
                    <span>{locale}</span>
                  </h4>
                  <div className={s.field}>
                    <label htmlFor={`game-${locale}-title`}>
                      {label} 공식명
                    </label>
                    <TextField
                      id={`game-${locale}-title`}
                      value={row.title}
                      onChange={(e) =>
                        localized(locale, "title", e.target.value)
                      }
                      maxLength={120}
                      width="100%"
                      placeholder={
                        locale === "KO"
                          ? "이환"
                          : locale === "EN"
                            ? "NTE (Neverness to Everness)"
                            : "异环"
                      }
                    />
                  </div>
                  <div className={s.field}>
                    <label htmlFor={`game-${locale}-url`}>
                      {label} 공식 사이트 (선택)
                    </label>
                    <TextField
                      id={`game-${locale}-url`}
                      value={row.officialUrl}
                      onChange={(e) =>
                        localized(locale, "officialUrl", e.target.value)
                      }
                      maxLength={2048}
                      width="100%"
                      placeholder="https://"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className={s.section}>
          <h3>썸네일</h3>
          <div className={s.imageRow}>
            <Thumbnail url={profile.thumbnailUrl.trim()} large />
            <div className={s.field}>
              <label htmlFor="game-thumbnail">썸네일 이미지 주소</label>
              <TextField
                id="game-thumbnail"
                value={profile.thumbnailUrl}
                onChange={(e) => update("thumbnailUrl", e.target.value)}
                maxLength={2048}
                width="100%"
                placeholder="https://example.com/game-icon.png"
              />
              <small>
                공개된 HTTPS 이미지 주소를 입력하세요. 정사각형 게임 아이콘을
                권장합니다.
              </small>
              <small>
                수정한 이미지는 이 게임이 연결된 캠페인에도 반영됩니다.
              </small>
            </div>
          </div>
        </section>
        <section className={s.section}>
          <div className={s.field}>
            <label htmlFor="game-aliases">검색용 별칭 (선택)</label>
            <TextArea
              id="game-aliases"
              value={aliases}
              onChange={(e) => {
                setAliases(e.target.value);
                setDirty(true);
              }}
              width="100%"
              rows={3}
              placeholder={"NTE\n이 환"}
            />
            <small>
              줄마다 하나씩, 최대 40개까지 입력하세요. 대표명과 언어별 공식명은
              자동으로 검색에 포함됩니다.
            </small>
          </div>
        </section>
        {game && (
          <div className={s.field}>
            <label htmlFor="game-reason">변경 사유</label>
            <TextField
              id="game-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setDirty(true);
              }}
              maxLength={500}
              width="100%"
              placeholder="예: 공식 영문명 및 게임 아이콘 갱신"
            />
          </div>
        )}
      </fieldset>
      {error && (
        <div role="alert" className="admin-alert error">
          {error}
          {game && (
            <AdminButton
              type="button"
              disabled={busy}
              onClick={() => {
                if (navigate()) onReload();
              }}
            >
              최신 내용 불러오기
            </AdminButton>
          )}
        </div>
      )}
      <div className={s.footer}>
        <p>등록·수정 내역은 변경 이력에 기록됩니다.</p>
        <AdminButton className="primary" disabled={busy}>
          {busy ? "저장 중…" : game ? "변경사항 저장" : "게임 등록"}
        </AdminButton>
      </div>
    </form>
  );
}

export function AdminGameCatalog({
  initialGameId,
  refreshToken,
  onSelectGame,
}: {
  initialGameId: string;
  refreshToken: number;
  onSelectGame: (id: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState("");
  const [status, setStatus] = useState("all"),
    [page, setPage] = useState(1),
    [reload, setReload] = useState(0);
  const [list, setList] = useState<GameList | null>(null),
    [game, setGame] = useState<AdminGame | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    if (initialGameId === "new") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      const params = initialGameId
        ? new URLSearchParams({ id: initialGameId })
        : new URLSearchParams({ q: search, status, page: String(page) });
      void api<GameList | { game: AdminGame }>(`?${params}`, {
        signal: controller.signal,
      })
        .then((value) => {
          if (controller.signal.aborted) return;
          if ("game" in value) setGame(value.game);
          else setList(value);
        })
        .catch((caught) => {
          if (!controller.signal.aborted)
            setError(
              caught instanceof Error ? caught.message : "불러오지 못했습니다.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [initialGameId, search, status, page, refreshToken, reload]);
  if (initialGameId === "new" || (initialGameId && game && !loading && !error))
    return (
      <GameEditor
        key={game?.updatedAt ?? "new"}
        game={initialGameId === "new" ? null : game}
        onCancel={() => onSelectGame("")}
        onSaved={(saved) => {
          setGame(saved);
          onSelectGame(saved.id);
        }}
        onReload={() => setReload((v) => v + 1)}
      />
    );
  return (
    <section className={s.panel} aria-busy={loading}>
      <div className={s.heading}>
        <div>
          <h2>{initialGameId ? "게임 정보" : "등록된 게임"}</h2>
          <p>
            {initialGameId
              ? "공식 명칭과 썸네일을 불러옵니다."
              : "공식 게임과 브랜드가 직접 등록한 게임을 함께 확인하세요."}
          </p>
        </div>
        <AdminButton
          type="button"
          className="primary"
          onClick={() => onSelectGame(initialGameId ? "" : "new")}
        >
          {initialGameId ? "목록으로" : "새 게임 등록"}
        </AdminButton>
      </div>
      {!initialGameId && (
        <form
          className={s.filters}
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query.trim());
            setPage(1);
            setReload((v) => v + 1);
          }}
        >
          <div className={s.field}>
            <label htmlFor="game-search">게임 검색</label>
            <TextField
              id="game-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={120}
              width="100%"
              placeholder="대표명, 언어별 공식명, 별칭 검색"
            />
          </div>
          <div className={s.field}>
            <label htmlFor="game-status">공개 상태</label>
            <FormSelect
              id="game-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">전체</option>
              <option value="verified">공식 게임</option>
              <option value="pending">검토 중</option>
            </FormSelect>
          </div>
          <AdminButton>검색</AdminButton>
        </form>
      )}
      {loading ? (
        <p role="status" className={s.empty}>
          게임 정보를 불러오는 중입니다…
        </p>
      ) : error ? (
        <div className="admin-alert error" role="alert">
          {error}
          <AdminButton type="button" onClick={() => setReload((v) => v + 1)}>
            다시 시도
          </AdminButton>
        </div>
      ) : (
        list && (
          <>
            <p className={s.meta}>총 {list.total}개 게임</p>
            {list.games.length ? (
              <div className={s.table}>
                <table>
                  <thead>
                    <tr>
                      <th>게임</th>
                      <th>언어별 공식명</th>
                      <th>공개 상태</th>
                      <th>등록 출처 · 연결 캠페인</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.games.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className={s.identity}>
                            <Thumbnail url={item.thumbnailUrl} />
                            <div>
                              <strong>{item.title}</strong>
                              <small>{date(item.updatedAt)}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {item.localizations.map((row) => (
                            <div className={s.translation} key={row.locale}>
                              <span>{row.locale}</span>
                              {row.title || <small>미등록</small>}
                            </div>
                          ))}
                        </td>
                        <td>
                          <span
                            className={`${s.badge} ${item.verified ? s.verified : ""}`}
                          >
                            {item.verified ? "공식 게임" : "검토 중"}
                          </span>
                        </td>
                        <td>
                          {item.organizationName ?? "운영자 등록"}
                          <small>캠페인 {item.campaignCount}개</small>
                        </td>
                        <td>
                          <AdminButton
                            type="button"
                            aria-label={`${item.title} 수정`}
                            onClick={() => onSelectGame(item.id)}
                          >
                            수정
                          </AdminButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={s.empty}>
                검색 조건에 맞는 게임이 없습니다.
                <p>새 게임을 등록하거나 검색 조건을 변경해 주세요.</p>
              </div>
            )}
            <div className={s.pagination}>
              <AdminButton
                type="button"
                disabled={list.page <= 1}
                onClick={() => setPage(list.page - 1)}
              >
                이전
              </AdminButton>
              <span>
                {list.page} /{" "}
                {Math.max(1, Math.ceil(list.total / list.pageSize))}
              </span>
              <AdminButton
                type="button"
                disabled={list.page * list.pageSize >= list.total}
                onClick={() => setPage(list.page + 1)}
              >
                다음
              </AdminButton>
            </div>
          </>
        )
      )}
    </section>
  );
}
