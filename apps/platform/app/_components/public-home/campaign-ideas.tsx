"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Button,
  ContentBadge,
  Modal,
  ModalContainer,
  ModalContent,
  ModalNavigation,
  ModalNavigationButton,
  ModalTrigger,
  Tab,
  TabList,
  TabListItem,
  TabPanel,
  Typography,
} from "@montage-ui/core";
import { IconArrowRight, IconCheck } from "@montage-ui/icon";
import type { HomeCopy } from "./copy";
import type { Locale } from "../landing-copy";
import styles from "./public-home.module.css";

const artwork = ["mmorpg", "subculture", "survival"];
const channels = [
  "YouTube · Twitch",
  "YouTube · TikTok",
  "YouTube · Instagram",
];

export function CampaignIdeas({ t, locale }: { t: HomeCopy; locale: Locale }) {
  const [category, setCategory] = useState("all");
  const filters = [
    { value: "all", label: t.discovery.all },
    ...t.campaigns.map((item, i) => ({ value: String(i), label: item.genre })),
  ];
  return (
    <section
      id="campaigns"
      className={`${styles.container} ${styles.section}`}
      aria-labelledby="campaigns-title"
    >
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>{t.discovery.eyebrow}</p>
          <Typography
            as="h2"
            variant="title1"
            weight="bold"
            id="campaigns-title"
            className={styles.sectionTitle}
          >
            {t.discovery.title}
          </Typography>
          <p className={styles.sectionBody}>{t.discovery.body}</p>
        </div>
      </div>
      <Tab
        value={category}
        onValueChange={setCategory}
        disableScrollMoveOnChange
      >
        <TabList
          size="medium"
          horizontalPadding={false}
          className={styles.tabs}
          aria-label={t.nav.explore}
        >
          {filters.map((filter) => (
            <TabListItem key={filter.value} value={filter.value}>
              {filter.label}
            </TabListItem>
          ))}
        </TabList>
        {filters.map((filter) => (
          <TabPanel key={filter.value} value={filter.value}>
            <div className={styles.campaignGrid}>
              {t.campaigns.map(
                (campaign, index) =>
                  (filter.value === "all" ||
                    filter.value === String(index)) && (
                    <Modal key={artwork[index]}>
                      <article className={styles.campaignCard}>
                        <ModalTrigger>
                          <button
                            className={styles.campaignTrigger}
                            type="button"
                            aria-label={`${campaign.title} — ${t.discovery.action}`}
                          >
                            <div className={styles.campaignImage}>
                              <Image
                                src={`/campaign-art/${artwork[index]}.webp`}
                                alt=""
                                width={1536}
                                height={1024}
                                sizes="(max-width: 600px) 90vw, (max-width: 900px) 45vw, 360px"
                              />
                              <span className={styles.imageBadge}>
                                {t.discovery.concept}
                              </span>
                            </div>
                            <div className={styles.campaignCopy}>
                              <ContentBadge size="small" color="neutral">
                                {campaign.genre}
                              </ContentBadge>
                              <Typography
                                as="h3"
                                variant="title3"
                                weight="bold"
                              >
                                {campaign.title}
                              </Typography>
                              <p>{campaign.body}</p>
                              <span className={styles.cardAction}>
                                {t.discovery.action}
                                <IconArrowRight aria-hidden="true" />
                              </span>
                            </div>
                          </button>
                        </ModalTrigger>
                      </article>
                      <ModalContainer
                        size="large"
                        className={styles.conceptModal}
                        aria-labelledby={`concept-${index}`}
                        aria-describedby={`concept-note-${index}`}
                      >
                        <ModalNavigation
                          trailingContent={
                            <ModalNavigationButton
                              variant="close-button"
                              aria-label={t.discovery.close}
                            />
                          }
                        >
                          <span id={`concept-${index}`}>{campaign.title}</span>
                        </ModalNavigation>
                        <ModalContent verticalPadding="bottom-only" gap={20}>
                          <Image
                            className={styles.modalImage}
                            src={`/campaign-art/${artwork[index]}.webp`}
                            alt=""
                            width={1536}
                            height={1024}
                            sizes="(max-width: 600px) 90vw, 520px"
                          />
                          <div>
                            <ContentBadge
                              size="small"
                              color="accent"
                              accentColor="semantic.foreground.brand.primary"
                            >
                              {t.discovery.concept}
                            </ContentBadge>
                          </div>
                          <Typography as="p" variant="body1">
                            {campaign.body}
                          </Typography>
                          <dl className={styles.conceptFacts}>
                            <div>
                              <dt>{t.discovery.platform}</dt>
                              <dd>{channels[index]}</dd>
                            </div>
                            <div>
                              <dt>{t.discovery.market}</dt>
                              <dd>{t.discovery.korea}</dd>
                            </div>
                          </dl>
                          <div>
                            <Typography
                              as="h3"
                              variant="headline1"
                              weight="bold"
                            >
                              {t.discovery.direction}
                            </Typography>
                            <ul className={styles.featureList}>
                              {campaign.ideas.map((idea) => (
                                <li key={idea}>
                                  <IconCheck aria-hidden="true" />
                                  {idea}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <p
                            className={styles.disclaimer}
                            id={`concept-note-${index}`}
                          >
                            {t.discovery.disclaimer}
                          </p>
                          <Button
                            as="a"
                            href={`/register?audience=buyer&lang=${locale}`}
                            size="large"
                            trailingContent={<IconArrowRight />}
                          >
                            {t.discovery.cta}
                          </Button>
                        </ModalContent>
                      </ModalContainer>
                    </Modal>
                  ),
              )}
            </div>
          </TabPanel>
        ))}
      </Tab>
      <p className={styles.disclaimer}>{t.discovery.disclaimer}</p>
    </section>
  );
}
