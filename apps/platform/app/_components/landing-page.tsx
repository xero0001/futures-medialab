"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronDown,
  Compass,
  FileCheck2,
  Gamepad2,
  Globe2,
  Languages,
  Menu,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { landingCopy, type Locale } from "./landing-copy";
import {
  BrandSymbol,
  CampaignPreview,
  ConnectionVisual,
  Wordmark,
} from "./landing-visuals";
import { BriefDialog } from "./brief-dialog";

export function LandingPage({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePath, setActivePath] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const eligibilityRef = useRef<HTMLDetailsElement>(null);
  const t = landingCopy[locale];

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

  function handleTabKey(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
    setActivePath(next);
    document.getElementById(`path-tab-${next}`)?.focus();
  }

  const capabilityIcons = [Compass, Languages, UsersRound, FileCheck2];
  const navLinks = [
    { id: "solutions", text: t.nav.solutions },
    { id: "process", text: t.nav.process },
    { id: "partners", text: t.nav.partners },
  ];

  return (
    <div className="fm-site" id="top" lang={locale === "zh" ? "zh-CN" : locale}>
      <header className="fm-header">
        <div className="fm-shell fm-nav">
          <Wordmark />
          <nav className="fm-desktop-nav" aria-label={t.nav.menu}>
            {navLinks.map(({ id, text }) => (
              <a href={`#${id}`} key={id}>
                {text}
              </a>
            ))}
          </nav>
          <div className="fm-nav-actions">
            <label className="fm-language">
              <Globe2 size={15} />
              <select
                aria-label={t.nav.language}
                value={locale}
                onChange={(e) => changeLocale(e.target.value as Locale)}
              >
                <option value="en">EN</option>
                <option value="ko">한국어</option>
                <option value="zh">中文</option>
              </select>
              <ChevronDown size={12} />
            </label>
            <button className="fm-button fm-button-nav" onClick={openBrief}>
              {t.nav.cta}
              <ArrowUpRight size={16} />
            </button>
            <button
              ref={menuToggleRef}
              className="fm-menu-toggle fm-icon-button"
              aria-label={menuOpen ? t.nav.close : t.nav.menu}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={23} /> : <Menu size={23} />}
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
                <ArrowUpRight size={18} />
              </a>
            ))}
            <button onClick={openBrief}>
              {t.nav.cta}
              <ArrowUpRight size={18} />
            </button>
          </nav>
        )}
      </header>

      <main>
        <section className="fm-hero" aria-labelledby="hero-title">
          <div className="fm-hero-wash" />
          <div className="fm-shell fm-hero-grid">
            <div className="fm-hero-copy">
              <p className="fm-eyebrow">
                <span className="fm-eyebrow-dot" />
                {t.hero.eyebrow}
              </p>
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
                  <ArrowUpRight size={18} />
                </button>
                <a className="fm-text-link" href="#partners">
                  {t.hero.secondary}
                  <ArrowRight size={17} />
                </a>
              </div>
              <p className="fm-hero-caption">{t.hero.caption}</p>
            </div>
            <ConnectionVisual copy={t.hero} />
          </div>
          <div className="fm-shell fm-hero-baseline">
            <div>
              {t.hero.footnotes.map((text, index) => (
                <span key={text}>
                  <span className="fm-small-index">0{index + 1}</span>
                  {text}
                </span>
              ))}
            </div>
            <a href="#solutions" aria-label={t.nav.solutions}>
              <ArrowDown size={20} />
            </a>
          </div>
        </section>

        <section
          className="fm-section fm-services"
          id="solutions"
          aria-labelledby="solutions-title"
        >
          <div className="fm-shell">
            <div className="fm-section-intro">
              <div>
                <p className="fm-eyebrow">{t.intro.eyebrow}</p>
                <h2 id="solutions-title">{t.intro.title}</h2>
              </div>
              <p className="fm-section-description">{t.intro.description}</p>
            </div>
            <div className="fm-capabilities">
              {t.capabilities.map((capability, index) => {
                const Icon = capabilityIcons[index]!;
                return (
                  <article className="fm-capability" key={capability.title}>
                    <div className="fm-capability-top">
                      <Icon size={27} strokeWidth={1.5} />
                      <span>0{index + 1}</span>
                    </div>
                    <h3>{capability.title}</h3>
                    <p>{capability.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="fm-section fm-paths" aria-labelledby="paths-title">
          <div className="fm-shell">
            <div className="fm-center-heading">
              <p className="fm-eyebrow">{t.paths.eyebrow}</p>
              <h2 id="paths-title">{t.paths.title}</h2>
              <p>{t.paths.description}</p>
            </div>
            <div
              className="fm-path-tabs"
              role="tablist"
              aria-label={t.paths.title}
            >
              {[t.paths.managed, t.paths.marketplace].map((label, index) => (
                <button
                  key={label}
                  id={`path-tab-${index}`}
                  role="tab"
                  aria-selected={activePath === index}
                  aria-controls="path-panel"
                  tabIndex={activePath === index ? 0 : -1}
                  onKeyDown={(event) => handleTabKey(event, index)}
                  onClick={() => setActivePath(index)}
                >
                  {index === 0 ? (
                    <Compass size={17} />
                  ) : (
                    <UsersRound size={17} />
                  )}
                  {label}
                </button>
              ))}
            </div>
            <div
              className="fm-path-panel"
              id="path-panel"
              role="tabpanel"
              aria-labelledby={`path-tab-${activePath}`}
              tabIndex={0}
            >
              <div className="fm-path-copy">
                <span className="fm-section-number">
                  0{activePath + 1} /{" "}
                  {activePath === 0 ? t.paths.managed : t.paths.marketplace}
                </span>
                <h3>
                  {activePath === 0
                    ? t.paths.managedTitle
                    : t.paths.marketplaceTitle}
                </h3>
                <p>
                  {activePath === 0
                    ? t.paths.managedDescription
                    : t.paths.marketplaceDescription}
                </p>
                <ul className="fm-check-list">
                  {(activePath === 0
                    ? t.paths.managedPoints
                    : t.paths.marketplacePoints
                  ).map((point) => (
                    <li key={point}>
                      <Check size={16} />
                      {point}
                    </li>
                  ))}
                </ul>
                {activePath === 0 ? (
                  <button className="fm-text-link" onClick={openBrief}>
                    {t.paths.managedCta}
                    <ArrowUpRight size={18} />
                  </button>
                ) : (
                  <a className="fm-text-link" href="#partners">
                    {t.paths.marketplaceCta}
                    <ArrowUpRight size={18} />
                  </a>
                )}
              </div>
              <CampaignPreview copy={t.paths} active={activePath} />
            </div>
          </div>
        </section>

        <section className="fm-local" aria-labelledby="local-title">
          <div className="fm-shell fm-local-grid">
            <div className="fm-local-copy">
              <p className="fm-eyebrow">{t.local.eyebrow}</p>
              <h2 id="local-title">{t.local.title}</h2>
              <p>{t.local.description}</p>
              <div className="fm-local-points">
                {t.local.points.map((point, index) => (
                  <div key={point.title}>
                    <span>0{index + 1}</span>
                    <div>
                      <h3>{point.title}</h3>
                      <p>{point.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="fm-local-art">
              <div className="fm-local-orbit" />
              <span className="fm-local-art-label">
                {t.local.from}
                <ArrowRight size={15} />
                {t.local.to}
              </span>
              <div className="fm-translation-source">
                <Languages size={20} />
                <span>{t.local.originalLabel}</span>
                <p>{t.local.originalText}</p>
              </div>
              <div className="fm-translation-arrow">
                <ArrowDown size={24} />
              </div>
              <div className="fm-translation-result">
                <div>
                  <span>{t.local.adaptedLabel}</span>
                  <span>KO</span>
                </div>
                <p lang="ko">{t.local.adaptedText}</p>
                <AudioLines size={32} strokeWidth={1.3} />
              </div>
              <p className="fm-local-note">{t.local.note}</p>
            </div>
          </div>
        </section>

        <section
          className="fm-section fm-process"
          id="process"
          aria-labelledby="process-title"
        >
          <div className="fm-shell">
            <div className="fm-section-intro">
              <div>
                <p className="fm-eyebrow">{t.process.eyebrow}</p>
                <h2 id="process-title">{t.process.title}</h2>
              </div>
              <p className="fm-section-description">{t.process.description}</p>
            </div>
            <ol className="fm-steps">
              {t.process.steps.map((step, index) => (
                <li key={step.title}>
                  <div className="fm-step-track">
                    <span>0{index + 1}</span>
                    <ArrowRight size={19} />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="fm-section fm-partners"
          id="partners"
          aria-labelledby="partners-title"
        >
          <div className="fm-shell">
            <div className="fm-center-heading">
              <p className="fm-eyebrow">{t.partners.eyebrow}</p>
              <h2 id="partners-title">{t.partners.title}</h2>
            </div>
            <div className="fm-partner-grid">
              <article className="fm-partner-panel fm-partner-brand">
                <span className="fm-partner-icon">
                  <Gamepad2 size={28} strokeWidth={1.5} />
                </span>
                <h3>{t.partners.brandTitle}</h3>
                <p>{t.partners.brandDescription}</p>
                <ul className="fm-check-list">
                  {t.partners.brandPoints.map((point) => (
                    <li key={point}>
                      <Check size={16} />
                      {point}
                    </li>
                  ))}
                </ul>
                <button className="fm-text-link" onClick={openBrief}>
                  {t.partners.brandCta}
                  <ArrowUpRight size={18} />
                </button>
              </article>
              <article className="fm-partner-panel fm-partner-agency">
                <span className="fm-partner-icon">
                  <UsersRound size={28} strokeWidth={1.5} />
                </span>
                <h3>{t.partners.agencyTitle}</h3>
                <p>{t.partners.agencyDescription}</p>
                <ul className="fm-check-list">
                  {t.partners.agencyPoints.map((point) => (
                    <li key={point}>
                      <Check size={16} />
                      {point}
                    </li>
                  ))}
                </ul>
                <button
                  className="fm-text-link"
                  onClick={() => {
                    if (eligibilityRef.current) {
                      eligibilityRef.current.open = true;
                      eligibilityRef.current.scrollIntoView({
                        block: "center",
                        behavior: window.matchMedia(
                          "(prefers-reduced-motion: reduce)",
                        ).matches
                          ? "instant"
                          : "smooth",
                      });
                      eligibilityRef.current.querySelector("summary")?.focus();
                    }
                  }}
                >
                  {t.partners.agencyCta}
                  <ArrowUpRight size={18} />
                </button>
              </article>
            </div>
            <details className="fm-eligibility" ref={eligibilityRef}>
              <summary>
                <ShieldCheck size={18} />
                <span>{t.partners.eligibilityTitle}</span>
                <ChevronDown size={18} />
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
        </section>

        <section
          className="fm-section fm-faq"
          id="faq"
          aria-labelledby="faq-title"
        >
          <div className="fm-shell fm-faq-grid">
            <div>
              <p className="fm-eyebrow">{t.faq.eyebrow}</p>
              <h2 id="faq-title">{t.faq.title}</h2>
            </div>
            <div className="fm-questions">
              {t.faq.items.map((item, index) => (
                <details key={index}>
                  <summary>
                    <span>{item.question}</span>
                    <span className="fm-plus" />
                  </summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section
          className="fm-contact"
          id="contact"
          aria-labelledby="contact-title"
        >
          <div className="fm-shell fm-contact-inner">
            <div>
              <p className="fm-eyebrow">{t.contact.eyebrow}</p>
              <h2 id="contact-title">{t.contact.title}</h2>
              <p>{t.contact.description}</p>
            </div>
            <div>
              <button className="fm-button fm-button-light" onClick={openBrief}>
                {t.contact.cta}
                <ArrowUpRight size={19} />
              </button>
              <p className="fm-contact-note">{t.contact.note}</p>
            </div>
            <BrandSymbol className="fm-contact-symbol" />
          </div>
        </section>
      </main>

      <footer className="fm-footer">
        <div className="fm-shell">
          <div className="fm-footer-top">
            <div>
              <Wordmark footer />
              <p>{t.footer.tagline}</p>
            </div>
            <div className="fm-footer-links">
              <span>{t.footer.services}</span>
              <a href="#solutions">{t.nav.solutions}</a>
              <a href="#process">{t.nav.process}</a>
              <a href="#faq">{t.nav.faq}</a>
            </div>
            <div className="fm-footer-links">
              <span>{t.footer.partners}</span>
              <a href="#partners">{t.partners.brandTitle}</a>
              <a href="#partners">{t.partners.agencyTitle}</a>
            </div>
            <div className="fm-footer-links">
              <span>{t.footer.language}</span>
              {(
                [
                  ["en", "English"],
                  ["ko", "한국어"],
                  ["zh", "简体中文"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  lang={value}
                  aria-pressed={locale === value}
                  onClick={() => changeLocale(value)}
                >
                  {label}
                  {locale === value && <span className="fm-language-dot" />}
                </button>
              ))}
            </div>
          </div>
          <div className="fm-footer-bottom">
            <span>
              © {new Date().getFullYear()} Futures Medialab.{" "}
              {t.footer.copyright}
            </span>
            <a href="#top">
              {t.footer.backTop}
              <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
      </footer>
      <BriefDialog copy={t.brief} locale={locale} dialogRef={dialogRef} />
    </div>
  );
}
