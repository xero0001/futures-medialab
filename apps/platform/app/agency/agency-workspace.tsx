"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { Locale } from "../_components/landing-copy";
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
import "./agency-montage.css";
import { WorkspaceThemeContext } from "../_components/workspace/workspace-controls";
import { WorkspaceProvider } from "../_components/workspace/workspace-provider";
import { WorkspaceShell } from "../_components/workspace/workspace-shell";
import shellStyles from "../_components/workspace/workspace-shell.module.css";

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
}: AgencyAccount & { initialLocale: Locale; initialSection?: AgencySection }) {
  const copy = agencyCopy[locale];
  const t = (en: string, ko: string, zh: string) =>
    agencyText(locale, en, ko, zh);
  const [section, setSection] = useState(initialSection);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
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
      requestAnimationFrame(() =>
        mainHeading.current?.focus({ preventScroll: true }),
      );
    }
    window.addEventListener("popstate", syncSection);
    return () => window.removeEventListener("popstate", syncSection);
  }, []);

  function navigate(next: AgencySection) {
    setSection(next);
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
  return (
    <WorkspaceProvider>
      <WorkspaceThemeContext value={true}>
        <div
          className={`cwa-workspace agency-montage ${shellStyles.workspace}`}
          lang={locale === "zh" ? "zh-CN" : locale}
        >
          <WorkspaceShell
            locale={locale}
            organizationName={organizationName}
            userName={userName}
            workspaceRole="agency"
            agencySection={section}
            onAgencyNavigate={navigate}
            isGuest={false}
            busy={signingOut}
            onSignOut={() => void signOut()}
          />
          <main id="workspace-main" className={`cwa-main ${shellStyles.main}`}>
            <div className={shellStyles.content}>
              {logoutError && (
                <p className="cwa-date-error" role="alert">
                  {t(
                    "Could not log out. Please try again.",
                    "로그아웃하지 못했습니다. 다시 시도해 주세요.",
                    "退出失败，请重试。",
                  )}
                </p>
              )}

              <div className="cwa-heading">
                <div>
                  <p className="agency-eyebrow">
                    {t(
                      "Agency workspace",
                      "에이전시 워크스페이스",
                      "代理机构工作区",
                    )}
                  </p>
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
                  <p>
                    {t(
                      "Workspace records become available after approval.",
                      "조직 승인이 완료되면 프로젝트와 정산 내역을 확인할 수 있습니다.",
                      "组织审核通过后可查看项目和结算记录。",
                    )}
                  </p>
                  <Link
                    className="cwa-button"
                    href={`/onboarding/agency?lang=${locale}`}
                  >
                    {copy.reviewProfile}
                  </Link>
                </section>
              )}
            </div>
          </main>
        </div>
      </WorkspaceThemeContext>
    </WorkspaceProvider>
  );
}
