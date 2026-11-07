"use client";

import { FormSelect } from "@futures-medialab/ui/form-select";
import { ActionButton } from "@futures-medialab/ui/action-button";
import { IconButton as MontageIconButton } from "@montage-ui/core";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Plus, Trash2, Users, CheckCircle2 } from "lucide-react";
import {
  formats,
  type ApplicationLine,
  type LocalApplication,
} from "./agency-planning-data";
import {
  useAgencyPlanning,
  usePartnerText,
  PartnerDataStatus,
  Modal,
  money,
} from "./agency-planning-context";
import s from "./agency-partner.module.css";

export type ApplicationCampaign = {
  id: string;
  title: string;
  currency: string;
  platforms: string[];
  supplierRateCap?: string | null;
};
export const sampleCampaign: ApplicationCampaign = {
  id: "sample-open",
  title: "오로라 온라인 · 크리에이터 모집",
  currency: "KRW",
  platforms: ["YouTube", "치지직", "SOOP", "TikTok"],
};
const platformName = (value: string) =>
  (
    ({
      youtube: "YouTube",
      chzzk: "치지직",
      soop: "SOOP",
      tiktok: "TikTok",
      instagram: "Instagram",
      twitch: "Twitch",
      x: "X",
      facebook: "Facebook",
    }) as Record<string, string>
  )[value.toLowerCase()] ?? value;
