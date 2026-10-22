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
import { BrandSymbol } from "../_components/landing-visuals";
import { LanguageSwitcher } from "../_components/language-switcher";
import { landingCopy } from "./copy";

const campaignPlatforms = [
  "YouTube · Twitch",
  "YouTube · TikTok",
  "YouTube · Instagram",
];
const campaignArtwork = [
  "/campaign-art/mmorpg.webp",
  "/campaign-art/subculture.webp",
  "/campaign-art/survival.webp",
];
const stepIcons = [FileText, Users, Check];

function Logo({ footer = false }: { footer?: boolean }) {
  return (
    <a
      className={`fl-logo${footer ? " fl-logo-footer" : ""}`}
      href="#top"
      aria-label="Futures Medialab"
    >
      <BrandSymbol />
      <span>
        futures<span className="fl-logo-sub">MEDIALAB</span>
      </span>
    </a>
  );
}

export function LandingExperience({
  initialLocale,
}: {
  initialLocale: Locale;
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
    <div className="fl-site" id="top">
      <header
        className="fl-header"
        onKeyDown={(event) => {
          if (event.key === "Escape" && menuOpen) {
            setMenuOpen(false);
            menuRef.current?.focus();
          }
        }}
      >
        <div className="fl-header-inner fl-container">
          <Logo />
          <nav className="fl-desktop-nav" aria-label={copy.nav.menu}>
            <a href="#campaigns" className="fl-nav-selected">
              {copy.nav.explore}
            </a>
            <a href="#how-it-works">{copy.nav.how}</a>
            <a href="#partners">{copy.nav.partners}</a>
          </nav>
          <div className="fl-header-actions">
            <LanguageSwitcher
              locale={locale}
              label={copy.nav.language}
              onChange={changeLocale}
            />
            <Link className="fl-login" href={loginUrl}>
              {copy.nav.login}
            </Link>
            <Link
              className="fl-button fl-button-small fl-header-join"
              href={accountUrl()}
            >
              {copy.nav.join}
              <ArrowUpRight size={16} />
            </Link>
            <button
              ref={menuRef}
              className="fl-icon-button fl-menu-toggle"
              type="button"
              aria-label={menuOpen ? copy.nav.close : copy.nav.menu}
              aria-expanded={menuOpen}
              aria-controls="fl-mobile-menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            className="fl-mobile-nav"
            id="fl-mobile-menu"
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
        <div className="fl-container fl-intro">
          <a className="fl-announcement" href="#how-it-works">
            <span>
              <Megaphone size={19} />
              {copy.announcement.line}
            </span>
            <span className="fl-announcement-link">
              {copy.announcement.link}
              <ArrowRight size={18} />
            </span>
          </a>
          <section className="fl-hero" aria-labelledby="fl-hero-title">
            <div className="fl-hero-copy">
              <p className="fl-eyebrow">
                <span className="fl-status-dot" />
                {copy.hero.eyebrow}
              </p>
              <h1 id="fl-hero-title">
                {copy.hero.titleLine1}
                <br />
                <span>{copy.hero.titleLine2}</span>
              </h1>
              <p className="fl-hero-description">{copy.hero.body}</p>
              <div className="fl-hero-buttons">
                <Link className="fl-button" href={accountUrl("brand")}>
                  {copy.hero.primary}
                  <ArrowUpRight size={19} />
                </Link>
                <Link className="fl-text-link" href={accountUrl("agency")}>
                  {copy.hero.secondary}
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
            <div className="fl-hero-art">
              <Image
                src="/landing/creator-world.webp"
                alt={copy.hero.visualLabel}
                width={1536}
                height={1024}
                sizes="(max-width: 700px) 100vw, 650px"
                priority
              />
              <div className="fl-art-tag">
                <Sparkles size={17} />
                <span>{copy.hero.artTag}</span>
              </div>
            </div>
            <a
              href="#campaigns"
              className="fl-hero-down"
              aria-label={copy.nav.explore}
            >
              <ArrowDown size={20} />
            </a>
          </section>

          <div className="fl-quick-links">
            <Link href={accountUrl("brand")} className="fl-quick-link">
              <span className="fl-quick-icon">
                <Megaphone />
              </span>
              <span>
                <strong>{copy.quickLinks.brand.title}</strong>
                <span>{copy.quickLinks.brand.description}</span>
              </span>
              <ArrowUpRight className="fl-quick-arrow" />
            </Link>
            <Link href={accountUrl("agency")} className="fl-quick-link">
              <span className="fl-quick-icon">
                <Users />
              </span>
              <span>
                <strong>{copy.quickLinks.agency.title}</strong>
                <span>{copy.quickLinks.agency.description}</span>
              </span>
              <ArrowUpRight className="fl-quick-arrow" />
            </Link>
          </div>
        </div>

        <section
          className="fl-discovery fl-container fl-section"
          id="campaigns"
          aria-labelledby="fl-discovery-title"
        >
          <div className="fl-section-heading">
            <div>
              <p className="fl-eyebrow">{copy.discovery.eyebrow}</p>
              <h2 id="fl-discovery-title">{copy.discovery.title}</h2>
            </div>
            <p>{copy.discovery.body}</p>
          </div>
          <div className="fl-filter-row" aria-label={copy.nav.explore}>
            <button
              type="button"
              className={`fl-filter${category === "all" ? " fl-filter-active" : ""}`}
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
                className={`fl-filter${category === campaign.id ? " fl-filter-active" : ""}`}
                aria-pressed={category === campaign.id}
                onClick={() => setCategory(campaign.id)}
              >
                {campaign.category}
              </button>
            ))}
          </div>
          <div className="fl-campaign-grid" aria-live="polite">
            {copy.sampleCampaigns.map((campaign, index) =>
              category === "all" || category === campaign.id ? (
                <article className="fl-campaign-card" key={campaign.id}>
                  <button
                    type="button"
                    className="fl-card-image-button"
                    onClick={() => openConcept(index)}
                    aria-label={`${copy.discovery.cardAction}: ${campaign.title}`}
                  >
                    <div className="fl-card-art">
                      <Image
                        src={campaignArtwork[index]}
                        alt=""
                        fill
                        sizes="(max-width: 700px) 100vw, (max-width: 1280px) 33vw, 384px"
                      />
                    </div>
                    <span className="fl-card-badge">
                      {copy.discovery.sampleLabel}
                    </span>
                    <span className="fl-card-arrow">
                      <ArrowUpRight size={21} />
                    </span>
                  </button>
                  <div className="fl-card-content">
                    <p className="fl-card-category">{campaign.category}</p>
                    <h3>
                      <button type="button" onClick={() => openConcept(index)}>
                        {campaign.title}
                      </button>
                    </h3>
                    <p className="fl-card-description">
                      {campaign.description}
                    </p>
                    <p className="fl-card-meta">
                      <span>{campaignPlatforms[index]}</span>
                      <span>KR</span>
                    </p>
                  </div>
                </article>
              ) : null,
            )}
          </div>
          <p className="fl-sample-note">{copy.discovery.notReal}</p>
          <Link href={loginUrl} className="fl-wide-link">
            {copy.discovery.viewAll}
            <ArrowRight size={19} />
          </Link>
        </section>

        <section
          className="fl-workflow"
          id="how-it-works"
          aria-labelledby="fl-workflow-title"
        >
          <div className="fl-container fl-section">
            <div className="fl-section-heading">
              <div>
                <p className="fl-eyebrow">{copy.workflow.eyebrow}</p>
                <h2 id="fl-workflow-title">{copy.workflow.title}</h2>
              </div>
              <p>{copy.workflow.body}</p>
            </div>
            <ol className="fl-steps">
              {copy.workflow.steps.map((step, index) => {
                const Icon = stepIcons[index]!;
                return (
                  <li key={index}>
                    <div className="fl-step-top">
                      <span className="fl-step-icon">
                        <Icon size={29} />
                      </span>
                      <span className="fl-step-number">0{index + 1}</span>
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
          className="fl-container fl-section fl-partners"
          id="partners"
          aria-labelledby="fl-partners-title"
        >
          <p className="fl-eyebrow">{copy.partners.eyebrow}</p>
          <h2 id="fl-partners-title">{copy.partners.title}</h2>
          <p className="fl-partners-intro">{copy.partners.body}</p>
          <div className="fl-partner-grid">
            <article className="fl-partner-card fl-partner-brand">
              <span className="fl-partner-icon">
                <Megaphone size={34} />
              </span>
              <p className="fl-partner-label">{copy.partners.brandLabel}</p>
              <h3>{copy.partners.brandTitle}</h3>
              <p>{copy.partners.brandBody}</p>
              <Link className="fl-text-link" href={accountUrl("brand")}>
                {copy.partners.brandCta}
                <ArrowUpRight size={21} />
              </Link>
            </article>
            <article className="fl-partner-card fl-partner-agency">
              <span className="fl-partner-icon">
                <Users size={34} />
              </span>
              <p className="fl-partner-label">{copy.partners.agencyLabel}</p>
              <h3>{copy.partners.agencyTitle}</h3>
              <p>{copy.partners.agencyBody}</p>
              <Link className="fl-text-link" href={accountUrl("agency")}>
                {copy.partners.agencyCta}
                <ArrowUpRight size={21} />
              </Link>
            </article>
          </div>
        </section>

        <section className="fl-faq fl-container" aria-labelledby="fl-faq-title">
          <h2 id="fl-faq-title">{copy.faq.title}</h2>
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

        <section className="fl-container fl-final-wrap">
          <div className="fl-final">
            <Sparkles size={35} />
            <h2>{copy.final.title}</h2>
            <p>{copy.final.body}</p>
            <Link className="fl-button fl-button-white" href={accountUrl()}>
              {copy.final.button}
              <ArrowUpRight size={19} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="fl-footer fl-container">
        <div>
          <Logo footer />
          <p>{copy.footer.tagline}</p>
        </div>
        <nav aria-label={copy.footer.home}>
          <Link href={`/?lang=${locale}`}>{copy.footer.home}</Link>
          <Link href={loginUrl}>{copy.footer.login}</Link>
          <Link href={accountUrl()}>{copy.footer.register}</Link>
        </nav>
        <p className="fl-footer-note">{copy.footer.prototype}</p>
        <p className="fl-copyright">
          © {new Date().getFullYear()} Futures Medialab
        </p>
      </footer>

      <dialog
        ref={dialogRef}
        className="fl-concept-dialog"
        aria-labelledby="fl-concept-title"
        onClose={() => setSelectedCampaign(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="fl-dialog-body">
          <button
            type="button"
            className="fl-icon-button fl-dialog-close"
            aria-label={copy.discovery.close}
            onClick={() => dialogRef.current?.close()}
          >
            <X />
          </button>
          {selectedCampaign !== null && (
            <>
              <p className="fl-eyebrow">{copy.discovery.sampleLabel}</p>
              <h2 id="fl-concept-title">
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
              <p className="fl-dialog-note">{copy.discovery.notReal}</p>
              <Link href={loginUrl} className="fl-button">
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
