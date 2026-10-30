"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  FileText,
  Gamepad2,
  Megaphone,
  Menu,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { Locale } from "../_components/landing-copy";
import { BrandSymbol } from "../_components/brand-logo";
import { LanguageSwitcher } from "../_components/language-switcher";
import { landingCopy } from "./copy";

const campaignPlatforms = [
  "YouTube · Twitch",
  "YouTube · TikTok",
  "YouTube · Instagram",
];
const campaignArtwork = [
  "/backup-assets/mmorpg.webp",
  "/backup-assets/subculture.webp",
  "/backup-assets/survival.webp",
];
const stepIcons = [FileText, Users, Check];
type LandingTheme = "chzzk" | "chzzk-light" | "orange" | "thefair";
const themeArtwork: Record<LandingTheme, string> = {
  chzzk: "/landing/creator-world-chzzk.webp",
  "chzzk-light": "/landing/creator-world-chzzk-neutral.webp",
  orange: "/landing/creator-world-orange-monochrome.webp",
  thefair: "/landing/creator-world-thefair.webp",
};
const themeRoutes: Record<LandingTheme, string> = {
  chzzk: "/landing-chzzk",
  "chzzk-light": "/chzzk-light",
  orange: "/landing-orange",
  thefair: "/landing-thefair",
};
const themeLabels = {
  ko: {
    label: "색상 비교",
    original: "기본",
    chzzk: "다크 민트",
    "chzzk-light": "라이트 민트",
    orange: "오렌지",
    thefair: "더페어 아쿠아",
  },
  en: {
    label: "Color previews",
    original: "Original",
    chzzk: "Dark mint",
    "chzzk-light": "Light mint",
    orange: "Orange",
    thefair: "The Fair aqua",
  },
  zh: {
    label: "配色预览",
    original: "原版",
    chzzk: "暗夜薄荷",
    "chzzk-light": "明亮薄荷",
    orange: "亮橙",
    thefair: "The Fair 青色",
  },
};

function Logo({ footer = false }: { footer?: boolean }) {
  return (
    <a
      className={`fmb-logo${footer ? " fmb-logo-footer" : ""}`}
      href="#top"
      aria-label="Futures Medialab"
    >
      <BrandSymbol />
      <span>
        futures<span className="fmb-logo-sub">MEDIALAB</span>
      </span>
    </a>
  );
}

