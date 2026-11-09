"use client";

import { FormSelect } from "@futures-medialab/ui/form-select";
import { ActionButton } from "@futures-medialab/ui/action-button";
import { IconButton as MontageIconButton } from "@montage-ui/core";

import { useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Mail,
  MessageSquare,
  Plus,
  Search,
  Users,
  X,
  Pencil,
  AlertCircle,
} from "lucide-react";
import {
  type Creator,
  type LocalApplication,
  platforms,
  formats,
} from "./agency-planning-data";
import {
  useAgencyPlanning,
  usePartnerText,
  PartnerDataStatus,
  Status,
  CreatorAvatar,
  Empty,
  Modal,
  Back,
  money,
  localDate,
  today,
} from "./agency-planning-context";
import { ApplicationComposerModal } from "./agency-application-composer";
import s from "./agency-partner.module.css";
import { RequestWorkspace } from "../storage/_components/request-workspace";

function SearchBox({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label className={s.search}>
      <Search size={18} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        aria-label={label}
      />
      {value && (
        <MontageIconButton
          size="small"
          data-fm-control="icon"
          className={s.iconButton}
          type="button"
          aria-label="검색 초기화"
          onClick={() => onChange("")}
        >
          <X size={15} />
        </MontageIconButton>
      )}
    </label>
  );
}
function Summary({
  items,
}: {
  items: { label: string; value: number; icon: ReactNode }[];
}) {
  return (
    <div className={s.summary}>
      {items.map((item) => (
        <div className={s.summaryCard} key={item.label}>
          <div>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
          <span className={s.summaryIcon}>{item.icon}</span>
        </div>
      ))}
    </div>
  );
}
function Missing({
  section,
}: {
  section: "creators" | "invitations" | "applications" | "requests";
}) {
  const { navigate } = useAgencyPlanning(),
    t = usePartnerText();
  return (
    <Empty
      title={t(
        "이 항목을 찾을 수 없습니다",
        "This item is unavailable",
        "未找到该项目",
      )}
    >
      <ActionButton
        intent="secondary"
        className={s.secondary}
        onClick={() => navigate(section)}
      >
        {t("목록으로", "Back to list", "返回列表")}
      </ActionButton>
    </Empty>
  );
}
function isStale(creator: Creator) {
  return Date.parse(today()) - Date.parse(creator.updated) > 90 * 86400000;
}

