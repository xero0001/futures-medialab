"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Avatar,
  Button,
  Divider,
  List,
  ListCell,
  ListCellContent,
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuItemContent,
  MenuList,
  MenuTrigger,
  TopNavigation,
  TopNavigationButton,
  Typography,
} from "@montage-ui/core";
import {
  IconArrowUpRight,
  IconChevronDown,
  IconCircleQuestion,
  IconCompany,
  IconFolderStar,
  IconGlobe,
  IconInbox,
  IconLink,
  IconLogout,
  IconMegaphone,
  IconMenu,
  IconPersons,
  IconSearch,
  IconSetting,
  IconSparkle,
} from "@montage-ui/icon";
import { Wordmark } from "../../../_components/brand-logo";
import type { Locale } from "../../../_components/landing-copy";
import { translate } from "../../_components/directory-filters";
import styles from "./montage-search.module.css";

const languages = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
] as const;

type Props = {
  locale: Locale;
  organizationName: string;
  userName: string;
  busy: boolean;
  onSignOut: () => void;
};

export function MontageShell({
  locale,
  organizationName,
  userName,
  busy,
  onSignOut,
}: Props) {
  const router = useRouter();
  const t = (en: string, ko: string, zh: string) =>
    translate(locale, en, ko, zh);
  const href = (path: string) => `${path}?lang=${locale}`;
  const [navOpen, setNavOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!navOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNavOpen(false);
        menuRef.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [navOpen]);

  const navigation = [
    {
      label: t("Discover", "크리에이터 탐색", "达人探索"),
      items: [
        {
          path: "/storage/search/montage",
          label: t("Creator search", "크리에이터 검색", "达人查询"),
          icon: IconSearch,
        },
        {
          path: "/storage/similar-search",
          label: t("Similar creators", "유사 크리에이터", "相似达人"),
          icon: IconPersons,
        },
        {
          path: "/storage/similar-brands",
          label: t("Related brands", "동종 브랜드", "同类品牌"),
          icon: IconCompany,
        },
        {
          path: "/agent",
          label: t("Intelligence tools", "분석 도구", "智能工具"),
          icon: IconSparkle,
        },
      ],
    },
    {
      label: t("Workspace", "내 작업 공간", "工作区"),
      items: [
        {
          path: "/storage/collect",
          label: t("Collections", "즐겨찾기", "收藏夹"),
          icon: IconFolderStar,
        },
        {
          path: "/advertiser/campaign",
          label: t("Campaigns", "캠페인 관리", "推广系列"),
          icon: IconMegaphone,
        },
        {
          path: "/shortLinks",
          label: t("Short links", "단축 링크", "短链服务"),
          icon: IconLink,
        },
        {
          path: "/advertiser/requests",
          label: t("Request inbox", "요청함", "请求中心"),
          icon: IconInbox,
        },
      ],
    },
  ];

  return (
    <>
      <a className={styles.skipLink} href="#montage-main">
        {t("Skip to content", "본문 바로가기", "跳转到内容")}
      </a>
      <header className={styles.topbar}>
        <TopNavigation
          variant="normal"
          background={false}
          className={styles.topNavigation}
          leadingContent={
            <div className={styles.headerLeading}>
              <div className={styles.brand}>
                <TopNavigationButton
                  ref={menuRef}
                  variant="icon-button"
                  className={styles.mobileMenu}
                  aria-label={t(
                    "Toggle navigation",
                    "메뉴 열기·닫기",
                    "打开导航",
                  )}
                  aria-expanded={navOpen}
                  aria-controls="montage-sidebar"
                  onClick={() => setNavOpen(!navOpen)}
                >
                  <IconMenu aria-hidden />
                </TopNavigationButton>
                <Wordmark href={href("/")} />
              </div>
              <div className={styles.topContext}>
                <Divider vertical size={20} />
                <Typography
                  variant="label1"
                  weight="medium"
                  color="semantic.foreground.neutral.secondary"
                >
                  {t("Brand workspace", "브랜드 워크스페이스", "品牌工作区")}
                </Typography>
              </div>
            </div>
          }
          trailingContent={
            <div className={styles.topActions}>
              <Menu
                open={languageOpen}
                onOpenChange={setLanguageOpen}
                value={locale}
                onValueChange={(value) => {
                  setLanguageOpen(false);
                  if (!languages.some((language) => language.value === value))
                    return;
                  document.cookie = `fm-locale=${value};path=/;max-age=31536000;SameSite=Lax`;
                  router.push(`/storage/search/montage?lang=${value}`);
                }}
              >
                <MenuTrigger>
                  <Button
                    variant="outlined"
                    color="assistive"
                    size="small"
                    aria-label={`${t("Language", "언어", "语言")}: ${languages.find((language) => language.value === locale)?.label}`}
                    leadingContent={<IconGlobe aria-hidden />}
                    trailingContent={<IconChevronDown aria-hidden />}
                  >
                    {
                      languages.find((language) => language.value === locale)
                        ?.label
                    }
                  </Button>
                </MenuTrigger>
                <MenuContent
                  position="bottom-end"
                  aria-label={t("Language", "언어", "语言")}
                  sx={{ minWidth: 160 }}
                >
                  <MenuList>
                    {languages.map((language) => (
                      <MenuItem
                        key={language.value}
                        value={language.value}
                        variant="radio"
                      >
                        {language.label}
                      </MenuItem>
                    ))}
                  </MenuList>
                </MenuContent>
              </Menu>
              <div className={styles.topDivider}>
                <Divider vertical size={24} />
              </div>
              <Menu
                open={accountOpen}
                onOpenChange={setAccountOpen}
                onValueChange={(value) => {
                  setAccountOpen(false);
                  if (value === "signout") onSignOut();
                  else if (typeof value === "string") router.push(href(value));
                }}
              >
                <MenuTrigger>
                  <Button
                    variant="outlined"
                    color="assistive"
                    size="small"
                    className={styles.account}
                    aria-label={t(
                      `Account menu: ${userName}`,
                      `계정 메뉴: ${userName}`,
                      `账户菜单: ${userName}`,
                    )}
                    leadingContent={
                      <Avatar
                        size={28}
                        alt=""
                        sx={(theme) => ({
                          backgroundColor: theme.semantic.surface.brand.subtle,
                          color: theme.semantic.foreground.brand.primary,
                        })}
                      />
                    }
                    trailingContent={<IconChevronDown aria-hidden />}
                  >
                    <span className={styles.accountName}>
                      {organizationName}
                    </span>
                  </Button>
                </MenuTrigger>
                <MenuContent
                  position="bottom-end"
                  aria-label={t("Account menu", "계정 메뉴", "账户菜单")}
                  sx={{ minWidth: 220 }}
                >
                  <MenuList>
                    <MenuGroup title={organizationName}>
                      <MenuItem
                        value="/advertiser/accountManagement"
                        leadingContent={
                          <MenuItemContent variant="icon">
                            <IconSetting aria-hidden />
                          </MenuItemContent>
                        }
                      >
                        {t("Account settings", "계정 관리", "账户管理")}
                      </MenuItem>
                      <MenuItem
                        value="/advertiser/requests"
                        leadingContent={
                          <MenuItemContent variant="icon">
                            <IconCircleQuestion aria-hidden />
                          </MenuItemContent>
                        }
                      >
                        {t("Help", "도움말 및 문의", "帮助与咨询")}
                      </MenuItem>
                    </MenuGroup>
                    <Divider />
                    <MenuItem
                      value="signout"
                      disabled={busy}
                      leadingContent={
                        <MenuItemContent variant="icon">
                          <IconLogout aria-hidden />
                        </MenuItemContent>
                      }
                    >
                      {t("Sign out", "로그아웃", "退出登录")}
                    </MenuItem>
                  </MenuList>
                </MenuContent>
              </Menu>
            </div>
          }
        />
      </header>
      {navOpen && (
        <button
          className={styles.backdrop}
          aria-label={t("Close navigation", "메뉴 닫기", "关闭导航")}
          onClick={() => {
            setNavOpen(false);
            menuRef.current?.focus();
          }}
        />
      )}
      <aside
        id="montage-sidebar"
        className={`${styles.sidebar} ${navOpen ? styles.sidebarOpen : ""}`}
      >
        <nav
          aria-label={t("Workspace navigation", "작업 공간 메뉴", "工作区导航")}
        >
          {navigation.map((group) => (
            <section key={group.label} className={styles.navGroup}>
              <Typography
                as="h2"
                variant="caption1"
                weight="medium"
                color="semantic.foreground.neutral.tertiary"
                className={styles.navGroupLabel}
              >
                {group.label}
              </Typography>
              <List>
                {group.items.map(({ path, label, icon: Icon }) => {
                  const active = path === "/storage/search/montage";
                  return (
                    <li key={path}>
                      <ListCell
                        as={Link}
                        href={href(path)}
                        role="link"
                        aria-current={active ? "page" : undefined}
                        className={styles.navItem}
                        variant="full"
                        selected={active}
                        trailingContent={null}
                        verticalPadding="small"
                        textProps={{
                          variant: "label1",
                          weight: active ? "bold" : "medium",
                        }}
                        leadingContent={
                          <ListCellContent variant="icon">
                            <Icon aria-hidden />
                          </ListCellContent>
                        }
                        sx={(theme) => ({
                          paddingInline: theme.spacing[12],
                          minHeight: 46,
                          borderRadius: theme.radius[8],
                          color: active
                            ? theme.semantic.foreground.neutral.strong
                            : theme.semantic.foreground.neutral.secondary,
                          backgroundColor: active
                            ? theme.semantic.surface.neutral.secondary
                            : "transparent",
                          "[data-role='list-text-wrapper']": {
                            color: "inherit",
                          },
                          "[data-component='list-cell-content']": {
                            color: "inherit",
                          },
                        })}
                        onClick={() => setNavOpen(false)}
                      >
                        {label}
                      </ListCell>
                    </li>
                  );
                })}
              </List>
            </section>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.helpCard}>
            <Typography
              variant="label2"
              weight="medium"
              color="semantic.foreground.neutral.secondary"
            >
              {t("Need a hand?", "도움이 필요하신가요?", "需要帮助吗？")}
            </Typography>
            <Button
              as={Link}
              href={href("/advertiser/requests")}
              variant="outlined"
              color="assistive"
              size="small"
              trailingContent={<IconArrowUpRight aria-hidden />}
            >
              {t("Contact us", "문의하기", "联系我们")}
            </Button>
          </div>
          <Divider />
          <List>
            <li>
              <ListCell
                as={Link}
                href={href("/advertiser/accountManagement")}
                role="link"
                className={styles.navItem}
                variant="full"
                verticalPadding="small"
                textProps={{ variant: "label1", weight: "medium" }}
                leadingContent={
                  <ListCellContent variant="icon">
                    <IconSetting aria-hidden />
                  </ListCellContent>
                }
                sx={{ paddingInline: 12 }}
              >
                {t("Account settings", "계정 관리", "账户管理")}
              </ListCell>
            </li>
            <li>
              <ListCell
                as="button"
                type="button"
                className={styles.navItem}
                variant="full"
                disabled={busy}
                onClick={onSignOut}
                verticalPadding="small"
                textProps={{ variant: "label1", weight: "medium" }}
                leadingContent={
                  <ListCellContent variant="icon">
                    <IconLogout aria-hidden />
                  </ListCellContent>
                }
                sx={{ paddingInline: 12 }}
              >
                {t("Sign out", "로그아웃", "退出登录")}
              </ListCell>
            </li>
          </List>
          <Typography
            as="p"
            variant="caption2"
            color="semantic.foreground.neutral.tertiary"
            className={styles.copyright}
          >
            © Futures Medialab
          </Typography>
        </div>
      </aside>
    </>
  );
}
