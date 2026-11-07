"use client";

import { ActionButton } from "@futures-medialab/ui/action-button";
import { IconButton as MontageIconButton } from "@montage-ui/core";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { CheckCircle2, Info, Inbox, X } from "lucide-react";
import type { Locale } from "../_components/landing-copy";
import type { AgencySection } from "./agency-workspace-copy";
import {
  initialInvitations,
  initialRequests,
  type Creator,
  type Invitation,
  type LocalApplication,
  type PartnerRequest,
} from "./agency-planning-data";
import s from "./agency-partner.module.css";

type PlanningContext = {
  locale: Locale;
  canEdit: boolean;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  saveCreator: (creator: Creator) => Promise<void>;
  withdrawApplication: (id: string) => Promise<void>;
  creators: Creator[];
  setCreators: Dispatch<SetStateAction<Creator[]>>;
  invitations: Invitation[];
  setInvitations: Dispatch<SetStateAction<Invitation[]>>;
  applications: LocalApplication[];
  setApplications: Dispatch<SetStateAction<LocalApplication[]>>;
  requests: PartnerRequest[];
  setRequests: Dispatch<SetStateAction<PartnerRequest[]>>;
  navigate: (section: AgencySection, detail?: string, related?: string) => void;
  notify: (message: string) => void;
};
const Context = createContext<PlanningContext | null>(null);
export function AgencyPlanningProvider({
  locale,
  canEdit,
  enabled = true,
  children,
}: {
  locale: Locale;
  canEdit: boolean;
  children: ReactNode;
  enabled?: boolean;
}) {
  const [creators, setCreators] = useState<Creator[]>([]),
    [invitations, setInvitations] = useState(initialInvitations),
    [applications, setApplications] = useState<LocalApplication[]>([]),
    [requests, setRequests] = useState(initialRequests),
    [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(enabled),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const response = await fetch("/api/agency/partner-workspace", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "정보를 불러오지 못했습니다.");
      setCreators(result.creators);
      setApplications(result.applications);
      setError("");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "정보를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, [enabled]);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const changed = () => {
      void refresh();
    };
    window.addEventListener("agency:applications-changed", changed);
    window.addEventListener("focus", changed);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("agency:applications-changed", changed);
      window.removeEventListener("focus", changed);
    };
  }, [refresh]);
  async function saveCreator(creator: Creator) {
    const { id, updated, color, ...fields } = creator;
    void color;
    const { partnerPlatform } =
      await import("../../lib/partner-application-validation");
    const response = await fetch("/api/agency/partner-workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...fields,
        platform: partnerPlatform(fields.platform),
        ...(id ? { id, expectedUpdatedAt: updated } : {}),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "저장하지 못했습니다.");
    setCreators((current) => [
      result.creator,
      ...current.filter((c) => c.id !== result.creator.id),
    ]);
  }
  async function withdrawApplication(id: string) {
    const response = await fetch("/api/agency/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "withdraw", applicationId: id }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "철회하지 못했습니다.");
    await refresh();
    window.dispatchEvent(new Event("agency:applications-changed"));
  }
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  function navigate(section: AgencySection, detail?: string, related?: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("section", section);
    for (const key of [
      "stage",
      "campaign",
      "creator",
      "invitation",
      "application",
      "request",
      "related",
    ])
      url.searchParams.delete(key);
    const key = (
      {
        creators: "creator",
        invitations: "invitation",
        applications: "application",
        requests: "request",
      } as Record<string, string>
    )[section];
    if (detail && key) url.searchParams.set(key, detail);
    if (related) url.searchParams.set("related", related);
    window.history.pushState(null, "", url);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  return (
    <Context.Provider
      value={{
        locale,
        canEdit,
        loading,
        error,
        refresh,
        saveCreator,
        withdrawApplication,
        creators,
        setCreators,
        invitations,
        setInvitations,
        applications,
        setApplications,
        requests,
        setRequests,
        navigate,
        notify: setNotice,
      }}
    >
      {children}
      <div className={s.toastRegion} role="status" aria-live="polite">
        {notice && (
          <div className={s.toast}>
            <CheckCircle2 size={18} />
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="닫기"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </Context.Provider>
  );
}
export function useAgencyPlanning() {
  const context = useContext(Context);
  if (!context) throw new Error("AgencyPlanningProvider is required");
  return context;
}
export function usePartnerText() {
  const { locale } = useAgencyPlanning();
  return (ko: string, en: string, zh: string) => ({ ko, en, zh })[locale];
}
export function money(value: number, currency = "KRW", locale = "ko") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2,
  }).format(value);
}
export function localDate(value: string) {
  const date = value.includes("T")
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(value))
    : value;
  return date.slice(0, 10).replaceAll("-", ".");
}
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export const statusNames: Record<string, [string, string, string]> = {
  pending: ["회신 대기", "Awaiting reply", "待回复"],
  negotiating: ["조건 협의 중", "Negotiating", "协商中"],
  accepted: ["참여 가능 회신", "Available", "已回复可参与"],
  declined: ["참여 불가", "Unavailable", "无法参与"],
  expired: ["기한 만료", "Expired", "已过期"],
  draft: ["작성 중", "Draft", "草稿"],
  preview: ["신청 미리보기", "Application preview", "申请预览"],
  review: ["검토 중", "In review", "审核中"],
  selected: ["선정", "Selected", "已入选"],
  brand_pending: ["광고주 승인 대기", "Awaiting approval", "待广告主批准"],
  confirmed: ["참여 확정", "Confirmed", "已确认"],
  not_selected: ["미선정", "Not selected", "未入选"],
  withdrawn: ["철회", "Withdrawn", "已撤回"],
  received: ["접수 완료", "Received", "已受理"],
  partially_confirmed: ["일부 참여 확정", "Partially confirmed", "部分已确认"],
  canceled: ["캠페인 취소", "Campaign canceled", "活动已取消"],
  progress: ["처리 중", "In progress", "处理中"],
  waiting: ["회신 필요", "Reply needed", "需回复"],
  resolved: ["처리 완료", "Resolved", "已解决"],
};
export function Status({ value }: { value: string }) {
  const t = usePartnerText();
  const labels = statusNames[value];
  return (
    <span
      className={`${s.badge} ${["confirmed", "accepted", "resolved"].includes(value) ? s.green : ["pending", "brand_pending", "waiting", "negotiating"].includes(value) ? s.amber : ["declined", "not_selected", "expired", "withdrawn"].includes(value) ? s.gray : s.blue}`}
    >
      {labels ? t(...labels) : value}
    </span>
  );
}
export function PreviewNotice() {
  const t = usePartnerText();
  return (
    <div className={s.notice}>
      <Info size={17} />
      <p>
        <strong>{t("화면 미리보기", "UI preview", "界面预览")}</strong>
        {t(
          "예시 데이터입니다. 변경 내용은 현재 페이지에서만 유지되며 실제 접수·전송되지 않습니다.",
          "Sample data. Changes last only on this page and are not submitted or sent.",
          "示例数据，更改仅保留于当前页面，不会实际提交或发送。",
        )}
      </p>
    </div>
  );
}
export function CreatorAvatar({ creator }: { creator: Creator }) {
  return (
    <span
      className={s.avatar}
      style={{ background: creator.color }}
      aria-hidden="true"
    >
      {creator.name.slice(0, 1)}
    </span>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={s.empty}>
      <Inbox size={32} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  const t = usePartnerText();
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => {
      if (el?.open) el.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`${s.dialog} ${wide ? s.wideDialog : ""}`}
      aria-labelledby={id}
      onCancel={onClose}
      onClose={onClose}
    >
      <header className={s.dialogHead}>
        <h2 id={id}>{title}</h2>
        <MontageIconButton
          size="small"
          data-fm-control="icon"
          className={s.iconButton}
          type="button"
          aria-label={t("닫기", "Close", "关闭")}
          onClick={onClose}
        >
          <X size={20} />
        </MontageIconButton>
      </header>
      {children}
    </dialog>
  );
}
export function Back({ onClick }: { onClick: () => void }) {
  const t = usePartnerText();
  return (
    <ActionButton
      intent="text"
      type="button"
      className={s.back}
      onClick={onClick}
    >
      ← {t("목록으로", "Back to list", "返回列表")}
    </ActionButton>
  );
}

export function PartnerDataStatus() {
  const { loading, error, refresh } = useAgencyPlanning();
  if (error)
    return (
      <div role="alert" className={s.notice}>
        {error}{" "}
        <button type="button" onClick={() => void refresh()}>
          다시 불러오기
        </button>
      </div>
    );
  if (loading) return <p role="status">정보를 불러오는 중…</p>;
  return null;
}
