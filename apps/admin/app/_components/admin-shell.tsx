"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  List,
  ListCell,
  ListCellContent,
  TopNavigation,
  Typography,
  Divider,
} from "@montage-ui/core";
import {
  IconMenu,
  IconLogout,
  IconArrowUpRight,
  IconPersons,
  IconCompany,
  IconMegaphone,
  IconInbox,
  IconHome,
  IconHistory,
} from "@montage-ui/icon";
import { BrandLogo } from "../brand-logo";
import { AdminProvider } from "./admin-provider";
import { AdminButton } from "./admin-button";

export const adminNavigation = [
  { key: "overview", label: "운영 현황", icon: IconHome },
  { key: "users", label: "사용자 관리", icon: IconPersons },
  { key: "organizations", label: "조직 · 심사 관리", icon: IconCompany },
  { key: "campaigns", label: "캠페인 · 신청 관리", icon: IconMegaphone },
  { key: "requests", label: "브랜드 요청함", icon: IconInbox },
  { key: "audit", label: "변경 이력", icon: IconHistory },
] as const;
export type AdminTab = (typeof adminNavigation)[number]["key"];

export function AdminShell({
  name,
  tab,
  busy,
  onNavigate,
  onLogout,
  children,
}: {
  name: string;
  tab: AdminTab;
  busy: boolean;
  onNavigate: (tab: AdminTab) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => menuRef.current?.focus());
  };
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => {
      sidebarRef.current
        ?.querySelector<HTMLButtonElement>("[aria-current='page']")
        ?.focus();
    });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        requestAnimationFrame(() => menuRef.current?.focus());
      }
      if (event.key !== "Tab") return;
      const items = Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>("button, a[href]") ??
          [],
      );
      const first = items[0],
        last = items.at(-1);
      if (!sidebarRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const media = window.matchMedia("(min-width: 901px)");
    const resize = () => {
      if (media.matches) setOpen(false);
    };
    document.addEventListener("keydown", keydown);
    media.addEventListener("change", resize);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keydown);
      media.removeEventListener("change", resize);
    };
  }, [open]);
  return (
    <AdminProvider>
      <div className="admin-shell">
        <a
          className="admin-skip-link"
          href="#admin-content"
          tabIndex={open ? -1 : undefined}
        >
          본문으로 건너뛰기
        </a>
        <header className="admin-topbar" inert={open}>
          <TopNavigation
            variant="normal"
            background={false}
            className="admin-top-navigation"
            leadingContent={
              <div className="admin-header-leading">
                <button
                  ref={menuRef}
                  type="button"
                  className="admin-mobile-menu"
                  aria-label="메뉴 열기"
                  aria-expanded={open}
                  aria-controls="admin-sidebar"
                  onClick={() => setOpen(!open)}
                >
                  <IconMenu aria-hidden />
                </button>
                <BrandLogo />
                <div className="admin-header-context">
                  <Divider vertical size={20} />
                  <Typography
                    variant="label1"
                    weight="medium"
                    color="semantic.foreground.neutral.secondary"
                  >
                    운영 콘솔
                  </Typography>
                </div>
              </div>
            }
            trailingContent={
              <div className="admin-header-actions">
                <span className="admin-operator">
                  <span className="admin-avatar" aria-hidden="true">
                    {Array.from(name.trim())[0] || "A"}
                  </span>
                  <span className="admin-account-name">{name}</span>
                </span>
                <AdminButton
                  type="button"
                  className="admin-signout"
                  aria-label="로그아웃"
                  disabled={busy}
                  onClick={onLogout}
                >
                  <IconLogout aria-hidden />
                  <span className="admin-signout-label">로그아웃</span>
                </AdminButton>
              </div>
            }
          />
        </header>
        {open && (
          <button
            type="button"
            tabIndex={-1}
            className="admin-nav-backdrop"
            aria-label="메뉴 닫기"
            onClick={close}
          />
        )}
        <aside
          ref={sidebarRef}
          onTransitionEnd={(event) => {
            if (
              open &&
              event.target === event.currentTarget &&
              event.propertyName === "transform"
            ) {
              sidebarRef.current
                ?.querySelector<HTMLButtonElement>("[aria-current='page']")
                ?.focus();
            }
          }}
          id="admin-sidebar"
          className={`admin-sidebar${open ? " is-open" : ""}`}
          role={open ? "dialog" : undefined}
          aria-modal={open || undefined}
          aria-label="관리자 메뉴"
        >
          <button className="admin-mobile-close" type="button" onClick={close}>
            메뉴 닫기
          </button>
          <nav aria-label="관리자 메뉴">
            <Typography
              as="h2"
              variant="caption1"
              weight="medium"
              className="admin-nav-label"
            >
              워크스페이스
            </Typography>
            <List>
              {adminNavigation.map(({ key, label, icon: Icon }) => (
                <li key={key}>
                  <ListCell
                    as="button"
                    role="button"
                    type="button"
                    variant="full"
                    selected={tab === key}
                    trailingContent={null}
                    verticalPadding="small"
                    className="admin-nav-item"
                    aria-current={tab === key ? "page" : undefined}
                    textProps={{
                      variant: "label1",
                      weight: tab === key ? "bold" : "medium",
                    }}
                    leadingContent={
                      <ListCellContent variant="icon">
                        <Icon aria-hidden />
                      </ListCellContent>
                    }
                    sx={{
                      paddingInline: 12,
                      minHeight: 46,
                      borderRadius: 8,
                      color: tab === key ? "#171719" : "#46474c",
                      backgroundColor: tab === key ? "#f4f4f5" : "transparent",
                      "[data-role='list-text-wrapper'], [data-component='list-cell-content']":
                        { color: "inherit" },
                    }}
                    onClick={() => {
                      setOpen(false);
                      onNavigate(key);
                      requestAnimationFrame(() =>
                        document.getElementById("admin-content")?.focus(),
                      );
                    }}
                  >
                    {label}
                  </ListCell>
                </li>
              ))}
            </List>
          </nav>
          <div className="admin-sidebar-foot">
            <Divider />
            <a
              href="https://futures-medialab.vercel.app"
              target="_blank"
              rel="noreferrer"
            >
              서비스 바로가기 <IconArrowUpRight aria-hidden />
            </a>
            <Typography
              as="p"
              variant="caption2"
              color="semantic.foreground.neutral.tertiary"
            >
              © Futures Medialab
            </Typography>
          </div>
        </aside>
        <div className="admin-main" inert={open}>
          {children}
        </div>
      </div>
    </AdminProvider>
  );
}
