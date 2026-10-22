"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Users } from "lucide-react";
import type { Locale } from "../../_components/landing-copy";
import type { BrandCampaignApplication } from "../../../lib/campaign-marketplace-types";
type Decision = "shortlist" | "accept" | "reject";

export function CampaignApplications({
  campaignId,
  campaignStatus,
  locale,
  canEdit,
  busy,
  onMutate,
}: {
  campaignId: string;
  campaignStatus: string;
  locale: Locale;
  canEdit: boolean;
  busy: boolean;
  onMutate: (endpoint: string, body: unknown) => Promise<boolean>;
}) {
  const t = (en: string, ko: string, zh: string) =>
    locale === "ko" ? ko : locale === "zh" ? zh : en;
  const [applications, setApplications] = useState<
    BrandCampaignApplication[] | null
  >(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    action: Decision;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const canReview =
    canEdit && ["RECRUITING", "IN_PROGRESS"].includes(campaignStatus);
  const labels: Record<string, string> = {
    SUBMITTED: t("Submitted", "신청 접수", "已提交"),
    SHORTLISTED: t("Shortlisted", "검토 후보", "候选"),
    ACCEPTED: t("Selected", "선정", "已选定"),
    REJECTED: t("Not selected", "미선정", "未选定"),
    WITHDRAWN: t("Withdrawn", "신청 철회", "已撤回"),
  };
  const decisions: Record<Decision, string> = {
    shortlist: t("Shortlist", "후보로 지정", "列为候选"),
    accept: t("Select agency", "에이전시 선정", "选定代理机构"),
    reject: t("Decline", "미선정 처리", "不予选定"),
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/workspace/campaign-applications?campaignId=${encodeURIComponent(campaignId)}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Applications unavailable");
        const data = await response.json();
        if (!Array.isArray(data.applications))
          throw new Error("Invalid application response");
        if (!controller.signal.aborted) {
          setApplications(data.applications);
          setLoadError(false);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadError(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [campaignId, revision]);

  function reload() {
    setLoading(true);
    setLoadError(false);
    setRevision((current) => current + 1);
  }

  async function decide(applicationId: string, action: Decision) {
    setNotice("");
    const saved = await onMutate("/api/workspace/campaign-applications", {
      action,
      applicationId,
    });
    setConfirmation(null);
    if (saved) {
      setNotice(
        t(
          "Application status saved.",
          "신청 상태를 저장했습니다.",
          "报名状态已保存。",
        ),
      );
      reload();
    } else {
      setNotice(
        t(
          "Could not update the application. Refresh the list and try again.",
          "신청 상태를 변경하지 못했습니다. 목록을 새로고침한 후 다시 시도해 주세요.",
          "更新失败，请刷新列表后重试。",
        ),
      );
    }
  }

  return (
    <section
      id={`applications-${campaignId}`}
      className="cw-tools-applications"
      aria-label={t(
        "Agency applications",
        "에이전시 신청 내역",
        "代理机构报名列表",
      )}
      aria-busy={loading}
    >
      <div className="cw-toolbar">
        <h4>
          <Users size={19} aria-hidden="true" />
          {t("Applications", "신청 내역", "报名列表")}
        </h4>
        <button
          type="button"
          className="cw-button"
          onClick={reload}
          disabled={loading || busy}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {t("Refresh", "새로고침", "刷新")}
        </button>
      </div>
      <p className="cw-tools-muted">
        {t(
          "Proposals are handled through the platform. Selecting an agency records your decision; it does not create a contract, reserve a budget, or transfer money.",
          "신청과 제안은 플랫폼을 통해 관리됩니다. 에이전시 선정은 선택 결과만 기록하며 계약 체결·예산 확보·송금을 의미하지 않습니다.",
          "报名和提案通过平台管理。选定代理机构仅记录选择结果，并不签订合同、预留预算或转账。",
        )}
      </p>
      {notice && (
        <p className="cw-tools-application-notice" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">
          {t(
            "Loading applications…",
            "신청 내역을 불러오는 중…",
            "正在加载报名…",
          )}
        </p>
      ) : loadError ? (
        <p className="cw-tools-form-error" role="alert">
          {t(
            "Could not load applications. Use Refresh to retry.",
            "신청 내역을 불러오지 못했습니다. 새로고침으로 다시 시도해 주세요.",
            "无法加载报名，请点击刷新重试。",
          )}
        </p>
      ) : applications?.length === 0 ? (
        <p className="cw-tools-muted">
          {t(
            "No applications yet. Approved campaigns appear in the agency workspace while recruiting.",
            "아직 신청 내역이 없습니다. 승인된 캠페인은 모집 기간 동안 에이전시 화면에 표시됩니다.",
            "暂无报名。审核通过的活动将在招募期间显示在代理机构工作区。",
          )}
        </p>
      ) : (
        <div className="cw-tools-application-list">
          {applications?.map((application) => (
            <article key={application.id}>
              <div className="cw-toolbar">
                <h4>{application.agencyLabel}</h4>
                <span className="cw-tag">
                  {labels[application.status] ?? application.status}
                </span>
              </div>
              <p className="cw-tools-pre-line">{application.proposal}</p>
              <div className="cw-toolbar">
                <p className="cw-tools-muted">
                  {new Intl.DateTimeFormat(
                    locale === "ko"
                      ? "ko-KR"
                      : locale === "zh"
                        ? "zh-CN"
                        : "en-US",
                    { dateStyle: "medium", timeStyle: "short" },
                  ).format(new Date(application.createdAt))}
                </p>
                <strong>
                  {application.proposedAmount
                    ? `${application.currency} ${application.proposedAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
                    : t("No amount proposed", "제안 금액 없음", "未提供报价")}
                </strong>
              </div>
              {canReview &&
                ["SUBMITTED", "SHORTLISTED"].includes(application.status) && (
                  <div className="cw-tools-actions">
                    {confirmation?.id === application.id ? (
                      <>
                        <span>{decisions[confirmation.action]}?</span>
                        <button
                          type="button"
                          className="cw-button cw-button-primary"
                          disabled={busy || loading}
                          onClick={() =>
                            void decide(application.id, confirmation.action)
                          }
                        >
                          {t("Confirm", "확정", "确认")}
                        </button>
                        <button
                          type="button"
                          className="cw-button"
                          disabled={busy}
                          onClick={() => setConfirmation(null)}
                        >
                          {t(
                            "Keep current status",
                            "기존 상태 유지",
                            "保持当前状态",
                          )}
                        </button>
                      </>
                    ) : (
                      <>
                        {application.status === "SUBMITTED" && (
                          <button
                            type="button"
                            className="cw-button"
                            disabled={busy || loading}
                            onClick={() =>
                              void decide(application.id, "shortlist")
                            }
                          >
                            {decisions.shortlist}
                          </button>
                        )}
                        <button
                          type="button"
                          className="cw-button cw-button-primary"
                          disabled={busy || loading}
                          onClick={() =>
                            setConfirmation({
                              id: application.id,
                              action: "accept",
                            })
                          }
                        >
                          {decisions.accept}
                        </button>
                        <button
                          type="button"
                          className="cw-button"
                          disabled={busy || loading}
                          onClick={() =>
                            setConfirmation({
                              id: application.id,
                              action: "reject",
                            })
                          }
                        >
                          {decisions.reject}
                        </button>
                      </>
                    )}
                  </div>
                )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
