"use client";

import type { ReactNode } from "react";
import type { ProductionItemBase } from "@futures-medialab/database/production-types";
import { Button, Option, Select, Typography } from "@montage-ui/core";
import { splitDeliverable } from "../../../lib/campaign-copy";
import { ProposalChannelAvatar } from "../../advertiser/_components/proposal-channel-avatar";
import type { Locale } from "../landing-copy";
import { productionText } from "./production-shared";
import styles from "./production-workspace.module.css";

type SelectableItem = Pick<
  ProductionItemBase,
  "id" | "creatorName" | "channelUrl" | "platform" | "deliverables"
>;

export function CampaignContentHeading({
  item,
  title,
  status,
}: {
  item: SelectableItem;
  title: string;
  status: ReactNode;
}) {
  return (
    <header className={styles.contentHeader}>
      <ProposalChannelAvatar name={item.creatorName} channelUrl={item.channelUrl} alt="" />
      <div className={styles.contentHeadingText}>
        <Typography as="h3" variant="heading2" weight="bold">
          {title || item.creatorName}
        </Typography>
        <Typography variant="label2" color="semantic.foreground.neutral.secondary">
          {title && `${item.creatorName} · `}{item.platform}
        </Typography>
      </div>
      {status}
    </header>
  );
}

export function CampaignItemPicker<T extends SelectableItem>({
  items,
  selectedId,
  onSelect,
  label,
  renderStatus,
  extraLabel,
}: {
  items: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  label: string;
  renderStatus: (item: T) => ReactNode;
  extraLabel?: (item: T) => string | undefined;
}) {
  if (items.length < 2) return null;
  return (
    <div className={styles.tasks} role="group" aria-label={label}>
      {items.map((item) => {
        const selected = item.id === selectedId;
        const extra = extraLabel?.(item);
        return (
          <Button
            key={item.id}
            variant="outlined"
            color="assistive"
            className={`${styles.task} ${selected ? styles.taskActive : ""}`}
            sx={{
              width: "100%",
              minWidth: 0,
              height: "auto",
              padding: "var(--spacing-20)",
              justifyContent: "flex-start",
              whiteSpace: "normal",
              "& > span": { minWidth: 0, width: "100%", whiteSpace: "normal" },
            }}
            aria-pressed={selected}
            onClick={() => onSelect(item.id)}
          >
            <span className={styles.taskContent}>
              {renderStatus(item)}
              <span className={styles.creatorIdentity}>
                <ProposalChannelAvatar
                  name={item.creatorName}
                  channelUrl={item.channelUrl}
                  alt=""
                />
                <Typography as="strong" variant="label1" weight="bold">
                  {item.creatorName}
                </Typography>
              </span>
              <Typography
                variant="caption1"
                color="semantic.foreground.neutral.secondary"
              >
                {item.platform} · {splitDeliverable(item.deliverables).title}
              </Typography>
              {extra && (
                <Typography
                  variant="caption1"
                  color="semantic.foreground.neutral.secondary"
                >
                  {extra}
                </Typography>
              )}
            </span>
          </Button>
        );
      })}
    </div>
  );
}

export function CampaignVersionPicker({
  versions,
  selectedId,
  onSelect,
  label,
  comparing,
  onToggleCompare,
  locale,
  latestLabel,
  earlierLabel,
}: {
  versions: { id: string; version: number; isLatest: boolean }[];
  selectedId: string;
  onSelect: (id: string) => void;
  label: string;
  comparing: boolean;
  onToggleCompare: () => void;
  locale: Locale;
  latestLabel?: string;
  earlierLabel?: string;
}) {
  if (versions.length < 2) return null;
  const t = productionText(locale);
  const latest =
    latestLabel ?? t("최신 공유본", "Latest shared version", "最新共享版本");
  const earlier =
    earlierLabel ?? t("이전 공유본", "Previous shared version", "历史共享版本");
  return (
    <div className={styles.versionControls}>
      <Select
        aria-label={label}
        value={selectedId}
        onChange={onSelect}
        width="100%"
        size="medium"
      >
        {versions.map((version) => (
          <Option key={version.id} value={version.id}>
            v{version.version} · {version.isLatest ? latest : earlier}
          </Option>
        ))}
      </Select>
      <Button
        variant="outlined"
        color="assistive"
        size="small"
        aria-expanded={comparing}
        onClick={onToggleCompare}
      >
        {comparing
          ? t("비교 닫기", "Close comparison", "关闭比较")
          : t("버전 비교", "Compare versions", "版本比较")}
      </Button>
    </div>
  );
}
