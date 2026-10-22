"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bell, Building2, CalendarDays, CheckCircle2, ChevronRight, Clock3, FileText, FolderOpen, Gamepad2, Globe2, Handshake, LayoutGrid, List, Mail, Menu, Search, ShieldCheck, Sparkles, Users, Wallet, X } from "lucide-react";
import type { Locale } from "../_components/landing-copy";
import { LanguageSwitcher } from "../_components/language-switcher";
import { ProfileSelect } from "../onboarding/brand/profile-select";
import { agencyCopy, agencySections, agencyText, type AgencySection } from "./agency-workspace-copy";
import "./agency-workspace.css";

type AgencyAccount = {
  organizationName: string;
  status: "PENDING" | "ACTIVE";
  userName: string;
  agencyType: "agency" | "studio";
  submittedAt: string | null;
};
type DemoOffer = {
  id: string; brand: string; title: string; platforms: string[]; countries: string[];
  category: "gaming" | "entertainment" | "lifestyle";
  followersMin: number; followersMax: number; budget: number; fixed: boolean;
  postedAt: string; deadline: string; theme: string; overview: [string, string, string]; deliverable: [string, string, string];
};

// Entirely invented campaigns. These fixtures never create applications or money movements.
const DEMO_OFFER_CONTENT: Omit<DemoOffer, "postedAt">[] = [
  { id: "lumen", brand: "LUMEN QUEST", title: "Lumen Quest — a new world awaits", platforms: ["YouTube", "TikTok"], countries: ["KR", "JP"], category: "gaming", followersMin: 1000, followersMax: 100000, budget: 2000, fixed: false, deadline: "2026-12-20", theme: "violet", overview: ["Introduce an imaginary fantasy adventure through your own story and first impressions.", "가상의 판타지 게임을 나만의 이야기와 첫인상으로 소개하는 캠페인 예시입니다.", "用自己的故事和第一印象介绍一款虚构的奇幻冒险游戏。"], deliverable: ["One 60-second vertical video, with a clear sponsorship disclosure and a fictional gameplay showcase.", "협찬 표기를 포함한 60초 세로 영상 1개와 가상 게임 플레이 소개.", "一条60秒竖屏视频，明确标注广告合作并展示虚构玩法。"] },
  { id: "cloudkeep", brand: "CLOUDKEEP", title: "Cloudkeep Tactics — build your strategy", platforms: ["YouTube", "Twitch"], countries: ["KR"], category: "gaming", followersMin: 10000, followersMax: 500000, budget: 1500, fixed: true, deadline: "2026-12-12", theme: "cyan", overview: ["A sample strategy-game collaboration built around helpful explanations and community play.", "전략 설명과 커뮤니티 플레이를 중심으로 한 가상 게임 협업 예시입니다.", "以策略讲解和社区互动为主题的虚构游戏合作示例。"], deliverable: ["One gameplay video or a 60-minute livestream. Final requirements would be agreed before a live campaign.", "게임 플레이 영상 1개 또는 60분 라이브 방송. 실제 요건은 집행 전 합의가 필요합니다.", "一条游戏视频或60分钟直播，真实要求需在活动开始前确认。"] },
  { id: "prism", brand: "PRISM STAGE", title: "Prism Stage — make your moment", platforms: ["TikTok", "Instagram"], countries: ["GLOBAL"], category: "entertainment", followersMin: 1000, followersMax: 200000, budget: 750, fixed: false, deadline: "2026-12-28", theme: "rose", overview: ["A fictional entertainment launch for creators who turn music and movement into engaging short videos.", "음악과 움직임을 짧은 영상으로 표현하는 크리에이터를 위한 가상 엔터테인먼트 캠페인입니다.", "面向音乐与创意短视频达人的虚构娱乐推广活动。"], deliverable: ["Two short videos using a supplied, rights-cleared sample creative brief.", "사용 권리를 확인한 예시 가이드를 활용한 숏폼 영상 2개.", "根据已确认使用权的示例创意指南制作两条短视频。"] },
  { id: "orbit", brand: "ORBIT RALLY", title: "Orbit Rally — race beyond the ordinary", platforms: ["YouTube", "Twitch"], countries: ["KR", "US"], category: "gaming", followersMin: 100000, followersMax: 1000000, budget: 3500, fixed: true, deadline: "2027-01-05", theme: "blue", overview: ["Preview an imaginary competitive racing game with entertaining commentary and community challenges.", "재미있는 해설과 커뮤니티 챌린지로 가상의 경쟁형 레이싱 게임을 소개하는 예시입니다.", "通过趣味解说和社区挑战展示一款虚构的竞技赛车游戏。"], deliverable: ["One dedicated video and one community post, subject to an agreed creative brief.", "합의된 가이드에 따른 전용 영상 1개와 커뮤니티 게시물 1개.", "根据双方确认的指南制作一条专题视频及一条社区帖子。"] },
  { id: "mossvale", brand: "MOSSVALE", title: "Mossvale Stories — a slower kind of adventure", platforms: ["YouTube", "Instagram"], countries: ["KR", "JP"], category: "gaming", followersMin: 1000, followersMax: 300000, budget: 500, fixed: true, deadline: "2026-12-08", theme: "green", overview: ["A cozy, fictional game campaign for storytellers who enjoy thoughtful exploration and everyday creativity.", "차분한 탐험과 일상의 창의성을 담는 크리에이터를 위한 가상 힐링 게임 캠페인입니다.", "为喜欢慢节奏探索与生活创意的达人设计的虚构治愈游戏活动。"], deliverable: ["One first-impressions video with an honest review and clear advertising disclosure.", "솔직한 첫인상과 광고 표기를 포함한 소개 영상 1개.", "一条真实表达第一印象的视频，并明确标注广告合作。"] },
  { id: "cloudberry", brand: "CLOUDBERRY", title: "Cloudberry Desk — create your own space", platforms: ["Instagram", "TikTok"], countries: ["KR", "US"], category: "lifestyle", followersMin: 1000, followersMax: 100000, budget: 300, fixed: true, deadline: "2026-12-16", theme: "peach", overview: ["An invented lifestyle collaboration exploring creative workspaces. No physical product will be supplied.", "창의적인 작업 공간을 소개하는 가상 라이프스타일 협업입니다. 실제 제품은 제공되지 않습니다.", "以创意工作空间为主题的虚构生活方式合作，不会提供真实产品。"], deliverable: ["One short workspace tour following a sample storyboard.", "예시 스토리보드를 따른 짧은 작업 공간 소개 영상 1개.", "按照示例脚本制作一条工作空间短视频。"] },
];

