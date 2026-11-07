"use client";

import { useState, type FormEvent } from "react";
import {
  ContentBadge,
  SectionMessage,
  Tab,
  TabList,
  TabListItem,
  TabPanel,
  TextField,
  Typography,
} from "@montage-ui/core";
import { ActionButton } from "@futures-medialab/ui/action-button";
import type { Locale } from "../../_components/landing-copy";
import type { WorkspaceAccount } from "../../../lib/workspace-types";
import styles from "./account-view.module.css";

export function AccountView({
  locale,
  account,
  onMutate,
  busy,
}: {
  locale: Locale;
  account: WorkspaceAccount;
  onMutate: (endpoint: string, body: unknown) => Promise<boolean>;
  busy: boolean;
}) {
  const t = (en: string, ko: string, zh: string) => ({ en, ko, zh })[locale];
  const [tab, setTab] = useState("personal");
  const [name, setName] = useState(account.name);
  const [contactName, setContactName] = useState(account.contactName);
  const [websiteUrl, setWebsiteUrl] = useState(account.websiteUrl ?? "");
  const canEdit = account.role === "OWNER";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onMutate("/api/workspace/account", {
      name: name.trim(),
      contactName: contactName.trim(),
      websiteUrl: websiteUrl.trim(),
    });
  }

  const saveAction = (
    <div className={styles.actions}>
      <ActionButton
        type="submit"
        intent="primary"
        loading={busy}
        disabled={busy || !canEdit}
      >
        {t("Save changes", "변경 사항 저장", "保存修改")}
      </ActionButton>
      {!canEdit && (
        <Typography
          variant="body2"
          color="semantic.foreground.neutral.secondary"
        >
          {t(
            "Only the organization owner can edit company and contact information.",
            "조직 소유자만 회사와 담당자 정보를 수정할 수 있습니다.",
            "仅组织所有者可修改公司及联系人信息。",
          )}
        </Typography>
      )}
    </div>
  );

  return (
    <Tab value={tab} onValueChange={setTab} disableScrollMoveOnChange>
      <TabList
        size="medium"
        horizontalPadding={false}
        aria-label={t("Account sections", "계정 관리 메뉴", "账户栏目")}
      >
        {[
          {
            value: "personal",
            label: t("Personal information", "담당자 정보", "个人信息"),
          },
          {
            value: "company",
            label: t("Company information", "회사 정보", "公司信息"),
          },
          { value: "security", label: t("Security", "보안", "安全设置") },
        ].map((item) => (
          <TabListItem
            key={item.value}
            value={item.value}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setTab(item.value);
              }
            }}
          >
            {item.label}
          </TabListItem>
        ))}
      </TabList>
      <TabPanel value="personal" tabIndex={0}>
        <form className={styles.panel} onSubmit={save}>
          <Typography as="h2" variant="heading2" weight="bold">
            {t("Your point of contact", "담당자 정보", "联系人信息")}
          </Typography>
          <div className={styles.field}>
            <Typography
              as="label"
              htmlFor="account-contact-name"
              variant="label1"
              weight="medium"
            >
              {t("Contact name", "담당자 이름", "联系人姓名")}
            </Typography>
            <TextField
              id="account-contact-name"
              size="large"
              width="100%"
              required
              disabled={!canEdit}
              maxLength={100}
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <Typography
              as="label"
              htmlFor="account-email"
              variant="label1"
              weight="medium"
            >
              {t("Email address", "이메일 주소", "邮箱地址")}
            </Typography>
            <TextField
              id="account-email"
              size="large"
              width="100%"
              readOnly
              value={account.email}
              type="email"
              aria-describedby="account-email-help"
            />
            <Typography
              id="account-email-help"
              variant="caption1"
              color="semantic.foreground.neutral.secondary"
            >
              {t(
                "This is your sign-in email and cannot be edited here.",
                "로그인 이메일이며 이 화면에서 변경할 수 없습니다.",
                "这是您的登录邮箱，无法在此更改。",
              )}
            </Typography>
          </div>
          {saveAction}
        </form>
      </TabPanel>
      <TabPanel value="company" tabIndex={0}>
        <form className={styles.panel} onSubmit={save}>
          <Typography as="h2" variant="heading2" weight="bold">
            {t("Organization details", "조직 상세 정보", "组织详情")}
          </Typography>
          <div className={styles.field}>
            <Typography
              as="label"
              htmlFor="account-company-name"
              variant="label1"
              weight="medium"
            >
              {t("Company name", "회사 이름", "公司名称")}
            </Typography>
            <TextField
              id="account-company-name"
              size="large"
              width="100%"
              required
              disabled={!canEdit}
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <Typography
              as="label"
              htmlFor="account-website"
              variant="label1"
              weight="medium"
            >
              {t("Company website", "회사 웹사이트", "公司网址")}
            </Typography>
            <TextField
              id="account-website"
              size="large"
              width="100%"
              type="url"
              disabled={!canEdit}
              maxLength={2048}
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://"
            />
          </div>
          <dl className={styles.details}>
            {[
              [t("Industry", "산업", "行业"), account.industry],
              [
                t("Country / region", "국가 / 지역", "国家 / 地区"),
                account.countryCode,
              ],
              [t("Company size", "회사 규모", "公司规模"), account.companySize],
            ].map(([label, value]) => (
              <div key={label}>
                <Typography
                  as="dt"
                  variant="body2"
                  color="semantic.foreground.neutral.secondary"
                >
                  {label}
                </Typography>
                <Typography as="dd" variant="body2">
                  {value || "—"}
                </Typography>
              </div>
            ))}
          </dl>
          {saveAction}
        </form>
      </TabPanel>
      <TabPanel value="security" tabIndex={0}>
        <div className={styles.panel}>
          <Typography as="h2" variant="heading2" weight="bold">
            {t("Account security", "계정 보안", "账户安全")}
          </Typography>
          <dl className={styles.details}>
            <div>
              <Typography
                as="dt"
                variant="body2"
                color="semantic.foreground.neutral.secondary"
              >
                {t("Login email", "로그인 이메일", "登录邮箱")}
              </Typography>
              <Typography as="dd" variant="body2">
                {account.email}
              </Typography>
            </div>
            <div>
              <Typography
                as="dt"
                variant="body2"
                color="semantic.foreground.neutral.secondary"
              >
                {t("Organization status", "조직 상태", "组织状态")}
              </Typography>
              <dd>
                <ContentBadge
                  color={account.status === "ACTIVE" ? "accent" : "neutral"}
                  accentColor="atomic.green.30"
                >
                  {account.status === "ACTIVE"
                    ? t("Approved", "승인됨", "已批准")
                    : t("Awaiting approval", "승인 대기", "等待审批")}
                </ContentBadge>
              </dd>
            </div>
          </dl>
          <SectionMessage
            variant="info"
            description={t(
              "Email verification and email-based password recovery are not available until a mail provider is connected. Email addresses and approval status cannot be changed here.",
              "메일 발송 서비스 연결 전까지 이메일 인증과 이메일 기반 비밀번호 복구는 제공되지 않습니다. 여기서는 이메일 주소나 승인 상태를 변경할 수 없습니다.",
              "接入邮件服务前暂不提供邮箱验证和邮件找回密码。此页面无法更改邮箱地址或审批状态。",
            )}
          />
        </div>
      </TabPanel>
    </Tab>
  );
}
