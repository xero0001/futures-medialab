"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import {
  Button,
  Card,
  CardBody,
  CardCaption,
  CardThumbnail,
  CardThumbnailContent,
  CardTitle,
  ContentBadge,
  IconButton,
  Modal,
  ModalContainer,
  ModalContent,
  ModalNavigation,
  ModalNavigationButton,
  ModalTrigger,
  PaginationDots,
  Typography,
} from "@montage-ui/core";
import {
  IconArrowRight,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconPause,
  IconPlay,
} from "@montage-ui/icon";
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
  const sectionRef = useRef<HTMLElement>(null);
  const [viewportRef, carousel] = useEmblaCarousel({ align: "start" });
  const [selectedPage, setSelectedPage] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
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

  useEffect(() => {
    if (!carousel) return;
    const update = () => {
      setSelectedPage(carousel.selectedScrollSnap());
      setPageCount(carousel.scrollSnapList().length);
    };
    const onPointerDown = () => setDragging(true);
    const onPointerUp = () => setDragging(false);
    update();
    carousel.on("select", update).on("reInit", update);
    carousel.on("pointerDown", onPointerDown).on("pointerUp", onPointerUp);
    return () => {
      carousel.off("select", update).off("reInit", update);
      carousel.off("pointerDown", onPointerDown).off("pointerUp", onPointerUp);
    };
  }, [carousel]);

  useEffect(() => {
    if (
      !carousel ||
      pageCount < 2 ||
      !autoplay ||
      reducedMotion ||
      hovered ||
      focused ||
      dragging ||
      modalOpen ||
      !inView ||
      !pageVisible
    )
      return;
    const timer = window.setTimeout(() => {
      if (carousel.canScrollNext()) carousel.scrollNext();
      else carousel.scrollTo(0);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [
    carousel,
    pageCount,
    selectedPage,
    autoplay,
    reducedMotion,
    hovered,
    focused,
    dragging,
    modalOpen,
    inView,
    pageVisible,
  ]);

  function move(direction: "previous" | "next") {
    if (!carousel) return;
    if (direction === "next") {
      if (carousel.canScrollNext()) carousel.scrollNext(reducedMotion);
      else carousel.scrollTo(0, reducedMotion);
    } else {
      if (carousel.canScrollPrev()) carousel.scrollPrev(reducedMotion);
      else carousel.scrollTo(pageCount - 1, reducedMotion);
    }
  }

  return (
    <section
      ref={sectionRef}
      id="campaigns"
      className={`${styles.container} ${styles.section}`}
      aria-labelledby="campaigns-title"
      aria-roledescription={t.discovery.carousel}
    >
      <div className={styles.sectionHeading}>
        <Typography as="h2" variant="title1" weight="bold" id="campaigns-title">
          {t.discovery.title}
        </Typography>
      </div>
      <div
        ref={viewportRef}
        id="campaign-carousel"
        className={styles.campaignViewport}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setFocused(false);
        }}
        onKeyDown={(event) => {
          if (modalOpen) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            move(event.key === "ArrowLeft" ? "previous" : "next");
          }
        }}
      >
        <div className={styles.campaignTrack}>
          {t.campaigns.map((campaign, index) => (
            <div
              key={artwork[index]}
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
                      src={`/campaign-art/${artwork[index]}.webp`}
                      alt=""
                      leadingContent={
                        <CardThumbnailContent variant="text">
                          {t.discovery.concept}
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
            </div>
          ))}
        </div>
      </div>
      {pageCount > 1 && (
        <div className={styles.campaignControls}>
          <PaginationDots
            totalPages={pageCount}
            currentPage={selectedPage + 1}
            onClickDot={(page) => carousel?.scrollTo(page - 1, reducedMotion)}
            aria-label={t.discovery.pagination}
          />
          <div className={styles.campaignNavigation}>
            {!reducedMotion && (
              <IconButton
                size="large"
                aria-label={autoplay ? t.discovery.pause : t.discovery.play}
                aria-controls="campaign-carousel"
                onClick={() => setAutoplay(!autoplay)}
              >
                {autoplay ? <IconPause /> : <IconPlay />}
              </IconButton>
            )}
            <IconButton
              size="large"
              aria-label={t.discovery.previous}
              aria-controls="campaign-carousel"
              onClick={() => move("previous")}
            >
              <IconChevronLeft />
            </IconButton>
            <IconButton
              size="large"
              aria-label={t.discovery.next}
              aria-controls="campaign-carousel"
              onClick={() => move("next")}
            >
              <IconChevronRight />
            </IconButton>
          </div>
        </div>
      )}
      <p className={styles.disclaimer}>{t.discovery.disclaimer}</p>
    </section>
  );
}