const DEMO_OFFERS: DemoOffer[] = DEMO_OFFER_CONTENT.map((offer, index) => ({
  ...offer,
  postedAt: ["2026-10-21", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-16", "2026-10-17"][index]!,
}));

const defaultFilters = { query: "", platform: "", country: "", category: "", followers: "", budget: "", start: "", end: "", sort: "newest" };

function displayDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value));
}

export function AgencyWorkspace({ initialLocale: locale, initialSection = "offers", organizationName, status, userName, agencyType, submittedAt }: AgencyAccount & { initialLocale: Locale; initialSection?: AgencySection }) {
  const copy = agencyCopy[locale];
  const t = (en: string, ko: string, zh: string) => agencyText(locale, en, ko, zh);
  const [section, setSection] = useState(initialSection);
  const [navOpen, setNavOpen] = useState(false);
  const [view, setView] = useState<"board" | "list">("board");
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedOffer, setSelectedOffer] = useState<DemoOffer | null>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const mainHeading = useRef<HTMLHeadingElement>(null);
  const pending = status === "PENDING";
  const money = (amount: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  const compactNumber = (amount: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 0 }).format(amount);
  const regionName = (value: string) => ({ KR: copy.korea, JP: copy.japan, US: copy.us, GLOBAL: copy.global })[value] ?? value;
  const invalidDates = Boolean(filters.start && filters.end && filters.start > filters.end);
  const offers = DEMO_OFFERS.filter((offer) => {
    const followers = Number(filters.followers);
    return !invalidDates && (!filters.query || `${offer.title} ${offer.brand}`.toLowerCase().includes(filters.query.toLowerCase().trim())) &&
      (!filters.platform || offer.platforms.includes(filters.platform)) &&
      (!filters.country || offer.countries.includes("GLOBAL") || offer.countries.includes(filters.country)) &&
      (!filters.category || offer.category === filters.category) &&
      (!filters.followers || (offer.followersMin <= followers && offer.followersMax >= followers)) &&
      (!filters.budget || (filters.budget === "under500" ? offer.budget < 500 : filters.budget === "500to2000" ? offer.budget >= 500 && offer.budget <= 2000 : offer.budget > 2000)) &&
      (!filters.start || offer.deadline >= filters.start) && (!filters.end || offer.deadline <= filters.end);
  }).sort((a, b) => filters.sort === "closing" ? a.deadline.localeCompare(b.deadline) : filters.sort === "highest" ? b.budget - a.budget : b.postedAt.localeCompare(a.postedAt));

  useEffect(() => {
    function syncSection() {
      const requested = new URL(window.location.href).searchParams.get("section");
      setSection(agencySections.includes(requested as AgencySection) ? requested as AgencySection : "offers");
      setNavOpen(false);
      requestAnimationFrame(() => mainHeading.current?.focus({ preventScroll: true }));
    }
    window.addEventListener("popstate", syncSection);
    return () => window.removeEventListener("popstate", syncSection);
  }, []);

  useEffect(() => {
    if (selectedOffer) drawer.current?.showModal();
    else drawer.current?.close();
  }, [selectedOffer]);

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
  function dismissNavigation() {
    setNavOpen(false);
    menuTrigger.current?.focus({ preventScroll: true });
  }
  function updateFilter(key: keyof typeof defaultFilters, value: string) { setFilters((current) => ({ ...current, [key]: value })); }
  function navLink(key: AgencySection, Icon: typeof Search, nested = false) {
    return <Link key={key} href={`/agency?lang=${locale}&section=${key}`} aria-current={section === key ? "page" : undefined} className={`cwa-nav-item${section === key ? " is-active" : ""}${nested ? " is-nested" : ""}`} onClick={(event) => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(key); }}><Icon size={18} aria-hidden="true" /><span>{copy[key]}</span></Link>;
  }
  function selectFilter(key: keyof typeof defaultFilters, label: string, options: { value: string; label: string }[]) {
    return <ProfileSelect id={`agency-${key}`} label={label} placeholder={copy.any} value={filters[key]} onChange={(value) => updateFilter(key, value)} options={options} />;
  }

  const emptyContent = {
    projects: { title: copy.emptyProjects, body: copy.emptyProjectsBody, icon: FolderOpen },
    invitations: { title: copy.emptyInvitations, body: copy.emptyInvitationsBody, icon: Mail },
    "creator-projects": { title: copy.emptyCreatorProjects, body: copy.emptyCreatorProjectsBody, icon: FileText },
    creators: { title: copy.emptyCreators, body: copy.emptyCreatorsBody, icon: Users },
    payments: { title: copy.emptyPayments, body: copy.emptyPaymentsBody, icon: Wallet },
    notifications: { title: copy.emptyNotifications, body: copy.emptyNotificationsBody, icon: Bell },
  };
  const empty = section !== "offers" && section !== "organization" ? emptyContent[section] : null;
  const EmptyIcon = empty?.icon ?? FolderOpen;

  return <div className="cwa-workspace" lang={locale === "zh" ? "zh-CN" : locale}>
    <header className="cwa-topbar">
      <button ref={menuTrigger} type="button" className="cwa-icon-button cwa-mobile-menu" aria-label={copy.menu} aria-expanded={navOpen} aria-controls="agency-navigation" onClick={() => setNavOpen(!navOpen)}><Menu size={22} /></button>
      <Link href={`/?lang=${locale}`} className="cwa-logo"><span aria-hidden="true">F</span><span>Futures <strong>Medialab</strong></span></Link>
      <span className="cwa-topbar-divider" /><span className="cwa-topbar-label">{copy.workspace}</span>
      <div className="cwa-top-actions"><button className="cwa-icon-button" type="button" aria-label={copy.notifications} onClick={() => navigate("notifications")}><Bell size={20} /></button><LanguageSwitcher locale={locale} label={copy.language} onChange={(next) => { document.cookie = `fm-locale=${next};path=/;max-age=31536000;SameSite=Lax`; window.location.assign(`/agency?lang=${next}&section=${section}`); }} /><button type="button" className="cwa-avatar" onClick={() => navigate("organization")} aria-label={copy.organization}>{userName.slice(0, 2).toUpperCase()}</button></div>
    </header>
    {navOpen && <button className="cwa-mobile-backdrop" aria-label={copy.menu} onClick={dismissNavigation} />}
    <aside id="agency-navigation" className={`cwa-sidebar${navOpen ? " is-open" : ""}`}><nav aria-label={copy.workspace}>
      {navLink("offers", LayoutGrid)}
      <div className="cwa-nav-group"><span><Handshake size={17} aria-hidden="true" />{copy.officialGroup}</span>{navLink("projects", FolderOpen, true)}</div>
      <div className="cwa-nav-group"><span><Users size={17} aria-hidden="true" />{copy.creatorsGroup}</span>{navLink("invitations", Mail, true)}{navLink("creator-projects", FileText, true)}</div>
      {navLink("creators", Users)}{navLink("payments", Wallet)}
      <div className="cwa-nav-group"><span><Building2 size={17} aria-hidden="true" />{copy.accountGroup}</span>{navLink("organization", Building2, true)}</div>
      {navLink("notifications", Bell)}
    </nav><div className="cwa-sidebar-footer"><span className="cwa-avatar">{organizationName.slice(0, 1).toUpperCase()}</span><div><strong>{organizationName}</strong><span>{agencyType === "studio" ? copy.studio : copy.agency}</span></div></div></aside>
    <main className="cwa-main">
      <div className="cwa-heading"><div><h1 ref={mainHeading} tabIndex={-1}>{section === "offers" ? copy.offersTitle : copy[section]}</h1>{section === "organization" && <p className="cwa-subtitle">{copy.organizationSubtitle}</p>}</div><span className="cwa-preview-badge"><Sparkles size={16} aria-hidden="true" />{copy.preview}</span></div>
      <section className={`cwa-approval-banner${pending ? " is-pending" : ""}`} aria-label={copy.status}><ShieldCheck size={25} aria-hidden="true" /><div><strong>{pending ? copy.pendingTitle : copy.activeTitle}</strong><p>{pending ? copy.pendingBody : copy.activeBody}</p></div><Link href={`/onboarding/agency?lang=${locale}`}>{copy.reviewProfile}<ChevronRight size={17} aria-hidden="true" /></Link></section>

      {section === "offers" ? <>
        <div className="cwa-demo-note"><Sparkles size={17} aria-hidden="true" /><span>{copy.demoNotice}</span></div>
        <section className="cwa-filters" aria-label={copy.searchLabel}>
          <div className="cwa-search-row"><label className="cwa-search-input"><Search size={19} aria-hidden="true" /><input aria-label={copy.searchLabel} placeholder={copy.searchPlaceholder} value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} /></label><button className="cwa-button" type="button" onClick={() => setFilters(defaultFilters)}>{copy.reset}</button></div>
          <div className="cwa-filter-grid">
            {selectFilter("platform", copy.platform, [{ value: "", label: copy.allPlatforms }, ...["YouTube", "TikTok", "Instagram", "Twitch"].map((name) => ({ value: name, label: name }))])}
            {selectFilter("country", copy.country, [{ value: "", label: copy.allCountries }, ...["KR", "JP", "US"].map((value) => ({ value, label: regionName(value) }))])}
            {selectFilter("category", copy.category, [{ value: "", label: copy.allCategories }, ...(["gaming", "entertainment", "lifestyle"] as const).map((value) => ({ value, label: copy[value] }))])}
            {selectFilter("followers", copy.followers, [{ value: "", label: copy.anyFollowers }, { value: "1000", label: "1K" }, { value: "10000", label: "10K" }, { value: "100000", label: "100K" }, { value: "500000", label: "500K" }])}
            {selectFilter("budget", copy.budget, [{ value: "", label: copy.anyBudget }, { value: "under500", label: `< ${money(500)}` }, { value: "500to2000", label: `${money(500)} – ${money(2000)}` }, { value: "over2000", label: `> ${money(2000)}` }])}
            <fieldset className="cwa-date-range"><legend>{copy.deadline}</legend><div><input type="date" aria-label={`${copy.deadline} ${copy.startDate}`} value={filters.start} onChange={(event) => updateFilter("start", event.target.value)} /><span aria-hidden="true">–</span><input type="date" aria-label={`${copy.deadline} ${copy.endDate}`} value={filters.end} onChange={(event) => updateFilter("end", event.target.value)} /></div></fieldset>
          </div>{invalidDates && <p className="cwa-date-error" role="alert">{copy.invalidDates}</p>}
        </section>
        <div className="cwa-results-toolbar"><p><strong>{offers.length}</strong> {copy.results}</p><div>{selectFilter("sort", copy.sort, [{ value: "newest", label: copy.newest }, { value: "closing", label: copy.closing }, { value: "highest", label: copy.highest }])}<div className="cwa-view-toggle" aria-label={t("Display mode", "표시 방식", "显示方式")}><button type="button" aria-label={copy.board} aria-pressed={view === "board"} className={view === "board" ? "is-active" : ""} onClick={() => setView("board")}><LayoutGrid size={18} aria-hidden="true" />{copy.board}</button><button type="button" aria-label={copy.list} aria-pressed={view === "list"} className={view === "list" ? "is-active" : ""} onClick={() => setView("list")}><List size={18} aria-hidden="true" />{copy.list}</button></div></div></div>
        {offers.length ? <div className={`cwa-offers cwa-offers-${view}`}>{offers.map((offer) => <article className="cwa-offer" key={offer.id}>
          <button type="button" className={`cwa-offer-art cwa-theme-${offer.theme}`} onClick={() => setSelectedOffer(offer)} aria-label={`${copy.viewBrief}: ${offer.title}`}><span className="cwa-art-orbit" /><Gamepad2 className="cwa-art-icon" size={104} aria-hidden="true" /><span className="cwa-card-badge">{copy.demoShort}</span><span className="cwa-art-brand">{offer.brand}</span></button>
          <div className="cwa-offer-body"><div className="cwa-offer-meta"><span>{copy[offer.category]}</span><span><CalendarDays size={14} aria-hidden="true" />{displayDate(offer.deadline, locale)}</span></div><h2><button type="button" onClick={() => setSelectedOffer(offer)}>{offer.title}</button></h2><p className="cwa-offer-platforms">{offer.platforms.join(" · ")}</p><div className="cwa-offer-tags"><span><Users size={14} aria-hidden="true" />{compactNumber(offer.followersMin)} – {compactNumber(offer.followersMax)}</span><span><Globe2 size={14} aria-hidden="true" />{offer.countries.map(regionName).join(" / ")}</span></div><div className="cwa-offer-footer"><div><span>{offer.fixed ? copy.fixed : copy.upTo}</span><strong>{money(offer.budget)} <small>USD</small></strong></div><button className="cwa-card-action" type="button" aria-label={`${copy.viewBrief}: ${offer.title}`} onClick={() => setSelectedOffer(offer)}><ArrowRight size={20} aria-hidden="true" /></button></div></div>
        </article>)}</div> : <section className="cwa-empty"><Search size={34} aria-hidden="true" /><h2>{copy.noOffers}</h2><p>{copy.noOffersBody}</p><button className="cwa-button" onClick={() => setFilters(defaultFilters)}>{copy.reset}</button></section>}
      </> : section === "organization" ? <section className="cwa-organization"><div className="cwa-section-heading"><Building2 size={24} aria-hidden="true" /><div><h2>{organizationName}</h2><p>{copy.profileNotice}</p></div></div><dl><div><dt>{copy.company}</dt><dd>{organizationName}</dd></div><div><dt>{copy.type}</dt><dd>{agencyType === "studio" ? copy.studio : copy.agency}</dd></div><div><dt>{copy.status}</dt><dd className="cwa-review-status">{pending ? <Clock3 size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}{pending ? copy.pending : copy.active}</dd></div><div><dt>{copy.submitted}</dt><dd>{submittedAt ? displayDate(submittedAt, locale) : copy.notSubmitted}</dd></div></dl><Link className="cwa-button cwa-button-primary" href={`/onboarding/agency?lang=${locale}`}>{copy.reviewProfile}<ArrowRight size={17} aria-hidden="true" /></Link></section> : <>
        {section === "payments" && <><div className="cwa-payment-summary">{[copy.available, copy.pendingEarnings, copy.paid].map((label) => <div key={label}><span>{label}</span><strong>—</strong><small>{copy.noFinancialData}</small></div>)}</div><div className="cwa-payment-note"><ShieldCheck size={20} aria-hidden="true" /><p>{copy.paymentNotice}</p><button className="cwa-button" type="button" disabled>{copy.withdrawal}</button></div></>}
        {empty && <section className="cwa-empty"><span className="cwa-empty-icon"><EmptyIcon size={34} aria-hidden="true" /></span><span className="cwa-empty-eyebrow">{copy.noActualData}</span><h2>{empty.title}</h2><p>{empty.body}</p>{section === "creators" ? <button type="button" className="cwa-button" disabled>{copy.rosterAction}</button> : section !== "payments" && section !== "notifications" ? <button type="button" className="cwa-button cwa-button-primary" onClick={() => navigate("offers")}>{copy.explore}<ArrowRight size={17} aria-hidden="true" /></button> : null}</section>}
      </>}
      <p className="cwa-prototype-note">{copy.prototypeNote}</p>
    </main>
    <dialog className="cwa-drawer" ref={drawer} aria-labelledby="agency-offer-title" onClose={() => setSelectedOffer(null)} onClick={(event) => { if (event.target !== event.currentTarget) return; const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) setSelectedOffer(null); }}>
      {selectedOffer && <><div className="cwa-drawer-heading"><span><FileText size={19} aria-hidden="true" />{copy.details}</span><button className="cwa-icon-button" type="button" aria-label={copy.close} onClick={() => setSelectedOffer(null)}><X size={22} /></button></div><div className={`cwa-drawer-art cwa-theme-${selectedOffer.theme}`}><Gamepad2 size={112} aria-hidden="true" /><span>{selectedOffer.brand}</span><span className="cwa-card-badge">{copy.demo}</span></div><div className="cwa-drawer-content"><h2 id="agency-offer-title">{selectedOffer.title}</h2><p className="cwa-drawer-notice">{copy.demoBrief}</p><h3>{copy.overview}</h3><p>{agencyText(locale, ...selectedOffer.overview)}</p><h3>{copy.requirements}</h3><dl className="cwa-brief-details"><div><dt>{copy.channels}</dt><dd>{selectedOffer.platforms.join(" / ")}</dd></div><div><dt>{copy.target}</dt><dd>{selectedOffer.countries.map(regionName).join(" / ")}</dd></div><div><dt>{copy.eligibility}</dt><dd>{compactNumber(selectedOffer.followersMin)} – {compactNumber(selectedOffer.followersMax)}</dd></div><div><dt>{copy.due}</dt><dd>{displayDate(selectedOffer.deadline, locale)}</dd></div></dl><h3>{copy.deliverables}</h3><p>{agencyText(locale, ...selectedOffer.deliverable)}</p><h3>{copy.payout}</h3><div className="cwa-brief-payout"><span>{selectedOffer.fixed ? copy.fixed : copy.upTo}</span><strong>{money(selectedOffer.budget)} USD</strong></div><p>{selectedOffer.fixed ? copy.fixedNote : copy.cpmNote}</p><div className="cwa-apply-gate"><button className="cwa-button cwa-button-primary" type="button" disabled>{pending ? copy.applyPending : copy.applyDemo}</button><p>{copy.applyNote}</p></div></div></>}
    </dialog>
  </div>;
}