export function AgencyCreatorsScreen() {
  const { creators, navigate, locale, canEdit, loading } = useAgencyPlanning(),
    t = usePartnerText(),
    params = useSearchParams();
  const [query, setQuery] = useState(""),
    [platform, setPlatform] = useState(""),
    [editor, setEditor] = useState<Creator | "new" | null>(null);
  const id = params.get("creator"),
    selected = creators.find((c) => c.id === id);
  const visible = creators.filter(
    (c) =>
      (!platform || c.platform === platform) &&
      `${c.name} ${c.genre}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  if (id && !selected && !loading) return <Missing section="creators" />;
  return (
    <section className={s.screen}>
      <PartnerDataStatus />
      {selected ? (
        <>
          <Back onClick={() => navigate("creators")} />
          <div className={s.profileHero}>
            <CreatorAvatar creator={selected} />
            <div>
              <span className={s.eyebrow}>
                {t("소속 크리에이터", "Represented creator", "所属达人")}
              </span>
              <h2>{selected.name}</h2>
              <p>
                {selected.platform} · {selected.genre}
              </p>
            </div>
            <ActionButton
              intent="primary"
              type="button"
              className={s.primary}
              disabled={!canEdit || loading}
              onClick={() => setEditor(selected)}
            >
              <Pencil size={16} />
              {t("프로필 수정", "Edit profile", "编辑资料")}
            </ActionButton>
          </div>
          <div className={s.detailGrid}>
            <div className={s.stack}>
              <section className={s.panel}>
                <h3>{t("채널 정보", "Channel information", "频道信息")}</h3>
                <dl className={s.facts}>
                  <div>
                    <dt>{t("플랫폼", "Platform", "平台")}</dt>
                    <dd>{selected.platform}</dd>
                  </div>
                  <div>
                    <dt>
                      {t(
                        "구독자 / 팔로워",
                        "Subscribers / followers",
                        "订阅者 / 粉丝",
                      )}
                    </dt>
                    <dd>{selected.followers.toLocaleString(locale)}</dd>
                  </div>
                  <div className={s.span2}>
                    <dt>{t("채널 주소", "Channel URL", "频道链接")}</dt>
                    <dd className={s.wrap}>{selected.channel}</dd>
                  </div>
                  <div className={s.span2}>
                    <dt>{t("소개", "About", "简介")}</dt>
                    <dd>{selected.bio || "—"}</dd>
                  </div>
                </dl>
              </section>
              <section className={s.panel}>
                <h3>
                  {t(
                    "공급 조건과 가용 일정",
                    "Supplier terms & availability",
                    "供货条件与档期",
                  )}
                </h3>
                <dl className={s.facts}>
                  <div>
                    <dt>{t("콘텐츠 형식", "Content format", "内容形式")}</dt>
                    <dd>{selected.format}</dd>
                  </div>
                  <div>
                    <dt>
                      {t(
                        "기준 공급 단가 · VAT 별도",
                        "Base rate · excluding VAT",
                        "基准供货价 · 不含税",
                      )}
                    </dt>
                    <dd>{money(selected.rate, "KRW", locale)}</dd>
                  </div>
                  <div>
                    <dt>{t("협업 가능일", "Available from", "可合作日期")}</dt>
                    <dd>{localDate(selected.available)}</dd>
                  </div>
                  <div>
                    <dt>
                      {t(
                        "중국 게임 광고",
                        "Chinese game campaigns",
                        "中国游戏广告",
                      )}
                    </dt>
                    <dd>{selected.acceptance}</dd>
                  </div>
                </dl>
                {isStale(selected) && (
                  <div className={s.warning}>
                    <AlertCircle size={18} />
                    {t(
                      "단가·가용성 갱신 후 90일이 지났습니다. 신청 전에 다시 확인해 주세요.",
                      "Rates and availability have not been updated for 90 days. Check before applying.",
                      "单价及档期超过90天未更新，申请前请确认。",
                    )}
                  </div>
                )}
              </section>
            </div>
            <aside className={s.stack}>
              <section className={s.panel}>
                <span className={s.eyebrow}>
                  {t("관리 정보", "Profile management", "管理信息")}
                </span>
                <h3>
                  {t(
                    "최신 정보로 제안하세요",
                    "Keep your proposals current",
                    "使用最新信息提案",
                  )}
                </h3>
                <p className={s.muted}>
                  {t(
                    "이 정보는 퓨처스의 후보 검토와 캠페인 신청에 사용됩니다.",
                    "Futures uses these details for sourcing and applications.",
                    "此信息用于 Futures 候选审核与活动申请。",
                  )}
                </p>
                <p className={s.small}>
                  {t("최근 갱신", "Last updated", "最近更新")} ·{" "}
                  {localDate(selected.updated)}
                </p>
                <ActionButton
                  intent="secondary"
                  className={s.secondary}
                  type="button"
                  onClick={() => navigate("applications")}
                >
                  {t("신청 현황 확인", "View applications", "查看申请")}
                  <ArrowRight size={16} />
                </ActionButton>
              </section>
              <section className={s.panel}>
                <h3>
                  {t(
                    "조건 확인이 필요하신가요?",
                    "Need to discuss terms?",
                    "需要确认条件？",
                  )}
                </h3>
                <ActionButton
                  intent="text"
                  className={s.textButton}
                  type="button"
                  onClick={() => navigate("requests", "new", selected.name)}
                >
                  {t("퓨처스에 문의", "Contact Futures", "联系 Futures")}
                  <ChevronRight size={16} />
                </ActionButton>
              </section>
            </aside>
          </div>
        </>
      ) : (
        <>
          <div className={s.heading}>
            <div>
              <h2>
                {t(
                  "우리 팀의 크리에이터",
                  "Your creator roster",
                  "团队达人名单",
                )}
              </h2>
              <p>
                {t(
                  "채널과 공급 조건을 관리하고, 맞는 캠페인에 함께 제안하세요.",
                  "Manage channels and supplier terms for your next campaign.",
                  "管理频道与供货条件，为下一次合作做好准备。",
                )}
              </p>
            </div>
            <ActionButton
              intent="primary"
              className={s.primary}
              type="button"
              disabled={!canEdit || loading}
              onClick={() => setEditor("new")}
            >
              <Plus size={17} />
              {t("크리에이터 등록", "Add creator", "添加达人")}
            </ActionButton>
          </div>
          <Summary
            items={[
              {
                label: t("소속 크리에이터", "Represented creators", "所属达人"),
                value: creators.length,
                icon: <Users size={21} />,
              },
              {
                label: t(
                  "협업 검토 가능",
                  "Open to collaboration",
                  "可协商合作",
                ),
                value: creators.filter((c) => c.acceptance !== "진행 불가")
                  .length,
                icon: <Check size={21} />,
              },
              {
                label: t("정보 갱신 필요", "Updates needed", "需更新资料"),
                value: creators.filter(isStale).length,
                icon: <Clock3 size={21} />,
              },
            ]}
          />
          <div className={s.toolbar}>
            <SearchBox
              value={query}
              onChange={setQuery}
              label={t(
                "크리에이터 이름 또는 장르 검색",
                "Search creator or genre",
                "搜索达人或类型",
              )}
            />
            <FormSelect
              aria-label={t("플랫폼 필터", "Platform filter", "平台筛选")}
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
            >
              <option value="">
                {t("전체 플랫폼", "All platforms", "全部平台")}
              </option>
              {platforms.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </FormSelect>
          </div>
          <div className={s.tablePanel}>
            <div
              className={s.tableScroll}
              tabIndex={0}
              role="region"
              aria-label={t(
                "소속 크리에이터 목록",
                "Creator roster",
                "所属达人列表",
              )}
            >
              <table className={s.table}>
                <thead>
                  <tr>
                    {[
                      t("크리에이터", "Creator", "达人"),
                      t("플랫폼 / 장르", "Platform / genre", "平台 / 类型"),
                      t("구독자·팔로워", "Followers", "粉丝"),
                      t("기준 공급 단가", "Base supplier rate", "基准供货价"),
                      t("가능 일정", "Availability", "档期"),
                      t("갱신 상태", "Updated", "更新状态"),
                    ].map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <button
                          type="button"
                          className={s.personButton}
                          onClick={() => navigate("creators", c.id)}
                        >
                          <CreatorAvatar creator={c} />
                          <span>
                            <strong>{c.name}</strong>
                            <small>{c.format}</small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <strong>{c.platform}</strong>
                        <small>{c.genre}</small>
                      </td>
                      <td>
                        {new Intl.NumberFormat(locale, {
                          notation: "compact",
                        }).format(c.followers)}
                      </td>
                      <td>
                        <strong>{money(c.rate, "KRW", locale)}</strong>
                        <small>
                          {t(
                            "1건 · VAT 별도",
                            "Per item · excl. VAT",
                            "每项 · 不含税",
                          )}
                        </small>
                      </td>
                      <td>
                        {localDate(c.available)}
                        <small>{c.acceptance}</small>
                      </td>
                      <td>
                        {isStale(c) ? (
                          <span className={`${s.badge} ${s.amber}`}>
                            {t("갱신 필요", "Update needed", "需更新")}
                          </span>
                        ) : (
                          <span className={`${s.badge} ${s.green}`}>
                            {t("확인됨", "Updated", "已更新")}
                          </span>
                        )}
                        <small>{localDate(c.updated)}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!visible.length && (
              <Empty
                title={t(
                  "조건에 맞는 크리에이터가 없습니다",
                  "No matching creators",
                  "无符合条件的达人",
                )}
              >
                <ActionButton
                  intent="secondary"
                  className={s.secondary}
                  onClick={() => {
                    setQuery("");
                    setPlatform("");
                  }}
                >
                  {t("필터 초기화", "Reset filters", "重置筛选")}
                </ActionButton>
              </Empty>
            )}
          </div>
        </>
      )}
      {editor && (
        <CreatorEditor
          creator={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
    </section>
  );
}

function CreatorEditor({
  creator,
  onClose,
}: {
  creator?: Creator;
  onClose: () => void;
}) {
  const { saveCreator, canEdit, notify } = useAgencyPlanning(),
    t = usePartnerText();
  const [form, setForm] = useState<Creator>(
    creator
      ? { ...creator }
      : {
          id: "",
          name: "",
          channel: "",
          platform: "YouTube",
          genre: "",
          followers: 0,
          format: "VOD",
          rate: 0,
          available: "",
          acceptance: "검토 가능",
          updated: today(),
          bio: "",
          color: "#e9e3ff",
        },
  );
  function change<K extends keyof Creator>(key: K, value: Creator[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || busy) return;
    setBusy(true);
    setError("");
    try {
      await saveCreator(form);
      notify(
        t(
          "크리에이터 정보를 저장했습니다.",
          "Creator saved.",
          "达人信息已保存。",
        ),
      );
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        creator
          ? t("크리에이터 수정", "Edit creator", "编辑达人")
          : t("크리에이터 등록", "Add creator", "添加达人")
      }
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className={s.dialogBody}>
        {error && (
          <p role="alert" className={s.error}>
            {error}
          </p>
        )}
        <PartnerDataStatus />
        <fieldset disabled={!canEdit || busy} className={s.formGrid}>
          <label className={s.field}>
            <span>{t("크리에이터 이름", "Creator name", "达人名称")} *</span>
            <input
              required
              maxLength={60}
              value={form.name}
              onChange={(e) => change("name", e.target.value)}
            />
          </label>
          <label className={s.field}>
            <span>{t("플랫폼", "Platform", "平台")} *</span>
            <FormSelect
              value={form.platform}
              onChange={(e) => change("platform", e.target.value)}
            >
              {platforms.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </FormSelect>
          </label>
          <label className={`${s.field} ${s.span2}`}>
            <span>{t("채널 URL", "Channel URL", "频道链接")} *</span>
            <input
              required
              type="url"
              pattern="https://.*"
              maxLength={2048}
              value={form.channel}
              onChange={(e) => change("channel", e.target.value)}
              placeholder="https://"
            />
          </label>
          <label className={s.field}>
            <span>{t("장르", "Genre", "类型")} *</span>
            <input
              required
              maxLength={80}
              value={form.genre}
              onChange={(e) => change("genre", e.target.value)}
              placeholder="RPG · 액션"
            />
          </label>
          <label className={s.field}>
            <span>{t("구독자 / 팔로워 수", "Followers", "粉丝数")} *</span>
            <input
              required
              type="number"
              min="0"
              max="1000000000"
              step="1"
              value={form.followers}
              onChange={(e) => change("followers", Number(e.target.value))}
            />
          </label>
          <label className={s.field}>
            <span>{t("콘텐츠 형식", "Content format", "内容形式")}</span>
            <FormSelect
              value={form.format}
              onChange={(e) => change("format", e.target.value)}
            >
              {formats.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </FormSelect>
          </label>
          <label className={s.field}>
            <span>
              {t(
                "기준 공급 단가 (KRW, VAT 별도)",
                "Base rate (KRW, excl. VAT)",
                "基准单价（KRW，不含税）",
              )}{" "}
              *
            </span>
            <input
              required
              type="number"
              min="1"
              max="1000000000"
              step="1"
              value={form.rate || ""}
              onChange={(e) => change("rate", Number(e.target.value))}
            />
          </label>
          <label className={s.field}>
            <span>{t("협업 가능일", "Available from", "可合作日期")} *</span>
            <input
              required
              type="date"
              value={form.available}
              onChange={(e) => change("available", e.target.value)}
            />
          </label>
          <label className={s.field}>
            <span>
              {t(
                "중국 게임 광고 수용",
                "Chinese game campaigns",
                "中国游戏广告合作",
              )}
            </span>
            <FormSelect
              value={form.acceptance}
              onChange={(e) => change("acceptance", e.target.value)}
            >
              {["검토 가능", "조건 협의", "진행 불가"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </FormSelect>
          </label>
          <label className={`${s.field} ${s.span2}`}>
            <span>
              {t(
                "소개와 협업 조건",
                "About & collaboration terms",
                "简介及合作条件",
              )}
            </span>
            <textarea
              rows={3}
              maxLength={1000}
              value={form.bio}
              onChange={(e) => change("bio", e.target.value)}
            />
          </label>
        </fieldset>
        <div className={s.formActions}>
          <ActionButton
            intent="secondary"
            className={s.secondary}
            type="button"
            onClick={onClose}
          >
            {t("취소", "Cancel", "取消")}
          </ActionButton>
          <ActionButton
            intent="primary"
            className={s.primary}
            type="submit"
            disabled={!canEdit || busy}
          >
            {t("저장", "Save", "保存")}
          </ActionButton>
        </div>
      </form>
    </Modal>
  );
}

export function AgencyInvitationsScreen() {
  const { locale, refresh } = useAgencyPlanning();
  return (
    <RequestWorkspace
      locale={locale}
      audience="agency"
      invitations
      onChanged={() => void refresh()}
    />
  );
}

export function AgencyApplicationsScreen({
  liveHistory,
}: {
  liveHistory: ReactNode;
}) {
  const {
      applications,
      creators,
      navigate,
      locale,
      canEdit,
      withdrawApplication,
      loading,
      notify,
    } = useAgencyPlanning(),
    t = usePartnerText(),
    params = useSearchParams();
  const [tab, setTab] = useState("preview"),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [composer, setComposer] = useState<LocalApplication | null>(null),
    [withdraw, setWithdraw] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const id = params.get("application"),
    selected = applications.find((a) => a.id === id);
  const shown = applications.filter(
    (a) =>
      (filter === "all" ||
        a.status === filter ||
        a.lines.some((row) => row.status === filter)) &&
      a.title.toLowerCase().includes(query.trim().toLowerCase()),
  );
  if (id && !selected && !loading) return <Missing section="applications" />;
  return (
    <section className={s.screen}>
      <PartnerDataStatus />
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      {selected ? (
        <>
          <Back onClick={() => navigate("applications")} />
          <div className={s.heading}>
            <div>
              <div className={s.inline}>
                <span className={s.eyebrow}>
                  {t("APPLICATION", "APPLICATION", "申请")}
                </span>
                <Status value={selected.status} />
              </div>
              <h2>{selected.title}</h2>
              <p>
                {t(
                  "크리에이터별 조건과 검토 상태를 확인하세요.",
                  "Review terms and status for each creator.",
                  "查看各达人条件与审核状态。",
                )}
              </p>
            </div>
            <ActionButton
              intent="secondary"
              className={s.secondary}
              onClick={() => navigate("requests", "new", selected.title)}
            >
              <MessageSquare size={17} />
              {t("신청 문의", "Ask about application", "咨询申请")}
            </ActionButton>
          </div>
          <div
            className={s.process}
            aria-label={t("신청 진행 순서", "Application process", "申请流程")}
          >
            {[
              t("신청 접수", "Submitted", "提交"),
              t("퓨처스 검토", "Futures review", "Futures 审核"),
              t("광고주 승인 대기", "Brand approval", "待广告主批准"),
              t("참여 확정", "Confirmed", "确认参与"),
            ].map((step, index) => (
              <span key={step}>
                <b>{index + 1}</b>
                {step}
                {index < 3 && <ChevronRight size={15} />}
              </span>
            ))}
          </div>
          <div className={s.tablePanel}>
            <div
              className={s.tableScroll}
              tabIndex={0}
              role="region"
              aria-label={t(
                "크리에이터별 신청 내역",
                "Application creator rows",
                "按达人申请记录",
              )}
            >
              <table className={s.table}>
                <thead>
                  <tr>
                    {[
                      t(
                        "크리에이터 / 채널",
                        "Creator / channel",
                        "达人 / 频道",
                      ),
                      t("형식·수량", "Format · quantity", "形式 · 数量"),
                      t("공급 단가", "Supplier rate", "供货单价"),
                      t("가능 일정", "Availability", "档期"),
                      t("행별 상태", "Row status", "行状态"),
                    ].map((v) => (
                      <th key={v}>{v}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.lines.map((row) => {
                    const creator = creators.find(
                      (c) => c.id === row.creatorId,
                    );
                    return (
                      <tr key={row.id}>
                        <td>
                          {creator ? (
                            <button
                              type="button"
                              className={s.personButton}
                              onClick={() => navigate("creators", creator.id)}
                            >
                              <CreatorAvatar creator={creator} />
                              <span>
                                <strong>{creator.name}</strong>
                                <small>{row.platform}</small>
                              </span>
                            </button>
                          ) : (
                            (row.creatorName ??
                            t("등록 정보 없음", "Unavailable", "信息不可用"))
                          )}
                        </td>
                        <td>
                          {row.format} · {row.quantity}
                        </td>
                        <td>
                          {money(row.rate, selected.currency, locale)}
                          <small>
                            {t("합계", "Subtotal", "小计")}{" "}
                            {money(
                              row.rate * row.quantity,
                              selected.currency,
                              locale,
                            )}
                          </small>
                        </td>
                        <td>{row.date ? localDate(row.date) : "—"}</td>
                        <td>
                          <Status value={row.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <section className={s.panel}>
            <div className={s.composerTotal}>
              <span>
                {t(
                  "제안 공급 금액 합계 · VAT 별도",
                  "Total supplier amount · excl. VAT",
                  "供货金额合计 · 不含税",
                )}
              </span>
              <strong>
                {money(
                  selected.lines.reduce(
                    (sum, row) => sum + row.rate * row.quantity,
                    0,
                  ),
                  selected.currency,
                  locale,
                )}
              </strong>
            </div>
            {selected.note && <p className={s.prose}>{selected.note}</p>}
            <p className={s.small}>
              {t("마지막 변경", "Last updated", "最后更新")} ·{" "}
              {localDate(selected.updated)}
            </p>
          </section>
          <div className={s.formActions}>
            {selected.canEdit ? (
              <ActionButton
                intent="primary"
                className={s.primary}
                type="button"
                disabled={!canEdit || busy}
                onClick={() => setComposer(selected)}
              >
                <Pencil size={16} />
                {t("신청서 수정", "Edit application", "修改申请")}
              </ActionButton>
            ) : null}
            {selected.status !== "draft" && selected.canWithdraw ? (
              <ActionButton
                intent="secondary"
                className={s.secondary}
                type="button"
                disabled={!canEdit || busy}
                onClick={() => setWithdraw(true)}
              >
                {t("신청 철회", "Withdraw application", "撤回申请")}
              </ActionButton>
            ) : null}
          </div>
          {withdraw && (
            <Modal
              title={t("신청 철회 확인", "Confirm withdrawal", "确认撤回")}
              onClose={() => setWithdraw(false)}
            >
              <div className={s.dialogBody}>
                <p>{selected.title}</p>
                <p className={s.muted}>
                  {t(
                    "이 신청을 철회합니다. 제출한 모든 크리에이터가 모집 검토에서 제외됩니다.",
                    "Withdraw this application and all its creator rows from recruitment.",
                    "撤回本次申请及所有达人行。",
                  )}
                </p>
                <div className={s.formActions}>
                  <ActionButton
                    intent="secondary"
                    className={s.secondary}
                    onClick={() => setWithdraw(false)}
                  >
                    {t("취소", "Cancel", "取消")}
                  </ActionButton>
                  <ActionButton
                    intent="primary"
                    className={s.primary}
                    disabled={!canEdit || busy}
                    onClick={async () => {
                      if (!canEdit || busy) return;
                      setBusy(true);
                      setError("");
                      try {
                        await withdrawApplication(selected.id);
                        setWithdraw(false);
                        notify(
                          t(
                            "신청을 철회했습니다.",
                            "Application withdrawn.",
                            "申请已撤回。",
                          ),
                        );
                      } catch (error) {
                        setError(
                          error instanceof Error
                            ? error.message
                            : "철회하지 못했습니다.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {t("신청 철회", "Withdraw application", "撤回申请")}
                  </ActionButton>
                </div>
              </div>
            </Modal>
          )}
        </>
      ) : (
        <>
          <div className={s.heading}>
            <div>
              <h2>
                {t(
                  "크리에이터별 신청 현황",
                  "Applications by creator",
                  "按达人查看申请",
                )}
              </h2>
              <p>
                {t(
                  "작성한 조건부터 참여 확정까지, 각 크리에이터의 진행 상황을 확인하세요.",
                  "Track each creator from proposed terms to confirmed participation.",
                  "从提议条件到确认参与，跟踪每位达人的进展。",
                )}
              </p>
            </div>
            <ActionButton
              intent="primary"
              className={s.primary}
              type="button"
              disabled={!canEdit || busy}
              onClick={() => navigate("offers")}
            >
              <Plus size={17} />
              {t("모집 공고 보기", "Browse offers", "查看招募")}
            </ActionButton>
          </div>
          <div
            className={s.topTabs}
            role="tablist"
            aria-label={t(
              "신청 내역 구분",
              "Application records",
              "申请记录类型",
            )}
          >
            {[
              [
                "preview",
                t("크리에이터별 신청", "Creator applications", "达人申请"),
              ],
              ["live", t("기존 접수 내역", "Submitted records", "已提交记录")],
            ].map(([value, label]) => (
              <button
                type="button"
                role="tab"
                aria-selected={tab === value}
                aria-controls="agency-application-panel"
                id={`agency-application-${value}`}
                className={tab === value ? s.activeTab : ""}
                key={value}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            id="agency-application-panel"
            role="tabpanel"
            aria-labelledby={`agency-application-${tab}`}
          >
            {tab === "live" ? (
              liveHistory
            ) : (
              <div className={s.screen}>
                <div className={s.toolbar}>
                  <SearchBox
                    label={t(
                      "신청한 캠페인 검색",
                      "Search applications",
                      "搜索申请活动",
                    )}
                    value={query}
                    onChange={setQuery}
                  />
                  <FormSelect
                    value={filter}
                    aria-label={t(
                      "신청 상태 필터",
                      "Application status filter",
                      "申请状态筛选",
                    )}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    {[
                      ["all", t("전체 상태", "All statuses", "全部状态")],
                      ["draft", t("작성 중", "Draft", "草稿")],
                      ["received", t("접수 완료", "Received", "已受理")],
                      ["selected", t("선정", "Selected", "已入选")],
                      [
                        "partially_confirmed",
                        t(
                          "일부 참여 확정",
                          "Partially confirmed",
                          "部分已确认",
                        ),
                      ],
                      ["expired", t("기한 만료", "Expired", "已过期")],
                      ["review", t("검토 중", "In review", "审核中")],
                      [
                        "brand_pending",
                        t(
                          "광고주 승인 대기",
                          "Awaiting brand approval",
                          "待广告主批准",
                        ),
                      ],
                      ["confirmed", t("참여 확정", "Confirmed", "已确认")],
                      ["not_selected", t("미선정", "Not selected", "未入选")],
                      ["withdrawn", t("철회", "Withdrawn", "已撤回")],
                    ].map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </FormSelect>
                </div>
                <div className={s.stack}>
                  {shown.map((app) => (
                    <article className={s.applicationCard} key={app.id}>
                      <div className={s.inline}>
                        <Status value={app.status} />
                        <span className={s.small}>
                          {localDate(app.updated)}
                        </span>
                      </div>
                      <div className={s.applicationCardBody}>
                        <div>
                          <h3>{app.title}</h3>
                          <p className={s.muted}>
                            {app.lines
                              .map(
                                (row) =>
                                  creators.find((c) => c.id === row.creatorId)
                                    ?.name ??
                                  row.creatorName ??
                                  t(
                                    "등록 정보 없음",
                                    "Unavailable",
                                    "信息不可用",
                                  ),
                              )
                              .join(" · ")}
                          </p>
                          <div className={s.tags}>
                            {[
                              ...new Set(app.lines.map((row) => row.status)),
                            ].map((value) => (
                              <Status key={value} value={value} />
                            ))}
                          </div>
                        </div>
                        <div className={s.applicationAmount}>
                          <strong>
                            {money(
                              app.lines.reduce(
                                (sum, row) => sum + row.quantity * row.rate,
                                0,
                              ),
                              app.currency,
                              locale,
                            )}
                          </strong>
                          <small>
                            {t(
                              "공급 제안 합계",
                              "Proposed supplier total",
                              "拟议供货合计",
                            )}
                          </small>
                          <ActionButton
                            intent="text"
                            className={s.textButton}
                            onClick={() => navigate("applications", app.id)}
                          >
                            {t("신청 상세", "Application details", "申请详情")}
                            <ArrowRight size={16} />
                          </ActionButton>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                {!shown.length && (
                  <Empty
                    title={t(
                      "해당 신청이 없습니다",
                      "No matching applications",
                      "无相关申请",
                    )}
                  />
                )}
              </div>
            )}
          </div>
        </>
      )}
      {composer && (
        <ApplicationComposerModal
          campaign={{
            id: composer.campaignId,
            title: composer.title,
            currency: composer.currency,
            platforms: composer.platforms ?? [],
            supplierRateCap: composer.supplierRateCap,
          }}
          draft={composer}
          onClose={() => setComposer(null)}
        />
      )}
    </section>
  );
}

export function AgencyRequestsScreen() {
  const { locale, refresh } = useAgencyPlanning();
  return (
    <RequestWorkspace
      locale={locale}
      audience="agency"
      onChanged={() => void refresh()}
    />
  );
}

export function AgencyActionSummary() {
  const { invitationCount, replyCount, navigate } = useAgencyPlanning(),
    t = usePartnerText();
  return (
    <div className={s.quickActions}>
      <div>
        <span className={s.eyebrow}>
          {t("다음 할 일", "NEXT ACTIONS", "下一步")}
        </span>
        <p>
          {t(
            "확인이 필요한 협업부터 시작하세요.",
            "Start with collaborations that need your attention.",
            "从需要您确认的合作开始。",
          )}
        </p>
      </div>
      <button onClick={() => navigate("invitations")}>
        <Mail size={18} />
        <span>{t("회신할 초대", "Invitations to reply", "待回复邀请")}</span>
        <strong>{invitationCount}</strong>
        <ChevronRight size={16} />
      </button>
      <button onClick={() => navigate("requests")}>
        <MessageSquare size={18} />
        <span>{t("문의 회신", "Requests to reply", "待回复咨询")}</span>
        <strong>{replyCount}</strong>
        <ChevronRight size={16} />
      </button>
      <button onClick={() => navigate("creators")}>
        <Users size={18} />
        <span>{t("소속 크리에이터", "Creator roster", "所属达人")}</span>
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
