"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  Clock3,
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
  submittedAt,
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
  const emptyContent = {
    invitations: {
      title: copy.emptyInvitations,
      body: copy.emptyInvitationsBody,
      icon: Mail,
    },
    "creator-projects": {
      title: copy.emptyCreatorProjects,
      body: copy.emptyCreatorProjectsBody,
      icon: FileText,
    },
    creators: {
      title: copy.emptyCreators,
      body: copy.emptyCreatorsBody,
      icon: Users,
    },
    payments: {
      title: copy.emptyPayments,
      body: copy.emptyPaymentsBody,
      icon: Wallet,
    },
    notifications: {
      title: copy.emptyNotifications,
      body: copy.emptyNotificationsBody,
      icon: Bell,
    },
  };
  const empty =
    section !== "offers" && section !== "projects" && section !== "organization"
      ? emptyContent[section]
      : null;
  const EmptyIcon = empty?.icon ?? FolderOpen;

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
          <div className="cwa-nav-group">
            <span>
              <Handshake size={17} aria-hidden="true" />
              {copy.officialGroup}
            </span>
            {navLink("projects", FolderOpen, true)}
          </div>
          <div className="cwa-nav-group">
            <span>
              <Users size={17} aria-hidden="true" />
              {copy.creatorsGroup}
            </span>
            {navLink("invitations", Mail, true)}
            {navLink("creator-projects", FileText, true)}
          </div>
          {navLink("creators", Users)}
          {navLink("payments", Wallet)}
          <div className="cwa-nav-group">
            <span>
              <Building2 size={17} aria-hidden="true" />
              {copy.accountGroup}
            </span>
            {navLink("organization", Building2, true)}
          </div>
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
              {section === "offers" ? copy.offersTitle : copy[section]}
            </h1>
            {section === "organization" && (
              <p className="cwa-subtitle">{copy.organizationSubtitle}</p>
            )}
          </div>
        </div>
        <section
          className={`cwa-approval-banner${pending ? " is-pending" : ""}`}
          aria-label={copy.status}
        >
          <ShieldCheck size={25} aria-hidden="true" />
          <div>
            <strong>{pending ? copy.pendingTitle : copy.activeTitle}</strong>
            <p>
              {pending
                ? t(
                    "Approved organizations can view and apply to published campaigns.",
                    "조직 심사 승인 후 공개된 캠페인을 확인하고 신청할 수 있습니다.",
                    "组织审核通过后可浏览及申请已发布的活动。",
                  )
                : t(
                    "View approved campaigns and submit your organization's proposal. Applications do not create contracts or initiate payments.",
                    "승인된 캠페인을 확인하고 조직의 제안서를 제출하세요. 신청만으로 계약이나 결제가 발생하지 않습니다.",
                    "查看已审核活动并提交组织提案。申请不会自动创建合同或付款。",
                  )}
            </p>
          </div>
        </section>

        {section === "offers" || section === "projects" ? (
          <AgencyMarketplace
            locale={locale}
            section={section}
            status={status}
            role={role}
            onExplore={() => navigate("offers")}
          />
        ) : section === "organization" ? (
          <section className="cwa-organization">
            <div className="cwa-section-heading">
              <Building2 size={24} aria-hidden="true" />
              <div>
                <h2>{organizationName}</h2>
                <p>
                  {t(
                    "Your organization and current review status. Company information is managed through the verification process.",
                    "조직 정보와 현재 심사 상태입니다. 회사 정보는 심사 절차를 통해 관리합니다.",
                    "组织资料与当前审核状态。公司资料通过审核流程管理。",
                  )}
                </p>
              </div>
            </div>
            <dl>
              <div>
                <dt>{copy.company}</dt>
                <dd>{organizationName}</dd>
              </div>
              <div>
                <dt>{copy.type}</dt>
                <dd>{agencyType === "studio" ? copy.studio : copy.agency}</dd>
              </div>
              <div>
                <dt>{copy.status}</dt>
                <dd className="cwa-review-status">
                  {pending ? (
                    <Clock3 size={17} aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={17} aria-hidden="true" />
                  )}
                  {pending ? copy.pending : copy.active}
                </dd>
              </div>
              <div>
                <dt>{copy.submitted}</dt>
                <dd>
                  {submittedAt
                    ? new Intl.DateTimeFormat(locale, {
                        timeZone: "UTC",
                      }).format(new Date(submittedAt))
                    : copy.notSubmitted}
                </dd>
              </div>
            </dl>
            {pending && (
              <Link
                className="cwa-button cwa-button-primary"
                href={`/onboarding/agency?lang=${locale}`}
              >
                {copy.reviewProfile}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            )}
          </section>
        ) : (
          <>
            {section === "payments" && (
              <>
                <div className="cwa-payment-summary">
                  {[copy.available, copy.pendingEarnings, copy.paid].map(
                    (label) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>—</strong>
                        <small>{copy.noFinancialData}</small>
                      </div>
                    ),
                  )}
                </div>
                <div className="cwa-payment-note">
                  <ShieldCheck size={20} aria-hidden="true" />
                  <p>{copy.paymentNotice}</p>
                  <button className="cwa-button" type="button" disabled>
                    {copy.withdrawal}
                  </button>
                </div>
              </>
            )}
            {empty && (
              <section className="cwa-empty">
                <span className="cwa-empty-icon">
                  <EmptyIcon size={34} aria-hidden="true" />
                </span>
                <span className="cwa-empty-eyebrow">
                  {t(
                    "Not connected yet",
                    "아직 연결되지 않은 기능",
                    "功能尚未接入",
                  )}
                </span>
                <h2>{empty.title}</h2>
                <p>{empty.body}</p>
                {section === "creators" ? (
                  <button type="button" className="cwa-button" disabled>
                    {copy.rosterAction}
                  </button>
                ) : section !== "payments" && section !== "notifications" ? (
                  <button
                    type="button"
                    className="cwa-button cwa-button-primary"
                    onClick={() => navigate("offers")}
                  >
                    {t("Browse campaigns", "캠페인 둘러보기", "浏览活动")}
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                ) : null}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
