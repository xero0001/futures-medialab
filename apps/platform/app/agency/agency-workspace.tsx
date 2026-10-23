"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Building2,
  ChevronDown,
  History,
  FileText,
  FolderOpen,
  Handshake,
  LayoutGrid,
  LogOut,
  Mail,
  Menu,
  Search,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { Locale } from "../_components/landing-copy";
import { LanguageSwitcher } from "../_components/language-switcher";
import { Wordmark } from "../_components/brand-logo";
import { authClient } from "../../lib/auth-client";
import { AgencyMarketplace } from "./agency-marketplace";
import { AgencyOperations } from "./agency-operations";
import {
  agencyCopy,
  agencySections,
  agencyText,
  type AgencySection,
} from "./agency-workspace-copy";
import "./agency-workspace.css";

type AgencyAccount = {
  organizationName: string;
  status: "PENDING" | "ACTIVE";
  role: "OWNER" | "ADMIN" | "MEMBER";
  userName: string;
  agencyType: "agency" | "studio";
  submittedAt: string | null;
};

export function AgencyWorkspace({
  initialLocale: locale,
  initialSection = "offers",
  organizationName,
  status,
  role,
  userName,
  agencyType,
}: AgencyAccount & { initialLocale: Locale; initialSection?: AgencySection }) {
  const copy = agencyCopy[locale];
  const t = (en: string, ko: string, zh: string) =>
    agencyText(locale, en, ko, zh);
  const [section, setSection] = useState(initialSection);
  const [navOpen, setNavOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const mainHeading = useRef<HTMLHeadingElement>(null);
  const pending = status === "PENDING";

  useEffect(() => {
    function syncSection() {
      const requested = new URL(window.location.href).searchParams.get(
        "section",
      );
      setSection(
        agencySections.includes(requested as AgencySection)
          ? (requested as AgencySection)
          : "offers",
      );
      setNavOpen(false);
      requestAnimationFrame(() =>
        mainHeading.current?.focus({ preventScroll: true }),
      );
    }
    window.addEventListener("popstate", syncSection);
    return () => window.removeEventListener("popstate", syncSection);
  }, []);

  useEffect(() => {
    if (!navOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setNavOpen(false);
      menuTrigger.current?.focus({ preventScroll: true });
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [navOpen]);

  function navigate(next: AgencySection) {
    setSection(next);
    setNavOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("section", next);
    window.history.pushState(null, "", url);
    requestAnimationFrame(() => {
      mainHeading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  }
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setLogoutError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("logout");
      window.location.assign(`/login?lang=${locale}`);
    } catch {
      setLogoutError(true);
      setSigningOut(false);
    }
  }
  function navLink(key: AgencySection, Icon: typeof Search, nested = false) {
    return (
      <Link
        key={key}
        href={`/agency?lang=${locale}&section=${key}`}
        aria-current={section === key ? "page" : undefined}
        className={`cwa-nav-item${section === key ? " is-active" : ""}${nested ? " is-nested" : ""}`}
        onClick={(event) => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
            return;
          event.preventDefault();
          navigate(key);
        }}
      >
        <Icon size={18} aria-hidden="true" />
        <span>{copy[key]}</span>
      </Link>
    );
  }

  return (
    <div className="cwa-workspace" lang={locale === "zh" ? "zh-CN" : locale}>
      <header className="cwa-topbar">
        <button
          ref={menuTrigger}
          type="button"
          className="cwa-icon-button cwa-mobile-menu"
          aria-label={copy.menu}
          aria-expanded={navOpen}
          aria-controls="agency-navigation"
          onClick={() => setNavOpen(!navOpen)}
        >
          <Menu size={22} />
        </button>
        <Wordmark href={`/?lang=${locale}`} />
        <span className="cwa-topbar-divider" />
        <span className="cwa-topbar-label">{copy.workspace}</span>
        <div className="cwa-top-actions">
          <button
            className="cwa-icon-button"
            type="button"
            aria-label={copy.notifications}
            onClick={() => navigate("notifications")}
          >
            <Bell size={20} />
          </button>
          <LanguageSwitcher
            locale={locale}
            label={copy.language}
            onChange={(next) => {
              document.cookie = `fm-locale=${next};path=/;max-age=31536000;SameSite=Lax`;
              window.location.assign(`/agency?lang=${next}&section=${section}`);
            }}
          />
          <button
            type="button"
            className="cwa-avatar"
            onClick={() => navigate("organization")}
            aria-label={copy.organization}
          >
            {userName.slice(0, 2).toUpperCase()}
          </button>
        </div>
      </header>
      {navOpen && (
        <button
          type="button"
          className="cwa-mobile-backdrop"
          aria-label={copy.menu}
          onClick={() => {
            setNavOpen(false);
            menuTrigger.current?.focus({ preventScroll: true });
          }}
        />
      )}
      <aside
        id="agency-navigation"
        className={`cwa-sidebar${navOpen ? " is-open" : ""}`}
      >
        <nav aria-label={copy.workspace}>
          {navLink("offers", LayoutGrid)}
          {navLink("applications", History)}
          <details className="cwa-nav-group" open>
            <summary>
              <Handshake size={17} aria-hidden="true" />
              {copy.officialGroup}
              <ChevronDown size={15} aria-hidden="true" />
            </summary>
            {navLink("projects", FolderOpen, true)}
          </details>
          <details className="cwa-nav-group" open>
            <summary>
              <Users size={17} aria-hidden="true" />
              {copy.creatorsGroup}
              <ChevronDown size={15} aria-hidden="true" />
            </summary>
            {navLink("invitations", Mail, true)}
            {navLink("creator-projects", FileText, true)}
          </details>
          {navLink("creators", Users)}
          {navLink("payments", Wallet)}
          <details className="cwa-nav-group" open>
            <summary>
              <Building2 size={17} aria-hidden="true" />
              {copy.accountGroup}
              <ChevronDown size={15} aria-hidden="true" />
            </summary>
            {navLink("organization", Building2, true)}
          </details>
          {navLink("notifications", Bell)}
          <button
            type="button"
            className="cwa-nav-item cwa-logout"
            onClick={signOut}
            disabled={signingOut}
          >
            <LogOut size={18} aria-hidden="true" />
            {t("Log out", "로그아웃", "退出登录")}
          </button>
          {logoutError && (
            <p className="cwa-date-error" role="alert">
              {t(
                "Could not log out. Please try again.",
                "로그아웃하지 못했습니다. 다시 시도해 주세요.",
                "退出失败，请重试。",
              )}
            </p>
          )}
        </nav>
        <div className="cwa-sidebar-footer">
          <span className="cwa-avatar">
            {organizationName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{organizationName}</strong>
            <span>{agencyType === "studio" ? copy.studio : copy.agency}</span>
          </div>
        </div>
      </aside>
      <main className="cwa-main">
        <div className="cwa-heading">
          <div>
            <h1 ref={mainHeading} tabIndex={-1}>
              {copy[section]}
            </h1>
            {section === "organization" && (
              <p className="cwa-subtitle">{copy.organizationSubtitle}</p>
            )}
          </div>
          {!pending && (
            <button
              className="cwa-partner-status"
              type="button"
              onClick={() => navigate("organization")}
              aria-label={`${copy.status}: ${copy.active}`}
            >
              <ShieldCheck size={17} aria-hidden="true" />
              {t("Verified partner", "승인된 파트너", "已认证合作伙伴")}
            </button>
          )}
        </div>
        {pending && (
          <section
            className="cwa-approval-banner is-pending"
            aria-label={copy.status}
          >
            <ShieldCheck size={25} aria-hidden="true" />
            <div>
              <strong>{copy.pendingTitle}</strong>
              <p>
                {t(
                  "Approved organizations can view and apply to published campaigns.",
                  "조직 심사 승인 후 공개된 캠페인을 확인하고 신청할 수 있습니다.",
                  "组织审核通过后可浏览及申请已发布的活动。",
                )}
              </p>
            </div>
          </section>
        )}

        {section === "offers" || section === "applications" ? (
          <AgencyMarketplace
            locale={locale}
            section={section === "offers" ? "offers" : "projects"}
            status={status}
            role={role}
            onExplore={() => navigate("offers")}
            onProjects={() => navigate("applications")}
          />
        ) : !pending ? (
          <AgencyOperations
            key={section}
            locale={locale}
            section={section}
            onExplore={() => navigate("offers")}
            onApplications={() => navigate("applications")}
          />
        ) : (
          <section className="cwa-empty">
            <ShieldCheck size={34} aria-hidden="true" />
            <h2>{copy.pendingTitle}</h2>
            <p>{t("Workspace records become available after approval.", "조직 승인이 완료되면 프로젝트와 정산 내역을 확인할 수 있습니다.", "组织审核通过后可查看项目和结算记录。")}</p>
            <Link className="cwa-button" href={`/onboarding/agency?lang=${locale}`}>{copy.reviewProfile}</Link>
          </section>
        )}
      </main>
    </div>
  );
}
