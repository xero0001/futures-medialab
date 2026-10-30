"use client";

import { useEffect, useState } from "react";
import { Button, TextButton, Typography } from "@montage-ui/core";
import {
  IconArrowRight,
  IconDocumentText,
  IconGlobe,
  IconPersons,
} from "@montage-ui/icon";
import { Wordmark } from "../brand-logo";
import { LanguageSwitcher } from "../language-switcher";
import type { Locale } from "../landing-copy";
import { WorkspaceProvider } from "../workspace/workspace-provider";
import { homeCopy } from "./copy";
import styles from "./public-home.module.css";

const capabilityIcons = [IconDocumentText, IconGlobe, IconPersons];

export function PublicHome({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState(initialLocale);
  const t = homeCopy[locale];
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
    document.title = homeCopy[locale].title;
  }, [locale]);
  function changeLocale(next: Locale) {
    setLocale(next);
    document.cookie = `fm-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
  }
  return (
    <WorkspaceProvider>
      <div className={styles.page} lang={locale === "zh" ? "zh-CN" : locale}>
        <a className={styles.skip} href="#main-content">
          {t.skip}
        </a>
        <header className={styles.header}>
          <div className={`${styles.container} ${styles.headerInner}`}>
            <div className={styles.brand}>
              <Wordmark href={`/?lang=${locale}`} />
            </div>
            <nav className={styles.navigation} aria-label={t.services}>
              <TextButton
                as="a"
                href="#services"
                color="assistive"
                size="small"
              >
                {t.services}
              </TextButton>
              <TextButton as="a" href="#contact" color="assistive" size="small">
                {t.contact}
              </TextButton>
            </nav>
            <div className={styles.headerActions}>
              <LanguageSwitcher
                className={styles.language}
                locale={locale}
                label={t.language}
                onChange={changeLocale}
              />
              <Button
                as="a"
                href={`/login?lang=${locale}`}
                variant="outlined"
                color="assistive"
                size="small"
                className={styles.login}
              >
                {t.login}
              </Button>
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <section
            className={`${styles.container} ${styles.hero}`}
            aria-labelledby="home-title"
          >
            <Typography
              as="p"
              variant="label1"
              weight="medium"
              className={styles.eyebrow}
            >
              {t.eyebrow}
            </Typography>
            <Typography
              as="h1"
              variant="display1"
              weight="bold"
              id="home-title"
              className={styles.headline}
            >
              {t.headline[0]}
              <br />
              <span>{t.headline[1]}</span>
            </Typography>
            <div className={styles.introduction}>
              <Typography as="p" variant="body1">
                {t.introduction}
              </Typography>
              <Typography as="p" variant="body1">
                {t.body}
              </Typography>
            </div>
            <div className={styles.actions}>
              <Button
                as="a"
                href={`/register?audience=buyer&lang=${locale}`}
                size="large"
                trailingContent={<IconArrowRight />}
                className={styles.cta}
              >
                {t.buyer}
              </Button>
              <Button
                as="a"
                href={`/register/agency?lang=${locale}`}
                variant="outlined"
                color="assistive"
                size="large"
                className={styles.cta}
              >
                {t.partner}
              </Button>
            </div>
            <Typography as="p" variant="caption1" className={styles.approval}>
              {t.approval}
            </Typography>
          </section>
          <section
            id="services"
            className={`${styles.container} ${styles.services}`}
            aria-labelledby="services-title"
          >
            <Typography
              as="h2"
              variant="title3"
              weight="bold"
              id="services-title"
            >
              {t.servicesTitle}
            </Typography>
            <div className={styles.capabilities}>
              {t.capabilities.map((item, index) => {
                const Icon = capabilityIcons[index]!;
                return (
                  <article key={index} className={styles.capability}>
                    <Icon className={styles.serviceIcon} aria-hidden="true" />
                    <Typography as="h3" variant="headline1" weight="bold">
                      {item.title}
                    </Typography>
                    <Typography as="p" variant="body2">
                      {item.body}
                    </Typography>
                  </article>
                );
              })}
            </div>
          </section>
          <section
            id="contact"
            className={`${styles.container} ${styles.contact}`}
            aria-labelledby="contact-title"
          >
            <div className={styles.contactCopy}>
              <Typography
                as="h2"
                variant="title3"
                weight="bold"
                id="contact-title"
              >
                {t.contactTitle}
              </Typography>
              <Typography as="p" variant="body2">
                {t.contactBody}
              </Typography>
            </div>
            <dl className={styles.contactDetails}>
              <div>
                <dt>{t.email}</dt>
                <dd>{t.emailPlaceholder}</dd>
              </div>
              <div>
                <dt>WeChat</dt>
                <dd>{t.wechatPlaceholder}</dd>
              </div>
            </dl>
          </section>
        </main>
        <footer className={`${styles.container} ${styles.footer}`}>
          <Typography as="p" variant="caption1">
            © Futures Medialab
          </Typography>
          <Typography as="p" variant="caption1">
            {t.footer}
          </Typography>
        </footer>
      </div>
    </WorkspaceProvider>
  );
}
