"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "../../../_components/landing-copy";
import { authClient } from "../../../../lib/auth-client";
import {
  defaultFilters,
  validateFilters,
  type Creator,
  type DirectoryFilters,
  type PlatformId,
} from "../../../../lib/creator-directory";
import type {
  WorkspaceBootstrap,
  WorkspaceSearchResult,
} from "../../../../lib/workspace-types";
import { translate } from "../../_components/directory-filters";

type Operation = {
  controller: AbortController;
  kind: "load" | "search" | "save" | "signout";
};

async function fetchBootstrap(
  signal: AbortSignal,
): Promise<WorkspaceBootstrap> {
  const response = await fetch("/api/workspace/bootstrap", {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("load");
  return response.json();
}

export function useMontageSearch(locale: Locale) {
  const t = useCallback(
    (en: string, ko: string, zh: string) => translate(locale, en, ko, zh),
    [locale],
  );
  const [data, setData] = useState<WorkspaceBootstrap | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(true);
  const [filters, setFilters] = useState(() => defaultFilters("youtube"));
  const [applied, setApplied] = useState<DirectoryFilters | null>(null);
  const [results, setResults] = useState<Creator[]>([]);
  const [sort, updateSort] = useState("relevance");
  const [page, setPage] = useState(1);
  const [collectionId, setCollectionId] = useState("");
  const mounted = useRef(false);
  const operation = useRef<Operation | null>(null);
  const mustReload = useRef(false);

  const begin = useCallback((kind: Operation["kind"]) => {
    if (
      operation.current?.kind === "save" ||
      operation.current?.kind === "signout"
    )
      return null;
    operation.current?.controller.abort();
    const next: Operation = { kind, controller: new AbortController() };
    operation.current = next;
    setBusy(true);
    setError("");
    setNotice("");
    return next;
  }, []);

  const isCurrent = useCallback(
    (current: Operation) =>
      mounted.current &&
      operation.current === current &&
      !current.controller.signal.aborted,
    [],
  );

  const finish = useCallback(
    (current: Operation) => {
      if (!isCurrent(current)) return;
      operation.current = null;
      setBusy(false);
    },
    [isCurrent],
  );

  const reload = useCallback(async () => {
    const current = begin("load");
    if (!current) return;
    try {
      const nextData = await fetchBootstrap(current.controller.signal);
      if (!isCurrent(current)) return;
      setData(nextData);
      mustReload.current = false;
    } catch {
      if (isCurrent(current))
        setError(
          t(
            "Could not load the workspace. Please refresh or sign in again.",
            "작업 공간을 불러오지 못했습니다. 새로고침하거나 다시 로그인해 주세요.",
            "无法加载工作区，请刷新或重新登录。",
          ),
        );
    } finally {
      finish(current);
    }
  }, [begin, finish, isCurrent, t]);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
      operation.current?.controller.abort();
      operation.current = null;
    };
  }, [reload]);

  async function search(next = filters) {
    if (!validateFilters(next)) {
      setError(
        t(
          "Use non-negative ranges; minimum must not exceed maximum.",
          "범위는 0 이상으로, 최솟값이 최댓값보다 작거나 같게 입력해 주세요.",
          "范围必须为非负数，且最小值不能大于最大值。",
        ),
      );
      return;
    }
    const current = begin("search");
    if (!current) return;
    // Snapshot the submitted values so later input changes cannot relabel results.
    const submitted = {
      ...next,
      includeTags: [...next.includeTags],
      excludeTags: [...next.excludeTags],
    };
    try {
      const response = await fetch("/api/workspace/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: current.controller.signal,
        body: JSON.stringify({
          mode: "search",
          filters: submitted,
          publishingPlatform: "all",
        }),
      });
      if (!response.ok)
        throw new Error(response.status === 429 ? "rate" : "search");
      const found: WorkspaceSearchResult = await response.json();
      if (!isCurrent(current)) return;
      setResults(found.creators);
      setApplied(submitted);
      setPage(1);
      try {
        const nextData = await fetchBootstrap(current.controller.signal);
        if (isCurrent(current)) {
          setData(nextData);
          mustReload.current = false;
        }
      } catch {
        if (isCurrent(current))
          setNotice(
            t(
              "Search completed. Recent search history could not be refreshed.",
              "검색을 완료했습니다. 최근 검색 이력을 새로 불러오지 못했습니다.",
              "搜索已完成，但无法刷新最近搜索记录。",
            ),
          );
      }
    } catch (failure) {
      if (isCurrent(current))
        setError(
          failure instanceof Error && failure.message === "rate"
            ? t(
                "Please wait a minute before searching again.",
                "잠시 후 다시 검색해 주세요.",
                "请稍后再次搜索。",
              )
            : t(
                "Search failed. Try again.",
                "검색에 실패했습니다. 다시 시도해 주세요.",
                "搜索失败，请重试。",
              ),
        );
    } finally {
      finish(current);
    }
  }

  function reset(platform: PlatformId = filters.platform) {
    if (
      operation.current?.kind === "save" ||
      operation.current?.kind === "signout"
    )
      return;
    if (operation.current?.kind === "search") {
      operation.current.controller.abort();
      operation.current = null;
      setBusy(false);
    }
    setFilters(defaultFilters(platform));
    setApplied(null);
    setResults([]);
    setError("");
    setNotice("");
    setPage(1);
  }

  const activeCollection =
    data?.collections.find((collection) => collection.id === collectionId) ??
    data?.collections[0];

  async function saveCreator(creator: Creator) {
    if (mustReload.current) {
      setError(
        t(
          "Refresh the workspace to confirm the last save before making another change.",
          "이전 저장 결과를 확인할 수 있도록 작업 공간을 새로고침한 뒤 다시 시도해 주세요.",
          "请先刷新工作区确认上次保存结果，再进行修改。",
        ),
      );
      return;
    }
    if (!activeCollection) {
      setError(
        t(
          "Create a collection in Collections first.",
          "먼저 즐겨찾기 메뉴에서 폴더를 만들어 주세요.",
          "请先在收藏夹中创建文件夹。",
        ),
      );
      return;
    }
    const current = begin("save");
    if (!current) return;
    const targetId = activeCollection.id;
    const removing = activeCollection.creatorIds.includes(creator.id);
    try {
      const response = await fetch("/api/workspace/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: current.controller.signal,
        body: JSON.stringify({
          action: removing ? "remove" : "add",
          collectionId: targetId,
          creatorId: creator.id,
        }),
      });
      if (!isCurrent(current)) return;
      if (!response.ok) {
        setError(
          response.status === 429
            ? t(
                "Please try again shortly.",
                "잠시 후 다시 시도해 주세요.",
                "请稍后重试。",
              )
            : response.status === 403
              ? t(
                  "Your account cannot make this change.",
                  "이 작업을 수행할 계정 권한이 없습니다.",
                  "您的账户无权进行此修改。",
                )
              : t(
                  "Could not save. Refresh the workspace and try again.",
                  "저장하지 못했습니다. 작업 공간을 새로고침한 뒤 다시 시도해 주세요.",
                  "保存失败，请刷新工作区后重试。",
                ),
        );
        return;
      }
      // The write succeeded; reflect it even if refreshing the rest of the DTO fails.
      setData((previous) =>
        previous
          ? {
              ...previous,
              collections: previous.collections.map((collection) =>
                collection.id !== targetId
                  ? collection
                  : {
                      ...collection,
                      creatorIds: removing
                        ? collection.creatorIds.filter(
                            (id) => id !== creator.id,
                          )
                        : [...new Set([...collection.creatorIds, creator.id])],
                    },
              ),
            }
          : previous,
      );
      setNotice(
        removing
          ? t(
              "Removed from collection.",
              "즐겨찾기에서 해제했습니다.",
              "已取消收藏。",
            )
          : t(
              "Saved to collection.",
              "즐겨찾기에 저장했습니다.",
              "已添加收藏。",
            ),
      );
      try {
        const nextData = await fetchBootstrap(current.controller.signal);
        if (isCurrent(current)) setData(nextData);
      } catch {
        if (isCurrent(current))
          setNotice(
            t(
              "Your change was saved. The workspace could not be refreshed.",
              "변경 사항을 저장했습니다. 작업 공간을 새로 불러오지 못했습니다.",
              "修改已保存，但无法刷新工作区。",
            ),
          );
      }
    } catch {
      if (isCurrent(current)) {
        mustReload.current = true;
        setError(
          t(
            "Could not confirm the save. Refresh to check its status before retrying.",
            "저장 결과를 확인하지 못했습니다. 새로고침으로 저장 여부를 확인한 뒤 다시 시도해 주세요.",
            "无法确认保存结果，请刷新确认状态后重试。",
          ),
        );
      }
    } finally {
      finish(current);
    }
  }

  async function signOut() {
    const current = begin("signout");
    if (!current) return;
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("logout");
      if (isCurrent(current)) window.location.assign(`/login?lang=${locale}`);
    } catch {
      if (isCurrent(current))
        setError(
          t(
            "Could not sign out. Try again.",
            "로그아웃하지 못했습니다. 다시 시도해 주세요.",
            "退出失败，请重试。",
          ),
        );
      finish(current);
    }
  }

  const baseResults = applied
    ? results
    : (data?.creators.filter(
        (creator) => creator.platform === filters.platform,
      ) ?? []);
  const viewsKey =
    (applied ?? filters).viewsWindow === "last10" ? "views10" : "views30";
  const sorted = [...baseResults].sort((a, b) =>
    sort === "followers"
      ? b.followers - a.followers
      : sort === "views"
        ? b[viewsKey] - a[viewsKey]
        : sort === "engagement"
          ? b.engagement - a.engagement
          : 0,
  );
  const pages = Math.max(1, Math.ceil(sorted.length / 8));

  function setSort(value: string) {
    updateSort(value);
    setPage(1);
  }

  return {
    data,
    error,
    notice,
    busy,
    filters,
    applied,
    setFilters,
    sorted,
    sort,
    setSort,
    page: Math.min(page, pages),
    setPage,
    pages,
    activeCollection,
    setCollectionId,
    search,
    reset,
    saveCreator,
    signOut,
    reload,
  };
}
