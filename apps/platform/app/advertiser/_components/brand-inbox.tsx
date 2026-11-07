"use client";

import { useSearchParams } from "next/navigation";
import {
  Button,
  ContentBadge,
  Tab,
  TabList,
  TabListItem,
  TabPanel,
  Typography,
} from "@montage-ui/core";
import { IconPlus } from "@montage-ui/icon";
import type { Locale } from "../../_components/landing-copy";
import { BrandThemeContext } from "../../storage/_components/brand-controls";
import { RequestWorkspace } from "../../storage/_components/request-workspace";
import { BrandActionCenter } from "./brand-action-center";
import { useBrandActivity } from "./brand-activity-provider";
import styles from "./live-brand-workspace.module.css";
import "../../storage/_components/workspace.css";
import "../../storage/_components/brand-workspace.css";

export function BrandInbox({ locale }: { locale: Locale }) {
  const searchParams = useSearchParams();
  const { actions, changed, now } = useBrandActivity();
  const t = (ko: string, en: string, zh: string) => ({ ko, en, zh })[locale];
  const requestId = searchParams.get("request");
  const composing = searchParams.get("compose") === "1";
  const campaignId = searchParams.get("campaign");
  const tab =
    requestId ||
    composing ||
    campaignId ||
    searchParams.get("view") === "inquiries"
      ? "inquiries"
      : "actions";

  function navigate(value: string, compose = false) {
    const params = new URLSearchParams({ lang: locale });
    if (value === "inquiries") params.set("view", "inquiries");
    if (compose) params.set("compose", "1");
    // Switching inbox views only changes client-side state, not server data.
    window.history.pushState(null, "", `/advertiser/requests?${params}`);
  }

  return (
    <>
      <div className={styles.heading}>
        <div>
          <Typography as="h1" variant="title2" weight="bold">
            {t("요청함", "Request inbox", "请求中心")}
          </Typography>
          <Typography
            as="p"
            variant="body2"
            color="semantic.foreground.neutral.secondary"
          >
            {t(
              "승인·검수·회신이 필요한 일을 확인하고, 캠페인별 문의와 처리 내역을 관리하세요.",
              "Review actions that need your attention and manage campaign inquiries.",
              "查看需要审批、审核或回复的事项，并管理活动咨询及处理记录。",
            )}
          </Typography>
        </div>
        {tab === "actions" && (
          <Button
            size="small"
            leadingContent={<IconPlus aria-hidden />}
            onClick={() => navigate("inquiries", true)}
          >
            {t("새 문의", "New inquiry", "新建咨询")}
          </Button>
        )}
      </div>
      <Tab value={tab} onValueChange={navigate} disableScrollMoveOnChange>
        <TabList
          size="medium"
          horizontalPadding={false}
          aria-label={t("요청함 보기", "Inbox view", "请求中心视图")}
        >
          <TabListItem value="actions">
            {t("처리할 일", "To do", "待处理")}
            {actions.length > 0 && (
              <ContentBadge
                size="xsmall"
                color="accent"
                accentColor="semantic.foreground.brand.primary"
                sx={{ marginLeft: 8 }}
              >
                {actions.length}
              </ContentBadge>
            )}
          </TabListItem>
          <TabListItem value="inquiries">
            {t("문의·처리 내역", "Inquiries & history", "咨询与处理记录")}
          </TabListItem>
        </TabList>
        <TabPanel value="actions" sx={{ paddingTop: 32 }}>
          <BrandActionCenter locale={locale} showEmpty />
        </TabPanel>
        <TabPanel value="inquiries" sx={{ paddingTop: 24 }}>
          <BrandThemeContext value={true}>
            <div className="cw-montage">
              <RequestWorkspace
                key={`${requestId ?? "list"}:${composing}:${campaignId ?? ""}`}
                locale={locale}
                onChanged={changed}
                refreshKey={now}
              />
            </div>
          </BrandThemeContext>
        </TabPanel>
      </Tab>
    </>
  );
}
