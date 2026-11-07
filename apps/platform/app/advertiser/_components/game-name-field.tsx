"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  Autocomplete,
  AutocompleteField,
  AutocompleteList,
  AutocompleteOption,
  AutocompleteOptionContent,
  TextField,
  Typography,
} from "@montage-ui/core";
import type { Locale } from "../../_components/landing-copy";
import type { GameCatalogOption } from "../../../lib/game-catalog-types";
import styles from "./game-name-field.module.css";

export function GameNameField({
  value,
  gameId,
  locale,
  disabled,
  status,
  onChange,
}: {
  value: string;
  gameId: string | null;
  locale: Locale;
  disabled: boolean;
  status: "negative" | "normal";
  onChange: (name: string, id: string | null) => void;
}) {
  const t = (ko: string, en: string, zh: string) => ({ ko, en, zh })[locale];
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{
    query: string;
    locale: Locale;
    items: GameCatalogOption[];
    error: boolean;
  } | null>(null);
  const query = value.trim();
  const current =
    result?.query === query && result.locale === locale ? result : null;
  const games = current?.items ?? [];

  useEffect(() => {
    if (!open || disabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, lang: locale });
        const response = await fetch(`/api/brand/games?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("search");
        const data = (await response.json()) as { games: GameCatalogOption[] };
        if (!controller.signal.aborted)
          setResult({ query, locale, items: data.games, error: false });
      } catch {
        if (!controller.signal.aborted)
          setResult({ query, locale, items: [], error: true });
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, locale, open, disabled]);

  return (
    <div className={styles.root}>
      <Autocomplete
        value={value}
        inputValue={value}
        open={open && !disabled}
        onOpenChange={setOpen}
        onValueChange={(name) => onChange(name, null)}
        onSearch={(name) => {
          const game = games.find((item) => item.title === name);
          onChange(name, game?.id ?? null);
          setOpen(false);
        }}
        sx={{ width: "100%" }}
      >
        <AutocompleteField onFocus={() => setOpen(true)}>
          <TextField
            id="brand-game-name"
            maxLength={120}
            width="100%"
            status={status}
            disabled={disabled}
            placeholder={t(
              "게임명을 입력하거나 검색해 주세요",
              "Enter or search for a game",
              "输入或搜索游戏名称",
            )}
            autoComplete="off"
          />
        </AutocompleteField>
        <AutocompleteList disableTrappedContent>
          {!current && (
            <Typography
              className={styles.message}
              variant="label1"
              role="status"
            >
              {t(
                "게임을 검색하고 있습니다…",
                "Searching games…",
                "正在搜索游戏…",
              )}
            </Typography>
          )}
          {games.map((game) => (
            <AutocompleteOption
              key={game.id}
              value={game.title}
              leadingContent={
                <AutocompleteOptionContent>
                  <Image
                    src={game.thumbnailUrl}
                    alt=""
                    width={36}
                    height={36}
                    className={styles.thumbnail}
                    unoptimized
                  />
                </AutocompleteOptionContent>
              }
              textProps={{
                description: game.verified
                  ? t("공식 명칭", "Official title", "官方名称")
                  : t("직접 등록한 게임", "Custom game", "自行登记的游戏"),
              }}
            >
              {game.title}
            </AutocompleteOption>
          ))}
          {current?.error && (
            <Typography
              className={styles.message}
              variant="label1"
              role="status"
            >
              {t(
                "검색을 불러오지 못했습니다. 게임명을 직접 입력할 수 있습니다.",
                "Search is unavailable. You can still enter the game name.",
                "搜索暂不可用，您仍可直接输入游戏名称。",
              )}
            </Typography>
          )}
          {current &&
            !current.error &&
            query &&
            !games.some(
              (game) =>
                game.exactMatch ||
                game.title.toLocaleLowerCase() === query.toLocaleLowerCase(),
            ) && (
              <AutocompleteOption
                value={query}
                textProps={{
                  description: t(
                    "새 게임으로 사용",
                    "Use as a new game",
                    "作为新游戏使用",
                  ),
                }}
              >
                {query}
              </AutocompleteOption>
            )}
          {current && !current.error && !games.length && !query && (
            <Typography className={styles.message} variant="label1">
              {t(
                "게임명을 입력해 주세요.",
                "Enter a game name.",
                "请输入游戏名称。",
              )}
            </Typography>
          )}
        </AutocompleteList>
      </Autocomplete>
      {gameId && (
        <Typography
          variant="caption1"
          color="semantic.foreground.neutral.tertiary"
        >
          {t(
            "등록된 게임을 선택했습니다.",
            "Registered game selected.",
            "已选择登记的游戏。",
          )}
        </Typography>
      )}
    </div>
  );
}
