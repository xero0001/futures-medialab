"use client";

import { useRef, useState } from "react";
import {
  Button,
  ContentBadge,
  RadioGroup,
  RadioGroupItem,
  SectionMessage,
  Typography,
} from "@montage-ui/core";
import type { Locale } from "../../_components/landing-copy";
import type {
  BrandCampaign,
  BrandCampaignCreated,
  BrandCampaignDetail,
  BrandCampaignDraftSaved,
  BrandCampaignRoute,
} from "../../../lib/brand-workspace-types";
import {
  canRestoreRequestDraft,
  listRequestDrafts,
  requestDraftChoices,
  startNewRequestDraft,
  writeRequestDraft,
} from "../../../lib/brand-request-draft";
import { LiveRequestWizard } from "./live-request-wizard";
import styles from "./brand-request-entry.module.css";

type Props = {
  locale: Locale;
  draftScope: string;
  campaigns: BrandCampaign[];
  initialCampaign?: BrandCampaign;
  initialRoute?: BrandCampaignRoute;
  onClose: () => void;
  onSaved: (result: BrandCampaignCreated | BrandCampaignDraftSaved) => void;
};

export function BrandRequestEntry({
  locale,
  draftScope,
  campaigns,
  initialCampaign,
  initialRoute = "managed",
  onClose,
  onSaved,
}: Props) {
  const t = (ko: string, en: string, zh: string) => ({ ko, en, zh })[locale];
  const [choices, setChoices] = useState(() =>
    requestDraftChoices(
      campaigns,
      (["managed", "open"] as const).flatMap((storageRoute) =>
        listRequestDrafts(draftScope, storageRoute).map((snapshot) => ({
          storageRoute,
          snapshot,
        })),
      ),
    ),
  );
  const [selected, setSelected] = useState(choices[0]?.id ?? "");
  const [entry, setEntry] = useState<{
    campaign?: BrandCampaign;
    route: BrandCampaignRoute;
  } | null>(() =>
    initialCampaign
      ? {
          campaign: initialCampaign,
          route:
            choices.find((choice) => choice.id === initialCampaign.id)
              ?.storageRoute ??
            (initialCampaign.type === "OPEN_BIDDING" ? "open" : "managed"),
        }
      : choices.length === 0
        ? { route: initialRoute }
        : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  function updateUrl(route: BrandCampaignRoute, id?: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("route", route);
    if (id) url.searchParams.set("draft", id);
    else url.searchParams.delete("draft");
    window.history.replaceState(null, "", url);
  }

  function newCampaign() {
    if (inFlight.current) return;
    if (!startNewRequestDraft(draftScope, initialRoute)) {
      setError(
        t(
          "작성 내용을 보관하지 못했습니다. 기존 초안을 저장한 후 다시 시도해 주세요.",
          "Could not keep your current work. Save the draft and try again.",
          "无法保留当前内容，请保存草稿后重试。",
        ),
      );
      return;
    }
    updateUrl(initialRoute);
    setEntry({ route: initialRoute });
  }

  async function resume() {
    const choice = choices.find((item) => item.id === selected);
    if (!choice || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      let campaign = choice.campaign;
      if (campaign) {
        const response = await fetch(
          `/api/brand/campaigns/${encodeURIComponent(campaign.id)}`,
          { cache: "no-store" },
        );
        const body = (await response
          .json()
          .catch(() => null)) as BrandCampaignDetail | null;
        if (
          response.status === 404 ||
          (response.ok && body?.campaign.status !== "DRAFT")
        ) {
          const remaining = choices.filter((item) => item.id !== choice.id);
          setChoices(remaining);
          setSelected(remaining[0]?.id ?? "");
          throw new Error(
            t(
              "이미 제출되었거나 사용할 수 없는 초안입니다. 다른 초안을 선택하거나 새로 작성해 주세요.",
              "This draft was submitted or is no longer available. Choose another draft or start a new campaign.",
              "此草稿已提交或不可用，请选择其他草稿或新建活动。",
            ),
          );
        }
        if (!response.ok || !body?.campaign)
          throw new Error(
            t(
              "초안을 불러오지 못했습니다. 다시 시도해 주세요.",
              "Could not load the draft. Please try again.",
              "无法加载草稿，请重试。",
            ),
          );
        campaign = body.campaign;
      }
      const snapshot = canRestoreRequestDraft(choice.snapshot ?? null, campaign)
        ? choice.snapshot
        : undefined;
      if (
        snapshot &&
        !writeRequestDraft(draftScope, choice.storageRoute, snapshot)
      )
        throw new Error(
          t(
            "작성 내용을 복원하지 못했습니다. 다시 시도해 주세요.",
            "Could not restore your work. Please try again.",
            "无法恢复内容，请重试。",
          ),
        );
      updateUrl(choice.storageRoute, campaign?.id);
      setEntry({ campaign, route: choice.storageRoute });
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message !== "Failed to fetch"
          ? cause.message
          : t(
              "연결을 확인한 뒤 다시 시도해 주세요.",
              "Check your connection and try again.",
              "请检查网络连接后重试。",
            ),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (entry)
    return (
      <LiveRequestWizard
        locale={locale}
        draftScope={draftScope}
        initialCampaign={entry.campaign}
        initialRoute={entry.route}
        onClose={onClose}
        onSaved={onSaved}
      />
    );

  return (
    <section className={styles.root} aria-labelledby="draft-choice-heading">
      <header className={styles.header}>
        <div>
          <Typography
            as="h1"
            id="draft-choice-heading"
            variant="title2"
            weight="bold"
          >
            {t(
              "작성 중인 캠페인이 있습니다",
              "You have campaign drafts",
              "您有未完成的活动草稿",
            )}
          </Typography>
          <Typography
            as="p"
            variant="body2"
            color="semantic.foreground.neutral.tertiary"
          >
            {t(
              "저장한 내용을 이어서 작성하거나 새 캠페인을 시작할 수 있습니다.",
              "Continue a saved draft or start a new campaign.",
              "您可以继续填写已保存的草稿，或新建活动。",
            )}
          </Typography>
        </div>
        <Button
          variant="outlined"
          color="assistive"
          size="small"
          disabled={busy}
          onClick={onClose}
        >
          {t("나가기", "Close", "关闭")}
        </Button>
      </header>
      <div className={styles.panel}>
        <Typography
          as="h2"
          id="draft-choice-label"
          variant="heading1"
          weight="bold"
        >
          {t(
            "이어서 작성할 캠페인",
            "Choose a draft to continue",
            "选择要继续填写的活动",
          )}
        </Typography>
        {choices.length > 0 && (
          <RadioGroup
            value={selected}
            onValueChange={(value) => {
              setSelected(value);
              setError("");
            }}
            aria-labelledby="draft-choice-label"
            className={styles.list}
            disabled={busy}
          >
            {choices.map((choice, index) => (
              <label
                key={choice.id}
                className={`${styles.choice} ${selected === choice.id ? styles.selected : ""}`}
              >
                <RadioGroupItem
                  value={choice.id}
                  aria-labelledby={`draft-choice-${index}`}
                  disabled={busy}
                />
                <div className={styles.identity}>
                  <Typography
                    as="span"
                    id={`draft-choice-${index}`}
                    variant="body1"
                    weight="bold"
                    className={styles.title}
                  >
                    {choice.title.trim() ||
                      t("제목 없는 캠페인", "Untitled campaign", "未命名活动")}
                  </Typography>
                  <div className={styles.meta}>
                    <ContentBadge size="small">
                      {choice.route === "managed"
                        ? t("매니지드", "Managed", "托管")
                        : t("모집형", "Open", "公开招募")}
                    </ContentBadge>
                    <Typography
                      as="span"
                      variant="caption1"
                      color="semantic.foreground.neutral.tertiary"
                    >
                      {t("최근 작성", "Last edited", "最近编辑")} ·{" "}
                      {new Intl.DateTimeFormat(
                        locale === "zh" ? "zh-CN" : locale,
                        {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Asia/Seoul",
                        },
                      ).format(choice.savedAt)}
                    </Typography>
                  </div>
                </div>
              </label>
            ))}
          </RadioGroup>
        )}
        {error && (
          <SectionMessage variant="negative" role="alert">
            {error}
          </SectionMessage>
        )}
        <Typography
          as="p"
          variant="label1"
          color="semantic.foreground.neutral.tertiary"
        >
          {t(
            "새로 작성해도 기존 초안은 유지됩니다.",
            "Your existing drafts are kept when you start a new campaign.",
            "新建活动不会删除现有草稿。",
          )}
        </Typography>
        <div className={styles.actions}>
          <Button
            variant="outlined"
            color="assistive"
            size="large"
            disabled={busy}
            onClick={newCampaign}
          >
            {t("새 캠페인 작성", "Start a new campaign", "新建活动")}
          </Button>
          <Button
            variant="solid"
            color="primary"
            size="large"
            disabled={busy || !selected}
            loading={busy}
            onClick={() => void resume()}
          >
            {t("이어서 작성", "Continue draft", "继续填写")}
          </Button>
        </div>
      </div>
    </section>
  );
}
