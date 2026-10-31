"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  IconButton,
  TextButton,
  Typography,
} from "@montage-ui/core";
import {
  IconArrowRight,
  IconCheck,
  IconClose,
  IconDocumentText,
  IconGlobe,
  IconMegaphone,
  IconMenu,
  IconPersons,
} from "@montage-ui/icon";
import { Wordmark } from "../brand-logo";
import { LanguageSwitcher } from "../language-switcher";
import type { Locale } from "../landing-copy";
import { WorkspaceProvider } from "../workspace/workspace-provider";
import { CampaignIdeas } from "./campaign-ideas";
import { homeCopy } from "./copy";
import styles from "./public-home.module.css";

const stepIcons = [IconDocumentText, IconPersons, IconCheck];
const partnerIcons = [IconGlobe, IconMegaphone];

export function PublicHome({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState(initialLocale);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const t = homeCopy[locale];
  const buyerHref = `/register?audience=buyer&lang=${locale}`;
  const partnerHref = `/register/agency?lang=${locale}`;
  const destinations = [buyerHref, partnerHref];
  const nav = [
    { href: "#campaigns", label: t.nav.explore },
    { href: "#how-it-works", label: t.nav.how },
    { href: "#partners", label: t.nav.partners },
    { href: "#contact", label: t.nav.contact },
  ];
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
    document.title = homeCopy[locale].title;
  }, [locale]);
  function changeLocale(next: Locale) {
    setLocale(next);
    setMenuOpen(false);
    document.cookie = `fm-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
  }
  return (
    <WorkspaceProvider>
      <div className={styles.page} lang={locale === "zh" ? "zh-CN" : locale}>
        <a className={styles.skip} href="#main-content">
          {t.nav.skip}
        </a>
        <header
          className={styles.header}
          onKeyDown={(event) => {
            if (event.key === "Escape" && menuOpen) {
              setMenuOpen(false);
              menuButton.current?.focus();
            }
          }}
        >
          <div className={`${styles.container} ${styles.headerInner}`}>
            <div className={styles.brand}>
              <Wordmark href={`/?lang=${locale}`} />
            </div>
            <nav className={styles.navigation} aria-label={t.nav.menu}>
              {nav.map((item) => (
                <TextButton
                  key={item.href}
                  as="a"
                  href={item.href}
                  color="assistive"
                  size="small"
                >
                  {item.label}
                </TextButton>
              ))}
            </nav>
            <div className={styles.headerActions}>
              <LanguageSwitcher
                className={styles.language}
                locale={locale}
                label={t.nav.language}
                onChange={changeLocale}
              />
              <TextButton
                as="a"
                href={`/login?lang=${locale}`}
                color="assistive"
                size="small"
                className={styles.login}
              >
                {t.nav.login}
              </TextButton>
              <Button
                as="a"
                href={buyerHref}
                size="small"
                className={styles.headerJoin}
              >
                {t.nav.join}
              </Button>
              <IconButton
                ref={menuButton}
                className={styles.menuButton}
                size="xlarge"
                aria-label={menuOpen ? t.nav.close : t.nav.menu}
                aria-expanded={menuOpen}
                aria-controls="home-mobile-navigation"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                {menuOpen ? <IconClose /> : <IconMenu />}
              </IconButton>
            </div>
          </div>
          <nav
            id="home-mobile-navigation"
            className={styles.mobileNavigation}
            hidden={!menuOpen}
            aria-label={t.nav.menu}
          >
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <a href={`/login?lang=${locale}`}>{t.nav.login}</a>
            <Button as="a" href={buyerHref} size="medium">
              {t.nav.join}
            </Button>
          </nav>
        </header>
        <main id="main-content" tabIndex={-1}>
          <section className={styles.heroSurface} aria-labelledby="home-title">
            <div className={`${styles.container} ${styles.hero}`}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>{t.hero.eyebrow}</p>
                <Typography
                  as="h1"
                  variant="display1"
                  weight="bold"
                  id="home-title"
                  className={styles.headline}
                >
                  {t.hero.lines[0]}
                  <br />
                  <span>{t.hero.lines[1]}</span>
                </Typography>
                <p className={styles.heroBody}>{t.hero.body}</p>
                <div className={styles.actions}>
                  <Button
                    as="a"
                    href={buyerHref}
                    size="large"
                    trailingContent={<IconArrowRight />}
                  >
                    {t.hero.primary}
                  </Button>
                  <TextButton
                    as="a"
                    href={partnerHref}
                    size="medium"
                    color="assistive"
                    trailingContent={<IconArrowRight />}
                  >
                    {t.hero.secondary}
                  </TextButton>
                </div>
                <p className={styles.approval}>{t.hero.approval}</p>
              </div>
              <div className={styles.heroArt} aria-hidden="true">
                <Image
                  src="/landing/creator-world-montage.webp"
                  alt=""
                  width={1536}
                  height={1024}
                  sizes="(max-width: 760px) 100vw, 650px"
                  priority
                />
              </div>
            </div>
          </section>
          <div className={`${styles.container} ${styles.quickLinks}`}>
            {t.quick.map((item, index) => {
              const Icon = partnerIcons[index]!;
              return (
                <a
                  href={destinations[index]}
                  className={styles.quickLink}
                  key={index}
                >
                  <span className={styles.quickIcon}>
                    <Icon aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                  </span>
                  <IconArrowRight
                    className={styles.quickArrow}
                    aria-hidden="true"
                  />
                </a>
              );
            })}
          </div>
          <CampaignIdeas t={t} locale={locale} />
          <section
            id="how-it-works"
            className={styles.workflowSurface}
            aria-labelledby="workflow-title"
          >
            <div className={`${styles.container} ${styles.section}`}>
              <p className={styles.eyebrow}>{t.workflow.eyebrow}</p>
              <Typography
                as="h2"
                variant="title1"
                weight="bold"
                id="workflow-title"
                className={styles.sectionTitle}
              >
                {t.workflow.title}
              </Typography>
              <p className={styles.sectionBody}>{t.workflow.body}</p>
              <ol className={styles.steps}>
                {t.workflow.steps.map((step, i) => {
                  const Icon = stepIcons[i]!;
                  return (
                    <li key={i}>
                      <div className={styles.stepTop}>
                        <span className={styles.stepIcon}>
                          <Icon aria-hidden="true" />
                        </span>
                        <span className={styles.stepNumber}>0{i + 1}</span>
                      </div>
                      <Typography as="h3" variant="headline1" weight="bold">
                        {step.title}
                      </Typography>
                      <p>{step.body}</p>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
          <section
            id="partners"
            className={`${styles.container} ${styles.section}`}
            aria-labelledby="partners-title"
          >
            <p className={styles.eyebrow}>{t.partners.eyebrow}</p>
            <Typography
              as="h2"
              variant="title1"
              weight="bold"
              id="partners-title"
              className={styles.sectionTitle}
            >
              {t.partners.title}
            </Typography>
            <p className={styles.sectionBody}>{t.partners.body}</p>
            <div className={styles.partnerGrid}>
              {t.partners.items.map((partner, index) => {
                const Icon = partnerIcons[index]!;
                return (
                  <article key={index} className={styles.partnerCard}>
                    <div className={styles.partnerTop}>
                      <p className={styles.partnerLabel}>{partner.label}</p>
                      <Icon aria-hidden="true" />
                    </div>
                    <Typography
                      as="h3"
                      variant="title2"
                      weight="bold"
                      className={styles.partnerTitle}
                    >
                      {partner.title}
                    </Typography>
                    <p className={styles.partnerBody}>{partner.body}</p>
                    <ul className={styles.featureList}>
                      {partner.features.map((feature) => (
                        <li key={feature}>
                          <IconCheck aria-hidden="true" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      as="a"
                      href={destinations[index]}
                      size="large"
                      variant={index === 0 ? "solid" : "outlined"}
                      color={index === 0 ? "primary" : "assistive"}
                      trailingContent={<IconArrowRight />}
                    >
                      {partner.cta}
                    </Button>
                  </article>
                );
              })}
            </div>
          </section>
          <section
            className={`${styles.container} ${styles.faq}`}
            aria-labelledby="faq-title"
          >
            <div>
              <p className={styles.eyebrow}>{t.faq.eyebrow}</p>
              <Typography
                as="h2"
                variant="title1"
                weight="bold"
                id="faq-title"
                className={styles.sectionTitle}
              >
                {t.faq.title}
              </Typography>
              <p className={styles.sectionBody}>{t.faq.body}</p>
            </div>
            <div className={styles.faqList}>
              {t.faq.items.map((item, i) => (
                <Accordion key={i} divider className={styles.faqItem}>
                  <AccordionSummary
                    textProps={{ weight: "bold", variant: "body1" }}
                    verticalPadding="large"
                  >
                    {item.question}
                  </AccordionSummary>
                  <AccordionDetails>
                    <p className={styles.faqAnswer}>{item.answer}</p>
                  </AccordionDetails>
                </Accordion>
              ))}
            </div>
          </section>
          <section
            className={styles.finalSurface}
            aria-labelledby="final-title"
          >
            <div className={`${styles.container} ${styles.finalInner}`}>
              <div>
                <p className={styles.eyebrow}>{t.final.eyebrow}</p>
                <Typography
                  as="h2"
                  variant="title1"
                  weight="bold"
                  id="final-title"
                  className={styles.finalTitle}
                >
                  {t.final.title}
                </Typography>
                <p>{t.final.body}</p>
              </div>
              <Button
                as="a"
                href={buyerHref}
                size="large"
                color="assistive"
                className={styles.finalButton}
                trailingContent={<IconArrowRight />}
              >
                {t.final.cta}
              </Button>
            </div>
          </section>
          <section
            id="contact"
            className={`${styles.container} ${styles.contact}`}
            aria-labelledby="contact-title"
          >
            <div>
              <Typography
                as="h2"
                variant="title3"
                weight="bold"
                id="contact-title"
              >
                {t.contact.title}
              </Typography>
              <p>{t.contact.body}</p>
            </div>
            <dl>
              <div>
                <dt>{t.contact.email}</dt>
                <dd>{t.contact.emailPlaceholder}</dd>
              </div>
              <div>
                <dt>WeChat</dt>
                <dd>{t.contact.wechatPlaceholder}</dd>
              </div>
            </dl>
          </section>
        </main>
        <footer className={`${styles.container} ${styles.footer}`}>
          <div>
            <div className={styles.brand}>
              <Wordmark href={`/?lang=${locale}`} footer />
            </div>
            <p>{t.footer}</p>
          </div>
          <div className={styles.footerRight}>
            <nav aria-label={t.nav.contact}>
              <a href="#how-it-works">{t.nav.how}</a>
              <a href="#partners">{t.nav.partners}</a>
              <a href={`/login?lang=${locale}`}>{t.nav.login}</a>
            </nav>
            <small>© {new Date().getFullYear()} Futures Medialab</small>
          </div>
        </footer>
      </div>
    </WorkspaceProvider>
  );
}
