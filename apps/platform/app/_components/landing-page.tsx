"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Gamepad2,
  Globe2,
  Menu,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { landingCopy, type Locale } from "./landing-copy";
import {
  BrandSymbol,
  CampaignArtwork,
  ConnectionVisual,
  Wordmark,
} from "./landing-visuals";
import { BriefDialog } from "./brief-dialog";

export function LandingPage({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [menuOpen, setMenuOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const t = landingCopy[locale];
  const loginHref = `/login?lang=${locale}`;

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

  function openBrief() {
    if (menuOpen) menuToggleRef.current?.focus();
    setMenuOpen(false);
    dialogRef.current?.showModal();
  }

  const navLinks = [
    { id: "solutions", text: t.nav.solutions },
    { id: "partners", text: t.nav.partners },
    { id: "process", text: t.nav.process },
  ];

  return (
    <div className="fm-site" id="top" lang={locale === "zh" ? "zh-CN" : locale}>
      <header className="fm-header">
        <div className="fm-shell fm-nav">
          <Wordmark />
          <nav className="fm-desktop-nav" aria-label={t.nav.solutions}>
            {navLinks.map(({ id, text }) => (
              <a href={`#${id}`} key={id}>
                {text}
              </a>
            ))}
          </nav>
          <div className="fm-nav-actions">
            <label className="fm-language">
              <Globe2 size={18} />
              <select
                aria-label={t.nav.language}
                value={locale}
                onChange={(event) => changeLocale(event.target.value as Locale)}
              >
                <option value="en">EN</option>
                <option value="ko">한국어</option>
                <option value="zh">中文</option>
              </select>
              <ChevronDown size={16} />
            </label>
            <a className="fm-login-link" href={loginHref}>
              {t.nav.login}
            </a>
            <button
              ref={menuToggleRef}
              className="fm-menu-toggle fm-icon-button"
              aria-label={menuOpen ? t.nav.close : t.nav.menu}
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? "mobile-nav" : undefined}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            id="mobile-nav"
            className="fm-mobile-nav"
            aria-label={t.nav.menu}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setMenuOpen(false);
                menuToggleRef.current?.focus();
              }
            }}
          >
            {navLinks.map(({ id, text }) => (
              <a href={`#${id}`} key={id} onClick={() => setMenuOpen(false)}>
                {text}
                <ArrowUpRight size={20} />
              </a>
            ))}
            <a href={loginHref}>
              {t.nav.login}
              <ArrowUpRight size={20} />
            </a>
          </nav>
        )}
      </header>

      <main>
        <section className="fm-hero" aria-labelledby="hero-title">
          <div className="fm-hero-wash" />
          <div className="fm-shell fm-hero-grid">
            <div className="fm-hero-copy">
              <h1 id="hero-title">
                {t.hero.lineOne}
                <br />
                <span>{t.hero.lineTwo}</span>
              </h1>
              <p className="fm-hero-description">{t.hero.description}</p>
              <div className="fm-hero-actions">
                <button
                  className="fm-button fm-button-primary"
                  onClick={openBrief}
                >
                  {t.hero.primary}
                  <ArrowUpRight size={20} />
                </button>
                <a className="fm-text-link" href="#partners">
                  {t.hero.secondary}
                  <ArrowRight size={20} />
                </a>
              </div>
            </div>
            <ConnectionVisual copy={t.hero} />
          </div>
        </section>

        <section
          className="fm-section fm-managed"
          id="solutions"
          aria-labelledby="solutions-title"
        >
          <div className="fm-shell fm-feature-grid">
            <div className="fm-feature-copy">
              <h2 id="solutions-title">{t.paths.managedTitle}</h2>
              <p>{t.paths.managedDescription}</p>
              <ul className="fm-feature-points">
                {t.paths.managedPoints.map((point) => (
                  <li key={point}>
                    <Check size={21} />
                    {point}
                  </li>
                ))}
              </ul>
              <button className="fm-text-link" onClick={openBrief}>
                {t.paths.managedCta}
                <ArrowUpRight size={21} />
              </button>
            </div>
            <div className="fm-campaign-art">
              <CampaignArtwork />
            </div>
          </div>
        </section>

        <section
          className="fm-section fm-partner-section"
          id="partners"
          aria-labelledby="partners-title"
        >
          <div className="fm-shell fm-feature-grid fm-feature-grid-reverse">
            <div className="fm-partner-art" aria-hidden="true">
              <UsersRound size={104} strokeWidth={1.1} />
              <ArrowRight size={48} strokeWidth={1.3} />
              <Gamepad2 size={120} strokeWidth={1.1} />
            </div>
            <div className="fm-feature-copy">
              <h2 id="partners-title">{t.paths.marketplaceTitle}</h2>
              <p>{t.paths.marketplaceDescription}</p>
              <a className="fm-text-link" href={loginHref}>
                {t.nav.login}
                <ArrowUpRight size={21} />
              </a>
              <details className="fm-eligibility">
                <summary>
                  <ShieldCheck size={20} />
                  <span>{t.partners.eligibilityTitle}</span>
                  <ChevronDown size={20} />
                </summary>
                <div>
                  <p>{t.partners.eligibilityDescription}</p>
                  <ul>
                    {t.partners.eligibilityPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              </details>
            </div>
          </div>
        </section>

        <section
          className="fm-section fm-process"
          id="process"
          aria-labelledby="process-title"
        >
          <div className="fm-shell">
            <div className="fm-simple-heading">
              <h2 id="process-title">{t.process.title}</h2>
            </div>
            <ol className="fm-steps">
              {t.process.steps.map((step, index) => (
                <li key={step.title}>
                  <div className="fm-step-track">
                    <span>0{index + 1}</span>
                    <ArrowRight size={22} />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="fm-contact"
          id="contact"
          aria-labelledby="contact-title"
        >
          <div className="fm-shell fm-contact-inner">
            <h2 id="contact-title">{t.contact.title}</h2>
            <div>
              <button className="fm-button fm-button-light" onClick={openBrief}>
                {t.contact.cta}
                <ArrowUpRight size={21} />
              </button>
              <p className="fm-contact-note">{t.contact.note}</p>
            </div>
            <BrandSymbol className="fm-contact-symbol" />
          </div>
        </section>
      </main>

      <footer className="fm-footer">
        <div className="fm-shell">
          <div className="fm-footer-row">
            <Wordmark footer />
            <nav className="fm-footer-nav" aria-label={t.footer.services}>
              <a href="#solutions">{t.nav.solutions}</a>
              <a href="#partners">{t.nav.partners}</a>
              <a href={loginHref}>{t.nav.login}</a>
            </nav>
            <div className="fm-footer-locales">
              {(
                [
                  ["en", "English"],
                  ["ko", "한국어"],
                  ["zh", "中文"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  lang={value}
                  aria-pressed={locale === value}
                  onClick={() => changeLocale(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="fm-footer-bottom">
            <span>
              © {new Date().getFullYear()} Futures Medialab.{" "}
              {t.footer.copyright}
            </span>
          </div>
        </div>
      </footer>
      <BriefDialog copy={t.brief} locale={locale} dialogRef={dialogRef} />
    </div>
  );
}
