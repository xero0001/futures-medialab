"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Avatar,
  Badge,
  Button,
  Icon,
  NavGroup,
  NavItem,
  Text,
} from "@channel.io/bezier-react";
import {
  BriefcaseIcon,
  CancelIcon,
  ChevronSmallRightIcon,
  FolderIcon,
  GraphIcon,
  GroupIcon,
  InboxIcon,
  LinkIcon,
  MegaphoneIcon,
  MenuIcon,
  OfficeIcon,
  OutIcon,
  PeopleListIcon,
  SearchIcon,
  SettingsIcon,
  ShineIcon,
} from "@channel.io/bezier-icons";
import { BrandSymbol } from "@futures-medialab/ui/brand-symbol";

import type { Locale } from "../../../_components/landing-copy";
import { translate } from "../../_components/directory-filters";
import { BezierSelect } from "./bezier-filters";

type BezierWorkspaceShellProps = {
  locale: Locale;
  organizationName: string;
  userName: string;
  status: "PENDING" | "ACTIVE";
  signingOut: boolean;
  onSignOut: () => void;
  children: ReactNode;
};

function initialsAvatar(name: string) {
  const initials = Array.from(name.trim() || "F")
    .slice(0, 2)
    .join("");
  const safeInitials = initials.replace(/[&<>"']/g, (character) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[character]!;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="24" fill="#e9e7ff"/><text x="40" y="42" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,sans-serif" font-size="27" font-weight="700" fill="#5e56f0">${safeInitials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function BezierWorkspaceShell({
  locale,
  organizationName,
  userName,
  status,
  signingOut,
  onSignOut,
  children,
}: BezierWorkspaceShellProps) {
  const t = (en: string, ko: string, zh: string) =>
    translate(locale, en, ko, zh);
  const [navOpen, setNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(true);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const userAvatar = initialsAvatar(userName);
  const organizationAvatar = initialsAvatar(organizationName);
  const accountHref = `/advertiser/accountManagement?lang=${locale}`;
  const searchLabel = t("Creator search", "크리에이터 검색", "达人查询");
  const workspaceLabel = t(
    "Brand workspace",
    "브랜드 워크스페이스",
    "品牌工作区",
  );
  const accountLabel = t("Account settings", "계정 관리", "账户管理");
  const statusLabel =
    status === "ACTIVE"
      ? t("Approved brand", "승인된 브랜드", "已批准品牌")
      : t("Approval pending", "승인 대기", "待审核");

  function closeNavigation() {
    setNavOpen(false);
    requestAnimationFrame(() => menuRef.current?.focus());
  }

  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    function updateViewport() {
      setIsMobile(media.matches);
      if (!media.matches) setNavOpen(false);
    }
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (!navOpen || !isMobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function containFocus(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setNavOpen(false);
        requestAnimationFrame(() => menuRef.current?.focus());
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !sidebarRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !sidebarRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", containFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", containFocus);
    };
  }, [isMobile, navOpen]);

  function navigateMenu(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).filter((element) => element.getClientRects().length > 0);
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (current < 0 || items.length === 0) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length;
    items[next]?.focus();
  }

  return (
    <>
      {navOpen && isMobile && (
        <button
          className="bz-shell-backdrop"
          type="button"
          tabIndex={-1}
          aria-label={t("Close navigation", "탐색 메뉴 닫기", "关闭导航")}
          onClick={closeNavigation}
        />
      )}
      <aside
        ref={sidebarRef}
        id="bz-shell-navigation"
        className={`bz-sidebar${navOpen ? " is-open" : ""}`}
        role={isMobile && navOpen ? "dialog" : undefined}
        aria-modal={isMobile && navOpen ? true : undefined}
        aria-label={t(
          "Workspace navigation",
          "워크스페이스 메뉴",
          "工作区导航",
        )}
        inert={isMobile && !navOpen}
      >
        <div className="bz-shell-sidebar-top">
          <Link
            className="bz-shell-brand"
            href={`/storage/search/beizier?lang=${locale}`}
            aria-label="Futures Medialab"
          >
            <span className="bz-shell-brand-symbol">
              <BrandSymbol />
            </span>
            <Text className="bz-shell-brand-name" typo="18" bold>
              futures<small>MEDIALAB</small>
            </Text>
          </Link>
          <Button
            ref={closeRef}
            className="bz-shell-close"
            type="button"
            size="m"
            styleVariant="tertiary"
            colorVariant="monochrome-dark"
            leftContent={CancelIcon}
            aria-label={t("Close navigation", "탐색 메뉴 닫기", "关闭导航")}
            onClick={closeNavigation}
          />
        </div>

        <div className="bz-shell-organization">
          <Avatar
            name={organizationName}
            avatarUrl={organizationAvatar}
            fallbackUrl={organizationAvatar}
            size="36"
          />
          <div className="bz-shell-organization-copy">
            <Text typo="14" bold truncated>
              {organizationName}
            </Text>
            <Text typo="12" color="text-neutral-light" truncated>
              {workspaceLabel}
            </Text>
          </div>
          <Icon source={OfficeIcon} size="s" color="text-neutral-light" />
        </div>

        <nav
          className="bz-shell-nav"
          aria-label={t("Main navigation", "주요 메뉴", "主导航")}
          onKeyDown={navigateMenu}
        >
          <ul
            className="bz-shell-nav-list"
            role="menu"
            aria-label={t("Workspace menu", "워크스페이스 메뉴", "工作区菜单")}
          >
            <NavGroup
              className="bz-shell-nav-group"
              name="bz-discover"
              content={t("Discover", "크리에이터 탐색", "达人探索")}
              leftContent={PeopleListIcon}
              open={discoverOpen}
              onClick={() => setDiscoverOpen((open) => !open)}
            >
              <NavItem
                className="bz-shell-nav-item is-active"
                name="creator-search"
                href={`/storage/search/beizier?lang=${locale}`}
                content={searchLabel}
                leftContent={SearchIcon}
                active
                aria-current="page"
              />
              <NavItem
                className="bz-shell-nav-item"
                name="similar-creators"
                href={`/storage/similar-search?lang=${locale}`}
                content={t("Similar creators", "유사 크리에이터", "相似达人")}
                leftContent={GroupIcon}
              />
              <NavItem
                className="bz-shell-nav-item"
                name="related-brands"
                href={`/storage/similar-brands?lang=${locale}`}
                content={t("Related brands", "동종 브랜드", "同类品牌")}
                leftContent={BriefcaseIcon}
              />
              <NavItem
                className="bz-shell-nav-item"
                name="collections"
                href={`/storage/collect?lang=${locale}`}
                content={t("Collections", "즐겨찾기", "收藏夹")}
                leftContent={FolderIcon}
              />
            </NavGroup>
            <NavGroup
              className="bz-shell-nav-group"
              name="bz-workspace"
              content={t("Workspace", "작업 공간", "工作区")}
              leftContent={OfficeIcon}
              open={workspaceOpen}
              onClick={() => setWorkspaceOpen((open) => !open)}
            >
              <NavItem
                className="bz-shell-nav-item"
                name="campaigns"
                href={`/advertiser/campaign?lang=${locale}`}
                content={t("Campaigns", "캠페인 관리", "推广管理")}
                leftContent={MegaphoneIcon}
              />
              <NavItem
                className="bz-shell-nav-item"
                name="requests"
                href={`/advertiser/requests?lang=${locale}`}
                content={t("Request inbox", "요청함", "请求中心")}
                leftContent={InboxIcon}
              />
              <NavItem
                className="bz-shell-nav-item"
                name="short-links"
                href={`/shortLinks?lang=${locale}`}
                content={t("Short links", "단축 링크", "短链服务")}
                leftContent={LinkIcon}
              />
              <NavItem
                className="bz-shell-nav-item"
                name="intelligence-tools"
                href={`/agent?lang=${locale}`}
                content={t("Intelligence tools", "분석 도구", "智能工具")}
                leftContent={GraphIcon}
              />
            </NavGroup>
          </ul>
        </nav>

        <div className="bz-shell-sidebar-footer">
          <Link
            className="bz-shell-account"
            href={accountHref}
            aria-label={`${userName} · ${accountLabel}`}
          >
            <Avatar
              name={userName}
              avatarUrl={userAvatar}
              fallbackUrl={userAvatar}
              size="36"
            />
            <div className="bz-shell-account-copy">
              <Text typo="14" bold truncated>
                {userName}
              </Text>
              <Text typo="12" color="text-neutral-light" truncated>
                {statusLabel}
              </Text>
            </div>
            <Icon source={SettingsIcon} size="s" />
          </Link>
          <Button
            className="bz-shell-signout"
            type="button"
            size="m"
            styleVariant="tertiary"
            colorVariant="monochrome-dark"
            leftContent={OutIcon}
            aria-label={t("Sign out", "로그아웃", "退出登录")}
            title={t("Sign out", "로그아웃", "退出登录")}
            loading={signingOut}
            disabled={signingOut}
            onClick={onSignOut}
          />
        </div>
      </aside>

      <div className="bz-body" inert={isMobile && navOpen}>
        <header className="bz-topbar">
          <div className="bz-shell-header-start">
            <Button
              ref={menuRef}
              className="bz-shell-menu"
              type="button"
              size="m"
              styleVariant="tertiary"
              colorVariant="monochrome-dark"
              leftContent={MenuIcon}
              aria-label={t("Open navigation", "탐색 메뉴 열기", "打开导航")}
              aria-controls="bz-shell-navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            />
            <div className="bz-shell-breadcrumb">
              <Icon source={SearchIcon} size="s" />
              <Text
                className="bz-shell-breadcrumb-parent"
                typo="13"
                color="text-neutral-light"
              >
                {t("Discover", "크리에이터 탐색", "达人探索")}
              </Text>
              <Icon
                className="bz-shell-breadcrumb-separator"
                source={ChevronSmallRightIcon}
                size="xs"
                color="text-neutral-light"
              />
              <Text typo="14" bold>
                {searchLabel}
              </Text>
            </div>
          </div>
          <div className="bz-shell-header-actions">
            <Badge
              className="bz-shell-status"
              variant={status === "ACTIVE" ? "blue" : "default"}
              size="m"
              icon={status === "ACTIVE" ? ShineIcon : OfficeIcon}
            >
              {status === "ACTIVE" ? workspaceLabel : statusLabel}
            </Badge>
            <div className="bz-shell-language">
              <BezierSelect
                id="bz-shell-language"
                label={t("Language", "언어", "语言")}
                value={locale}
                options={[
                  { value: "ko", label: "한국어" },
                  { value: "en", label: "English" },
                  { value: "zh", label: "中文" },
                ]}
                onChange={(next) => {
                  document.cookie = `fm-locale=${next};path=/;max-age=31536000;SameSite=Lax`;
                  window.location.assign(
                    `/storage/search/beizier?lang=${next}`,
                  );
                }}
              />
            </div>
            <Link
              className="bz-shell-header-account"
              href={accountHref}
              aria-label={accountLabel}
              title={`${userName} · ${accountLabel}`}
            >
              <Avatar
                name={userName}
                avatarUrl={userAvatar}
                fallbackUrl={userAvatar}
                size="30"
              />
            </Link>
          </div>
        </header>
        {children}
      </div>
    </>
  );
}