export function ArchivedLandingExperience({
  initialLocale,
  theme,
}: {
  initialLocale: Locale;
  theme?: LandingTheme;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [menuOpen, setMenuOpen] = useState(false);
  const [category, setCategory] = useState("all");
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const copy = landingCopy[locale];
  const accountUrl = (role?: "brand" | "agency") =>
    `/register${role ? `/${role}` : ""}?lang=${locale}`;
  const loginUrl = `/login?lang=${locale}`;

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  }, [locale]);

  useEffect(() => {
    if (selectedCampaign !== null) dialogRef.current?.showModal();
  }, [selectedCampaign]);

  function changeLocale(next: Locale) {
    setLocale(next);
    document.cookie = `fm-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
  }

  function openConcept(index: number) {
    setSelectedCampaign(index);
  }

  return (
    <div className="fmb-site" data-theme={theme} id="top">
      <header
        className="fmb-header"
        onKeyDown={(event) => {
          if (event.key === "Escape" && menuOpen) {
            setMenuOpen(false);
            menuRef.current?.focus();
          }
        }}
      >
        <div className="fmb-header-inner fmb-container">
          <Logo />
          <nav className="fmb-desktop-nav" aria-label={copy.nav.menu}>
            <a href="#campaigns" className="fmb-nav-selected">
              {copy.nav.explore}
            </a>
            <a href="#how-it-works">{copy.nav.how}</a>
            <a href="#partners">{copy.nav.partners}</a>
          </nav>
          <div className="fmb-header-actions">
            <LanguageSwitcher
              locale={locale}
              label={copy.nav.language}
              onChange={changeLocale}
            />
            <Link className="fmb-login" href={loginUrl}>
              {copy.nav.login}
            </Link>
            <Link
              className="fmb-button fmb-button-small fmb-header-join"
              href={accountUrl()}
            >
              {copy.nav.join}
              <ArrowUpRight size={16} />
            </Link>
            <button
              ref={menuRef}
              className="fmb-icon-button fmb-menu-toggle"
              type="button"
              aria-label={menuOpen ? copy.nav.close : copy.nav.menu}
              aria-expanded={menuOpen}
              aria-controls="fmb-mobile-menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            className="fmb-mobile-nav"
            id="fmb-mobile-menu"
            aria-label={copy.nav.menu}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setMenuOpen(false);
                menuRef.current?.focus();
              }
            }}
          >
            <a onClick={() => setMenuOpen(false)} href="#campaigns">
              {copy.nav.explore}
            </a>
            <a onClick={() => setMenuOpen(false)} href="#how-it-works">
              {copy.nav.how}
            </a>
            <a onClick={() => setMenuOpen(false)} href="#partners">
              {copy.nav.partners}
            </a>
            <Link href={loginUrl}>{copy.nav.login}</Link>
            <Link href={accountUrl()}>{copy.nav.join}</Link>
          </nav>
        )}
      </header>

      <main>
        <div className="fmb-container fmb-intro">
          {theme && (
            <nav
              className="fmb-theme-preview"
              aria-label={themeLabels[locale].label}
            >
              <span>{themeLabels[locale].label}</span>
              <div>
                <Link href={`/?lang=${locale}`}>
                  <span
                    className="fmb-theme-swatch fmb-theme-swatch-original"
                    aria-hidden="true"
                  />
                  {themeLabels[locale].original}
                </Link>
                {(["chzzk", "chzzk-light", "orange", "thefair"] as const).map(
                  (variant) => (
                    <Link
                      key={variant}
                      href={`${themeRoutes[variant]}?lang=${locale}`}
                      aria-current={theme === variant ? "page" : undefined}
                    >
                      <span
                        className={`fmb-theme-swatch fmb-theme-swatch-${variant}`}
                        aria-hidden="true"
                      />
                      {themeLabels[locale][variant]}
                    </Link>
                  ),
                )}
              </div>
            </nav>
          )}
          <a className="fmb-announcement" href="#how-it-works">
            <span>
              <Megaphone size={19} />
              {copy.announcement.line}
            </span>
            <span className="fmb-announcement-link">
              {copy.announcement.link}
              <ArrowRight size={18} />
            </span>
          </a>
          <section className="fmb-hero" aria-labelledby="fmb-hero-title">
            <div className="fmb-hero-copy">
              <p className="fmb-eyebrow">
                <span className="fmb-status-dot" />
                {copy.hero.eyebrow}
              </p>
              <h1 id="fmb-hero-title">
                {copy.hero.titleLine1}
                <br />
                <span>{copy.hero.titleLine2}</span>
              </h1>
              <p className="fmb-hero-description">{copy.hero.body}</p>
              <div className="fmb-hero-buttons">
                <Link className="fmb-button" href={accountUrl("brand")}>
                  {copy.hero.primary}
                  <ArrowUpRight size={19} />
                </Link>
                <Link className="fmb-text-link" href={accountUrl("agency")}>
                  {copy.hero.secondary}
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
            <div className="fmb-hero-art">
              <Image
                src={
                  theme
                    ? themeArtwork[theme]
                    : "/backup-assets/creator-world.webp"
                }
                alt={copy.hero.visualLabel}
                width={1536}
                height={1024}
                sizes="(max-width: 700px) 100vw, 650px"
                priority
              />
              <div className="fmb-art-tag">
                <Sparkles size={17} />
                <span>{copy.hero.artTag}</span>
              </div>
            </div>
            <a
              href="#campaigns"
              className="fmb-hero-down"
              aria-label={copy.nav.explore}
            >
              <ArrowDown size={20} />
            </a>
          </section>

          <div className="fmb-quick-links">
            <Link href={accountUrl("brand")} className="fmb-quick-link">
              <span className="fmb-quick-icon">
                <Megaphone />
              </span>
              <span>
                <strong>{copy.quickLinks.brand.title}</strong>
                <span>{copy.quickLinks.brand.description}</span>
              </span>
              <ArrowUpRight className="fmb-quick-arrow" />
            </Link>
            <Link href={accountUrl("agency")} className="fmb-quick-link">
              <span className="fmb-quick-icon">
                <Users />
              </span>
              <span>
                <strong>{copy.quickLinks.agency.title}</strong>
                <span>{copy.quickLinks.agency.description}</span>
              </span>
              <ArrowUpRight className="fmb-quick-arrow" />
            </Link>
          </div>
        </div>

        <section
          className="fmb-discovery fmb-container fmb-section"
          id="campaigns"
          aria-labelledby="fmb-discovery-title"
        >
          <div className="fmb-section-heading">
            <div>
              <h2 id="fmb-discovery-title">{copy.discovery.title}</h2>
            </div>
            <p>{copy.discovery.body}</p>
          </div>
          <div className="fmb-filter-row" aria-label={copy.nav.explore}>
            <button
              type="button"
              className={`fmb-filter${category === "all" ? " fmb-filter-active" : ""}`}
              aria-pressed={category === "all"}
              onClick={() => setCategory("all")}
            >
              <Gamepad2 size={18} />
              {copy.discovery.all}
            </button>
            {copy.sampleCampaigns.map((campaign) => (
              <button
                type="button"
                key={campaign.id}
                className={`fmb-filter${category === campaign.id ? " fmb-filter-active" : ""}`}
                aria-pressed={category === campaign.id}
                onClick={() => setCategory(campaign.id)}
              >
                {campaign.category}
              </button>
            ))}
          </div>
          <div className="fmb-campaign-grid" aria-live="polite">
            {copy.sampleCampaigns.map((campaign, index) =>
              category === "all" || category === campaign.id ? (
                <article className="fmb-campaign-card" key={campaign.id}>
                  <button
                    type="button"
                    className="fmb-card-image-button"
                    onClick={() => openConcept(index)}
                    aria-label={`${copy.discovery.cardAction}: ${campaign.title}`}
                  >
                    <div className="fmb-card-art">
                      <Image
                        src={campaignArtwork[index]}
                        alt=""
                        fill
                        sizes="(max-width: 700px) 100vw, (max-width: 1280px) 33vw, 384px"
                      />
                    </div>
                    <span className="fmb-card-badge">
                      {copy.discovery.sampleLabel}
                    </span>
                    <span className="fmb-card-arrow">
                      <ArrowUpRight size={21} />
                    </span>
                  </button>
                  <div className="fmb-card-content">
                    <p className="fmb-card-category">{campaign.category}</p>
                    <h3>
                      <button type="button" onClick={() => openConcept(index)}>
                        {campaign.title}
                      </button>
                    </h3>
                    <p className="fmb-card-description">
                      {campaign.description}
                    </p>
                    <p className="fmb-card-meta">
                      <span>{campaignPlatforms[index]}</span>
                      <span>KR</span>
                    </p>
                  </div>
                </article>
              ) : null,
            )}
          </div>
          <p className="fmb-sample-note">{copy.discovery.notReal}</p>
          <Link href={loginUrl} className="fmb-wide-link">
            {copy.discovery.viewAll}
            <ArrowRight size={19} />
          </Link>
        </section>

        <section
          className="fmb-workflow"
          id="how-it-works"
          aria-labelledby="fmb-workflow-title"
        >
          <div className="fmb-container fmb-section">
            <div className="fmb-section-heading">
              <div>
                <p className="fmb-eyebrow">{copy.workflow.eyebrow}</p>
                <h2 id="fmb-workflow-title">{copy.workflow.title}</h2>
              </div>
              <p>{copy.workflow.body}</p>
            </div>
            <ol className="fmb-steps">
              {copy.workflow.steps.map((step, index) => {
                const Icon = stepIcons[index]!;
                return (
                  <li key={index}>
                    <div className="fmb-step-top">
                      <span className="fmb-step-icon">
                        <Icon size={29} />
                      </span>
                      <span className="fmb-step-number">0{index + 1}</span>
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section
          className="fmb-container fmb-section fmb-partners"
          id="partners"
          aria-labelledby="fmb-partners-title"
        >
          <h2 id="fmb-partners-title">{copy.partners.title}</h2>
          <p className="fmb-partners-intro">{copy.partners.body}</p>
          <div className="fmb-partner-grid">
            <article className="fmb-partner-card fmb-partner-brand">
              <span className="fmb-partner-icon">
                <Megaphone size={34} />
              </span>
              <p className="fmb-partner-label">{copy.partners.brandLabel}</p>
              <h3>{copy.partners.brandTitle}</h3>
              <p>{copy.partners.brandBody}</p>
              <Link className="fmb-text-link" href={accountUrl("brand")}>
                {copy.partners.brandCta}
                <ArrowUpRight size={21} />
              </Link>
            </article>
            <article className="fmb-partner-card fmb-partner-agency">
              <span className="fmb-partner-icon">
                <Users size={34} />
              </span>
              <p className="fmb-partner-label">{copy.partners.agencyLabel}</p>
              <h3>{copy.partners.agencyTitle}</h3>
              <p>{copy.partners.agencyBody}</p>
              <Link className="fmb-text-link" href={accountUrl("agency")}>
                {copy.partners.agencyCta}
                <ArrowUpRight size={21} />
              </Link>
            </article>
          </div>
        </section>

        <section
          className="fmb-faq fmb-container"
          aria-labelledby="fmb-faq-title"
        >
          <h2 id="fmb-faq-title">{copy.faq.title}</h2>
          <div>
            {copy.faq.items.map((item, index) => (
              <details key={index}>
                <summary>
                  {item.question}
                  <ChevronDown size={20} />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="fmb-container fmb-final-wrap">
          <div className="fmb-final">
            <Sparkles size={35} />
            <h2>{copy.final.title}</h2>
            <p>{copy.final.body}</p>
            <Link className="fmb-button fmb-button-white" href={accountUrl()}>
              {copy.final.button}
              <ArrowUpRight size={19} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="fmb-footer fmb-container">
        <div>
          <Logo footer />
          <p>{copy.footer.tagline}</p>
        </div>
        <nav aria-label={copy.footer.home}>
          <Link href={`/test?lang=${locale}`}>{copy.footer.home}</Link>
          <Link href={loginUrl}>{copy.footer.login}</Link>
          <Link href={accountUrl()}>{copy.footer.register}</Link>
        </nav>
        <p className="fmb-footer-note">{copy.footer.prototype}</p>
        <p className="fmb-copyright">
          © {new Date().getFullYear()} Futures Medialab
        </p>
      </footer>

      <dialog
        ref={dialogRef}
        className="fmb-concept-dialog"
        aria-labelledby="fmb-concept-title"
        onClose={() => setSelectedCampaign(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="fmb-dialog-body">
          <button
            type="button"
            className="fmb-icon-button fmb-dialog-close"
            aria-label={copy.discovery.close}
            onClick={() => dialogRef.current?.close()}
          >
            <X />
          </button>
          {selectedCampaign !== null && (
            <>
              <p className="fmb-eyebrow">{copy.discovery.sampleLabel}</p>
              <h2 id="fmb-concept-title">
                {copy.sampleCampaigns[selectedCampaign]!.title}
              </h2>
              <p>{copy.sampleCampaigns[selectedCampaign]!.description}</p>
              <dl>
                <div>
                  <dt>{copy.discovery.platform}</dt>
                  <dd>{campaignPlatforms[selectedCampaign]}</dd>
                </div>
                <div>
                  <dt>{copy.discovery.region}</dt>
                  <dd>
                    {locale === "ko"
                      ? "대한민국"
                      : locale === "zh"
                        ? "韩国"
                        : "South Korea"}
                  </dd>
                </div>
              </dl>
              <p className="fmb-dialog-note">{copy.discovery.notReal}</p>
              <Link href={loginUrl} className="fmb-button">
                {copy.discovery.viewAll}
                <ArrowRight size={18} />
              </Link>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
