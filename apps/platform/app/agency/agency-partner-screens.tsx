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
  Send,
  Users,
  X,
  Paperclip,
  Pencil,
  AlertCircle,
} from "lucide-react";
import {
  type Creator,
  type Invitation,
  type LocalApplication,
  type PartnerRequest,
  platforms,
  formats,
} from "./agency-planning-data";
import {
  useAgencyPlanning,
  usePartnerText,
  PreviewNotice,
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
  const { invitations, creators, navigate, locale, canEdit } =
      useAgencyPlanning(),
    t = usePartnerText(),
    params = useSearchParams();
  const [filter, setFilter] = useState("all"),
    [response, setResponse] = useState<
      "accepted" | "negotiating" | "declined" | null
    >(null);
  const id = params.get("invitation"),
    selected = invitations.find((item) => item.id === id),
    visible = invitations.filter(
      (item) => filter === "all" || item.status === filter,
    );
  if (id && !selected) return <Missing section="invitations" />;
  return (
    <section className={s.screen}>
      <PreviewNotice />
      {selected ? (
        <>
          <Back onClick={() => navigate("invitations")} />
          <div className={s.heading}>
            <div>
              <div className={s.inline}>
                <span className={s.eyebrow}>
                  {t(
                    "FUTURES 초대 오퍼",
                    "FUTURES INVITATION",
                    "FUTURES 合作邀请",
                  )}
                </span>
                <Status value={selected.status} />
              </div>
              <h2>{selected.title}</h2>
              <p>
                {t(
                  "퓨처스가 전달한 공급 조건을 확인하고 참여 가능 여부를 알려주세요.",
                  "Review the supplier terms from Futures and confirm your availability.",
                  "请确认 Futures 提供的供货条件并回复参与意向。",
                )}
              </p>
            </div>
          </div>
          <div className={s.detailGrid}>
            <div className={s.stack}>
              <section className={s.panel}>
                <h3>{t("캠페인 브리프", "Campaign brief", "活动简报")}</h3>
                <p className={s.prose}>{selected.brief}</p>
                <div className={s.tags}>
                  <span>{selected.category}</span>
                  {selected.platforms.map((p) => (
                    <span key={p}>{p}</span>
                  ))}
                </div>
              </section>
              <section className={s.panel}>
                <h3>{t("초대 크리에이터", "Invited creators", "受邀达人")}</h3>
                {selected.creatorIds.map((cid) => {
                  const c = creators.find((item) => item.id === cid);
                  return c ? (
                    <button
                      className={s.creatorStrip}
                      type="button"
                      onClick={() => navigate("creators", c.id)}
                      key={cid}
                    >
                      <CreatorAvatar creator={c} />
                      <span>
                        <strong>{c.name}</strong>
                        <small>
                          {c.platform} · {c.genre}
                        </small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  ) : null;
                })}
              </section>
              <section className={s.panel}>
                <h3>
                  {t(
                    "제작·공급 조건",
                    "Delivery & supplier terms",
                    "制作及供货条件",
                  )}
                </h3>
                <dl className={s.facts}>
                  <div>
                    <dt>{t("요청 콘텐츠", "Requested content", "内容要求")}</dt>
                    <dd>
                      {selected.format} · {selected.quantity}
                      {t("건 / 인", " per creator", "项 / 人")}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {t(
                        "제안 공급 단가 · VAT 별도",
                        "Supplier rate · excl. VAT",
                        "供货单价 · 不含税",
                      )}
                    </dt>
                    <dd>
                      {money(selected.rate, "KRW", locale)} /{" "}
                      {t("건", "item", "项")}
                    </dd>
                  </div>
                  <div className={s.span2}>
                    <dt>
                      {t(
                        "제작·게시 기간",
                        "Production & publication",
                        "制作及发布时间",
                      )}
                    </dt>
                    <dd>
                      {localDate(selected.start)} – {localDate(selected.end)}
                    </dd>
                  </div>
                  <div className={s.span2}>
                    <dt>
                      {t("사용권·활용 범위", "Usage rights", "使用权范围")}
                    </dt>
                    <dd>{selected.rights}</dd>
                  </div>
                </dl>
              </section>
              {selected.response && (
                <section className={s.panel}>
                  <h3>
                    {t("우리 조직의 회신", "Your response", "本组织回复")}
                  </h3>
                  <Status value={selected.status} />
                  <p className={s.prose}>{selected.response}</p>
                </section>
              )}
            </div>
            <aside className={s.stack}>
              <section className={`${s.panel} ${s.actionPanel}`}>
                <span className={s.eyebrow}>
                  {t("RESPONSE DUE", "RESPONSE DUE", "回复期限")}
                </span>
                <h3>
                  <Clock3 size={21} />
                  {localDate(selected.deadline)}
                </h3>
                <p className={s.muted}>
                  {t(
                    "참여 가능 회신 후 퓨처스가 일정과 조건을 조율합니다. 광고주 승인과 최종 배정은 별도로 확정됩니다.",
                    "Futures coordinates terms after your reply. Brand approval and final assignment are confirmed separately.",
                    "回复后 Futures 将协调条件，广告主批准与最终分配会另行确认。",
                  )}
                </p>
                {selected.status === "expired" ? (
                  <p className={s.warning}>
                    {t(
                      "회신 기한이 지난 초대입니다.",
                      "This invitation has expired.",
                      "邀请已过期。",
                    )}
                  </p>
                ) : (
                  <>
                    <ActionButton
                      intent="primary"
                      className={s.primary}
                      type="button"
                      disabled={
                        !canEdit ||
                        ["accepted", "declined"].includes(selected.status)
                      }
                      onClick={() => setResponse("accepted")}
                    >
                      <Check size={17} />
                      {t("참여 가능", "Available to participate", "可以参与")}
                    </ActionButton>
                    <ActionButton
                      intent="secondary"
                      className={s.secondary}
                      type="button"
                      disabled={
                        !canEdit ||
                        ["accepted", "declined"].includes(selected.status)
                      }
                      onClick={() => setResponse("negotiating")}
                    >
                      {t("조건 조정 요청", "Request changes", "请求调整条件")}
                    </ActionButton>
                    <ActionButton
                      intent="text"
                      className={s.textButton}
                      type="button"
                      disabled={
                        !canEdit ||
                        ["accepted", "declined"].includes(selected.status)
                      }
                      onClick={() => setResponse("declined")}
                    >
                      {t("참여 불가", "Unable to participate", "无法参与")}
                    </ActionButton>
                  </>
                )}
              </section>
              <ActionButton
                intent="secondary"
                className={s.secondary}
                type="button"
                onClick={() => navigate("requests", "new", selected.title)}
              >
                <MessageSquare size={17} />
                {t(
                  "이 초대 문의하기",
                  "Ask about this invitation",
                  "咨询此邀请",
                )}
              </ActionButton>
            </aside>
          </div>
          {response && (
            <InvitationResponse
              invitation={selected}
              action={response}
              onClose={() => setResponse(null)}
            />
          )}
        </>
      ) : (
        <>
          <div className={s.heading}>
            <div>
              <h2>
                {t(
                  "퓨처스가 제안한 협업",
                  "Collaboration from Futures",
                  "Futures 合作邀请",
                )}
              </h2>
              <p>
                {t(
                  "참여할 수 있는 크리에이터와 일정을 확인하고 회신하세요.",
                  "Review creators and schedules, then respond to each invitation.",
                  "确认可参与达人与档期后回复邀请。",
                )}
              </p>
            </div>
            <span className={`${s.badge} ${s.blue}`}>
              {t("비공개 초청", "Private invitations", "非公开邀请")}
            </span>
          </div>
          <Summary
            items={[
              {
                label: t("회신 대기", "Awaiting reply", "待回复"),
                value: invitations.filter((i) => i.status === "pending").length,
                icon: <Mail size={21} />,
              },
              {
                label: t("조건 협의 중", "Negotiating", "协商中"),
                value: invitations.filter((i) => i.status === "negotiating")
                  .length,
                icon: <MessageSquare size={21} />,
              },
              {
                label: t("참여 가능 회신", "Available replies", "已回复可参与"),
                value: invitations.filter((i) => i.status === "accepted")
                  .length,
                icon: <Check size={21} />,
              },
            ]}
          />
          <div
            className={s.filterTabs}
            role="group"
            aria-label={t("초대 상태", "Invitation status", "邀请状态")}
          >
            {[
              "all",
              "pending",
              "negotiating",
              "accepted",
              "declined",
              "expired",
            ].map((value) => (
              <button
                type="button"
                key={value}
                className={filter === value ? s.activeTab : ""}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {value === "all" ? (
                  t("전체", "All", "全部")
                ) : (
                  <Status value={value} />
                )}
              </button>
            ))}
          </div>
          <div className={s.invitationGrid}>
            {visible.map((item) => (
              <article className={s.invitationCard} key={item.id}>
                <div className={s.inline}>
                  <Status value={item.status} />
                  <span className={s.small}>
                    {t("회신", "Reply by", "回复期限")}{" "}
                    {localDate(item.deadline)}
                  </span>
                </div>
                <span className={s.eyebrow}>{item.category}</span>
                <h3>{item.title}</h3>
                <div className={s.avatarRow}>
                  {item.creatorIds.map((cid) => {
                    const c = creators.find((c) => c.id === cid);
                    return c ? (
                      <span key={cid}>
                        <CreatorAvatar creator={c} />
                        {c.name}
                      </span>
                    ) : null;
                  })}
                </div>
                <dl className={s.cardFacts}>
                  <div>
                    <dt>{t("콘텐츠", "Content", "内容")}</dt>
                    <dd>
                      {item.format} · {item.quantity}
                      {t("건 / 인", " per creator", "项 / 人")}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("공급 단가", "Supplier rate", "供货单价")}</dt>
                    <dd>{money(item.rate, "KRW", locale)}</dd>
                  </div>
                </dl>
                <ActionButton
                  intent="secondary"
                  className={s.secondary}
                  type="button"
                  onClick={() => navigate("invitations", item.id)}
                >
                  {t("조건 확인", "Review terms", "查看条件")}
                  <ArrowRight size={16} />
                </ActionButton>
              </article>
            ))}
          </div>
          {!visible.length && (
            <Empty
              title={t(
                "해당 상태의 초대가 없습니다",
                "No invitations in this status",
                "此状态下暂无邀请",
              )}
            />
          )}
        </>
      )}
    </section>
  );
}
function InvitationResponse({
  invitation,
  action,
  onClose,
}: {
  invitation: Invitation;
  action: "accepted" | "negotiating" | "declined";
  onClose: () => void;
}) {
  const { setInvitations, canEdit, notify } = useAgencyPlanning(),
    t = usePartnerText();
  const [note, setNote] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setInvitations((current) =>
      current.map((item) =>
        item.id === invitation.id
          ? {
              ...item,
              status: action,
              response:
                note.trim() ||
                t(
                  "안내된 조건으로 참여 가능합니다. 최종 확정을 기다립니다.",
                  "Available under the proposed terms, pending final confirmation.",
                  "可以按提议条件参与，等待最终确认。",
                ),
            }
          : item,
      ),
    );
    notify(
      t(
        "회신 예시를 반영했습니다. 실제 전송되지 않았습니다.",
        "Response preview updated. Nothing was sent.",
        "回复预览已更新，未实际发送。",
      ),
    );
    onClose();
  }
  return (
    <Modal
      title={
        action === "accepted"
          ? t("참여 가능 회신", "Confirm availability", "回复可参与")
          : action === "negotiating"
            ? t("조건 조정 요청", "Request changes", "请求调整条件")
            : t("참여 불가 회신", "Decline invitation", "回复无法参与")
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className={s.dialogBody}>
        <PreviewNotice />
        <h3>{invitation.title}</h3>
        <p className={s.muted}>
          {t(
            "선택한 초대에 대한 회신 예시입니다. 최종 배정이나 계약 체결을 의미하지 않습니다.",
            "Preview a reply to this invitation. This is not a final assignment or contract.",
            "此为邀请回复预览，不代表最终分配或合同。",
          )}
        </p>
        <label className={s.field}>
          <span>
            {action === "accepted"
              ? t("전달 사항 (선택)", "Notes (optional)", "说明（选填）")
              : t(
                  "조정 내용 또는 사유",
                  "Requested changes or reason",
                  "调整内容或原因",
                )}{" "}
            {action !== "accepted" ? "*" : ""}
          </span>
          <textarea
            rows={4}
            maxLength={2000}
            required={action !== "accepted"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
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
            disabled={!canEdit || (action !== "accepted" && !note.trim())}
          >
            {t("회신 미리보기 반영", "Apply reply preview", "应用回复预览")}
          </ActionButton>
        </div>
      </form>
    </Modal>
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
            {selected.status === "draft" ? (
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
            ) : selected.canWithdraw ? (
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
  const {
      requests,
      setRequests,
      navigate,
      canEdit,
      notify,
      invitations,
      applications,
      locale,
    } = useAgencyPlanning(),
    t = usePartnerText(),
    params = useSearchParams();
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [reply, setReply] = useState("");
  const id = params.get("request"),
    isNew = id === "new",
    selected = requests.find((r) => r.id === id),
    visible = requests.filter(
      (r) =>
        (filter === "all" ||
          r.status === filter ||
          (filter === "progress" && r.status === "received")) &&
        `${r.subject} ${r.related}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    );
  if (id && !isNew && !selected) return <Missing section="requests" />;
  function sendReply(e: FormEvent) {
    e.preventDefault();
    if (!selected || !reply.trim() || !canEdit) return;
    const message = {
      id: crypto.randomUUID(),
      sender: "agency" as const,
      text: reply.trim(),
      time: new Date().toISOString(),
    };
    setRequests((current) =>
      current.map((r) =>
        r.id === selected.id
          ? { ...r, status: "progress", messages: [...r.messages, message] }
          : r,
      ),
    );
    setReply("");
    notify(
      t(
        "회신을 화면에 반영했습니다. 실제 전송되지 않았습니다.",
        "Reply added to the preview. Nothing was sent.",
        "回复已添加至预览，未实际发送。",
      ),
    );
  }
  return (
    <section className={s.screen}>
      <PreviewNotice />
      <div className={s.heading}>
        <div>
          <h2>{t("퓨처스 문의함", "Contact Futures", "Futures 咨询中心")}</h2>
          <p>
            {t(
              "협업 조건, 일정, 제작물과 정산 문의를 한곳에서 이어갑니다.",
              "Keep questions about terms, schedules, content and payouts together.",
              "集中沟通合作条件、日程、制作物与结算问题。",
            )}
          </p>
        </div>
        <ActionButton
          intent="primary"
          className={s.primary}
          type="button"
          disabled={!canEdit}
          onClick={() => navigate("requests", "new")}
        >
          <Plus size={17} />
          {t("새 문의", "New request", "新建咨询")}
        </ActionButton>
      </div>
      <Summary
        items={[
          {
            label: t("회신 필요", "Reply needed", "需要回复"),
            value: requests.filter((r) => r.status === "waiting").length,
            icon: <MessageSquare size={21} />,
          },
          {
            label: t("처리 중", "In progress", "处理中"),
            value: requests.filter((r) =>
              ["progress", "received"].includes(r.status),
            ).length,
            icon: <Clock3 size={21} />,
          },
          {
            label: t("처리 완료", "Resolved", "已处理"),
            value: requests.filter((r) => r.status === "resolved").length,
            icon: <Check size={21} />,
          },
        ]}
      />
      <div className={s.toolbar}>
        <SearchBox
          label={t(
            "문의 제목 또는 관련 캠페인 검색",
            "Search subject or campaign",
            "搜索主题或活动",
          )}
          value={query}
          onChange={setQuery}
        />
        <FormSelect
          value={filter}
          aria-label={t("문의 상태", "Request status", "咨询状态")}
          onChange={(e) => setFilter(e.target.value)}
        >
          {[
            ["all", t("전체 상태", "All statuses", "全部状态")],
            ["waiting", t("회신 필요", "Reply needed", "需要回复")],
            ["progress", t("처리 중", "In progress", "处理中")],
            ["resolved", t("처리 완료", "Resolved", "已处理")],
          ].map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </FormSelect>
      </div>
      <div className={`${s.inbox} ${selected ? s.inboxSelected : ""}`}>
        <div className={s.threadList}>
          {visible.map((r) => (
            <button
              type="button"
              key={r.id}
              className={`${s.threadListItem} ${selected?.id === r.id ? s.threadActive : ""}`}
              onClick={() => {
                setReply("");
                navigate("requests", r.id);
              }}
            >
              <div className={s.inline}>
                <Status value={r.status} />
                <small>{localDate(r.messages.at(-1)?.time ?? "")}</small>
              </div>
              <strong>{r.subject}</strong>
              <span>{r.related}</span>
              <p>{r.messages.at(-1)?.text}</p>
            </button>
          ))}
          {!visible.length && (
            <Empty title={t("문의가 없습니다", "No requests", "暂无咨询")} />
          )}
        </div>
        <div className={s.threadDetail}>
          {selected ? (
            <>
              <div className={s.threadHeader}>
                <ActionButton
                  intent="text"
                  className={`${s.back} ${s.mobileBack}`}
                  onClick={() => navigate("requests")}
                >
                  ← {t("문의 목록", "Requests", "咨询列表")}
                </ActionButton>
                <div className={s.inline}>
                  <Status value={selected.status} />
                  <span className={s.small}>{selected.category}</span>
                </div>
                <h3>{selected.subject}</h3>
                <p>{selected.related}</p>
                <div className={s.inline}>
                  {invitations.some((i) => i.title === selected.related) ? (
                    <ActionButton
                      intent="text"
                      className={s.textButton}
                      onClick={() =>
                        navigate(
                          "invitations",
                          invitations.find((i) => i.title === selected.related)!
                            .id,
                        )
                      }
                    >
                      {t("관련 초대 보기", "View invitation", "查看邀请")}
                      <ArrowRight size={15} />
                    </ActionButton>
                  ) : applications.some((a) => a.title === selected.related) ? (
                    <ActionButton
                      intent="text"
                      className={s.textButton}
                      onClick={() =>
                        navigate(
                          "applications",
                          applications.find(
                            (a) => a.title === selected.related,
                          )!.id,
                        )
                      }
                    >
                      {t("관련 신청 보기", "View application", "查看申请")}
                      <ArrowRight size={15} />
                    </ActionButton>
                  ) : null}
                  {selected.status !== "resolved" && (
                    <ActionButton
                      intent="text"
                      type="button"
                      className={s.textButton}
                      disabled={!canEdit}
                      onClick={() => {
                        if (!canEdit) return;
                        setRequests((current) =>
                          current.map((r) =>
                            r.id === selected.id
                              ? { ...r, status: "resolved" }
                              : r,
                          ),
                        );
                        notify(
                          t(
                            "처리 완료 상태를 반영했습니다.",
                            "Marked resolved in preview.",
                            "已在预览中标记为已处理。",
                          ),
                        );
                      }}
                    >
                      {t("처리 완료로 표시", "Mark resolved", "标记已处理")}
                    </ActionButton>
                  )}
                </div>
              </div>
              <div className={s.messages}>
                {selected.messages.map((message) => (
                  <article
                    key={message.id}
                    className={`${s.message} ${message.sender === "agency" ? s.ownMessage : ""}`}
                  >
                    <div>
                      <span className={s.messageAvatar}>
                        {message.sender === "agency" ? "A" : "F"}
                      </span>
                      <strong>
                        {message.sender === "agency"
                          ? t("우리 조직", "Your team", "本组织")
                          : "Futures"}
                      </strong>
                      <time>
                        {new Intl.DateTimeFormat(locale, {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Asia/Seoul",
                        }).format(new Date(message.time))}{" "}
                        KST
                      </time>
                    </div>
                    <p>{message.text}</p>
                    {message.files?.map((file, index) => (
                      <span className={s.fileChip} key={`${file}-${index}`}>
                        <Paperclip size={13} />
                        {file} ·{" "}
                        {t("첨부 예시", "Preview attachment", "附件预览")}
                      </span>
                    ))}
                  </article>
                ))}
              </div>
              <form className={s.replyForm} onSubmit={sendReply}>
                <label className={s.field}>
                  <span>{t("회신 내용", "Reply", "回复内容")}</span>
                  <textarea
                    rows={3}
                    required
                    maxLength={3000}
                    value={reply}
                    disabled={!canEdit}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={t(
                      "퓨처스에 전달할 내용을 작성하세요.",
                      "Write your reply to Futures.",
                      "请填写回复 Futures 的内容。",
                    )}
                  />
                </label>
                <div className={s.replyActions}>
                  <span>
                    {t(
                      "미리보기 · 실제 전송 없음",
                      "Preview · not sent",
                      "预览 · 不会发送",
                    )}
                  </span>
                  <ActionButton
                    intent="primary"
                    className={s.primary}
                    type="submit"
                    disabled={!canEdit || !reply.trim()}
                  >
                    <Send size={15} />
                    {t("회신 미리보기", "Preview reply", "预览回复")}
                  </ActionButton>
                </div>
              </form>
            </>
          ) : (
            <Empty
              title={t(
                "확인할 문의를 선택하세요",
                "Select a request",
                "请选择咨询",
              )}
            >
              <p>
                {t(
                  "퓨처스의 답변과 관련 업무를 함께 확인할 수 있습니다.",
                  "Read replies from Futures alongside the related work.",
                  "可同时查看 Futures 回复与相关业务。",
                )}
              </p>
            </Empty>
          )}
        </div>
      </div>
      {isNew && (
        <NewRequest
          related={params.get("related") ?? ""}
          onClose={() => navigate("requests")}
        />
      )}
    </section>
  );
}
function NewRequest({
  related,
  onClose,
}: {
  related: string;
  onClose: () => void;
}) {
  const {
      setRequests,
      canEdit,
      navigate,
      notify,
      invitations,
      applications,
      creators,
    } = useAgencyPlanning(),
    t = usePartnerText();
  const [subject, setSubject] = useState(""),
    [category, setCategory] = useState("제작 조건"),
    [relation, setRelation] = useState(related),
    [body, setBody] = useState(""),
    [files, setFiles] = useState<string[]>([]),
    [fileError, setFileError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || !subject.trim() || !body.trim() || fileError) return;
    const id = crypto.randomUUID();
    const item: PartnerRequest = {
      id,
      subject: subject.trim(),
      category,
      related: relation.trim() || t("일반 문의", "General request", "一般咨询"),
      status: "received",
      messages: [
        {
          id: crypto.randomUUID(),
          sender: "agency",
          text: body.trim(),
          time: new Date().toISOString(),
          files,
        },
      ],
    };
    setRequests((current) => [item, ...current]);
    notify(
      t(
        "문의 미리보기를 만들었습니다. 실제 접수되지 않았습니다.",
        "Request preview created. Nothing was submitted.",
        "咨询预览已创建，未实际提交。",
      ),
    );
    navigate("requests", id);
  }
  return (
    <Modal
      title={t("새 문의 작성", "New request", "新建咨询")}
      onClose={onClose}
      wide
    >
      <form className={s.dialogBody} onSubmit={submit}>
        <PreviewNotice />
        <fieldset className={s.formGrid} disabled={!canEdit}>
          <label className={s.field}>
            <span>{t("문의 유형", "Request type", "咨询类型")}</span>
            <FormSelect
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {[
                "제작 조건",
                "일정 변경",
                "크리에이터 교체",
                "제작물 검수",
                "정산 문의",
                "기타",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </FormSelect>
          </label>
          <label className={s.field}>
            <span>
              {t(
                "관련 캠페인 / 크리에이터",
                "Related campaign / creator",
                "相关活动 / 达人",
              )}
            </span>
            <input
              list="agency-request-relations"
              value={relation}
              maxLength={180}
              onChange={(e) => setRelation(e.target.value)}
              placeholder={t(
                "선택하거나 직접 입력",
                "Select or type",
                "选择或输入",
              )}
            />
            <datalist id="agency-request-relations">
              {[
                ...new Set([
                  ...invitations.map((i) => i.title),
                  ...applications.map((a) => a.title),
                  ...creators.map((c) => c.name),
                ]),
              ].map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <label className={`${s.field} ${s.span2}`}>
            <span>{t("제목", "Subject", "标题")} *</span>
            <input
              required
              maxLength={120}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label className={`${s.field} ${s.span2}`}>
            <span>{t("문의 내용", "Message", "咨询内容")} *</span>
            <textarea
              rows={5}
              required
              maxLength={4000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <label className={`${s.field} ${s.span2}`}>
            <span>
              {t(
                "참고 자료 선택 (미리보기)",
                "Attachments (preview)",
                "参考资料（预览）",
              )}
            </span>
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx"
              onChange={(e) => {
                const list = [...(e.target.files ?? [])];
                if (
                  list.length > 5 ||
                  list.some((file) => file.size > 10 * 1024 * 1024)
                ) {
                  setFileError(
                    t(
                      "파일은 최대 5개, 각 10MB까지 선택할 수 있습니다.",
                      "Select up to 5 files, 10 MB each.",
                      "最多选择5个文件，每个不超过10MB。",
                    ),
                  );
                  setFiles([]);
                  return;
                }
                setFileError("");
                setFiles(list.map((file) => file.name));
              }}
            />
            <small>
              {t(
                "최대 5개 · 각 10MB · 파일명만 미리보기에 표시됩니다.",
                "Up to 5 files, 10 MB each. Only filenames appear in the preview.",
                "最多5个文件，每个10MB，预览仅显示文件名。",
              )}
            </small>
          </label>
        </fieldset>
        {fileError && (
          <p className={s.error} role="alert">
            {fileError}
          </p>
        )}
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
            disabled={
              !canEdit || !subject.trim() || !body.trim() || Boolean(fileError)
            }
          >
            {t(
              "문의 미리보기 만들기",
              "Create request preview",
              "创建咨询预览",
            )}
            <ArrowRight size={16} />
          </ActionButton>
        </div>
      </form>
    </Modal>
  );
}

export function AgencyActionSummary() {
  const { invitations, requests, navigate } = useAgencyPlanning(),
    t = usePartnerText();
  return (
    <div className={s.quickActions}>
      <div>
        <span className={s.eyebrow}>
          {t("다음 할 일 · 예시", "NEXT ACTIONS · EXAMPLES", "下一步 · 示例")}
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
        <strong>
          {invitations.filter((i) => i.status === "pending").length}
        </strong>
        <ChevronRight size={16} />
      </button>
      <button onClick={() => navigate("requests")}>
        <MessageSquare size={18} />
        <span>{t("문의 회신", "Requests to reply", "待回复咨询")}</span>
        <strong>{requests.filter((r) => r.status === "waiting").length}</strong>
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
