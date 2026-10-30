"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { authClient } from "../../lib/auth-client";
import { AuthShell } from "../_components/auth-shell";
import type { Locale } from "../_components/landing-copy";
import "./account.css";

const copy = {
  en: {
    title: "Your account",
    subtitle: "You’re signed in to Futures Medialab.",
    email: "Email",
    organization: "Organization",
    type: "Account type",
    clientAgency: "Advertising agency (Buyer)",
    status: "Approval status",
    types: {
      AGENCY: "Agency / Studio",
      BRAND: "Brand (Advertiser)",
      PLATFORM: "Platform team",
    },
    statuses: {
      PENDING: "Pending review",
      ACTIVE: "Approved",
      SUSPENDED: "Suspended",
    },
    notices: {
      PENDING:
        "Your organization is awaiting review. Campaign access is not enabled yet.",
      ACTIVE: "Your organization has been approved.",
      SUSPENDED:
        "Your organization’s access is suspended. Please contact your platform manager.",
    },
    noOrganization: "No organization is linked to this account.",
    logout: "Log out",
    loggingOut: "Logging out…",
    logoutFailed: "We couldn’t log you out. Please try again.",
  },
  ko: {
    title: "내 계정",
    subtitle: "Futures Medialab에 로그인되어 있습니다.",
    email: "이메일",
    organization: "소속 조직",
    type: "회원 유형",
    clientAgency: "광고 대행사 (구매자)",
    status: "승인 상태",
    types: {
      AGENCY: "에이전시 / 스튜디오",
      BRAND: "브랜드 (광고주)",
      PLATFORM: "플랫폼 운영팀",
    },
    statuses: {
      PENDING: "승인 대기",
      ACTIVE: "승인 완료",
      SUSPENDED: "이용 정지",
    },
    notices: {
      PENDING:
        "조직 검토를 기다리고 있습니다. 아직 캠페인 접근 권한이 부여되지 않았습니다.",
      ACTIVE: "조직 승인이 완료되었습니다.",
      SUSPENDED: "조직 이용이 정지되었습니다. 플랫폼 담당자에게 문의해 주세요.",
    },
    noOrganization: "연결된 소속 조직이 없습니다.",
    logout: "로그아웃",
    loggingOut: "로그아웃 중…",
    logoutFailed: "로그아웃하지 못했습니다. 다시 시도해 주세요.",
  },
  zh: {
    title: "我的账号",
    subtitle: "您已登录 Futures Medialab。",
    email: "邮箱",
    organization: "所属机构",
    type: "账号类型",
    clientAgency: "广告代理机构（采购方）",
    status: "审核状态",
    types: {
      AGENCY: "代理机构 / 工作室",
      BRAND: "品牌（广告主）",
      PLATFORM: "平台运营团队",
    },
    statuses: { PENDING: "待审核", ACTIVE: "已通过", SUSPENDED: "已停用" },
    notices: {
      PENDING: "您的机构正在等待审核，暂未获得营销活动访问权限。",
      ACTIVE: "您的机构已通过审核。",
      SUSPENDED: "您的机构访问权限已停用，请联系平台负责人。",
    },
    noOrganization: "此账号尚未关联机构。",
    logout: "退出登录",
    loggingOut: "正在退出…",
    logoutFailed: "退出登录失败，请重试。",
  },
};

type AccountOrganization = {
  id: string;
  name: string;
  type: "AGENCY" | "BRAND" | "PLATFORM";
  isClientAgency?: boolean;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
};

export function AccountPanel({
  initialLocale,
  email,
  organizations,
}: {
  initialLocale: Locale;
  email: string;
  organizations: AccountOrganization[];
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestPending = useRef(false);
  const t = copy[locale];

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  }, [locale]);

  function changeLocale(next: Locale) {
    setLocale(next);
    document.cookie = `fm-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
  }

  async function logout() {
    if (requestPending.current) return;
    requestPending.current = true;
    setPending(true);
    setFailed(false);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setFailed(true);
        return;
      }
      window.location.assign(`/login?lang=${locale}`);
    } catch {
      setFailed(true);
    } finally {
      requestPending.current = false;
      setPending(false);
    }
  }

  return (
    <AuthShell
      locale={locale}
      onLocaleChange={changeLocale}
      headingId="account-title"
      className="fma-page"
    >
      <div className="fma-wrap">
        <h1 id="account-title">{t.title}</h1>
        <p className="fma-subtitle">{t.subtitle}</p>
        <dl className="fma-details">
          <div>
            <dt>{t.email}</dt>
            <dd>{email}</dd>
          </div>
        </dl>
        {organizations.length ? (
          organizations.map((organization) => (
            <section
              className="fma-organization"
              key={organization.id}
              aria-labelledby={`organization-${organization.id}`}
            >
              <p className="fma-label">{t.organization}</p>
              <h2 id={`organization-${organization.id}`}>
                {organization.name}
              </h2>
              <dl className="fma-details">
                <div>
                  <dt>{t.type}</dt>
                  <dd>
                    {organization.isClientAgency
                      ? t.clientAgency
                      : t.types[organization.type]}
                  </dd>
                </div>
                <div>
                  <dt>{t.status}</dt>
                  <dd>
                    <span
                      className="fma-badge"
                      data-status={organization.status}
                    >
                      {t.statuses[organization.status]}
                    </span>
                  </dd>
                </div>
              </dl>
              <p className="fma-notice">{t.notices[organization.status]}</p>
            </section>
          ))
        ) : (
          <p className="fma-notice">{t.noOrganization}</p>
        )}
        <button
          type="button"
          className="fma-logout"
          onClick={logout}
          disabled={pending}
          aria-busy={pending}
        >
          <LogOut size={18} aria-hidden="true" />
          {pending ? t.loggingOut : t.logout}
        </button>
        <p role="alert" className="fml-status fml-error-status">
          {failed ? t.logoutFailed : ""}
        </p>
      </div>
    </AuthShell>
  );
}
