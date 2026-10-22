"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Check,
  Copy,
  Download,
  Folder,
  Link2,
  MessageSquareText,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { Locale } from "../../_components/landing-copy";
import type {
  WorkspaceBootstrap,
  WorkspaceCampaign,
} from "../../../lib/workspace-types";
import { ProfileSelect } from "../../onboarding/brand/profile-select";
import { CampaignApplications } from "./campaign-applications";
import "./workspace-tools.css";

type ToolMode = "collect" | "links" | "campaigns" | "agent" | "account";
type Props = {
  mode: ToolMode;
  locale: Locale;
  data: WorkspaceBootstrap;
  onMutate: (endpoint: string, body: unknown) => Promise<boolean>;
  busy: boolean;
};
type ViewProps = Omit<Props, "mode">;
const text = (locale: Locale, en: string, ko: string, zh: string) =>
  locale === "ko" ? ko : locale === "zh" ? zh : en;

function displayDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(
    locale === "ko" ? "ko-KR" : locale === "zh" ? "zh-CN" : "en-US",
    { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" },
  ).format(new Date(value));
}

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const safe = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
          return `"${safe.replaceAll('"', '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function displayAmount(value: string) {
  const [whole = "0", fraction] = value.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""}`;
}

function CollectionsView({ locale, data, onMutate, busy }: ViewProps) {
  const t = (en: string, ko: string, zh: string) => text(locale, en, ko, zh);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const collection =
    data.collections.find((item) => item.id === selectedId) ??
    data.collections[0];
  const folders = data.collections.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase()),
  );
  const creatorIds = new Set(collection?.creatorIds ?? []);
  const creators = data.creators.filter((creator) =>
    creatorIds.has(creator.id),
  );

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      await onMutate("/api/workspace/collections", {
        action: "create",
        name: name.trim(),
      })
    )
      setName("");
  }

  return (
    <div className="cw-tools">
      <section className="cw-panel">
        <div className="cw-tools-heading">
          <div>
            <h2>
              {t(
                "Your creator shortlists",
                "우리 팀의 크리에이터 목록",
                "团队达人收藏",
              )}
            </h2>
            <p>
              {t(
                "Organize saved creators into shared folders. Changes are saved to your organization.",
                "저장한 크리에이터를 폴더로 정리하세요. 변경 사항은 소속 조직에 저장됩니다.",
                "将收藏的达人整理到文件夹，修改将保存到所属组织。",
              )}
            </p>
          </div>
          <Folder aria-hidden="true" size={28} />
        </div>
        <form className="cw-tools-inline-form" onSubmit={create}>
          <label className="cw-field">
            <span>{t("New folder", "새 폴더", "新建文件夹")}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
              placeholder={t(
                "e.g. Korea game launch",
                "예: 한국 게임 출시",
                "例如：韩国游戏发布",
              )}
            />
          </label>
          <button
            className="cw-button cw-button-primary"
            disabled={busy || !name.trim()}
            type="submit"
          >
            <Plus size={18} aria-hidden="true" />
            {t("Create folder", "폴더 만들기", "创建文件夹")}
          </button>
        </form>
      </section>
      <section className="cw-panel cw-tools-collections">
        <div className="cw-tools-folder-list">
          <label className="cw-field">
            <span>{t("Find a folder", "폴더 검색", "搜索文件夹")}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("Search folders", "폴더 이름", "文件夹名称")}
            />
          </label>
          <nav aria-label={t("Saved folders", "저장된 폴더", "已保存的文件夹")}>
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                className={`cw-tools-folder ${collection?.id === folder.id ? "is-active" : ""}`}
                aria-pressed={collection?.id === folder.id}
                onClick={() => setSelectedId(folder.id)}
              >
                <Folder size={18} aria-hidden="true" />
                <span>{folder.name}</span>
                <span>{folder.creatorIds.length}</span>
              </button>
            ))}
          </nav>
          {folders.length === 0 && (
            <p className="cw-tools-muted">
              {t(
                "No matching folders.",
                "표시할 폴더가 없습니다.",
                "暂无匹配的文件夹。",
              )}
            </p>
          )}
        </div>
        <div className="cw-tools-folder-content">
          <div className="cw-toolbar">
            <h3>
              {collection?.name ??
                t("Start a shortlist", "첫 목록 만들기", "创建首个收藏列表")}
            </h3>
            <button
              className="cw-button"
              type="button"
              disabled={creators.length === 0}
              onClick={() =>
                downloadCsv(
                  [
                    [
                      "Data source",
                      "Name",
                      "Platform",
                      "Handle",
                      "Country",
                      "Followers",
                      "Average views (last 10)",
                      "Engagement (%)",
                    ],
                    ...creators.map((creator) => [
                      "Fictional demo",
                      creator.name,
                      creator.platform,
                      creator.handle,
                      creator.country,
                      String(creator.followers),
                      String(creator.views10),
                      String(creator.engagement),
                    ]),
                  ],
                  "creator-shortlist.csv",
                )
              }
            >
              <Download size={17} aria-hidden="true" />
              {t("Export CSV", "CSV 내보내기", "导出 CSV")}
            </button>
          </div>
          {creators.length === 0 ? (
            <div className="cw-empty">
              <Folder size={32} aria-hidden="true" />
              <h3>
                {t(
                  "No creators saved yet",
                  "아직 저장한 크리에이터가 없습니다",
                  "尚未收藏达人",
                )}
              </h3>
              <p>
                {t(
                  "Save creators from the search results to build this shortlist.",
                  "검색 결과에서 크리에이터를 저장해 목록을 구성하세요.",
                  "从搜索结果中收藏达人，建立您的列表。",
                )}
              </p>
            </div>
          ) : (
            <div className="cw-tools-saved-list">
              {creators.map((creator) => (
                <article key={creator.id} className="cw-tools-saved-creator">
                  <span
                    className="cw-tools-avatar"
                    style={{ backgroundColor: creator.accent }}
                  >
                    {creator.name.slice(0, 1)}
                  </span>
                  <div>
                    <h4>{creator.name}</h4>
                    <p>
                      {creator.platform} · {creator.handle} · {creator.country}
                    </p>
                    <span className="cw-tag">
                      {t("Demo profile", "가상 프로필", "演示资料")}
                    </span>
                  </div>
                  <button
                    className="cw-button"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void onMutate("/api/workspace/collections", {
                        action: "remove",
                        collectionId: collection!.id,
                        creatorId: creator.id,
                      })
                    }
                  >
                    {t("Remove", "목록에서 빼기", "移除")}
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function LinksView({ locale, data, onMutate, busy }: ViewProps) {
  const t = (en: string, ko: string, zh: string) => text(locale, en, ko, zh);
  const [title, setTitle] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [query, setQuery] = useState("");
  const [since, setSince] = useState("");
  const [sort, setSort] = useState("newest");
  const [copyState, setCopyState] = useState("");
  const canEdit =
    data.account.role === "OWNER" || data.account.role === "ADMIN";
  const links = data.links
    .filter(
      (link) =>
        `${link.title} ${link.code} ${link.targetUrl}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!since || link.createdAt.slice(0, 10) >= since),
    )
    .sort((a, b) =>
      sort === "clicks"
        ? b.clickCount - a.clickCount
        : b.createdAt.localeCompare(a.createdAt),
    );

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      await onMutate("/api/workspace/links", {
        action: "create",
        title: title.trim(),
        targetUrl: targetUrl.trim(),
      })
    ) {
      setTitle("");
      setTargetUrl("");
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/s/${code}`,
      );
      setCopyState(code);
    } catch {
      setCopyState("error");
    }
  }

  return (
    <div className="cw-tools">
      <section className="cw-panel">
        <div className="cw-tools-heading">
          <div>
            <h2>
              {t(
                "One link. Clear tracking.",
                "짧은 링크로 간편하게 추적하세요",
                "短链接，清晰追踪",
              )}
            </h2>
            <p>
              {t(
                "Create a redirect link and track total requests. Counts may include bots and repeat visits; unique visitors are not measured.",
                "이동용 링크를 만들고 요청 수를 확인하세요. 봇·반복 방문이 포함될 수 있으며 순 방문자는 측정하지 않습니다.",
                "创建跳转链接并查看请求次数。计数可能包括机器人和重复访问，不统计独立访客。",
              )}
            </p>
          </div>
          <Link2 size={28} aria-hidden="true" />
        </div>
        <form className="cw-tools-link-form" onSubmit={create}>
          <label className="cw-field">
            <span>{t("Link name", "링크 이름", "链接名称")}</span>
            <input
              required
              maxLength={100}
              disabled={!canEdit}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t(
                "Campaign landing page",
                "캠페인 랜딩 페이지",
                "推广活动页面",
              )}
            />
          </label>
          <label className="cw-field">
            <span>{t("Destination URL", "이동할 주소", "目标网址")}</span>
            <input
              required
              type="url"
              maxLength={2048}
              disabled={!canEdit}
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              placeholder="https://example.com"
            />
          </label>
          <button
            className="cw-button cw-button-primary"
            type="submit"
            disabled={busy || !canEdit || !title.trim() || !targetUrl.trim()}
          >
            <Plus size={18} aria-hidden="true" />
            {t("Create link", "링크 만들기", "创建链接")}
          </button>
        </form>
        {!canEdit && (
          <p className="cw-tools-notice">
            {t(
              "Only organization owners and admins can manage links.",
              "조직 소유자와 관리자만 링크를 관리할 수 있습니다.",
              "仅组织所有者和管理员可管理链接。",
            )}
          </p>
        )}
      </section>
      <section className="cw-panel">
        <div className="cw-tools-filter-row">
          <label className="cw-field">
            <span>{t("Search links", "링크 검색", "搜索链接")}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(
                "Name, code or destination",
                "이름, 코드 또는 주소",
                "名称、代码或目标网址",
              )}
            />
          </label>
          <label className="cw-field">
            <span>{t("Created from", "생성일 시작", "创建日期起")}</span>
            <input
              type="date"
              value={since}
              onChange={(event) => setSince(event.target.value)}
            />
          </label>
          <ProfileSelect
            id="links-sort"
            label={t("Sort", "정렬", "排序")}
            placeholder=""
            value={sort}
            onChange={setSort}
            options={[
              {
                value: "newest",
                label: t("Newest first", "최신순", "最新优先"),
              },
              {
                value: "clicks",
                label: t("Most requests", "요청 많은 순", "请求最多"),
              },
            ]}
          />
          <button
            className="cw-button"
            type="button"
            onClick={() => {
              setQuery("");
              setSince("");
              setSort("newest");
            }}
          >
            {t("Reset", "초기화", "重置")}
          </button>
        </div>
        <p className="cw-tools-muted" role="status">
          {copyState === "error"
            ? t(
                "Copy unavailable. Select and copy the link text.",
                "복사할 수 없습니다. 링크 텍스트를 직접 복사해주세요.",
                "无法复制，请手动选择并复制链接。",
              )
            : copyState
              ? t("Link copied.", "링크를 복사했습니다.", "链接已复制。")
              : t(
                  `${links.length} links`,
                  `${links.length}개 링크`,
                  `${links.length} 个链接`,
                )}
        </p>
        {links.length === 0 ? (
          <div className="cw-empty">
            <Link2 size={32} aria-hidden="true" />
            <h3>
              {t("No links to show", "표시할 링크가 없습니다", "暂无链接")}
            </h3>
            <p>
              {t(
                "Create your first link above or clear your filters.",
                "위에서 첫 링크를 만들거나 검색 조건을 초기화하세요.",
                "在上方创建首个链接，或清除筛选条件。",
              )}
            </p>
          </div>
        ) : (
          <div className="cw-table-wrap">
            <table className="cw-table">
              <thead>
                <tr>
                  <th>{t("Link", "링크", "链接")}</th>
                  <th>{t("Destination", "이동 주소", "目标网址")}</th>
                  <th>{t("Requests", "요청 수", "请求次数")}</th>
                  <th>
                    {t("Created (UTC)", "생성일 (UTC)", "创建日期 (UTC)")}
                  </th>
                  <th>{t("Status / actions", "상태 / 관리", "状态 / 操作")}</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.id}>
                    <td>
                      <strong>{link.title}</strong>
                      <div className="cw-tools-url-row">
                        <a
                          href={`/s/${link.code}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          /s/{link.code}
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </a>
                        <button
                          type="button"
                          className="cw-tools-icon-button"
                          aria-label={t(
                            `Copy ${link.title}`,
                            `${link.title} 복사`,
                            `复制 ${link.title}`,
                          )}
                          onClick={() => void copy(link.code)}
                        >
                          {copyState === link.code ? (
                            <Check size={17} />
                          ) : (
                            <Copy size={17} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td>
                      <span className="cw-tools-url-text">
                        {link.targetUrl}
                      </span>
                    </td>
                    <td>{link.clickCount.toLocaleString()}</td>
                    <td>{displayDate(link.createdAt, locale)}</td>
                    <td>
                      <span
                        className={`cw-tag ${link.active ? "" : "cw-tools-muted"}`}
                      >
                        {link.active
                          ? t("Active", "사용 중", "已启用")
                          : t("Paused", "중지됨", "已暂停")}
                      </span>
                      <button
                        className="cw-button"
                        type="button"
                        disabled={busy || !canEdit}
                        onClick={() =>
                          void onMutate("/api/workspace/links", {
                            action: "toggle",
                            id: link.id,
                            active: !link.active,
                          })
                        }
                      >
                        {link.active
                          ? t("Pause", "중지", "暂停")
                          : t("Enable", "활성화", "启用")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const campaignPlatforms = [
  "youtube",
  "tiktok",
  "instagram",
  "twitch",
  "x",
  "facebook",
];
function CampaignsView({ locale, data, onMutate, busy }: ViewProps) {
  const t = (en: string, ko: string, zh: string) => text(locale, en, ko, zh);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [budget, setBudget] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["youtube"]);
  const [deadline, setDeadline] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [followerMin, setFollowerMin] = useState("");
  const [followerMax, setFollowerMax] = useState("");
  const [editingId, setEditingId] = useState("");
  const [formError, setFormError] = useState("");
  const [applicationsId, setApplicationsId] = useState("");
  const titleInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("all");
  const [cancelId, setCancelId] = useState("");
  const canEdit =
    data.account.role === "OWNER" || data.account.role === "ADMIN";
  const labels: Record<string, string> = {
    DRAFT: t("Draft", "초안", "草稿"),
    REVIEW: t("Submitted for review", "검토 요청됨", "已提交审核"),
    RECRUITING: t("Recruiting", "모집 중", "招募中"),
    IN_PROGRESS: t("In progress", "진행 중", "进行中"),
    VERIFYING: t("Verifying", "검수 중", "核验中"),
    SETTLING: t("Settling", "정산 중", "结算中"),
    COMPLETED: t("Completed", "완료", "已完成"),
    CANCELED: t("Canceled", "취소됨", "已取消"),
  };
  const campaigns = data.campaigns.filter(
    (campaign) => status === "all" || campaign.status === status,
  );

  const regionOptions: [string, string][] = [
    ["KR", t("South Korea", "대한민국", "韩国")],
    ["CN", t("China", "중국", "中国")],
    ["JP", t("Japan", "일본", "日本")],
    ["US", t("United States", "미국", "美国")],
    ["GB", t("United Kingdom", "영국", "英国")],
    ["DE", t("Germany", "독일", "德国")],
    ["FR", t("France", "프랑스", "法国")],
    ["CA", t("Canada", "캐나다", "加拿大")],
    ["AU", t("Australia", "호주", "澳大利亚")],
    ["SG", t("Singapore", "싱가포르", "新加坡")],
  ];
  const categoryOptions: [string, string][] = [
    ["gaming", t("Gaming", "게임", "游戏")],
    ["entertainment", t("Entertainment", "엔터테인먼트", "娱乐")],
    ["lifestyle", t("Lifestyle", "라이프스타일", "生活方式")],
    ["technology", t("Technology", "테크", "科技")],
    ["beauty", t("Beauty", "뷰티", "美妆")],
    ["travel", t("Travel", "여행", "旅行")],
  ];

  function resetForm() {
    setEditingId("");
    setTitle("");
    setSummary("");
    setBudget("");
    setCurrency("USD");
    setPlatforms(["youtube"]);
    setDeadline("");
    setRegions([]);
    setCategories([]);
    setFollowerMin("");
    setFollowerMax("");
    setFormError("");
  }

  function editCampaign(campaign: WorkspaceCampaign) {
    setEditingId(campaign.id);
    setTitle(campaign.title);
    setSummary(campaign.summary);
    setCurrency(campaign.currency);
    setBudget(campaign.budgetAmount ?? "");
    setPlatforms(campaign.platforms);
    setRegions(campaign.regions);
    setCategories(campaign.categories);
    setFollowerMin(campaign.followerMin?.toString() ?? "");
    setFollowerMax(campaign.followerMax?.toString() ?? "");
    if (campaign.applicationDeadline) {
      const date = new Date(campaign.applicationDeadline);
      setDeadline(
        new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
          .toISOString()
          .slice(0, 16),
      );
    } else setDeadline("");
    setFormError("");
    titleInput.current?.focus();
    titleInput.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const date = deadline ? new Date(deadline) : null;
    if (
      date &&
      (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())
    ) {
      setFormError(
        t(
          "Choose a future application deadline.",
          "신청 마감일을 현재보다 늦은 시간으로 설정해 주세요.",
          "请选择未来的报名截止时间。",
        ),
      );
      return;
    }
    if (
      followerMin &&
      followerMax &&
      Number(followerMin) > Number(followerMax)
    ) {
      setFormError(
        t(
          "Minimum followers cannot exceed the maximum.",
          "최소 팔로워 수는 최대 팔로워 수보다 클 수 없습니다.",
          "最低粉丝数不得大于最高粉丝数。",
        ),
      );
      return;
    }
    if (Number(budget) <= 0) {
      setFormError(
        t(
          "Enter a budget greater than zero.",
          "0보다 큰 예산을 입력해 주세요.",
          "请输入大于零的预算。",
        ),
      );
      return;
    }
    if (
      await onMutate("/api/workspace/campaigns", {
        action: editingId ? "update" : "create",
        ...(editingId ? { id: editingId } : {}),
        title: title.trim(),
        summary: summary.trim(),
        platforms,
        currency,
        budgetAmount: budget,
        ...(date ? { deadline: date.toISOString() } : {}),
        regions,
        categories,
        ...(followerMin !== "" ? { followerMin: Number(followerMin) } : {}),
        ...(followerMax !== "" ? { followerMax: Number(followerMax) } : {}),
      })
    )
      resetForm();
  }

  async function submitCampaign(campaign: WorkspaceCampaign, now: number) {
    if (editingId === campaign.id) {
      setFormError(
        t(
          "Save your edits before submitting this campaign for review.",
          "수정 내용을 저장한 뒤 검토를 요청해 주세요.",
          "请先保存修改，再提交审核。",
        ),
      );
      titleInput.current?.focus();
      return;
    }
    if (
      !campaign.applicationDeadline ||
      new Date(campaign.applicationDeadline).getTime() <= now
    ) {
      editCampaign(campaign);
      setFormError(
        t(
          "Set and save a future application deadline before requesting review.",
          "초안을 수정해 미래의 신청 마감 일시를 저장한 뒤 검토를 요청해 주세요.",
          "请先编辑草稿并保存未来的报名截止时间，再提交审核。",
        ),
      );
      return;
    }
    if (
      await onMutate("/api/workspace/campaigns", {
        action: "submit",
        id: campaign.id,
      })
    ) {
      if (editingId === campaign.id) resetForm();
    }
  }

  return (
    <div className="cw-tools">
      <section className="cw-panel">
        <div className="cw-tools-heading">
          <div>
            <h2>
              {editingId
                ? t("Edit campaign draft", "캠페인 초안 수정", "编辑活动草稿")
                : t(
                    "Plan your next creator campaign",
                    "다음 크리에이터 캠페인을 준비하세요",
                    "规划下一场达人推广",
                  )}
            </h2>
            <p>
              {t(
                "Save your brief and submit it for review. Once approved, partner agencies can view the campaign and apply. No payment is charged here.",
                "캠페인 초안을 저장하고 검토를 요청하세요. 관리자 승인 후 에이전시가 조회하고 신청할 수 있습니다. 이 단계에서 결제는 발생하지 않습니다.",
                "保存草稿并提交审核。管理员批准后，代理机构即可查看并报名。此步骤不会收取费用。",
              )}
            </p>
            <p className="cw-tools-notice">
              {data.account.status === "PENDING"
                ? t(
                    "Your organization is awaiting approval. You can prepare drafts now; submission unlocks after approval.",
                    "조직 승인 대기 중입니다. 초안을 작성할 수 있으며 승인 후 검토 요청이 가능합니다.",
                    "您的组织正在等待审批。现在可保存草稿，组织获批后可提交审核。",
                  )
                : t(
                    "Campaigns remain private to your organization until the operations team reviews them.",
                    "운영팀 검토 전까지 캠페인은 소속 조직에만 표시됩니다.",
                    "运营团队审核前，活动仅对所属组织可见。",
                  )}
            </p>
          </div>
          <BarChart3 size={28} aria-hidden="true" />
        </div>
        <form className="cw-tools-campaign-form" onSubmit={create}>
          <fieldset
            className="cw-tools-form-fields"
            disabled={busy || !canEdit}
          >
            <legend className="sr-only">
              {t("Campaign details", "캠페인 상세 정보", "活动详情")}
            </legend>
            <label className="cw-field cw-tools-span">
              <span>{t("Campaign title", "캠페인 이름", "活动名称")}</span>
              <input
                ref={titleInput}
                required
                disabled={!canEdit}
                maxLength={160}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t(
                  "e.g. New game launch in Korea",
                  "예: 한국 신작 게임 출시",
                  "例如：韩国新游戏上线",
                )}
              />
            </label>
            <label className="cw-field cw-tools-span">
              <span>{t("Campaign brief", "캠페인 요약", "推广需求")}</span>
              <textarea
                required
                disabled={!canEdit}
                maxLength={5000}
                rows={4}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder={t(
                  "Goals, audience, deliverables and timing",
                  "목표, 타깃, 제작물, 일정 등을 적어주세요",
                  "填写目标、受众、交付内容及时间安排",
                )}
              />
            </label>
            <fieldset className="cw-tools-span cw-tools-platforms">
              <legend>{t("Platforms", "플랫폼", "平台")}</legend>
              {campaignPlatforms.map((platform) => (
                <label key={platform}>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={platforms.includes(platform)}
                    onChange={(event) =>
                      setPlatforms((current) =>
                        event.target.checked
                          ? [...current, platform]
                          : current.filter((value) => value !== platform),
                      )
                    }
                  />
                  <span>
                    {platform === "youtube"
                      ? "YouTube"
                      : platform === "tiktok"
                        ? "TikTok"
                        : platform === "x"
                          ? "X"
                          : platform.charAt(0).toUpperCase() +
                            platform.slice(1)}
                  </span>
                </label>
              ))}
            </fieldset>
            <ProfileSelect
              id="campaign-currency"
              label={t("Currency", "통화", "币种")}
              placeholder=""
              value={currency}
              onChange={setCurrency}
              options={[
                { value: "USD", label: "USD" },
                { value: "KRW", label: "KRW" },
                { value: "CNY", label: "CNY" },
              ]}
            />
            <label className="cw-field">
              <span>{t("Planned budget", "예상 예산", "计划预算")}</span>
              <input
                disabled={!canEdit}
                required
                inputMode="decimal"
                pattern="(?:0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?"
                maxLength={19}
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                placeholder="0.00"
              />
            </label>
            <label className="cw-field cw-tools-span">
              <span>
                {t("Application deadline", "신청 마감 일시", "报名截止时间")}
              </span>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                aria-describedby="campaign-deadline-help"
              />
              <span className="cw-tools-field-help" id="campaign-deadline-help">
                {t(
                  "Your local time. A future deadline is required before submitting for review.",
                  "브라우저 현지 시간 기준입니다. 검토 요청 전에는 미래의 마감 일시를 반드시 입력해야 합니다.",
                  "使用浏览器当地时间，提交审核前必须填写未来的截止时间。",
                )}
              </span>
            </label>
            <fieldset className="cw-tools-span cw-tools-platforms">
              <legend>
                {t(
                  "Target regions · leave empty for all",
                  "대상 국가 · 미선택 시 전체",
                  "目标地区 · 不选则不限",
                )}
              </legend>
              {regionOptions.map(([value, label]) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={regions.includes(value)}
                    onChange={(event) =>
                      setRegions((current) =>
                        event.target.checked
                          ? [...current, value]
                          : current.filter((item) => item !== value),
                      )
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="cw-tools-span cw-tools-platforms">
              <legend>
                {t(
                  "Content categories · leave empty for all",
                  "콘텐츠 분야 · 미선택 시 전체",
                  "内容分类 · 不选则不限",
                )}
              </legend>
              {categoryOptions.map(([value, label]) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={categories.includes(value)}
                    onChange={(event) =>
                      setCategories((current) =>
                        event.target.checked
                          ? [...current, value]
                          : current.filter((item) => item !== value),
                      )
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <label className="cw-field">
              <span>
                {t(
                  "Minimum followers (optional)",
                  "최소 팔로워 수 (선택)",
                  "最低粉丝数（选填）",
                )}
              </span>
              <input
                type="number"
                min="0"
                max="2147483647"
                step="1"
                value={followerMin}
                onChange={(event) => setFollowerMin(event.target.value)}
                placeholder={t("No minimum", "하한 없음", "不限")}
              />
            </label>
            <label className="cw-field">
              <span>
                {t(
                  "Maximum followers (optional)",
                  "최대 팔로워 수 (선택)",
                  "最高粉丝数（选填）",
                )}
              </span>
              <input
                type="number"
                min="0"
                max="2147483647"
                step="1"
                value={followerMax}
                onChange={(event) => setFollowerMax(event.target.value)}
                placeholder={t("No maximum", "상한 없음", "不限")}
              />
            </label>
            {formError && (
              <p className="cw-tools-form-error cw-tools-span" role="alert">
                {formError}
              </p>
            )}
            <div className="cw-tools-span cw-tools-actions">
              <button
                className="cw-button cw-button-primary"
                disabled={busy || !canEdit || platforms.length === 0}
                type="submit"
              >
                <Plus size={18} aria-hidden="true" />
                {editingId
                  ? t("Save changes", "수정 저장", "保存修改")
                  : t("Save draft", "초안 저장", "保存草稿")}
              </button>
              {editingId && (
                <button className="cw-button" type="button" onClick={resetForm}>
                  {t("Cancel editing", "수정 취소", "取消编辑")}
                </button>
              )}
              {!canEdit && (
                <p className="cw-tools-muted">
                  {t(
                    "Only owners and admins can manage campaigns.",
                    "소유자와 관리자만 캠페인을 관리할 수 있습니다.",
                    "仅所有者和管理员可管理活动。",
                  )}
                </p>
              )}
            </div>
          </fieldset>
        </form>
      </section>
      <section className="cw-panel">
        <div className="cw-toolbar">
          <h2>{t("Your campaigns", "우리 조직 캠페인", "组织推广活动")}</h2>
          <ProfileSelect
            id="campaign-status"
            label={t("Status", "상태", "状态")}
            placeholder=""
            value={status}
            onChange={setStatus}
            options={[
              {
                value: "all",
                label: t("All statuses", "모든 상태", "所有状态"),
              },
              ...Object.entries(labels).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
        </div>
        {campaigns.length === 0 ? (
          <div className="cw-empty">
            <BarChart3 size={32} aria-hidden="true" />
            <h3>
              {t(
                "No campaigns yet",
                "등록된 캠페인이 없습니다",
                "暂无推广活动",
              )}
            </h3>
            <p>
              {t(
                "Start with a brief above. Your draft is saved privately.",
                "위에서 요약을 작성해보세요. 초안은 비공개로 저장됩니다.",
                "先在上方填写需求，草稿将以私密方式保存。",
              )}
            </p>
          </div>
        ) : (
          <div className="cw-tools-campaign-list">
            {campaigns.map((campaign) => (
              <article key={campaign.id}>
                <div className="cw-toolbar">
                  <div>
                    <span className="cw-tag">
                      {labels[campaign.status] ?? campaign.status}
                    </span>
                    <h3>{campaign.title}</h3>
                  </div>
                  <strong>
                    {campaign.currency}{" "}
                    {campaign.budgetAmount
                      ? displayAmount(campaign.budgetAmount)
                      : "—"}
                  </strong>
                </div>
                <p className="cw-tools-pre-line">{campaign.summary}</p>
                {campaign.reviewNote && (
                  <p className="cw-tools-review-note">
                    <strong>
                      {t("Review feedback", "검토 의견", "审核反馈")}
                    </strong>
                    {campaign.reviewNote}
                  </p>
                )}
                <dl className="cw-tools-campaign-facts">
                  <div>
                    <dt>
                      {t("Application deadline", "신청 마감", "报名截止")}
                    </dt>
                    <dd>
                      {campaign.applicationDeadline
                        ? new Intl.DateTimeFormat(
                            locale === "ko"
                              ? "ko-KR"
                              : locale === "zh"
                                ? "zh-CN"
                                : "en-US",
                            { dateStyle: "medium", timeStyle: "short" },
                          ).format(new Date(campaign.applicationDeadline))
                        : t(
                            "Required before review",
                            "검토 요청 전 입력 필요",
                            "提交审核前必填",
                          )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("Regions", "대상 국가", "地区")}</dt>
                    <dd>
                      {campaign.regions.length
                        ? campaign.regions.join(" · ")
                        : t("All regions", "전체", "不限")}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("Categories", "분야", "分类")}</dt>
                    <dd>
                      {campaign.categories.length
                        ? campaign.categories
                            .map(
                              (category) =>
                                categoryOptions.find(
                                  ([value]) => value === category,
                                )?.[1] ?? category,
                            )
                            .join(" · ")
                        : t("All categories", "전체", "不限")}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("Followers", "팔로워", "粉丝数")}</dt>
                    <dd>
                      {(campaign.followerMin ?? 0).toLocaleString()} –{" "}
                      {campaign.followerMax === null
                        ? t("No maximum", "상한 없음", "不限")
                        : campaign.followerMax.toLocaleString()}
                    </dd>
                  </div>
                </dl>
                <div className="cw-toolbar">
                  <span className="cw-tools-muted">
                    {campaign.platforms.join(" · ")} ·{" "}
                    {displayDate(campaign.createdAt, locale)}
                  </span>
                  <div className="cw-tools-actions">
                    {campaign.status === "DRAFT" && (
                      <button
                        type="button"
                        className="cw-button"
                        disabled={busy || !canEdit}
                        onClick={() => editCampaign(campaign)}
                      >
                        {t("Edit draft", "초안 수정", "编辑草稿")}
                      </button>
                    )}
                    {campaign.status === "DRAFT" && (
                      <button
                        type="button"
                        className="cw-button cw-button-primary"
                        disabled={
                          busy || !canEdit || data.account.status !== "ACTIVE"
                        }
                        onClick={() =>
                          void submitCampaign(campaign, Date.now())
                        }
                      >
                        {t("Submit for review", "검토 요청", "提交审核")}
                      </button>
                    )}
                    {["DRAFT", "REVIEW"].includes(campaign.status) &&
                      (cancelId === campaign.id ? (
                        <>
                          <button
                            className="cw-button"
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              if (
                                await onMutate("/api/workspace/campaigns", {
                                  action: "cancel",
                                  id: campaign.id,
                                })
                              ) {
                                setCancelId("");
                                if (editingId === campaign.id) resetForm();
                              }
                            }}
                          >
                            {t("Confirm cancellation", "취소 확정", "确认取消")}
                          </button>
                          <button
                            className="cw-button"
                            type="button"
                            onClick={() => setCancelId("")}
                          >
                            {t("Keep", "유지", "保留")}
                          </button>
                        </>
                      ) : (
                        <button
                          className="cw-button"
                          type="button"
                          disabled={busy || !canEdit}
                          onClick={() => setCancelId(campaign.id)}
                        >
                          {t("Cancel campaign", "캠페인 취소", "取消活动")}
                        </button>
                      ))}
                  </div>
                </div>
                <div className="cw-tools-applications-trigger">
                  <button
                    type="button"
                    className="cw-button"
                    aria-expanded={applicationsId === campaign.id}
                    aria-controls={`applications-${campaign.id}`}
                    onClick={() =>
                      setApplicationsId((current) =>
                        current === campaign.id ? "" : campaign.id,
                      )
                    }
                  >
                    <MessageSquareText size={18} aria-hidden="true" />
                    {t(
                      "Agency applications",
                      "에이전시 신청",
                      "代理机构报名",
                    )}{" "}
                    · {campaign.applicationCount}
                  </button>
                </div>
                {applicationsId === campaign.id && (
                  <CampaignApplications
                    key={campaign.id}
                    campaignId={campaign.id}
                    campaignStatus={campaign.status}
                    locale={locale}
                    onMutate={onMutate}
                    canEdit={canEdit && data.account.status === "ACTIVE"}
                    busy={busy}
                  />
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AgentView({ locale, data, onMutate, busy }: ViewProps) {
  const t = (en: string, ko: string, zh: string) => text(locale, en, ko, zh);
  const [tool, setTool] = useState("social-data");
  const [title, setTitle] = useState("");
  const [input, setInput] = useState("");
  const tools = [
    {
      id: "social-data",
      icon: Search,
      name: t("Social data collection", "소셜 데이터 수집", "社媒数据采集"),
      description: t(
        "Prepare a creator list and the metrics you need for a campaign proposal.",
        "캠페인 제안에 필요한 크리에이터 목록과 지표를 요청하세요.",
        "提交推广提案所需的达人名单及数据指标。",
      ),
      hint: t(
        "Channel URLs, product type and name, requested metrics",
        "채널 URL, 제품 유형·이름, 필요한 지표",
        "达人主页链接、产品类型及名称、所需指标",
      ),
    },
    {
      id: "brand-insight",
      icon: BarChart3,
      name: t("Brand promotion insights", "브랜드 홍보 분석", "品牌推广洞察"),
      description: t(
        "Request an overview of a brand’s creator collaborations and campaign activity.",
        "브랜드의 크리에이터 협업과 캠페인 현황 분석을 요청하세요.",
        "申请品牌达人合作及推广活动概览。",
      ),
      hint: t(
        "Brand or product name, market, period and questions to investigate",
        "브랜드·제품명, 대상 국가, 기간, 분석하고 싶은 내용",
        "品牌或产品名称、市场、时间范围及分析问题",
      ),
    },
    {
      id: "comments",
      icon: MessageSquareText,
      name: t("Video comment analysis", "영상 댓글 분석", "视频评论分析"),
      description: t(
        "Request a review of audience sentiment, purchase intent and competitor mentions.",
        "시청자 반응, 구매 의도, 경쟁사 언급 분석을 요청하세요.",
        "申请受众情绪、购买意向及竞品提及分析。",
      ),
      hint: t(
        "Video URLs (one per line), keywords and questions",
        "영상 URL (한 줄에 하나씩), 키워드, 확인할 내용",
        "视频链接（每行一个）、关键词及分析问题",
      ),
    },
  ];
  const selected = tools.find((item) => item.id === tool)!;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      await onMutate("/api/workspace/tools", {
        tool,
        title: title.trim(),
        input: input.trim(),
      })
    ) {
      setTitle("");
      setInput("");
    }
  }
  return (
    <div className="cw-tools">
      <section className="cw-panel">
        <div className="cw-tools-heading">
          <div>
            <h2>
              {t(
                "A workspace for better decisions",
                "더 나은 결정을 위한 분석 도구",
                "助力更好决策的工具",
              )}
            </h2>
            <p>
              {t(
                "Choose a tool and save an analysis request for your team.",
                "도구를 선택하고 팀의 분석 요청을 저장하세요.",
                "选择工具，为团队保存分析需求。",
              )}
            </p>
          </div>
        </div>
        <p className="cw-tools-notice">
          {t(
            "Request intake only. External data collection and AI processing are not connected yet. Saving a request does not start an automatic analysis or promise a delivery date.",
            "현재는 요청 접수 기능입니다. 외부 데이터 수집과 AI 분석은 아직 연결되지 않았습니다. 저장만으로 분석이 실행되거나 완료 일정이 확정되지 않습니다.",
            "目前仅提供需求登记。尚未接入外部数据采集及 AI 处理，保存请求不会自动开始分析，也不承诺交付日期。",
          )}
        </p>
        <div
          className="cw-tools-tool-grid"
          role="group"
          aria-label={t(
            "Choose an analysis tool",
            "분석 도구 선택",
            "选择分析工具",
          )}
        >
          {tools.map(({ id, icon: Icon, name, description }) => (
            <button
              key={id}
              type="button"
              className={`cw-tools-tool ${tool === id ? "is-active" : ""}`}
              aria-pressed={tool === id}
              onClick={() => setTool(id)}
            >
              <Icon size={27} aria-hidden="true" />
              <strong>{name}</strong>
              <span>{description}</span>
            </button>
          ))}
        </div>
        <form className="cw-tools-request-form" onSubmit={submit}>
          <h3>{selected.name}</h3>
          <label className="cw-field">
            <span>{t("Request title", "요청 제목", "请求标题")}</span>
            <input
              required
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t(
                "Name this analysis request",
                "분석 요청의 이름을 정해주세요",
                "为分析请求命名",
              )}
            />
          </label>
          <label className="cw-field">
            <span>
              {t("Details and links", "상세 내용과 링크", "详细内容和链接")}
            </span>
            <textarea
              required
              rows={5}
              maxLength={4000}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={selected.hint}
            />
          </label>
          <button
            className="cw-button cw-button-primary"
            type="submit"
            disabled={busy || !title.trim() || !input.trim()}
          >
            {t("Save request", "요청 저장", "保存请求")}
          </button>
        </form>
      </section>
      <section className="cw-panel">
        <h2>{t("Request history", "요청 이력", "请求历史")}</h2>
        {data.requests.length === 0 ? (
          <div className="cw-empty">
            <MessageSquareText size={32} aria-hidden="true" />
            <h3>{t("No requests yet", "아직 요청이 없습니다", "暂无请求")}</h3>
            <p>
              {t(
                "Your saved requests will appear here across sessions.",
                "저장한 요청은 다시 로그인해도 여기서 확인할 수 있습니다.",
                "已保存的请求将显示在此处，再次登录后仍可查看。",
              )}
            </p>
          </div>
        ) : (
          <div className="cw-table-wrap">
            <table className="cw-table">
              <thead>
                <tr>
                  <th>{t("Request", "요청", "请求")}</th>
                  <th>{t("Tool", "도구", "工具")}</th>
                  <th>{t("Status", "상태", "状态")}</th>
                  <th>
                    {t("Created (UTC)", "접수일 (UTC)", "创建日期 (UTC)")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.requests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <strong>{request.title}</strong>
                      <details className="cw-tools-details">
                        <summary>
                          {t(
                            "View submitted details",
                            "접수 내용 보기",
                            "查看提交内容",
                          )}
                        </summary>
                        <p className="cw-tools-pre-line">{request.input}</p>
                      </details>
                    </td>
                    <td>
                      {tools.find((item) => item.id === request.tool)?.name ??
                        request.tool}
                    </td>
                    <td>
                      <span className="cw-tag">
                        {request.status === "REQUESTED"
                          ? t(
                              "Request saved · not processed",
                              "요청 저장 · 분석 미실행",
                              "请求已保存 · 尚未处理",
                            )
                          : request.status}
                      </span>
                    </td>
                    <td>{displayDate(request.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AccountView({ locale, data, onMutate, busy }: ViewProps) {
  const t = (en: string, ko: string, zh: string) => text(locale, en, ko, zh);
  const [tab, setTab] = useState("personal");
  const [name, setName] = useState(data.account.name);
  const [contactName, setContactName] = useState(data.account.contactName);
  const [websiteUrl, setWebsiteUrl] = useState(data.account.websiteUrl ?? "");
  const canEdit = data.account.role === "OWNER";
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onMutate("/api/workspace/account", {
      name: name.trim(),
      contactName: contactName.trim(),
      websiteUrl: websiteUrl.trim(),
    });
  }
  return (
    <section className="cw-panel cw-tools">
      <div
        className="cw-tools-tabs"
        role="group"
        aria-label={t("Account sections", "계정 관리 메뉴", "账户栏目")}
      >
        {[
          {
            id: "personal",
            label: t("Personal information", "담당자 정보", "个人信息"),
          },
          {
            id: "company",
            label: t("Company information", "회사 정보", "公司信息"),
          },
          { id: "security", label: t("Security", "보안", "安全设置") },
        ].map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            className={tab === item.id ? "is-active" : ""}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "security" ? (
        <div className="cw-tools-account-form">
          <ShieldCheck size={32} aria-hidden="true" />
          <h2>{t("Account security", "계정 보안", "账户安全")}</h2>
          <dl className="cw-tools-definitions">
            <div>
              <dt>{t("Login email", "로그인 이메일", "登录邮箱")}</dt>
              <dd>{data.account.email}</dd>
            </div>
            <div>
              <dt>{t("Organization status", "조직 상태", "组织状态")}</dt>
              <dd>
                {data.account.status === "ACTIVE"
                  ? t("Approved", "승인됨", "已批准")
                  : t("Awaiting approval", "승인 대기", "等待审批")}
              </dd>
            </div>
          </dl>
          <p className="cw-tools-notice">
            {t(
              "Email verification and email-based password recovery are not available until a mail provider is connected. Email addresses and approval status cannot be changed here.",
              "메일 발송 서비스 연결 전까지 이메일 인증과 이메일 기반 비밀번호 복구는 제공되지 않습니다. 여기서는 이메일 주소나 승인 상태를 변경할 수 없습니다.",
              "接入邮件服务前暂不提供邮箱验证和邮件找回密码。此页面无法更改邮箱地址或审批状态。",
            )}
          </p>
        </div>
      ) : (
        <form className="cw-tools-account-form" onSubmit={save}>
          <h2>
            {tab === "personal"
              ? t("Your point of contact", "담당자 정보", "联系人信息")
              : t("Organization details", "조직 상세 정보", "组织详情")}
          </h2>
          {tab === "personal" ? (
            <>
              <label className="cw-field">
                <span>{t("Contact name", "담당자 이름", "联系人姓名")}</span>
                <input
                  required
                  disabled={!canEdit}
                  maxLength={100}
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                />
              </label>
              <label className="cw-field">
                <span>{t("Email address", "이메일 주소", "邮箱地址")}</span>
                <input readOnly value={data.account.email} type="email" />
              </label>
              <p className="cw-tools-muted">
                {t(
                  "This is your sign-in email and cannot be edited here.",
                  "로그인 이메일이며 이 화면에서 변경할 수 없습니다.",
                  "这是您的登录邮箱，无法在此更改。",
                )}
              </p>
            </>
          ) : (
            <>
              <label className="cw-field">
                <span>{t("Company name", "회사 이름", "公司名称")}</span>
                <input
                  required
                  disabled={!canEdit}
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="cw-field">
                <span>{t("Company website", "회사 웹사이트", "公司网址")}</span>
                <input
                  type="url"
                  disabled={!canEdit}
                  maxLength={2048}
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  placeholder="https://"
                />
              </label>
              <dl className="cw-tools-definitions">
                <div>
                  <dt>{t("Industry", "산업", "行业")}</dt>
                  <dd>{data.account.industry || "—"}</dd>
                </div>
                <div>
                  <dt>{t("Country / region", "국가 / 지역", "国家 / 地区")}</dt>
                  <dd>{data.account.countryCode || "—"}</dd>
                </div>
                <div>
                  <dt>{t("Company size", "회사 규모", "公司规模")}</dt>
                  <dd>{data.account.companySize || "—"}</dd>
                </div>
              </dl>
            </>
          )}
          <button
            type="submit"
            className="cw-button cw-button-primary"
            disabled={busy || !canEdit}
          >
            {t("Save changes", "변경 사항 저장", "保存修改")}
          </button>
          {!canEdit && (
            <p className="cw-tools-muted">
              {t(
                "Only the organization owner can edit company and contact information.",
                "조직 소유자만 회사와 담당자 정보를 수정할 수 있습니다.",
                "仅组织所有者可修改公司及联系人信息。",
              )}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

export function WorkspaceTools({ mode, ...props }: Props) {
  switch (mode) {
    case "collect":
      return <CollectionsView {...props} />;
    case "links":
      return <LinksView {...props} />;
    case "campaigns":
      return <CampaignsView {...props} />;
    case "agent":
      return <AgentView {...props} />;
    case "account":
      return <AccountView {...props} />;
  }
}
