"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import {
  Button,
  Card,
  CardBody,
  CardCaption,
  CardThumbnail,
  CardThumbnailContent,
  CardTitle,
  ContentBadge,
  Modal,
  ModalContainer,
  ModalContent,
  ModalNavigation,
  ModalNavigationButton,
  ModalTrigger,
  Typography,
} from "@montage-ui/core";
import { IconArrowRight, IconCheck } from "@montage-ui/icon";
import type { HomeCopy } from "./copy";
import type { Locale } from "../landing-copy";
import styles from "./public-home.module.css";

const campaignAssets: Record<
  string,
  { image: string; channels: string; officialUrl?: string }
> = {
  mmorpg: { image: "/campaign-art/mmorpg.webp", channels: "YouTube · CHZZK" },
  subculture: {
    image: "/campaign-art/subculture.webp",
    channels: "YouTube · TikTok",
  },
  survival: {
    image: "/campaign-art/survival.webp",
    channels: "YouTube · Instagram",
  },
  genshin: {
    image: "/campaign-art/games/genshin.webp",
    channels: "YouTube · CHZZK",
    officialUrl: "https://genshin.hoyoverse.com/ko/",
  },
  "star-rail": {
    image: "/campaign-art/games/star-rail.webp",
    channels: "YouTube · TikTok",
    officialUrl: "https://hsr.hoyoverse.com/ko-kr/",
  },
  "wuthering-waves": {
    image: "/campaign-art/games/wuthering-waves.webp",
    channels: "YouTube · CHZZK",
    officialUrl: "https://wutheringwaves.kurogames.com/kr/main/",
  },
  zenless: {
    image: "/campaign-art/games/zenless.webp",
    channels: "YouTube · TikTok",
    officialUrl: "https://zenless.hoyoverse.com/ko-kr/main",
  },
  nte: {
    image: "/demo/nte/city-key-art.jpg",
    channels: "YouTube · CHZZK",
    officialUrl: "https://nte.perfectworld.com/kr/",
  },
};

export function CampaignIdeas({ t, locale }: { t: HomeCopy; locale: Locale }) {
  const sectionRef = useRef<HTMLElement>(null);
  const autoScroll = useMemo(
    () =>
      AutoScroll({
        direction: "forward",
        speed: 0.6,
        startDelay: 0,
        playOnInit: false,
        stopOnInteraction: true,
        stopOnFocusIn: false,
      }),
    [],
  );
  const [viewportRef, carousel] = useEmblaCarousel(
    { align: "start", loop: true, dragFree: true },
    [autoScroll],
  );
  const dragging = useRef(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(motion.matches);
    const updateVisibility = () => setPageVisible(!document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { threshold: 0.2 },
    );
    updateMotion();
    updateVisibility();
    motion.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  const paused =
    reducedMotion || hovered || focused || modalOpen || !inView || !pageVisible;
  useEffect(() => {
    if (!carousel) return;
    const sync = () => {
      if (paused || dragging.current) autoScroll.stop();
      else autoScroll.play();
    };
    const onPointerDown = () => {
      dragging.current = true;
      autoScroll.stop();
    };
    const onPointerUp = () => {
      dragging.current = false;
      sync();
    };
    sync();
    carousel
      .on("reInit", sync)
      .on("pointerDown", onPointerDown)
      .on("pointerUp", onPointerUp);
    return () => {
      autoScroll.stop();
      carousel
        .off("reInit", sync)
        .off("pointerDown", onPointerDown)
        .off("pointerUp", onPointerUp);
    };
  }, [carousel, autoScroll, paused]);

  return (
    <section
      ref={sectionRef}
      id="campaigns"
      className={`${styles.container} ${styles.section}`}
      aria-labelledby="campaigns-title"
      aria-roledescription={t.discovery.carousel}
    >
      <div className={styles.sectionHeading}>
        <Typography as="h2" variant="title2" weight="bold" id="campaigns-title">
          {t.discovery.title}
        </Typography>
      </div>
      <div
        ref={viewportRef}
        id="campaign-carousel"
        className={styles.campaignViewport}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={(event) =>
          setFocused(event.target.matches(":focus-visible"))
        }
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setFocused(false);
        }}
      >
        <div className={styles.campaignTrack}>
          {t.campaigns.map((campaign, index) => {
            const asset = campaignAssets[campaign.id]!;
            return (
              <div
                key={campaign.id}
                className={styles.campaignSlide}
                role="group"
                aria-roledescription={t.discovery.slide}
                aria-label={`${index + 1} / ${t.campaigns.length}`}
              >
                <Modal onOpenChange={setModalOpen}>
                  <ModalTrigger>
                    <Card
                      as="button"
                      type="button"
                      platform="desktop"
                      xs={{ platform: "mobile" }}
                      sm={{ platform: "desktop" }}
                      className={styles.campaignCard}
                      aria-label={`${campaign.title} — ${t.discovery.action}`}
                    >
                      <CardThumbnail
                        src={asset.image}
                        alt=""
                        leadingContent={
                          <CardThumbnailContent variant="text">
                            {asset.officialUrl
                              ? t.discovery.spotlight
                              : t.discovery.concept}
                          </CardThumbnailContent>
                        }
                      />
                      <CardBody>
                        <CardTitle as="span">{campaign.title}</CardTitle>
                        <CardCaption as="span">{campaign.genre}</CardCaption>
                        <CardCaption as="span">{campaign.body}</CardCaption>
                      </CardBody>
                    </Card>
                  </ModalTrigger>
                  <ModalContainer
                    size="large"
                    className={styles.conceptModal}
                    aria-labelledby={`concept-${index}`}
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
                        src={asset.image}
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
                          {asset.officialUrl
                            ? t.discovery.spotlight
                            : t.discovery.concept}
                        </ContentBadge>
                      </div>
                      <Typography as="p" variant="body1">
                        {campaign.body}
                      </Typography>
                      <dl className={styles.conceptFacts}>
                        <div>
                          <dt>{t.discovery.platform}</dt>
                          <dd>{asset.channels}</dd>
                        </div>
                        <div>
                          <dt>{t.discovery.market}</dt>
                          <dd>{t.discovery.korea}</dd>
                        </div>
                      </dl>
                      <div>
                        <Typography as="h3" variant="headline1" weight="bold">
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
                      <Button
                        as="a"
                        href={
                          asset.officialUrl ??
                          `/register?audience=buyer&lang=${locale}`
                        }
                        target={asset.officialUrl ? "_blank" : undefined}
                        rel={
                          asset.officialUrl ? "noopener noreferrer" : undefined
                        }
                        size="large"
                        trailingContent={<IconArrowRight />}
                      >
                        {asset.officialUrl
                          ? t.discovery.official
                          : t.discovery.cta}
                      </Button>
                    </ModalContent>
                  </ModalContainer>
                </Modal>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