export function ApplicationComposerModal({
  campaign,
  draft,
  onClose,
}: {
  campaign: ApplicationCampaign;
  draft?: LocalApplication;
  onClose: () => void;
}) {
  const t = usePartnerText();
  const { applications } = useAgencyPlanning();
  const savedDraft =
    draft ??
    applications.find(
      (a) => a.campaignId === campaign.id && a.status === "draft",
    );
  return (
    <Modal
      title={t("크리에이터별 신청서", "Creator application", "按达人申请")}
      onClose={onClose}
      wide
    >
      <div className={s.dialogBody}>
        <AgencyApplicationComposer
          campaign={campaign}
          draft={savedDraft}
          onSaved={onClose}
        />
      </div>
    </Modal>
  );
}
export function AgencyApplicationComposer({
  campaign,
  draft,
  onSaved,
}: {
  campaign: ApplicationCampaign;
  draft?: LocalApplication;
  onSaved?: () => void;
}) {
  const { creators, canEdit, navigate, notify, locale, refresh, loading } =
      useAgencyPlanning(),
    t = usePartnerText();
  const supported = campaign.platforms.map(platformName),
    eligible = creators.filter(
      (c) => !supported.length || supported.includes(c.platform),
    );
  const makeLine = (): ApplicationLine => ({
    id: crypto.randomUUID(),
    creatorId: "",
    platform: "",
    format: "VOD",
    quantity: 1,
    rate: 0,
    date: "",
    status: "draft",
  });
  const [rows, setRows] = useState<ApplicationLine[]>(
    () =>
      draft?.lines.map((line) => ({ ...line })) ?? [
        {
          id: "first-row",
          creatorId: "",
          platform: "",
          format: "VOD",
          quantity: 1,
          rate: 0,
          date: "",
          status: "draft",
        },
      ],
  );
  const [note, setNote] = useState(draft?.note ?? ""),
    [review, setReview] = useState(false),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const savedId = useRef(draft?.id ?? ""),
    savedUpdatedAt = useRef(draft?.updated ?? ""),
    requestKey = useRef({ payload: "", id: "" }),
    formRef = useRef<HTMLFormElement>(null),
    errorRef = useRef<HTMLParagraphElement>(null);
  const total = rows.reduce((sum, row) => sum + row.quantity * row.rate, 0);
  function update(
    id: string,
    key: keyof ApplicationLine,
    value: string | number,
  ) {
    setReview(false);
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  }
  function choose(id: string, creatorId: string) {
    const creator = creators.find((c) => c.id === creatorId);
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              creatorId,
              platform: creator?.platform ?? "",
              format: creator?.format ?? "VOD",
              rate: campaign.currency === "KRW" ? (creator?.rate ?? 0) : 0,
              date: creator?.available ?? "",
            }
          : row,
      ),
    );
    setReview(false);
  }
  async function save(action: "saveDraft" | "apply") {
    if (!canEdit || busy || !formRef.current?.reportValidity()) return;
    setBusy(true);
    setError("");
    try {
      const canonical = (value: string) =>
        ({
          YouTube: "youtube",
          치지직: "chzzk",
          SOOP: "soop",
          TikTok: "tiktok",
          Instagram: "instagram",
        })[value] ?? value.toLowerCase();
      const fields = {
        action,
        campaignId: campaign.id,
        note,
        ...(savedId.current
          ? {
              applicationId: savedId.current,
              expectedUpdatedAt: savedUpdatedAt.current,
            }
          : {}),
        rows: rows.map((row) => ({
          creatorId: row.creatorId,
          platform: canonical(row.platform),
          format: row.format,
          quantity: row.quantity,
          unitAmount: String(row.rate),
          date: row.date,
        })),
      };
      const payload = JSON.stringify(fields);
      if (requestKey.current.payload !== payload)
        requestKey.current = { payload, id: crypto.randomUUID() };
      const response = await fetch("/api/agency/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          clientRequestId: requestKey.current.id,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "신청서를 저장하지 못했습니다.");
      await refresh();
      window.dispatchEvent(new Event("agency:applications-changed"));
      notify(
        action === "apply"
          ? t(
              "신청이 접수되었습니다. 퓨처스 검토 후 결과를 안내합니다.",
              "Application submitted for Futures review.",
              "申请已提交，等待 Futures 审核。",
            )
          : t("신청서 초안을 저장했습니다.", "Draft saved.", "草稿已保存。"),
      );
      onSaved?.();
      navigate("applications", result.id);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "신청서를 저장하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  function reviewForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    const keys = rows.map(
      (row) => `${row.creatorId}:${row.platform}:${row.format}`,
    );
    if (new Set(keys).size !== keys.length) {
      setError(
        t(
          "같은 크리에이터·채널·형식은 한 행에 수량을 합쳐 주세요.",
          "Combine quantities for the same creator, channel and format.",
          "同一达人、频道和形式请合并数量。",
        ),
      );
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setError("");
    setReview(true);
  }
  return (
    <section className={s.screen}>
      <PartnerDataStatus />
      <div className={s.composerHeading}>
        <span className={s.eyebrow}>
          {t("공급 파트너 신청", "Partner application", "供应合作伙伴申请")}
        </span>
        <h3>{campaign.title}</h3>
        <p className={s.muted}>
          {t(
            "소속 크리에이터와 수행 조건을 선택하세요. 퓨처스가 검토한 뒤 공식 제안으로 조율합니다.",
            "Choose represented creators and delivery terms. Futures reviews the application and coordinates the official proposal.",
            "选择所属达人与执行条件，Futures 审核后协调正式方案。",
          )}
        </p>
      </div>
      {campaign.supplierRateCap && (
        <p>
          {t(
            "건별 공급 단가 상한",
            "Maximum supplier rate per item",
            "每项供货单价上限",
          )}{" "}
          · {money(Number(campaign.supplierRateCap), campaign.currency, locale)}
        </p>
      )}
      {!canEdit && (
        <p className={s.notice}>
          {t(
            "소유자와 관리자만 신청서를 작성할 수 있습니다.",
            "Only owners and admins can prepare applications.",
            "仅所有者及管理员可填写申请。",
          )}
        </p>
      )}
      <form ref={formRef} onSubmit={reviewForm}>
        <fieldset disabled={!canEdit || review} className={s.formFields}>
          <div className={s.rowSectionHead}>
            <h3>
              <Users size={18} />
              {t("참여 크리에이터", "Participating creators", "参与达人")}{" "}
              <span>{rows.length}</span>
            </h3>
            <span className={s.muted}>
              {t(
                "공급 단가 · VAT 별도",
                "Supplier rate · excluding VAT",
                "供货单价 · 不含增值税",
              )}{" "}
              · {campaign.currency}
            </span>
          </div>
          {rows.map((row, index) => {
            const creator = creators.find((c) => c.id === row.creatorId);
            return (
              <div className={s.applicationLine} key={row.id}>
                <div className={s.lineTop}>
                  <strong>{String(index + 1).padStart(2, "0")}</strong>
                  {creator && (
                    <span className={s.muted}>
                      {creator.platform} · {creator.genre}
                    </span>
                  )}
                  <MontageIconButton
                    size="small"
                    data-fm-control="icon"
                    className={s.iconButton}
                    type="button"
                    disabled={rows.length === 1}
                    aria-label={`${index + 1} ${t("번 행 삭제", "Remove row", "删除行")}`}
                    onClick={() =>
                      setRows((current) =>
                        current.filter((item) => item.id !== row.id),
                      )
                    }
                  >
                    <Trash2 size={17} />
                  </MontageIconButton>
                </div>
                <div className={s.lineFields}>
                  <label className={s.field}>
                    <span>
                      {t(
                        "크리에이터 / 채널",
                        "Creator / channel",
                        "达人 / 频道",
                      )}{" "}
                      *
                    </span>
                    <FormSelect
                      required
                      aria-label={`${index + 1} ${t("번 크리에이터", "Creator", "达人")}`}
                      value={row.creatorId}
                      onChange={(event) => choose(row.id, event.target.value)}
                    >
                      <option value="">
                        {t(
                          "소속 크리에이터 선택",
                          "Select creator",
                          "选择所属达人",
                        )}
                      </option>
                      {eligible.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.platform}
                        </option>
                      ))}
                    </FormSelect>
                  </label>
                  <label className={s.field}>
                    <span>{t("형식", "Format", "形式")} *</span>
                    <FormSelect
                      aria-label={`${index + 1} ${t("번 콘텐츠 형식", "Format", "内容形式")}`}
                      value={row.format}
                      onChange={(event) =>
                        update(row.id, "format", event.target.value)
                      }
                    >
                      {formats.map((format) => (
                        <option key={format}>{format}</option>
                      ))}
                    </FormSelect>
                  </label>
                  <label className={s.field}>
                    <span>{t("수량", "Quantity", "数量")} *</span>
                    <input
                      aria-label={`${index + 1} ${t("번 수량", "Quantity", "数量")}`}
                      type="number"
                      min="1"
                      max="50"
                      step="1"
                      required
                      value={row.quantity || ""}
                      onChange={(event) =>
                        update(row.id, "quantity", Number(event.target.value))
                      }
                    />
                  </label>
                  <label className={s.field}>
                    <span>
                      {t("공급 단가", "Supplier rate", "供货单价")} (
                      {campaign.currency}) *
                    </span>
                    <input
                      aria-label={`${index + 1} ${t("번 공급 단가", "Supplier rate", "供货单价")}`}
                      type="number"
                      min="1"
                      max={campaign.supplierRateCap ?? "1000000000"}
                      step={campaign.currency === "KRW" ? "1" : "0.01"}
                      required
                      value={row.rate || ""}
                      placeholder="0"
                      onChange={(event) =>
                        update(row.id, "rate", Number(event.target.value))
                      }
                    />
                  </label>
                  <label className={s.field}>
                    <span>
                      {t("가능 일정", "Available date", "可用日期")} *
                    </span>
                    <input
                      aria-label={`${index + 1} ${t("번 가능 일정", "Available date", "可用日期")}`}
                      type="date"
                      min={creator?.available || undefined}
                      required
                      value={row.date}
                      onChange={(event) =>
                        update(row.id, "date", event.target.value)
                      }
                    />
                  </label>
                </div>
                <div className={s.lineBottom}>
                  <span>
                    {creator?.acceptance === "진행 불가"
                      ? t(
                          "현재 수용 조건을 확인해 주세요.",
                          "Check current availability before applying.",
                          "请确认当前合作条件。",
                        )
                      : creator
                        ? t(
                            "채널과 등록 단가를 불러왔습니다. 캠페인 조건에 맞춰 조정하세요.",
                            "Channel and registered rate loaded. Adjust for this campaign.",
                            "已填入频道与登记单价，请按活动条件调整。",
                          )
                        : t(
                            "캠페인에 맞는 크리에이터를 선택하세요.",
                            "Select a suitable creator.",
                            "请选择合适的达人。",
                          )}
                  </span>
                  <strong>
                    {money(row.quantity * row.rate, campaign.currency, locale)}
                  </strong>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className={s.addRow}
            disabled={rows.length >= 20}
            onClick={() => setRows((current) => [...current, makeLine()])}
          >
            <Plus size={17} />
            {t("크리에이터 행 추가", "Add creator row", "添加达人行")}
          </button>
          {!eligible.length && (
            <p className={s.error}>
              {t(
                "이 캠페인의 플랫폼에 등록된 소속 크리에이터가 없습니다.",
                "No represented creators on these platforms.",
                "这些平台暂无所属达人。",
              )}
            </p>
          )}
          <label className={s.field}>
            <span>{t("추가 전달 사항", "Additional notes", "补充说明")}</span>
            <textarea
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t(
                "일정, 사용권, 제작 조건 등 협의할 내용을 남겨 주세요.",
                "Add scheduling, usage rights or production questions.",
                "请填写日程、使用权或制作条件等协商事项。",
              )}
            />
          </label>
        </fieldset>
        <div className={s.composerTotal}>
          <span>
            {t(
              "제안 공급 금액 합계",
              "Total proposed supplier amount",
              "拟议供货金额合计",
            )}
          </span>
          <strong>{money(total, campaign.currency, locale)}</strong>
        </div>
        {error && (
          <p className={s.error} role="alert" tabIndex={-1} ref={errorRef}>
            {error}
          </p>
        )}
        {review ? (
          <div className={s.reviewNotice}>
            <CheckCircle2 size={22} />
            <div>
              <strong>
                {t(
                  "입력 내용을 확인해 주세요",
                  "Review the application",
                  "请确认申请内容",
                )}
              </strong>
              <p>
                {t(
                  "제출하면 퓨처스 운영팀에 접수됩니다. 후보 선정과 브랜드 승인을 거쳐 참여가 확정됩니다.",
                  "Submitting sends these terms to Futures. Participation is confirmed after review and brand approval.",
                  "提交后由 Futures 审核，广告主批准后确认参与。",
                )}
              </p>
            </div>
          </div>
        ) : null}
        <div className={s.formActions}>
          {review ? (
            <>
              <ActionButton
                intent="secondary"
                type="button"
                className={s.secondary}
                onClick={() => setReview(false)}
              >
                {t("내용 수정", "Edit", "修改内容")}
              </ActionButton>
              <ActionButton
                intent="primary"
                type="button"
                className={s.primary}
                disabled={!canEdit || busy || loading}
                onClick={() => void save("apply")}
              >
                {t("신청 제출", "Submit application", "提交申请")}
                <ArrowRight size={16} />
              </ActionButton>
            </>
          ) : (
            <>
              <ActionButton
                intent="secondary"
                type="button"
                className={s.secondary}
                disabled={!canEdit || busy || loading}
                onClick={() => void save("saveDraft")}
              >
                {t("임시 보관", "Keep draft", "暂存草稿")}
              </ActionButton>
              <ActionButton
                intent="primary"
                type="submit"
                className={s.primary}
                disabled={!canEdit || busy || loading || !eligible.length}
              >
                {t("신청서 검토", "Review application", "检查申请")}
                <ArrowRight size={16} />
              </ActionButton>
            </>
          )}
        </div>
      </form>
    </section>
  );
}
